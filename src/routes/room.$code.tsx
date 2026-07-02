import { createFileRoute, Link, useNavigate, useBlocker } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, FolderClock, Clock } from "lucide-react";
import { logActivity } from "@/lib/activity-logger";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/room/$code")({
  component: RoomPage,
});

const langExt = (l: string) => {
  switch (l) {
    case "python":
      return python();
    case "java":
      return java();
    case "cpp":
      return cpp();
    default:
      return javascript();
  }
};

const formatTime = (totalSeconds: number): string => {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
};

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { user, signOut, loading: authLoading } = useAuth();
  const handleSignOut = async () => {
    await logActivity({ action: "click:sign_out" });
    await signOut();
  };
  const { theme } = useTheme();
  const [value, setValue] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [participants, setParticipants] = useState(1);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  // Ref used to bypass the blocker when the user explicitly confirms quit
  const allowNavRef = useRef(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const startedAt = useRef<number>(Date.now());
  const remoteApply = useRef(false);
  const roomCreatedAtRef = useRef<string | null>(null);

  // Session Timer (persisted from room creation date)
  useEffect(() => {
    const timer = setInterval(() => {
      if (roomCreatedAtRef.current) {
        const createdMs = new Date(roomCreatedAtRef.current).getTime();
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - createdMs) / 1000)));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Browser Reload / Close protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Unsaved collaborative progress will be lost.";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // TanStack Router transition blocker
  // blockerFn returning true = block navigation, false = allow it
  const blocker = useBlocker({
    blockerFn: () => !allowNavRef.current,
    condition: true,
  });

  // When the blocker fires, open our custom dialog
  useEffect(() => {
    if (blocker.status === "blocked") {
      setShowQuitConfirm(true);
    }
  }, [blocker.status]);

  const clientId = useMemo(() => Math.random().toString(36).slice(2), []);
  const lastSent = useRef(0);
  const pendingSave = useRef<NodeJS.Timeout | null>(null);

  // Load room
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, code, language, created_at")
        .eq("room_code", code)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        return;
      }
      setRoomId(data.id);
      setLanguage(data.language);
      roomCreatedAtRef.current = data.created_at;
      remoteApply.current = true;
      setValue(data.code ?? "");
      setTimeout(() => (remoteApply.current = false), 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Realtime channel
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`room:${code}`, {
      config: { broadcast: { self: false }, presence: { key: clientId } },
    });
    channelRef.current = ch;

    ch.on("broadcast", { event: "code" }, (payload) => {
      const { value: v, language: l } = payload.payload as { value: string; language?: string };
      remoteApply.current = true;
      setValue(v);
      if (l) setLanguage(l);
      setTimeout(() => (remoteApply.current = false), 0);
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      setParticipants(Object.keys(state).length || 1);
    });

    ch.subscribe(async (s) => {
      if (s === "SUBSCRIBED") {
        setStatus("connected");
        await ch.track({ joined_at: Date.now() });
      } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
        setStatus("disconnected");
      }
    });

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [roomId, code, clientId]);

  // Broadcast + persist on change
  const onChange = (v: string) => {
    setValue(v);
    if (remoteApply.current) return;
    setSaved(false);
    channelRef.current?.send({
      type: "broadcast",
      event: "code",
      payload: { value: v, language },
    });
    // Throttled DB persist
    const now = Date.now();
    if (now - lastSent.current > 1500) {
      lastSent.current = now;
      supabase
        .from("rooms")
        .update({ code: v, updated_at: new Date().toISOString() })
        .eq("room_code", code);
    } else {
      if (pendingSave.current) clearTimeout(pendingSave.current);
      pendingSave.current = setTimeout(() => {
        lastSent.current = Date.now();
        supabase
          .from("rooms")
          .update({ code: v, updated_at: new Date().toISOString() })
          .eq("room_code", code);
      }, 1500);
    }
  };

  const onLangChange = async (l: string) => {
    setLanguage(l);
    supabase.from("rooms").update({ language: l }).eq("room_code", code);
    await logActivity({
      action: "change:room_language",
      after_state: { room_code: code, language: l },
    });
    channelRef.current?.send({
      type: "broadcast",
      event: "code",
      payload: { value, language: l },
    });
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      await logActivity({
        action: "click:copy_room_code",
        after_state: { room_code: code },
      });
      toast.success("Room code copied to clipboard!");
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      toast.error("Failed to copy code to clipboard");
    }
  };

  const saveSession = async () => {
    if (!roomId) return;
    setSaving(true);
    const duration = Math.floor((Date.now() - startedAt.current) / 1000);
    const { error } = await supabase.from("sessions").insert({
      room_id: roomId,
      room_code: code,
      language,
      final_code: value,
      duration_sec: duration,
    });
    setSaving(false);
    if (!error) {
      setSaved(true);
      await logActivity({
        action: "click:save_session",
        after_state: { room_code: code, language, duration_sec: duration },
      });
      toast.success("Session saved successfully!");
      setTimeout(() => setSaved(false), 2000);
    } else {
      toast.error(error.message || "Failed to save session.");
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Room not found</h1>
          <p className="text-muted-foreground mt-2">
            The room code <span className="font-mono">{code}</span> doesn't exist.
          </p>
          <button
            onClick={async () => {
              await logActivity({ action: "click:go_home_room_not_found" });
              navigate({ to: "/" });
            }}
            className="mt-5 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
              {"</>"}
            </div>
            <span className="font-semibold tracking-tight hidden sm:inline">CodeBoard</span>
          </Link>
          <div className="h-5 w-px bg-border" />
          <button
            onClick={copyCode}
            className="flex items-center gap-2 text-sm bg-card border border-border rounded-md px-3 py-1.5 hover:bg-accent transition"
            title="Copy room code"
          >
            <span className="text-muted-foreground text-xs">Room</span>
            <span className="font-mono tracking-widest">{code}</span>
            <span className="text-xs text-primary">{copied ? "✓" : "⧉"}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <ThemeToggle />
          <select
            value={language}
            onChange={(e) => onLangChange(e.target.value)}
            className="bg-card border border-border rounded-md px-2 py-1.5 text-sm outline-none"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
          </select>

          <div className="hidden sm:flex items-center gap-2 text-xs bg-card border border-border rounded-full px-3 py-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status === "connected"
                  ? "bg-primary animate-pulse"
                  : status === "connecting"
                    ? "bg-yellow-500"
                    : "bg-destructive"
              }`}
            />
            <span className="capitalize">{status}</span>
            <span className="text-muted-foreground">· {participants}/2</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs bg-card border border-border rounded-full px-3 py-1.5 text-muted-foreground font-mono">
            <Clock className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span>{formatTime(elapsedSeconds)}</span>
          </div>

          <button
            onClick={saveSession}
            disabled={saving}
            className="text-sm bg-primary text-primary-foreground font-medium rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-50 transition shadow-sm"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Session"}
          </button>

          <button
            onClick={() => setShowQuitConfirm(true)}
            className="text-sm border border-destructive/20 hover:bg-destructive/10 text-destructive font-medium rounded-md px-3 py-1.5 transition cursor-pointer"
          >
            Quit Room
          </button>

          <div className="h-5 w-px bg-border mx-1" />

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
                    <p className="text-xs leading-none text-muted-foreground truncate">
                      {user.email}
                    </p>
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
                  onClick={handleSignOut}
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
              className="text-sm border border-border bg-card text-foreground font-medium rounded-md px-3 py-1.5 hover:bg-accent transition"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={value}
          height="calc(100vh - 57px)"
          theme={theme === "dark" ? oneDark : "light"}
          extensions={[langExt(language)]}
          onChange={onChange}
          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
        />
      </div>

      {/* Quit confirmation modal — triggered by header button OR useBlocker */}
      <AlertDialog
        open={showQuitConfirm}
        onOpenChange={(isOpen) => {
          if (!isOpen && blocker.status === "blocked") {
            blocker.reset();
          }
          setShowQuitConfirm(isOpen);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quit Collaboration Room?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to quit this collaborative room? Unsaved progress on this coding
              session will not be saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                if (blocker.status === "blocked") {
                  blocker.reset();
                }
                setShowQuitConfirm(false);
              }}
            >
              Stay in Room
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await logActivity({
                  action: "click:quit_room",
                  after_state: { room_code: code },
                });
                allowNavRef.current = true;
                setShowQuitConfirm(false);
                if (blocker.status === "blocked") {
                  blocker.proceed();
                } else {
                  navigate({ to: "/" });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Quit Room
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
