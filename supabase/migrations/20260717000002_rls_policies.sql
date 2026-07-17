-- Migration: RLS Policies (Issue #4)
-- Enables Row Level Security on ALL tables (deny-by-default) and
-- creates fine-grained policies for each table.

-- ─── Enable RLS ──────────────────────────────────────────────────────────────
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_threads      ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;

-- ─── profiles ────────────────────────────────────────────────────────────────
-- Any authenticated user can read any profile.
CREATE POLICY profiles_read_all ON profiles
  FOR SELECT TO authenticated
  USING (true);

-- Users may only update their own profile row.
CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ─── events ──────────────────────────────────────────────────────────────────
-- Any authenticated user can read any event.
CREATE POLICY events_read_all ON events
  FOR SELECT TO authenticated
  USING (true);

-- Users can create events they own; venue-hosted events require venue_approved.
CREATE POLICY events_insert_owner ON events
  FOR INSERT TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND (
      is_venue_hosted = false
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role_status = 'venue_approved'
      )
    )
  );

-- Owners may update their own events.
CREATE POLICY events_update_owner ON events
  FOR UPDATE TO authenticated
  USING  (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- ─── event_threads ───────────────────────────────────────────────────────────
-- Any authenticated user can read threads.
CREATE POLICY threads_read_all ON event_threads
  FOR SELECT TO authenticated
  USING (true);

-- Users can only post threads under their own profile_id.
CREATE POLICY threads_insert_owner ON event_threads
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- Users can only update their own thread posts.
CREATE POLICY threads_update_owner ON event_threads
  FOR UPDATE TO authenticated
  USING  (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- ─── recommendations ─────────────────────────────────────────────────────────
-- Any authenticated user can read recommendations.
CREATE POLICY recommendations_read_all ON recommendations
  FOR SELECT TO authenticated
  USING (true);

-- Users can only send recommendations from their own profile.
CREATE POLICY recommendations_insert_self ON recommendations
  FOR INSERT TO authenticated
  WITH CHECK (from_profile_id = auth.uid());

-- ─── blocks ──────────────────────────────────────────────────────────────────
-- Users can only see blocks they created.
CREATE POLICY blocks_read_owner ON blocks
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

-- Users can only add blocks from their own profile.
CREATE POLICY blocks_insert_owner ON blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

-- Users can only remove blocks they created.
CREATE POLICY blocks_delete_owner ON blocks
  FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- ─── reports ─────────────────────────────────────────────────────────────────
-- Any authenticated user can file a report they own.
CREATE POLICY reports_insert_owner ON reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Users can read their own reports; admins can read all reports.
CREATE POLICY reports_read_owner ON reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR auth.jwt() ->> 'role' = 'admin'
  );

-- ─── moderation_actions ──────────────────────────────────────────────────────
-- Full read/write access for admins only.
CREATE POLICY moderation_actions_admin_rw ON moderation_actions
  FOR ALL TO authenticated
  USING     (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ─── audit_logs ──────────────────────────────────────────────────────────────
-- Admins can read all audit log entries.
CREATE POLICY audit_logs_admin_read ON audit_logs
  FOR SELECT TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Only admins (or SECURITY DEFINER triggers acting on their behalf) may insert.
CREATE POLICY audit_logs_system_insert ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');
