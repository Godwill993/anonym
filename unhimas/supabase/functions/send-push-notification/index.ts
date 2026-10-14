import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

if (!supabaseUrl || !serviceRoleKey || !webhookSecret || !vapidPublicKey || !vapidPrivateKey) {
  throw new Error('Push notification function environment is not fully configured.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:lendzelegoodwill@gmail.com',
  vapidPublicKey,
  vapidPrivateKey,
);

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed.', { status: 405 });
  }

  if (request.headers.get('x-push-hook-secret') !== webhookSecret) {
    return new Response('Unauthorized.', { status: 401 });
  }

  const payload = await request.json();
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

  const deliveryErrors = [];
  await Promise.all((subscriptions || []).map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify({
        id: notification.id,
        title: notification.title,
        body: notification.message,
        url: '/',
      }));
    } catch (error) {
      const statusCode = error instanceof Error && 'statusCode' in error
        ? Number(error.statusCode)
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
    return new Response(`Push delivery failed for ${deliveryErrors.length} subscription(s).`, { status: 502 });
  }

  return new Response(null, { status: 204 });
});
