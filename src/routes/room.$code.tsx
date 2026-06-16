import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const Route = createFileRoute("/room/$code")({
  component: RoomPage,
});

const langExt = (l: string) => {
  switch (l) {
    case "python": return python();
    case "java": return java();
    case "cpp": return cpp();
    default: return javascript();
  }
};

function RoomPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [participants, setParticipants] = useState(1);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const startedAt = useRef<number>(Date.now());
  const remoteApply = useRef(false);
  const clientId = useMemo(() => Math.random().toString(36).slice(2), []);
  const lastSent = useRef(0);
  const pendingSave = useRef<NodeJS.Timeout | null>(null);

  // Load room
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id, code, language")
        .eq("room_code", code)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setNotFound(true);
        return;
      }
      setRoomId(data.id);
      setLanguage(data.language);
      remoteApply.current = true;
      setValue(data.code ?? "");
      setTimeout(() => (remoteApply.current = false), 0);
    })();
    return () => { cancelled = true; };
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
      supabase.from("rooms").update({ code: v, updated_at: new Date().toISOString() }).eq("room_code", code);
    } else {
      if (pendingSave.current) clearTimeout(pendingSave.current);
      pendingSave.current = setTimeout(() => {
        lastSent.current = Date.now();
        supabase.from("rooms").update({ code: v, updated_at: new Date().toISOString() }).eq("room_code", code);
      }, 1500);
    }
  };

  const onLangChange = (l: string) => {
    setLanguage(l);
    supabase.from("rooms").update({ language: l }).eq("room_code", code);
    channelRef.current?.send({
      type: "broadcast",
      event: "code",
      payload: { value, language: l },
    });
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Room not found</h1>
          <p className="text-muted-foreground mt-2">The room code <span className="font-mono">{code}</span> doesn't exist.</p>
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-5 px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border">
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
                status === "connected" ? "bg-primary animate-pulse" :
                status === "connecting" ? "bg-yellow-500" : "bg-destructive"
              }`}
            />
            <span className="capitalize">{status}</span>
            <span className="text-muted-foreground">· {participants}/2</span>
          </div>

          <button
            onClick={saveSession}
            disabled={saving}
            className="text-sm bg-primary text-primary-foreground font-medium rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Session"}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={value}
          height="calc(100vh - 57px)"
          theme={oneDark}
          extensions={[langExt(language)]}
          onChange={onChange}
          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
        />
      </div>
    </div>
  );
}
