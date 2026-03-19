ALTER TABLE public.herald_reports
  ADD COLUMN lat double precision,
  ADD COLUMN lng double precision,
  ADD COLUMN accuracy double precision;