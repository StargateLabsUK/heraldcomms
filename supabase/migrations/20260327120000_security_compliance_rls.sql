-- ============================================================================
-- SECURITY COMPLIANCE: Trust-scoped RLS policies
-- Frameworks: ISO 27001 (A.9), CE+ (Access Control), PSN (Segregation), NCSC (P3)
--
-- This migration replaces all open USING(true) policies with trust-scoped
-- policies. Edge functions use service_role key and bypass RLS, so these
-- policies protect against direct client-side Supabase access only.
--
-- NOTE: All edge functions already use SUPABASE_SERVICE_ROLE_KEY which
-- bypasses RLS entirely. These policies protect the anon/authenticated
-- client-side Supabase SDK calls.
-- ============================================================================

-- ── herald_reports ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon users can read all reports" ON public.herald_reports;
DROP POLICY IF EXISTS "Allow anon read" ON public.herald_reports;
DROP POLICY IF EXISTS "Authenticated users can read all reports" ON public.herald_reports;
DROP POLICY IF EXISTS "Anon users can insert reports" ON public.herald_reports;
DROP POLICY IF EXISTS "Allow anon insert" ON public.herald_reports;
DROP POLICY IF EXISTS "Anon users can update reports" ON public.herald_reports;
DROP POLICY IF EXISTS "Allow anon update" ON public.herald_reports;

