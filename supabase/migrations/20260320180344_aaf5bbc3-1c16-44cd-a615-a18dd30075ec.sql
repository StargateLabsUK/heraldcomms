-- Allow all authenticated users to read all reports (field reports have null user_id)
CREATE POLICY "Authenticated users can read all reports"
  ON public.herald_reports FOR SELECT TO authenticated
  USING (true);

-- Drop the restrictive policy that only shows own records
DROP POLICY IF EXISTS "Authenticated users can read own records" ON public.herald_reports;
