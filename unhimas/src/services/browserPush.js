import { supabase } from '../lib/supabase';

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function getBrowserPushSupport() {
  return Boolean(
    vapidPublicKey &&
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'Notification' in window &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export async function getBrowserPushSubscription() {
  const registration = await navigator.serviceWorker.register('/sw.js');
  return registration.pushManager.getSubscription();
}

export async function enableBrowserPush(userId) {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Browser notification permission is blocked. Enable it in your browser settings.'
      : 'Browser notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  const subscription = await registration.pushManager.getSubscription()
    || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidPublicKey(vapidPublicKey),
    });

  await saveSubscription(userId, subscription);
  return subscription;
}

export async function disableBrowserPush(userId, subscription) {
  const endpoint = subscription?.endpoint;
  if (!endpoint) return;

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);
  if (error) throw error;

  const unsubscribed = await subscription.unsubscribe();
  if (!unsubscribed) {
    throw new Error('The browser did not unsubscribe from push notifications.');
  }
}

export async function saveSubscription(userId, subscription) {
  const serialized = subscription.toJSON();
  const { p256dh, auth } = serialized.keys || {};
  if (!serialized.endpoint || !p256dh || !auth) {
    throw new Error('The browser returned an incomplete push subscription.');
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: serialized.endpoint,
      p256dh,
      auth,
    }, { onConflict: 'endpoint' });
  if (error) throw error;
}

function decodeVapidPublicKey(key) {
  const padding = '='.repeat((4 - (key.length % 4)) % 4);
  const base64 = `${key.replace(/-/g, '+').replace(/_/g, '/')}${padding}`;
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}
