/**
 * zoomService.js
 *
 * Calls the `zoom-meeting` Supabase Edge Function to create / delete
 * Zoom meetings. Secrets stay in the Edge Function, never in the browser.
 *
 * Uses supabase.functions.invoke so the gateway always receives both the
 * user JWT and the project apikey (raw fetch without apikey often 401s).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
    );
  }
}

async function ensureSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated. Sign in again, then retry Zoom.');
  }
  return session;
}

function extractErrorMessage(error, data, fallback) {
  if (data?.error) return typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
  if (error?.message) return error.message;
  if (typeof data === 'string' && data.trim()) return data;
  return fallback;
}

/**
 * Create a Zoom meeting for a class session.
 *
 * @param {object} params
 * @param {string} params.sessionId
 * @param {string} params.topic
 * @param {string} params.scheduledStart ISO datetime
 * @param {number} params.durationMinutes
 * @returns {Promise<{ meeting_id, join_url, start_url, password }>}
 */
export async function createZoomMeeting({ sessionId, topic, scheduledStart, durationMinutes }) {
  ensureConfigured();
  await ensureSession();

  if (!sessionId || !scheduledStart) {
    throw new Error('Session id and scheduled start are required to create a Zoom meeting');
  }

  const duration = Number(durationMinutes);
  const safeDuration =
    Number.isFinite(duration) && duration > 0 ? Math.max(15, Math.round(duration)) : 60;

  const { data, error } = await supabase.functions.invoke('zoom-meeting', {
    method: 'POST',
    body: {
      session_id: sessionId,
      topic: topic || 'Online Class',
      scheduled_start: scheduledStart,
      duration_minutes: safeDuration,
    },
  });

  if (error) {
    // FunctionsHttpError may put the real message on context / data
    const msg = extractErrorMessage(error, data, error.message || 'Failed to create Zoom meeting');
    throw new Error(msg);
  }

  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to create Zoom meeting');
  }

  return data;
}

/**
 * Delete a Zoom meeting and clear the link from the session row.
 *
 * @param {object} params
 * @param {string} params.zoomMeetingId
 * @param {string} params.sessionId
 */
export async function deleteZoomMeeting({ zoomMeetingId, sessionId }) {
  ensureConfigured();
  await ensureSession();

  if (!zoomMeetingId || !sessionId) {
    throw new Error('Zoom meeting id and session id are required');
  }

  const { data, error } = await supabase.functions.invoke('zoom-meeting', {
    method: 'DELETE',
    body: {
      zoom_meeting_id: zoomMeetingId,
      session_id: sessionId,
    },
  });

  if (error) {
    const msg = extractErrorMessage(error, data, error.message || 'Failed to delete Zoom meeting');
    throw new Error(msg);
  }

  if (data?.error) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete Zoom meeting');
  }

  return data;
}
