-- Add 'owner' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';

-- Update Herald owner's role from admin to owner
UPDATE public.user_roles
SET role = 'owner'
WHERE user_id = 'feefae1b-ffa2-42a1-950d-b251181b8bb7' AND role = 'admin';

-- Update has_role function to still work (no changes needed, it checks by string)
