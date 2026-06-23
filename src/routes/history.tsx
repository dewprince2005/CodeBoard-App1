import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

type Session = {
  id: string;
  room_code: string;
  language: string;
  duration_sec: number;
  created_at: string;
};

function HistoryPage() {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const { user, signOut, loading: authLoading } = useAuth();

  useEffect(() => {
    supabase
      .from("sessions")
      .select("id, room_code, language, duration_sec, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setSessions(data ?? []));
  }, []);

  const fmtDur = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
            {"</>"}
          </div>
          <span className="font-semibold tracking-tight">CodeBoard</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
          <div className="h-4 w-px bg-border" />
          
          {authLoading ? (
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="focus:outline-none cursor-pointer">
                <Avatar className="w-8 h-8 border border-border hover:opacity-85 transition">
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold uppercase text-xs">
                    {user.email?.[0] ?? "U"}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-1 backdrop-blur-md bg-card/90">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-foreground">My Account</p>
                    <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={signOut}
                  className="flex items-center gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              to="/auth"
              className="text-sm bg-primary text-primary-foreground font-medium rounded-md px-4 py-2 hover:opacity-90 transition shadow-sm"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        <h1 className="text-2xl font-bold">Saved sessions</h1>
        <p className="text-muted-foreground text-sm mt-1">Read-only snapshots from past coding sessions.</p>

        <div className="mt-8 space-y-2">
          {sessions === null && <div className="text-muted-foreground text-sm">Loading…</div>}
          {sessions && sessions.length === 0 && (
            <div className="text-muted-foreground text-sm bg-card border border-border rounded-lg p-6 text-center">
              No saved sessions yet.
            </div>
          )}
          {sessions?.map((s) => (
            <Link
              key={s.id}
              to="/session/$id"
              params={{ id: s.id }}
              className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 hover:bg-accent transition"
            >
              <div>
                <div className="font-mono tracking-widest text-sm">{s.room_code}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(s.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground">{s.language}</span>
                <span className="text-muted-foreground">{fmtDur(s.duration_sec)}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-6 border-t border-border text-xs text-muted-foreground bg-background/20 mt-auto">
        <div>CodeBoard · Real-time collaborative coding</div>
        <div className="flex gap-4">
          <Link to="/" className="hover:text-foreground transition underline-offset-4 hover:underline">
            Home
          </Link>
          <span>·</span>
          <Link to="/contact" className="hover:text-foreground transition underline-offset-4 hover:underline">
            Contact Support
          </Link>
        </div>
      </footer>
    </div>
  );
}
