import { supabase } from "@/integrations/supabase/client";

export type ActivityLogPayload = {
  action: string;
  target_id?: string | null;
  target_email?: string | null;
  before_state?: Record<string, any> | null;
  after_state?: Record<string, any> | null;
};

/**
 * Logs a user interaction or event to the audit_logs database table.
 */
export const logActivity = async (payload: ActivityLogPayload) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      actor_email: user.email,
      action: payload.action,
      target_id: payload.target_id || null,
      target_email: payload.target_email || null,
      before_state: payload.before_state as any || null,
      after_state: payload.after_state as any || null,
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
