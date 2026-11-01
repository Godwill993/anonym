import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed.', { status: 405 });
  }

  let supabaseUrl: string;
  let serviceRoleKey: string;
  let webhookSecret: string;
  let vapidPublicKey: string;
  let vapidPrivateKey: string;

  try {
    supabaseUrl = requireEnv('SUPABASE_URL');
    serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    webhookSecret = requireEnv('PUSH_WEBHOOK_SECRET');
    vapidPublicKey = requireEnv('VAPID_PUBLIC_KEY');
    vapidPrivateKey = requireEnv('VAPID_PRIVATE_KEY');
  } catch (err) {
    console.error('[send-push-notification]', err instanceof Error ? err.message : err);
    return new Response('Server misconfigured.', { status: 500 });
  }

  if (request.headers.get('x-push-hook-secret') !== webhookSecret) {
    return new Response('Unauthorized.', { status: 401 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@unhimas.local',
    vapidPublicKey,
    vapidPrivateKey,
  );

  let payload: { record?: Record<string, unknown> };
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const notification = payload?.record;
  if (
    typeof notification?.id !== 'string' ||
    typeof notification?.recipient_id !== 'string' ||
    typeof notification?.title !== 'string' ||
    typeof notification?.message !== 'string'
  ) {
    return new Response('Invalid notification payload.', { status: 400 });
  }

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', notification.recipient_id);

  if (subscriptionsError) {
    console.error('Unable to load push subscriptions:', subscriptionsError.message);
    return new Response('Unable to load push subscriptions.', { status: 500 });
  }

  const deliveryErrors: unknown[] = [];
  await Promise.all((subscriptions || []).map(async (subscription) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({
          id: notification.id,
          title: notification.title,
          body: notification.message,
          url: '/',
        }),
      );
    } catch (error) {
      const statusCode = error instanceof Error && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;
      if (statusCode === 404 || statusCode === 410) {
        const { error: deleteError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', subscription.id);
        if (deleteError) {
          console.error('Unable to remove expired push subscription:', deleteError.message);
          deliveryErrors.push(deleteError);
        }
        return;
      }

      console.error(
        'Push notification delivery failed:',
        statusCode || (error instanceof Error ? error.message : 'Unknown error'),
      );
      deliveryErrors.push(error);
    }
  }));

  if (deliveryErrors.length) {
    return new Response(`Push delivery failed for ${deliveryErrors.length} subscription(s).`, {
      status: 502,
    });
  }

  return new Response(null, { status: 204 });
});
