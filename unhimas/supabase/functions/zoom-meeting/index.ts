/**
 * zoom-meeting — Supabase Edge Function
 *
 * Secure proxy to the Zoom API using Server-to-Server OAuth.
 * Credentials live ONLY here (Edge Function secrets), never in the frontend.
 *
 * Authorization:
 *   - Valid Supabase JWT required
 *   - Caller must be an active admin or lecturer
 *   - Lecturers may only act on sessions where they are the assigned lecturer
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

/** Optional allow-list of browser origins (comma-separated). Empty = reflect request Origin. */
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function resolveCorsOrigin(origin?: string | null): string {
  if (!origin) return '*';
  if (ALLOWED_ORIGINS.length === 0) return origin;
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

function corsHeaders(origin?: string | null) {
  return {
    'Access-Control-Allow-Origin': resolveCorsOrigin(origin),
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Vary': 'Origin',
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

type CallerContext = {
  userId: string;
  role: string;
  lecturerId: string | null;
};

/**
 * Resolve the caller's profile role and, for lecturers, their lecturer row id.
 * Uses the service-role client after the JWT has already been validated.
 */
async function resolveCaller(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
): Promise<CallerContext | { error: string; status: number }> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('[zoom-meeting] profile lookup failed', profileError.message);
    return { error: 'Unable to verify account', status: 500 };
  }
  if (!profile || !profile.is_active) {
    return { error: 'Forbidden — inactive or missing profile', status: 403 };
  }
  if (profile.role !== 'admin' && profile.role !== 'lecturer') {
    return { error: 'Forbidden — only administrators and lecturers may manage Zoom meetings', status: 403 };
  }

  let lecturerId: string | null = null;
  if (profile.role === 'lecturer') {
    const { data: lecturer, error: lecError } = await supabase
      .from('lecturers')
      .select('id')
      .eq('profile_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    if (lecError) {
      console.error('[zoom-meeting] lecturer lookup failed', lecError.message);
      return { error: 'Unable to verify lecturer record', status: 500 };
    }
    if (!lecturer) {
      return { error: 'Forbidden — lecturer profile is not linked', status: 403 };
    }
    lecturerId = lecturer.id as string;
  }

  return { userId, role: profile.role as string, lecturerId };
}

/** Ensure the session exists and the caller is allowed to manage it. */
async function assertSessionAccess(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  sessionId: string,
  caller: CallerContext,
): Promise<{ ok: true } | { error: string; status: number }> {
  const { data: session, error } = await supabase
    .from('class_sessions')
    .select('id, lecturer_id')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('[zoom-meeting] session lookup failed', error.message);
    return { error: 'Unable to load class session', status: 500 };
  }
  if (!session) {
    return { error: 'Class session not found', status: 404 };
  }
  if (caller.role === 'admin') {
    return { ok: true };
  }
  if (caller.role === 'lecturer' && session.lecturer_id === caller.lecturerId) {
    return { ok: true };
  }
  return { error: 'Forbidden — you may only manage Zoom meetings for your own sessions', status: 403 };
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

  const callerOrError = await resolveCaller(supabase, user.id);
  if ('error' in callerOrError) {
    return jsonResponse({ error: callerOrError.error }, callerOrError.status, origin);
  }
  const caller = callerOrError;

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

      const access = await assertSessionAccess(supabase, session_id, caller);
      if (!('ok' in access)) {
        return jsonResponse({ error: access.error }, access.status, origin);
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

    const access = await assertSessionAccess(supabase, session_id, caller);
    if (!('ok' in access)) {
      return jsonResponse({ error: access.error }, access.status, origin);
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
      if (dbErr.message?.includes('zoom_') || dbErr.code === '42703') {
        throw new Error(
          `Database is missing Zoom columns. Run migration 20261026_add_zoom_to_class_sessions.sql. (${dbErr.message})`,
        );
      }
      throw dbErr;
    }

    // start_url is the host URL — only return it to admin/lecturer callers (already enforced).
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
