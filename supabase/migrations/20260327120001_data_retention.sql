-- ============================================================================
-- DATA RETENTION POLICY
-- Frameworks: UK GDPR Art. 5(1)(e), ISO 27001 (A.8)
--
-- Adds configurable retention period per trust and a cleanup function.
-- Default retention: 365 days (1 year) from incident creation.
-- ============================================================================

-- Add retention_days column to trusts table
ALTER TABLE public.trusts
  ADD COLUMN IF NOT EXISTS retention_days integer NOT NULL DEFAULT 365;

-- Function to purge expired data (run via cron or manual trigger)
CREATE OR REPLACE FUNCTION public.purge_expired_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer := 0;
  trust_record record;
BEGIN
  FOR trust_record IN
    SELECT id, name, retention_days FROM trusts WHERE active = true
  LOOP
    -- Delete reports older than the trust's retention period
    -- CASCADE will handle transmissions, dispositions, transfers
    WITH deleted AS (
      DELETE FROM herald_reports
      WHERE trust_id = trust_record.id
        AND created_at < (now() - (trust_record.retention_days || ' days')::interval)
      RETURNING id
    )
    SELECT count(*) INTO deleted_count FROM deleted;

    IF deleted_count > 0 THEN
      INSERT INTO audit_log (action, trust_id, details)
      VALUES (
        'data_retention_purge',
        trust_record.id,
        jsonb_build_object(
          'trust_name', trust_record.name,
          'retention_days', trust_record.retention_days,
          'records_deleted', deleted_count,
          'purged_at', now()
        )
      );
    END IF;
  END LOOP;

  -- Also clean up orphaned shift_link_codes older than 30 days
  DELETE FROM shift_link_codes
  WHERE expires_at < (now() - interval '30 days');

  -- Clean up old audit log entries (keep 2 years)
  DELETE FROM audit_log
  WHERE created_at < (now() - interval '730 days');

  RETURN jsonb_build_object('status', 'ok', 'purged_at', now());
END;
$$;
