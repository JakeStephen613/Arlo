
-- Update the account_mode enum to remove 'hybrid' and add 'student'
ALTER TYPE public.account_mode RENAME VALUE 'arlo_tutoring' TO 'student';

-- Remove the hybrid value by recreating the enum
-- First create a temporary enum
CREATE TYPE public.account_mode_new AS ENUM ('student', 'tutor');

-- Update the profiles table to use the new enum
ALTER TABLE public.profiles 
ALTER COLUMN account_mode TYPE public.account_mode_new 
USING account_mode::text::public.account_mode_new;

-- Update the default value
ALTER TABLE public.profiles 
ALTER COLUMN account_mode SET DEFAULT 'student'::public.account_mode_new;

-- Drop the old enum and rename the new one
DROP TYPE public.account_mode;
ALTER TYPE public.account_mode_new RENAME TO account_mode;
