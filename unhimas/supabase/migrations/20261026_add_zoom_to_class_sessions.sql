-- Migration: add Zoom meeting columns to class_sessions
-- Run this in: Supabase Dashboard > SQL Editor

ALTER TABLE class_sessions
  ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT,
  ADD COLUMN IF NOT EXISTS zoom_join_url   TEXT,
  ADD COLUMN IF NOT EXISTS zoom_start_url  TEXT,
  ADD COLUMN IF NOT EXISTS zoom_password   TEXT;

-- Index to look up a session by Zoom meeting ID (useful for webhooks later)
CREATE INDEX IF NOT EXISTS idx_class_sessions_zoom_meeting_id
  ON class_sessions (zoom_meeting_id)
  WHERE zoom_meeting_id IS NOT NULL;
