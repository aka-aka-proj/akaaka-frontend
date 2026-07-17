-- Migration: Reputation Score + Audit Log Triggers (Issues #2 and #4)

-- ─── Reputation score trigger ────────────────────────────────────────────────
-- Applies a 1.5× multiplier when the recommender is venue_approved.

CREATE OR REPLACE FUNCTION apply_recommendation_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  weight NUMERIC := 1.0;
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = NEW.from_profile_id AND p.role_status = 'venue_approved'
  ) THEN
    weight := 1.5;
  END IF;

  UPDATE profiles
    SET reputation_score = reputation_score + CEIL(NEW.score_increment * weight)::INT
  WHERE id = NEW.to_profile_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_recommendation_score ON recommendations;
CREATE TRIGGER trg_apply_recommendation_score
  AFTER INSERT ON recommendations
  FOR EACH ROW
  EXECUTE FUNCTION apply_recommendation_score();

-- ─── Audit log: profile role_status change (Issue #2) ─────────────────────
-- Fires on every UPDATE to profiles; logs only when role_status actually changes.
-- SECURITY DEFINER so the trigger can bypass RLS on audit_logs.
-- actor_id defaults to auth.uid() (the session performing the update); for
-- service-role or admin-initiated updates this will reflect the admin's UID.

CREATE OR REPLACE FUNCTION log_role_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.role_status IS DISTINCT FROM NEW.role_status THEN
    INSERT INTO audit_logs (actor_id, target_profile_id, action, payload)
    VALUES (
      COALESCE(auth.uid(), NEW.id),  -- fall back to the profile owner if no session uid
      NEW.id,
      'role_status_change',
      jsonb_build_object('old', OLD.role_status, 'new', NEW.role_status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_role_status_change ON profiles;
CREATE TRIGGER trg_log_role_status_change
  AFTER UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION log_role_status_change();

-- ─── Audit log: moderation action inserted (Issue #2) ─────────────────────
-- Every new row in moderation_actions produces an audit_logs entry
-- attributed to the admin who performed the action.
-- SECURITY DEFINER so the trigger can bypass RLS on audit_logs.

CREATE OR REPLACE FUNCTION log_moderation_action()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, target_profile_id, action, payload)
  VALUES (
    NEW.admin_id,
    NEW.target_profile_id,
    NEW.action_type,
    NEW.payload
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_moderation_action ON moderation_actions;
CREATE TRIGGER trg_log_moderation_action
  AFTER INSERT ON moderation_actions
  FOR EACH ROW
  EXECUTE FUNCTION log_moderation_action();
