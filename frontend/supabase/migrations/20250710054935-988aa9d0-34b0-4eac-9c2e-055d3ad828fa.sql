
-- Create assigned_sessions table for tutor-assigned sessions
CREATE TABLE IF NOT EXISTS public.assigned_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tutor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    session_plan JSONB NOT NULL DEFAULT '{}',
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed'))
);

-- Enable RLS on assigned_sessions table
ALTER TABLE public.assigned_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for assigned_sessions
CREATE POLICY "Tutors can manage their assigned sessions" ON public.assigned_sessions
    FOR ALL USING (tutor_id = auth.uid());

CREATE POLICY "Students can view sessions assigned to them" ON public.assigned_sessions
    FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "Students can update their session status" ON public.assigned_sessions
    FOR UPDATE USING (student_id = auth.uid()) 
    WITH CHECK (student_id = auth.uid());
