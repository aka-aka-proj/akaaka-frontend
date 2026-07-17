-- Migration: Initial Schema
-- Creates all core tables for AkaAka.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles (one per auth.users row)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_status TEXT NOT NULL DEFAULT 'general'
    CHECK (role_status IN ('general', 'venue_pending', 'venue_approved')),
  display_name TEXT,
  bio TEXT,
  external_social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  venue_metadata JSONB DEFAULT NULL,
  reputation_score INT NOT NULL DEFAULT 0 CHECK (reputation_score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE profiles
  ADD CONSTRAINT profiles_social_links_min_one
  CHECK (
    external_social_links IS NOT NULL
    AND jsonb_typeof(external_social_links) = 'array'
    AND jsonb_array_length(external_social_links) >= 1
  );

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,
  is_venue_hosted BOOLEAN NOT NULL DEFAULT FALSE,
  visibility_settings JSONB NOT NULL DEFAULT '{"type":"public"}'::jsonb,
  start_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Event Threads (nested comments on events)
CREATE TABLE IF NOT EXISTS event_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  parent_id UUID REFERENCES event_threads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Recommendations (peer endorsements that affect reputation_score)
CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_profile_id UUID NOT NULL REFERENCES profiles(id),
  to_profile_id UUID NOT NULL REFERENCES profiles(id),
  score_increment INT NOT NULL DEFAULT 1 CHECK (score_increment > 0),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT recommendations_no_self_recommendation CHECK (from_profile_id <> to_profile_id)
);

-- Blocks
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id UUID NOT NULL REFERENCES profiles(id),
  blocked_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- Reports (user-submitted content / behaviour reports)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  target_profile_id UUID REFERENCES profiles(id),
  target_event_id UUID REFERENCES events(id),
  category TEXT NOT NULL CHECK (category IN ('harassment', 'impersonation', 'spam', 'safety_risk', 'other')),
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triaging', 'resolved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  resolved_at TIMESTAMPTZ
);

-- Moderation Actions (admin decisions; may reference a report)
CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  admin_id UUID NOT NULL REFERENCES profiles(id),
  action_type TEXT NOT NULL CHECK (action_type IN ('warn', 'suspend', 'ban', 'role_upgrade', 'role_revoke', 'note')),
  target_profile_id UUID REFERENCES profiles(id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Audit Logs (append-only record of all role / moderation changes)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  target_profile_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_metadata_gin       ON profiles USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_profiles_social_links_gin   ON profiles USING GIN (external_social_links);
CREATE INDEX IF NOT EXISTS idx_events_visibility_gin       ON events   USING GIN (visibility_settings);
CREATE INDEX IF NOT EXISTS idx_reports_status_created_at   ON reports  (status, created_at DESC);
