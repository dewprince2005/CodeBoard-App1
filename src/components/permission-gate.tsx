import type { ReactNode } from "react";
import { usePermissions, type Permission } from "@/hooks/use-permissions";
import { Shield } from "lucide-react";

interface PermissionGateProps {
  /** The permission required to render children */
  permission: Permission;
  /** Optional custom fallback. Defaults to a subtle "Access Restricted" block. */
  fallback?: ReactNode;
  /** If true, renders nothing (no fallback) when permission is denied */
  silent?: boolean;
  children: ReactNode;
}

/**
 * Renders `children` only when the current user has the specified permission.
 * Use `fallback` to show a custom blocked UI; use `silent` to render nothing.
 *
 * @example
 * <PermissionGate permission="ban_users">
 *   <BanButton />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  fallback,
  silent = false,
  children,
}: PermissionGateProps) {
  const { can, loading } = usePermissions();

  // While permissions are loading, show nothing to avoid flicker
  if (loading) return null;

  if (can(permission)) {
    return <>{children}</>;
  }

  if (silent) return null;

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  // Default fallback UI
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/50 bg-muted/20 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/20">
        <Shield className="h-6 w-6 text-destructive" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Access Restricted</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your role doesn't have the <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{permission}</code> permission.
        </p>
      </div>
    </div>
  );
}
