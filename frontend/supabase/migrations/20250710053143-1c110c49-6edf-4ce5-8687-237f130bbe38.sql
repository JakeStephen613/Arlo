
-- First, let's check if account_mode enum exists and create/update it
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_mode') THEN
        CREATE TYPE public.account_mode AS ENUM ('student', 'tutor');
    END IF;
END $$;

-- Update the profiles table to use the correct account_mode enum values
ALTER TABLE public.profiles 
ALTER COLUMN account_mode SET DEFAULT 'student'::account_mode;

-- Add tutor_code column to profiles table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'tutor_code') THEN
        ALTER TABLE public.profiles ADD COLUMN tutor_code TEXT UNIQUE;
    END IF;
END $$;

-- Create tutor_students table for linking tutors and students
CREATE TABLE IF NOT EXISTS public.tutor_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(tutor_id, student_id)
);

-- Create assigned_sessions table for tutor-assigned sessions
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

-- Enable RLS on new tables
ALTER TABLE public.tutor_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for tutor_students
CREATE POLICY "Tutors can view their students" ON public.tutor_students
    FOR SELECT USING (tutor_id = auth.uid());

CREATE POLICY "Students can view their tutors" ON public.tutor_students
    FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students can create tutor connections" ON public.tutor_students
    FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "Tutors can create student connections" ON public.tutor_students
    FOR INSERT WITH CHECK (tutor_id = auth.uid());

-- RLS policies for assigned_sessions
CREATE POLICY "Tutors can manage their assigned sessions" ON public.assigned_sessions
    FOR ALL USING (tutor_id = auth.uid());

CREATE POLICY "Students can view sessions assigned to them" ON public.assigned_sessions
    FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students can update their session status" ON public.assigned_sessions
    FOR UPDATE USING (student_id = auth.uid()) 
    WITH CHECK (student_id = auth.uid());

-- Function to generate unique tutor codes
CREATE OR REPLACE FUNCTION public.generate_tutor_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a 6-character alphanumeric code
        new_code := upper(substring(md5(random()::text) from 1 for 6));
        
        -- Check if code already exists
        SELECT EXISTS(
            SELECT 1 FROM public.profiles WHERE tutor_code = new_code
        ) INTO code_exists;
        
        -- Exit loop if code is unique
        IF NOT code_exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN new_code;
END;
$$;

-- Trigger to automatically generate tutor code when account_mode is set to 'tutor'
CREATE OR REPLACE FUNCTION public.handle_tutor_mode_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- If account_mode is being changed to 'tutor' and no tutor_code exists
    IF NEW.account_mode = 'tutor' AND NEW.tutor_code IS NULL THEN
        NEW.tutor_code := public.generate_tutor_code();
    END IF;
    
    -- If account_mode is being changed away from 'tutor', clear tutor_code
    IF OLD.account_mode = 'tutor' AND NEW.account_mode != 'tutor' THEN
        NEW.tutor_code := NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS handle_tutor_mode_change_trigger ON public.profiles;
CREATE TRIGGER handle_tutor_mode_change_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_tutor_mode_change();
