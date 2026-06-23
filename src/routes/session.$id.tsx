import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/session/$id")({
  component: SessionView,
});

const langExt = (l: string) => {
  switch (l) {
    case "python": return python();
    case "java": return java();
    case "cpp": return cpp();
    default: return javascript();
  }
};

function SessionView() {
  const { id } = Route.useParams();
  const { theme } = useTheme();
  const [data, setData] = useState<{ final_code: string; language: string; room_code: string; duration_sec: number; created_at: string } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    supabase
      .from("sessions")
      .select("final_code, language, room_code, duration_sec, created_at")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) setMissing(true);
        else setData(data);
      });
  }, [id]);

  if (missing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Session not found</h1>
          <Link to="/history" className="text-primary text-sm mt-3 inline-block">← Back to history</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/history" className="text-sm text-muted-foreground hover:text-foreground">← History</Link>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {data && (
            <>
              <span className="font-mono tracking-widest">{data.room_code}</span>
              <span className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground">{data.language}</span>
              <span className="text-muted-foreground">{Math.floor(data.duration_sec / 60)}m {data.duration_sec % 60}s</span>
            </>
          )}
        </div>
      </header>
      <div className="flex-1">
        {data && (
          <CodeMirror
            value={data.final_code}
            height="calc(100vh - 49px)"
            theme={theme === "dark" ? oneDark : "light"}
            extensions={[langExt(data.language)]}
            editable={false}
            basicSetup={{ lineNumbers: true, foldGutter: true }}
          />
        )}
      </div>
    </div>
  );
}
