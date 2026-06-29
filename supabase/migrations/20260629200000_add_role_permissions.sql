-- ═══════════════════════════════════════════════════════════════
-- Advanced Role Permission System
-- ═══════════════════════════════════════════════════════════════

-- 1. Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'moderator', 'admin')),
  permission  TEXT        NOT NULL,
  granted     BOOLEAN     NOT NULL DEFAULT true,
  updated_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, permission)
);

-- 2. Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Everyone authenticated can read role_permissions (needed for frontend permission checks)
CREATE POLICY "Authenticated users can read role permissions"
ON public.role_permissions FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only admins can insert/update/delete role permissions
CREATE POLICY "Admins can manage role permissions"
ON public.role_permissions FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

-- 4. Helper function: has_permission(perm)
-- Returns true if the calling user's role has a specific permission granted.
CREATE OR REPLACE FUNCTION public.has_permission(perm TEXT)
RETURNS boolean AS $$
DECLARE
  user_role TEXT;
  is_granted BOOLEAN;
BEGIN
  -- Get the caller's role
  SELECT role INTO user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF user_role IS NULL THEN
    RETURN false;
  END IF;

  -- Check the permission
  SELECT granted INTO is_granted
  FROM public.role_permissions
  WHERE role = user_role AND permission = perm;

  RETURN COALESCE(is_granted, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Seed default permissions
-- ┌─────────────────────────┬──────┬───────────┬───────┐
-- │ Permission              │ user │ moderator │ admin │
-- ├─────────────────────────┼──────┼───────────┼───────┤
-- │ view_dashboard          │  ✅  │    ✅     │  ✅   │
-- │ view_tasks              │  ✅  │    ✅     │  ✅   │
-- │ manage_own_tasks        │  ✅  │    ✅     │  ✅   │
-- │ view_history            │  ✅  │    ✅     │  ✅   │
-- │ view_trash              │  ✅  │    ✅     │  ✅   │
-- │ view_analytics          │  ❌  │    ✅     │  ✅   │
-- │ view_audit_logs         │  ❌  │    ✅     │  ✅   │
-- │ view_users              │  ❌  │    ✅     │  ✅   │
-- │ ban_users               │  ❌  │    ✅     │  ✅   │
-- │ manage_all_tasks        │  ❌  │    ✅     │  ✅   │
-- │ access_admin_panel      │  ❌  │    ✅     │  ✅   │
-- │ manage_roles            │  ❌  │    ❌     │  ✅   │
-- │ manage_permissions      │  ❌  │    ❌     │  ✅   │
-- └─────────────────────────┴──────┴───────────┴───────┘

INSERT INTO public.role_permissions (role, permission, granted) VALUES
  -- user permissions
  ('user', 'view_dashboard',     true),
  ('user', 'view_tasks',         true),
  ('user', 'manage_own_tasks',   true),
  ('user', 'view_history',       true),
  ('user', 'view_trash',         true),
  ('user', 'view_analytics',     false),
  ('user', 'view_audit_logs',    false),
  ('user', 'view_users',         false),
  ('user', 'ban_users',          false),
  ('user', 'manage_all_tasks',   false),
  ('user', 'access_admin_panel', false),
  ('user', 'manage_roles',       false),
  ('user', 'manage_permissions', false),

  -- moderator permissions
  ('moderator', 'view_dashboard',     true),
  ('moderator', 'view_tasks',         true),
  ('moderator', 'manage_own_tasks',   true),
  ('moderator', 'view_history',       true),
  ('moderator', 'view_trash',         true),
  ('moderator', 'view_analytics',     true),
  ('moderator', 'view_audit_logs',    true),
  ('moderator', 'view_users',         true),
  ('moderator', 'ban_users',          true),
  ('moderator', 'manage_all_tasks',   true),
  ('moderator', 'access_admin_panel', true),
  ('moderator', 'manage_roles',       false),
  ('moderator', 'manage_permissions', false),

  -- admin permissions (all granted)
  ('admin', 'view_dashboard',     true),
  ('admin', 'view_tasks',         true),
  ('admin', 'manage_own_tasks',   true),
  ('admin', 'view_history',       true),
  ('admin', 'view_trash',         true),
  ('admin', 'view_analytics',     true),
  ('admin', 'view_audit_logs',    true),
  ('admin', 'view_users',         true),
  ('admin', 'ban_users',          true),
  ('admin', 'manage_all_tasks',   true),
  ('admin', 'access_admin_panel', true),
  ('admin', 'manage_roles',       true),
  ('admin', 'manage_permissions', true)

ON CONFLICT (role, permission) DO NOTHING;

-- 6. Realtime: enable publication for role_permissions so frontend can subscribe
ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions;
