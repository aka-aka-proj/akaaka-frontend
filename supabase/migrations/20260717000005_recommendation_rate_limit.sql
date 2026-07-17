-- Belt-and-suspenders DB trigger that enforces the 1-recommendation-per-24h-per-target
-- rule at the database level, catching any inserts that bypass the Edge Function.

CREATE OR REPLACE FUNCTION check_recommendation_rate_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  rec_count INT;
BEGIN
  SELECT COUNT(*) INTO rec_count
  FROM recommendations
  WHERE from_profile_id = NEW.from_profile_id
    AND to_profile_id = NEW.to_profile_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF rec_count >= 1 THEN
    RAISE EXCEPTION 'rate_limited: already recommended this person in the last 24 hours';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_recommendation_rate_limit ON recommendations;
CREATE TRIGGER trg_check_recommendation_rate_limit
  BEFORE INSERT ON recommendations
  FOR EACH ROW
  EXECUTE FUNCTION check_recommendation_rate_limit();
