/**
 * verify-turnstile — Supabase Edge Function
 *
 * Verifies a Cloudflare Turnstile token using the secret key.
 * Called by the public /apply form when VITE_TURNSTILE_SITE_KEY is configured.
 *
 * Required secret:
 *   TURNSTILE_SECRET_KEY
 *
 * Deploy:
 *   npx supabase functions deploy verify-turnstile
 *   npx supabase secrets set TURNSTILE_SECRET_KEY=...
 */

const TURNSTILE_SECRET_KEY = Deno.env.get('TURNSTILE_SECRET_KEY') ?? '';
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function corsHeaders(origin?: string | null) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    Vary: 'Origin',
  };
}

function jsonResponse(body: unknown, status: number, origin?: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405, origin);
  }

  if (!TURNSTILE_SECRET_KEY) {
    console.error('[verify-turnstile] TURNSTILE_SECRET_KEY is not configured');
    return jsonResponse(
      { success: false, error: 'Server misconfigured: TURNSTILE_SECRET_KEY missing' },
      500,
      origin,
    );
  }

  let token = '';
  let remoteip: string | undefined;
  try {
    const body = await req.json();
    token = typeof body?.token === 'string' ? body.token.trim() : '';
    if (typeof body?.remoteip === 'string' && body.remoteip.trim()) {
      remoteip = body.remoteip.trim();
    }
  } catch {
    return jsonResponse({ success: false, error: 'Invalid JSON body' }, 400, origin);
  }

  if (!token || token.length < 10) {
    return jsonResponse({ success: false, error: 'Missing or invalid token' }, 400, origin);
  }

  try {
    const form = new URLSearchParams();
    form.set('secret', TURNSTILE_SECRET_KEY);
    form.set('response', token);
    if (remoteip) form.set('remoteip', remoteip);

    const verifyRes = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const result = await verifyRes.json() as {
      success?: boolean;
      'error-codes'?: string[];
      action?: string;
      cdata?: string;
    };

    if (!result?.success) {
      return jsonResponse(
        {
          success: false,
          error: 'Turnstile verification failed',
          codes: result?.['error-codes'] ?? [],
        },
        403,
        origin,
      );
    }

    return jsonResponse({ success: true }, 200, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification request failed';
    console.error('[verify-turnstile]', message);
    return jsonResponse({ success: false, error: message }, 502, origin);
  }
});
