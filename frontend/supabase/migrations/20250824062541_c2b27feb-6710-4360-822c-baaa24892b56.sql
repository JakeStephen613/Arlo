-- Fix security vulnerability in can_access_profile function
-- Add authentication requirement for tutor profile discovery
CREATE OR REPLACE FUNCTION public.can_access_profile(profile_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  -- Require authentication for all profile access
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  
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
  
  -- Allow authenticated users to view tutor profiles (for tutor discovery)
  -- Now requires authentication unlike before
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
$function$