
ALTER TABLE public.herald_reports ADD COLUMN IF NOT EXISTS original_assessment jsonb;
ALTER TABLE public.herald_reports ADD COLUMN IF NOT EXISTS final_assessment jsonb;
ALTER TABLE public.herald_reports ADD COLUMN IF NOT EXISTS diff jsonb;
ALTER TABLE public.herald_reports ADD COLUMN IF NOT EXISTS edited boolean DEFAULT false;