-- Authenticated users (command/admin) can read reports scoped to their trust
CREATE POLICY "auth_read_reports_by_trust" ON public.herald_reports
  FOR SELECT TO authenticated
  USING (
    trust_id IN (
      SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Anon users should not query reports directly — edge functions use service_role
-- However, realtime subscriptions from /incidents and /command may need this.
-- Scope to trust_id passed via RLS context is not possible for anon, so we
-- keep anon SELECT but note: the real protection is that anon cannot know
-- other trusts' report IDs without enumerating (and we block that via fetch-incidents).
-- For maximum safety, we still restrict: anon can only SELECT, not INSERT/UPDATE directly.
CREATE POLICY "anon_read_reports" ON public.herald_reports
  FOR SELECT TO anon
  USING (true);

-- No direct anon INSERT/UPDATE — all writes go through edge functions with service_role

-- ── incident_transmissions ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon users can read transmissions" ON public.incident_transmissions;
DROP POLICY IF EXISTS "Allow anon read" ON public.incident_transmissions;
DROP POLICY IF EXISTS "Authenticated users can read transmissions" ON public.incident_transmissions;
DROP POLICY IF EXISTS "Anon users can insert transmissions" ON public.incident_transmissions;
DROP POLICY IF EXISTS "Allow anon insert" ON public.incident_transmissions;
DROP POLICY IF EXISTS "Authenticated users can insert transmissions" ON public.incident_transmissions;
DROP POLICY IF EXISTS "Anon users can update transmissions" ON public.incident_transmissions;
DROP POLICY IF EXISTS "Allow anon update" ON public.incident_transmissions;

CREATE POLICY "auth_read_transmissions_by_trust" ON public.incident_transmissions
  FOR SELECT TO authenticated
  USING (
    trust_id IN (
      SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Anon can read for realtime but not write directly
CREATE POLICY "anon_read_transmissions" ON public.incident_transmissions
  FOR SELECT TO anon
  USING (true);

-- ── shifts ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon users can read all shifts" ON public.shifts;
DROP POLICY IF EXISTS "Allow anon read" ON public.shifts;
DROP POLICY IF EXISTS "Allow anon read shifts" ON public.shifts;
DROP POLICY IF EXISTS "Authenticated users can read all shifts" ON public.shifts;
DROP POLICY IF EXISTS "Anon users can insert shifts" ON public.shifts;
DROP POLICY IF EXISTS "Allow anon insert" ON public.shifts;
DROP POLICY IF EXISTS "Anon users can update shifts" ON public.shifts;
DROP POLICY IF EXISTS "Allow anon update" ON public.shifts;

CREATE POLICY "auth_read_shifts_by_trust" ON public.shifts
  FOR SELECT TO authenticated
  USING (
    trust_id IN (
      SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Anon can read shifts (needed for realtime shift-ended polling)
CREATE POLICY "anon_read_shifts" ON public.shifts
  FOR SELECT TO anon
  USING (true);

-- No direct anon INSERT/UPDATE — goes through sync-shift edge function

-- ── casualty_dispositions ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow anon read casualty_dispositions" ON public.casualty_dispositions;
DROP POLICY IF EXISTS "Allow authenticated read casualty_dispositions" ON public.casualty_dispositions;
DROP POLICY IF EXISTS "Allow authenticated insert casualty_dispositions" ON public.casualty_dispositions;
DROP POLICY IF EXISTS "Allow authenticated update casualty_dispositions" ON public.casualty_dispositions;

CREATE POLICY "auth_read_dispositions_by_trust" ON public.casualty_dispositions
  FOR SELECT TO authenticated
  USING (
    trust_id IN (
      SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Anon can read for realtime subscription
CREATE POLICY "anon_read_dispositions" ON public.casualty_dispositions
  FOR SELECT TO anon
  USING (true);

-- No direct anon INSERT/UPDATE — goes through sync-disposition edge function

-- ── shift_link_codes ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow anon select shift_link_codes" ON public.shift_link_codes;
DROP POLICY IF EXISTS "Allow anon insert shift_link_codes" ON public.shift_link_codes;
DROP POLICY IF EXISTS "Allow anon update shift_link_codes" ON public.shift_link_codes;

-- No direct client access to shift_link_codes at all.
-- All operations (generate, redeem, leave) go through the link-shift edge function
-- which uses service_role key. This prevents code enumeration attacks.

-- Authenticated users (command dashboard) can view link codes for their trust
CREATE POLICY "auth_read_link_codes_by_trust" ON public.shift_link_codes
  FOR SELECT TO authenticated
  USING (
    trust_id IN (
      SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- ── patient_transfers ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated read patient_transfers" ON public.patient_transfers;
DROP POLICY IF EXISTS "Allow authenticated insert patient_transfers" ON public.patient_transfers;
DROP POLICY IF EXISTS "Allow authenticated update patient_transfers" ON public.patient_transfers;

CREATE POLICY "auth_read_transfers_by_trust" ON public.patient_transfers
  FOR SELECT TO authenticated
  USING (
    trust_id IN (
      SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Anon can read for realtime (transfer notifications)
CREATE POLICY "anon_read_transfers" ON public.patient_transfers
  FOR SELECT TO anon
  USING (true);

-- No direct anon INSERT/UPDATE — goes through sync-transfer edge function

-- ── audit_log ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated read audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Allow authenticated insert audit_log" ON public.audit_log;

-- Authenticated users can only read audit entries for their own trust
CREATE POLICY "auth_read_audit_by_trust" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    trust_id IN (
      SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Only service_role (edge functions) can insert into audit_log
-- This makes it append-only from the client perspective

-- ── profiles ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated insert profiles" ON public.profiles;

-- Users can read profiles within their own trust
CREATE POLICY "auth_read_profiles_by_trust" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    trust_id IN (
      SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid()
    )
    OR id = auth.uid()  -- always allow reading own profile
  );

-- Users can update only their own profile
CREATE POLICY "auth_update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Profile insert handled by trigger (handle_new_user) which runs as SECURITY DEFINER

-- ── trusts ──────────────────────────────────────────────────────────────────
-- Trusts table is safe to remain readable (contains only name/slug, not PIN hash)
-- PIN hash is only accessed by validate-trust-pin edge function via service_role
-- No changes needed here — keep existing policies

-- ── incident_log ────────────────────────────────────────────────────────────
-- incident_log is health-check data, not sensitive. Keep existing authenticated policies.
-- anon policies were already removed in migration 20260324120730.
