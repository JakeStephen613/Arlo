
-- First, let's ensure the profiles table has proper structure and constraints
-- Update the account_mode enum to match what we need
DROP TYPE IF EXISTS public.account_mode CASCADE;
CREATE TYPE public.account_mode AS ENUM ('student', 'tutor');

-- Make sure profiles table is properly set up
ALTER TABLE public.profiles 
ALTER COLUMN account_mode TYPE public.account_mode USING account_mode::text::public.account_mode,
ALTER COLUMN account_mode SET DEFAULT 'student'::public.account_mode;

-- Ensure tutor_code is properly set up
ALTER TABLE public.profiles 
ALTER COLUMN tutor_code DROP NOT NULL IF EXISTS;

-- Fix the table names - we created tutor_students but it should be tutor_student_links to match existing types
DROP TABLE IF EXISTS public.tutor_students CASCADE;

-- Recreate with correct name
CREATE TABLE IF NOT EXISTS public.tutor_student_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'active',
    UNIQUE(tutor_id, student_id)
);

-- Create assigned_sessions table
CREATE TABLE IF NOT EXISTS public.assigned_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    session_plan JSONB NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed'))
);

-- Enable RLS
ALTER TABLE public.tutor_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Tutors can view their students" ON public.tutor_student_links;
DROP POLICY IF EXISTS "Students can view their tutors" ON public.tutor_student_links;
DROP POLICY IF EXISTS "Students can create tutor connections" ON public.tutor_student_links;
DROP POLICY IF EXISTS "Tutors can create student connections" ON public.tutor_student_links;
DROP POLICY IF EXISTS "Users can update their own links" ON public.tutor_student_links;

-- RLS policies for tutor_student_links
CREATE POLICY "Tutors can view their student links" ON public.tutor_student_links
    FOR SELECT USING (tutor_id = auth.uid());

CREATE POLICY "Students can view their tutor links" ON public.tutor_student_links
    FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students can create tutor links" ON public.tutor_student_links
    FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Tutors can create student links" ON public.tutor_student_links
    FOR INSERT WITH CHECK (tutor_id = auth.uid());

CREATE POLICY "Users can update their own links" ON public.tutor_student_links
    FOR UPDATE USING ((tutor_id = auth.uid()) OR (student_id = auth.uid()));

-- Drop existing policies for assigned_sessions
DROP POLICY IF EXISTS "Tutors can manage their assigned sessions" ON public.assigned_sessions;
DROP POLICY IF EXISTS "Students can view sessions assigned to them" ON public.assigned_sessions;
DROP POLICY IF EXISTS "Students can update their session status" ON public.assigned_sessions;

-- RLS policies for assigned_sessions
CREATE POLICY "Tutors can manage their assigned sessions" ON public.assigned_sessions
    FOR ALL USING (tutor_id = auth.uid());

CREATE POLICY "Students can view sessions assigned to them" ON public.assigned_sessions
    FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students can update their session status" ON public.assigned_sessions
    FOR UPDATE USING (student_id = auth.uid()) 
    WITH CHECK (student_id = auth.uid());

-- Update the trigger function to handle account_mode properly
CREATE OR REPLACE FUNCTION public.handle_tutor_mode_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If account_mode is being set to 'tutor' and no tutor_code exists
    IF NEW.account_mode = 'tutor' AND (OLD.tutor_code IS NULL OR NEW.tutor_code IS NULL) THEN
        NEW.tutor_code := public.generate_tutor_code();
    END IF;
    
    -- If account_mode is being changed away from 'tutor', clear tutor_code
    IF OLD IS NOT NULL AND OLD.account_mode = 'tutor' AND NEW.account_mode != 'tutor' THEN
        NEW.tutor_code := NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS handle_tutor_mode_change_trigger ON public.profiles;
CREATE TRIGGER handle_tutor_mode_change_trigger
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_tutor_mode_change();
