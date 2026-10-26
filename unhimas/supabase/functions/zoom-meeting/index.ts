/**
 * zoom-meeting — Supabase Edge Function
 *
 * Acts as a secure proxy to the Zoom API using Server-to-Server OAuth.
 * Your Zoom credentials live ONLY here (in Edge Function Secrets), never
 * in the frontend.
 *
 * Required Supabase Edge Function Secrets (set via Dashboard or CLI):
 *   ZOOM_ACCOUNT_ID     – from Zoom Marketplace > Your App > App Credentials
 *   ZOOM_CLIENT_ID      – from Zoom Marketplace > Your App > App Credentials
 *   ZOOM_CLIENT_SECRET  – from Zoom Marketplace > Your App > App Credentials
 *   ZOOM_USER_EMAIL     – the Zoom account email that will host the meetings
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const ZOOM_ACCOUNT_ID    = Deno.env.get('ZOOM_ACCOUNT_ID')    ?? '';
const ZOOM_CLIENT_ID     = Deno.env.get('ZOOM_CLIENT_ID')     ?? '';
const ZOOM_CLIENT_SECRET = Deno.env.get('ZOOM_CLIENT_SECRET') ?? '';
const ZOOM_USER_EMAIL    = Deno.env.get('ZOOM_USER_EMAIL')    ?? 'me';

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')             ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// ── helpers ──────────────────────────────────────────────────────────────────

function corsHeaders(origin?: string | null) {
  return {
    'Access-Control-Allow-Origin':  origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
  };
}

async function getZoomAccessToken(): Promise<string> {
  const credentials = btoa(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`);
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom OAuth failed (${res.status}): ${body}`);
  }
  const { access_token } = await res.json();
  return access_token as string;
}

// ── main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  // Only POST and DELETE are supported
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders(origin),
    });
  }

  // Verify the caller is an authenticated Supabase user
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Validate JWT
  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authError || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders(origin) });
  }

  try {
    const body = await req.json();

    // ── DELETE: remove a Zoom meeting ─────────────────────────────────────
    if (req.method === 'DELETE') {
      const { zoom_meeting_id, session_id } = body as {
        zoom_meeting_id: string;
        session_id: string;
      };

      if (!zoom_meeting_id || !session_id) {
        return new Response(JSON.stringify({ error: 'zoom_meeting_id and session_id are required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }

      const token = await getZoomAccessToken();
      const zoomRes = await fetch(`https://api.zoom.us/v2/meetings/${zoom_meeting_id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!zoomRes.ok && zoomRes.status !== 404) {
        const zoomErr = await zoomRes.text();
        throw new Error(`Zoom delete failed (${zoomRes.status}): ${zoomErr}`);
      }

      // Clear the meeting link from the DB
      const { error: dbErr } = await supabase
        .from('class_sessions')
        .update({ zoom_meeting_id: null, zoom_join_url: null, zoom_password: null })
        .eq('id', session_id);

      if (dbErr) throw dbErr;

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // ── POST: create a Zoom meeting ───────────────────────────────────────
    const {
      session_id,
      topic,
      scheduled_start,
      duration_minutes,
    } = body as {
      session_id: string;
      topic: string;
      scheduled_start: string; // ISO string
      duration_minutes: number;
    };

    if (!session_id || !scheduled_start) {
      return new Response(
        JSON.stringify({ error: 'session_id and scheduled_start are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } },
      );
    }

    const token = await getZoomAccessToken();

    const zoomPayload = {
      topic: topic || 'Online Class',
      type: 2, // Scheduled meeting
      start_time: scheduled_start,
      duration: duration_minutes || 60,
      timezone: 'UTC',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
        meeting_authentication: false,
        auto_recording: 'none',
      },
    };

    const zoomRes = await fetch(
      `https://api.zoom.us/v2/users/${encodeURIComponent(ZOOM_USER_EMAIL)}/meetings`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(zoomPayload),
      },
    );

    if (!zoomRes.ok) {
      const zoomErr = await zoomRes.text();
      throw new Error(`Zoom API error (${zoomRes.status}): ${zoomErr}`);
    }

    const meeting = await zoomRes.json() as {
      id: number;
      join_url: string;
      start_url: string;
      password: string;
    };

    // Persist the meeting details back to the class_session row
    const { error: dbErr } = await supabase
      .from('class_sessions')
      .update({
        zoom_meeting_id: String(meeting.id),
        zoom_join_url:   meeting.join_url,
        zoom_start_url:  meeting.start_url,
        zoom_password:   meeting.password ?? null,
      })
      .eq('id', session_id);

    if (dbErr) throw dbErr;

    return new Response(
      JSON.stringify({
        meeting_id:  meeting.id,
        join_url:    meeting.join_url,
        start_url:   meeting.start_url,
        password:    meeting.password,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[zoom-meeting]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
});
