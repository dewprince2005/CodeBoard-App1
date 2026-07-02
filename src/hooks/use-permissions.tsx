import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

// ─── Types ───────────────────────────────────────────────────────────────────

export type Permission =
  | "view_dashboard"
  | "view_tasks"
  | "manage_own_tasks"
  | "view_history"
  | "view_trash"
  | "view_analytics"
  | "view_audit_logs"
  | "view_users"
  | "ban_users"
  | "manage_all_tasks"
  | "access_admin_panel"
  | "manage_roles"
  | "manage_permissions";

export type RolePermissionRow = {
  id: string;
  role: "user" | "moderator" | "admin";
  permission: Permission;
  granted: boolean;
  updated_by: string | null;
  updated_at: string;
};

// ─── Context ─────────────────────────────────────────────────────────────────

interface PermissionsContextType {
  /** All role_permissions rows (for the admin matrix) */
  allRolePermissions: RolePermissionRow[];
  /** Permissions granted to the current user's role */
  grantedPermissions: Set<Permission>;
  /** Quick check: does current user have this permission? */
  can: (permission: Permission) => boolean;
  /** Update a permission for a role (admin only) */
  updatePermission: (
    role: "user" | "moderator" | "admin",
    permission: Permission,
    granted: boolean,
  ) => Promise<void>;
  loading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType>({
  allRolePermissions: [],
  grantedPermissions: new Set(),
  can: () => false,
  updatePermission: async () => {},
  loading: true,
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();

  const [allRolePermissions, setAllRolePermissions] = useState<RolePermissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Derive current user's granted permissions from allRolePermissions + their role
  const grantedPermissions: Set<Permission> = new Set(
    allRolePermissions
      .filter((rp) => rp.role === (profile?.role ?? "user") && rp.granted)
      .map((rp) => rp.permission),
  );

  const can = useCallback(
    (permission: Permission): boolean => {
      // Admins always have all permissions (safety net)
      if (profile?.role === "admin") return true;
      return grantedPermissions.has(permission);
    },
    [grantedPermissions, profile?.role],
  );

  // ─── Fetch all role permissions ───
  useEffect(() => {
    if (authLoading || !user) {
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("role_permissions")
        .select("*")
        .order("role")
        .order("permission");

      if (!error && data) {
        setAllRolePermissions(data as unknown as RolePermissionRow[]);
      }
      setLoading(false);
    };

    fetchPermissions();
  }, [user, authLoading]);

  // ─── Real-time subscription ───
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("role-permissions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "role_permissions" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAllRolePermissions((prev) => [...prev, payload.new as unknown as RolePermissionRow]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as unknown as RolePermissionRow;
            setAllRolePermissions((prev) =>
              prev.map((rp) => (rp.id === updated.id ? updated : rp)),
            );
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setAllRolePermissions((prev) => prev.filter((rp) => rp.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // ─── Update a permission (admin only) ───
  const updatePermission = useCallback(
    async (role: "user" | "moderator" | "admin", permission: Permission, granted: boolean) => {
      // Guard: prevent admin from revoking their own manage_permissions
      if (role === "admin" && permission === "manage_permissions" && !granted) {
        throw new Error(
          "Cannot revoke manage_permissions from admin — this would lock everyone out.",
        );
      }

      // Optimistic update
      setAllRolePermissions((prev) =>
        prev.map((rp) =>
          rp.role === role && rp.permission === permission
            ? { ...rp, granted, updated_at: new Date().toISOString() }
            : rp,
        ),
      );

      const { error } = await (supabase as any)
        .from("role_permissions")
        .update({
          granted,
          updated_by: user?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("role", role)
        .eq("permission", permission);

      if (error) {
        // Rollback optimistic update
        setAllRolePermissions((prev) =>
          prev.map((rp) =>
            rp.role === role && rp.permission === permission ? { ...rp, granted: !granted } : rp,
          ),
        );
        throw error;
      }
    },
    [user],
  );

  return (
    <PermissionsContext.Provider
      value={{
        allRolePermissions,
        grantedPermissions,
        can,
        updatePermission,
        loading,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionProvider");
  }
  return context;
}
