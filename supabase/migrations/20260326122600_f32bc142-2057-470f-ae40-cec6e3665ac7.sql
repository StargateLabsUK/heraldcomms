
CREATE TABLE public.shift_link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid REFERENCES public.shifts(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL,
  trust_id uuid REFERENCES public.trusts(id),
  session_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE UNIQUE INDEX idx_shift_link_codes_code_unused
  ON public.shift_link_codes (code)
  WHERE used_at IS NULL;

ALTER TABLE public.shift_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select shift_link_codes"
  ON public.shift_link_codes FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Allow anon insert shift_link_codes"
  ON public.shift_link_codes FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon update shift_link_codes"
  ON public.shift_link_codes FOR UPDATE TO anon, authenticated
  USING (true);
