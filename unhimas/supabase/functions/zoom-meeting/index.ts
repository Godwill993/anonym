/**
 * zoom-meeting — Supabase Edge Function
 *
 * Secure proxy to the Zoom API using Server-to-Server OAuth.
 * Credentials live ONLY here (Edge Function secrets), never in the frontend.
 *
 * Required secrets:
 *   ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_USER_EMAIL
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const ZOOM_ACCOUNT_ID = Deno.env.get('ZOOM_ACCOUNT_ID') ?? '';
const ZOOM_CLIENT_ID = Deno.env.get('ZOOM_CLIENT_ID') ?? '';
const ZOOM_CLIENT_SECRET = Deno.env.get('ZOOM_CLIENT_SECRET') ?? '';
const ZOOM_USER_EMAIL = Deno.env.get('ZOOM_USER_EMAIL') ?? '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function corsHeaders(origin?: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  };
}

function jsonResponse(body: unknown, status: number, origin?: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function assertZoomSecrets() {
  const missing: string[] = [];
  if (!ZOOM_ACCOUNT_ID) missing.push('ZOOM_ACCOUNT_ID');
  if (!ZOOM_CLIENT_ID) missing.push('ZOOM_CLIENT_ID');
  if (!ZOOM_CLIENT_SECRET) missing.push('ZOOM_CLIENT_SECRET');
  if (!ZOOM_USER_EMAIL) missing.push('ZOOM_USER_EMAIL');
  if (missing.length) {
    throw new Error(
      `Zoom is not configured on the server. Missing secrets: ${missing.join(', ')}. ` +
        'Set them in Supabase → Edge Functions → zoom-meeting → Secrets, then redeploy.',
    );
  }
}

async function getZoomAccessToken(): Promise<string> {
  assertZoomSecrets();
  const credentials = btoa(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`);
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ZOOM_ACCOUNT_ID)}`,
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
  if (!access_token) throw new Error('Zoom OAuth succeeded but no access_token was returned');
  return access_token as string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405, origin);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized — missing or invalid Authorization header' }, 401, origin);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(
      { error: 'Server misconfigured: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing' },
      500,
      origin,
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(jwt);
  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized — invalid session' }, 401, origin);
  }

  try {
    const body = await req.json();

    if (req.method === 'DELETE') {
      const { zoom_meeting_id, session_id } = body as {
        zoom_meeting_id?: string;
        session_id?: string;
      };

      if (!zoom_meeting_id || !session_id) {
        return jsonResponse(
          { error: 'zoom_meeting_id and session_id are required' },
          400,
          origin,
        );
      }

      const token = await getZoomAccessToken();
      const zoomRes = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(zoom_meeting_id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!zoomRes.ok && zoomRes.status !== 404) {
        const zoomErr = await zoomRes.text();
        throw new Error(`Zoom delete failed (${zoomRes.status}): ${zoomErr}`);
      }

      const { error: dbErr } = await supabase
        .from('class_sessions')
        .update({
          zoom_meeting_id: null,
          zoom_join_url: null,
          zoom_start_url: null,
          zoom_password: null,
        })
        .eq('id', session_id);

      if (dbErr) throw dbErr;

      return jsonResponse({ success: true }, 200, origin);
    }

    // POST — create meeting
    const {
      session_id,
      topic,
      scheduled_start,
      duration_minutes,
    } = body as {
      session_id?: string;
      topic?: string;
      scheduled_start?: string;
      duration_minutes?: number;
    };

    if (!session_id || !scheduled_start) {
      return jsonResponse(
        { error: 'session_id and scheduled_start are required' },
        400,
        origin,
      );
    }

    const durationRaw = Number(duration_minutes);
    const duration =
      Number.isFinite(durationRaw) && durationRaw > 0
        ? Math.max(15, Math.min(24 * 60, Math.round(durationRaw)))
        : 60;

    const token = await getZoomAccessToken();

    const zoomPayload = {
      topic: topic || 'Online Class',
      type: 2,
      start_time: scheduled_start,
      duration,
      timezone: 'Africa/Douala',
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

    const meeting = (await zoomRes.json()) as {
      id: number;
      join_url: string;
      start_url: string;
      password?: string;
    };

    const { error: dbErr } = await supabase
      .from('class_sessions')
      .update({
        zoom_meeting_id: String(meeting.id),
        zoom_join_url: meeting.join_url,
        zoom_start_url: meeting.start_url,
        zoom_password: meeting.password ?? null,
      })
      .eq('id', session_id);

    if (dbErr) {
      // Surface schema issues clearly (migration not applied)
      if (dbErr.message?.includes('zoom_') || dbErr.code === '42703') {
        throw new Error(
          `Database is missing Zoom columns. Run migration 20261026_add_zoom_to_class_sessions.sql. (${dbErr.message})`,
        );
      }
      throw dbErr;
    }

    return jsonResponse(
      {
        meeting_id: meeting.id,
        join_url: meeting.join_url,
        start_url: meeting.start_url,
        password: meeting.password,
      },
      200,
      origin,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[zoom-meeting]', message);
    return jsonResponse({ error: message }, 500, origin);
  }
});
