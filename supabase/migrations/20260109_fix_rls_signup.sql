-- Fix RLS policies for signup process
-- This migration adds proper policies for user registration

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON public.profiles;

-- Create new policy that allows authenticated users to insert their own profile
CREATE POLICY "Users can insert their own profile during signup"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create a function to handle user registration with proper role assignment
-- This function will be called from the client after auth signup
CREATE OR REPLACE FUNCTION public.register_user(
  p_user_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_role app_role DEFAULT 'receptionist'
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (p_user_id, p_full_name, p_email)
  ON CONFLICT (user_id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;

  -- Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'message', 'User registered successfully',
    'user_id', p_user_id,
    'role', p_role
  );
END;
$$;

-- Drop existing role policies
DROP POLICY IF EXISTS "Users can insert their own role during signup" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Add new policies for user_roles
CREATE POLICY "Authenticated users can insert their own role during signup"
ON public.user_roles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Ensure profiles table allows reading own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

-- Ensure profiles table allows updating own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Add policy for admins to view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
