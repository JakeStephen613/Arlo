
-- Update RLS policies to allow profile creation during signup
-- First, drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Create a more permissive policy for profile insertion that works during signup
CREATE POLICY "Allow profile creation during signup" 
ON public.profiles 
FOR INSERT 
WITH CHECK (true);

-- Keep the existing select and update policies but make them more robust
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);
