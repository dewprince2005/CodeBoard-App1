import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
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
import { LogOut, FolderClock } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CodeBoard — Real-time collaborative coding" },
      { name: "description", content: "Share a room code and pair-code in real time. No signup required." },
      { property: "og:title", content: "CodeBoard" },
      { property: "og:description", content: "Real-time collaborative coding rooms." },
    ],
  }),
  component: Index,
});

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function Index() {
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createRoom = async () => {
    setCreating(true);
    setError(null);
    try {
      const code = genCode();
      const { error: e } = await supabase
        .from("rooms")
        .insert({ room_code: code, language, code: "" });
      if (e) throw e;
      navigate({ to: "/room/$code", params: { code } });
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  };

  const joinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 8) {
      setError("Room code must be 8 characters.");
      return;
    }
    setJoining(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("rooms")
      .select("room_code")
      .eq("room_code", code)
      .maybeSingle();
    if (e || !data) {
      setError("Room not found.");
      setJoining(false);
      return;
    }
    navigate({ to: "/room/$code", params: { code } });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">
            {"</>"}
          </div>
          <span className="font-semibold text-lg tracking-tight">CodeBoard</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-card border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Server Active
          </div>

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
                <DropdownMenuItem asChild>
                  <Link to="/history" className="flex w-full items-center gap-2 cursor-pointer">
                    <FolderClock className="w-4 h-4" />
                    <span>Saved Sessions</span>
                  </Link>
                </DropdownMenuItem>
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

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Pair-code in <span className="text-primary">real time</span>.
            </h1>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Create a room, share the 8-character code, and start coding together.
              No accounts, no setup.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Create */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold">Create a room</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Spin up a new collaborative session.
              </p>
              <label className="block text-xs font-medium text-muted-foreground mt-5 mb-2">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
              </select>
              <button
                onClick={createRoom}
                disabled={creating}
                className="mt-5 w-full bg-primary text-primary-foreground font-medium rounded-md py-2.5 hover:opacity-90 transition disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create Room"}
              </button>
            </div>

            {/* Join */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold">Join a room</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter the 8-character room code.
              </p>
              <label className="block text-xs font-medium text-muted-foreground mt-5 mb-2">
                Room code
              </label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                maxLength={8}
                placeholder="ABCD1234"
                className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm font-mono tracking-widest outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={joinRoom}
                disabled={joining}
                className="mt-5 w-full bg-secondary text-secondary-foreground font-medium rounded-md py-2.5 border border-border hover:bg-accent transition disabled:opacity-50"
              >
                {joining ? "Joining…" : "Join Room"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-5 text-sm text-destructive text-center">{error}</div>
          )}

          <div className="mt-10 text-center">
            <a
              href="/history"
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              View saved sessions →
            </a>
          </div>
        </div>
      </main>

      <footer className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-6 border-t border-border text-xs text-muted-foreground bg-background/20">
        <div>CodeBoard · Real-time collaborative coding</div>
        <div className="flex gap-4">
          <Link to="/history" className="hover:text-foreground transition underline-offset-4 hover:underline">
            Saved Sessions
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
