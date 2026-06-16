import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
            {"</>"}
          </div>
          <span className="font-semibold tracking-tight">CodeBoard</span>
        </Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
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
    </div>
  );
}
