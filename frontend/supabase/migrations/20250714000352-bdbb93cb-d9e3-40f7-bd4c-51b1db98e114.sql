-- Create a security definer function to check if a tutor can access a student's profile
CREATE OR REPLACE FUNCTION public.can_access_profile(profile_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Allow users to access their own profile
  IF auth.uid() = profile_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- Allow tutors to access profiles of students connected to them
  IF EXISTS (
    SELECT 1 FROM public.tutor_student_links 
    WHERE tutor_id = auth.uid() 
    AND student_id = profile_user_id 
    AND status = 'active'
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Allow viewing tutor profiles (for tutor discovery)
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = profile_user_id 
    AND tutor_code IS NOT NULL 
    AND account_mode = 'tutor'
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view profiles with restrictions" ON public.profiles;

-- Create new policy using the security definer function
CREATE POLICY "Users can access profiles with proper permissions" 
ON public.profiles 
FOR SELECT 
USING (public.can_access_profile(id));