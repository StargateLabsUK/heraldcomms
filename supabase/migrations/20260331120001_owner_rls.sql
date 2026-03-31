-- Owner can read ALL data across all trusts (for the Herald admin)
-- Update existing policies to include owner role

-- Owner can read all profiles
DROP POLICY IF EXISTS "auth_read_profiles_by_trust" ON public.profiles;
CREATE POLICY "auth_read_profiles_by_trust" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner')
    OR trust_id IN (SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid())
    OR id = auth.uid()
  );

-- Owner can read all audit logs
DROP POLICY IF EXISTS "auth_read_audit_by_trust" ON public.audit_log;
CREATE POLICY "auth_read_audit_by_trust" ON public.audit_log
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner')
    OR trust_id IN (SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Owner can read all shifts
DROP POLICY IF EXISTS "auth_read_shifts_by_trust" ON public.shifts;
CREATE POLICY "auth_read_shifts_by_trust" ON public.shifts
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner')
    OR trust_id IN (SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Owner can read all reports
DROP POLICY IF EXISTS "auth_read_reports_by_trust" ON public.herald_reports;
CREATE POLICY "auth_read_reports_by_trust" ON public.herald_reports
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'owner')
    OR trust_id IN (SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- Owner can read all user_roles (add to existing admin policy)
DROP POLICY IF EXISTS "admins_read_all_roles" ON public.user_roles;
CREATE POLICY "admins_read_all_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- Owner and admin can insert roles
DROP POLICY IF EXISTS "admins_insert_roles" ON public.user_roles;
CREATE POLICY "admins_insert_roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- Owner and admin can update roles
DROP POLICY IF EXISTS "admins_update_roles" ON public.user_roles;
CREATE POLICY "admins_update_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- Owner and admin can delete roles
DROP POLICY IF EXISTS "admins_delete_roles" ON public.user_roles;
CREATE POLICY "admins_delete_roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'));

-- Owner can read all trusts (trusts table already allows authenticated read)
-- Owner can update trusts (for deactivation)
CREATE POLICY "owner_update_trusts" ON public.trusts
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'owner'));

-- Admin can update their own trust (for PIN reset only — handled via edge function)
