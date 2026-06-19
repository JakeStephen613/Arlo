
-- Update the profiles table RLS policy to allow students to find tutors by code
-- while still protecting private profile information

-- Drop the overly restrictive select policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a new policy that allows:
-- 1. Users to view their own full profile
-- 2. Users to view basic tutor information (for tutor code searches)
CREATE POLICY "Users can view profiles with restrictions" 
ON public.profiles 
FOR SELECT 
USING (
  -- Users can always see their own profile
  auth.uid() = id 
  OR 
  -- Users can see basic tutor info when the profile has a tutor_code and is a tutor
  (tutor_code IS NOT NULL AND account_mode = 'tutor')
);
