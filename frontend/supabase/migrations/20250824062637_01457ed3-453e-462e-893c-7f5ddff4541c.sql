-- Fix critical security vulnerability in context_cache table
-- Replace overly permissive policy with user-specific access control

-- Drop the existing insecure policy
DROP POLICY IF EXISTS "Allow all read/write for authenticated users" ON public.context_cache;

-- Create secure policies that restrict access to user's own data only
CREATE POLICY "Users can view their own context cache" 
ON public.context_cache 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own context cache" 
ON public.context_cache 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own context cache" 
ON public.context_cache 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own context cache" 
ON public.context_cache 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);