-- Allow trust admins to update their own trust (for PIN reset)
CREATE POLICY "admin_update_own_trust" ON public.trusts
  FOR UPDATE TO authenticated
  USING (
    id IN (SELECT p.trust_id FROM public.profiles p WHERE p.id = auth.uid() AND p.trust_id IS NOT NULL)
    AND has_role(auth.uid(), 'admin')
  );
