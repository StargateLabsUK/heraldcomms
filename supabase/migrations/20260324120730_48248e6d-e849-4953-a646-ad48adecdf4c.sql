
-- Remove all anon policies from herald_reports
DROP POLICY IF EXISTS "Allow anon insert" ON public.herald_reports;
DROP POLICY IF EXISTS "Allow anon read" ON public.herald_reports;
DROP POLICY IF EXISTS "Allow anon update" ON public.herald_reports;

-- Remove all anon policies from shifts
DROP POLICY IF EXISTS "Allow anon insert" ON public.shifts;
DROP POLICY IF EXISTS "Allow anon read" ON public.shifts;
DROP POLICY IF EXISTS "Allow anon update" ON public.shifts;

-- Remove all anon policies from incident_transmissions
DROP POLICY IF EXISTS "Allow anon insert" ON public.incident_transmissions;
DROP POLICY IF EXISTS "Allow anon read" ON public.incident_transmissions;
DROP POLICY IF EXISTS "Allow anon update" ON public.incident_transmissions;

-- Remove anon read from trusts (exposes trust_pin_hash)
DROP POLICY IF EXISTS "Allow anon read trusts" ON public.trusts;

-- Remove anon policies from incident_log
DROP POLICY IF EXISTS "Allow anon insert" ON public.incident_log;
DROP POLICY IF EXISTS "Allow anon read" ON public.incident_log;
