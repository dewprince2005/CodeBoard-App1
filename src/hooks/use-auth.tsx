import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  role: "user" | "moderator" | "admin";
  is_banned: boolean;
  created_at: string;
  updated_at: string;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: "user" | "moderator" | "admin" | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** Re-fetch the profile from the database */
  refreshProfile: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /** Fetch the profile row for a given user id */
  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) setProfile(data as unknown as UserProfile);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  // ─── Session initialization ───
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false); // unblock UI immediately — profile loads in background
        if (session?.user) fetchProfile(session.user.id);
      })
      .catch((err) => {
        console.error("Error getting initial session:", err);
        setLoading(false);
      });

    // Subscribe to auth changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false); // unblock UI immediately
      if (session?.user) {
        fetchProfile(session.user.id); // background fetch
      } else {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setProfile(null);
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out");
    } finally {
      setLoading(false);
    }
  };

  const role = (profile?.role ?? null) as "user" | "moderator" | "admin" | null;

  return (
    <AuthContext.Provider
      value={{ user, session, profile, role, loading, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
