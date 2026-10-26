/**
 * zoomService.js
 *
 * Calls the `zoom-meeting` Supabase Edge Function to create / delete
 * Zoom meetings. The actual Zoom API secrets live in the Edge Function,
 * never in the browser.
 */

import { supabase } from '../lib/supabase';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zoom-meeting`;

/**
 * Create a Zoom meeting for a class session.
 *
 * @param {object} params
 * @param {string} params.sessionId         – class_session UUID
 * @param {string} params.topic             – meeting title
 * @param {string} params.scheduledStart    – ISO datetime string
 * @param {number} params.durationMinutes   – meeting length in minutes
 * @returns {{ meeting_id, join_url, start_url, password }}
 */
export async function createZoomMeeting({ sessionId, topic, scheduledStart, durationMinutes }) {
  const headers = await getAuthHeaders();
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      session_id:       sessionId,
      topic:            topic || 'Online Class',
      scheduled_start:  scheduledStart,
      duration_minutes: durationMinutes || 60,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Failed to create Zoom meeting (${res.status})`);
  return data;
}

/**
 * Delete a Zoom meeting and clear the link from the session row.
 *
 * @param {object} params
 * @param {string} params.zoomMeetingId – Zoom meeting ID stored in the DB
 * @param {string} params.sessionId     – class_session UUID
 */
export async function deleteZoomMeeting({ zoomMeetingId, sessionId }) {
  const headers = await getAuthHeaders();
  const res = await fetch(FUNCTION_URL, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({
      zoom_meeting_id: zoomMeetingId,
      session_id:      sessionId,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Failed to delete Zoom meeting (${res.status})`);
  return data;
}
