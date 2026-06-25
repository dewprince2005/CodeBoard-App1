-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  bio TEXT,
  location TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  is_banned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_id UUID,
  target_email TEXT,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Helper functions to check roles recursion-safe
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
BEGIN
  RETURN (
    SELECT role FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_user_banned()
RETURNS boolean AS $$
BEGIN
  RETURN COALESCE((
    SELECT is_banned FROM public.profiles
    WHERE id = auth.uid()
  ), false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Profile RLS Policies
CREATE POLICY "Users can view all active profiles"
ON public.profiles FOR SELECT
USING (auth.uid() IS NOT NULL AND NOT public.is_user_banned());

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id AND NOT public.is_user_banned())
WITH CHECK (auth.uid() = id AND NOT public.is_user_banned());

CREATE POLICY "Admins and moderators can update any profile"
ON public.profiles FOR UPDATE
USING (
  (public.get_user_role() IN ('admin', 'moderator'))
  AND NOT public.is_user_banned()
);

-- 6. Audit Logs RLS Policies
CREATE POLICY "Admins and moderators can view audit logs"
ON public.audit_logs FOR SELECT
USING (
  (public.get_user_role() IN ('admin', 'moderator'))
  AND NOT public.is_user_banned()
);

CREATE POLICY "Authenticated users can create audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_user_banned());

-- 7. Trigger to automatically create a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, is_banned)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'user'),
    false
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if trigger exists, if not create it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Backfill profiles for existing users
INSERT INTO public.profiles (id, email, name, role, is_banned)
SELECT id, email, COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)), 'user', false
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 9. Enforce is_banned on existing tasks table (Update tasks policy)
DROP POLICY IF EXISTS "Users can create their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;

CREATE POLICY "Users can create their own tasks" 
ON public.tasks FOR INSERT 
WITH CHECK (auth.uid() = user_id AND NOT public.is_user_banned());

CREATE POLICY "Users can view their own tasks" 
ON public.tasks FOR SELECT 
USING (
  (auth.uid() = user_id OR public.get_user_role() IN ('admin', 'moderator'))
  AND NOT public.is_user_banned()
);

CREATE POLICY "Users can update their own tasks" 
ON public.tasks FOR UPDATE 
USING (
  (auth.uid() = user_id OR public.get_user_role() IN ('admin', 'moderator'))
  AND NOT public.is_user_banned()
)
WITH CHECK (
  (auth.uid() = user_id OR public.get_user_role() IN ('admin', 'moderator'))
  AND NOT public.is_user_banned()
);

CREATE POLICY "Users can delete their own tasks" 
ON public.tasks FOR DELETE 
USING (
  (auth.uid() = user_id OR public.get_user_role() IN ('admin', 'moderator'))
  AND NOT public.is_user_banned()
);
