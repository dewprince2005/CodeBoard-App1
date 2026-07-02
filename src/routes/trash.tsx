import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, Trash2, RefreshCw } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/activity-logger";

export const Route = createFileRoute("/trash")({
  component: TrashView,
});

type Task = {
  id: string;
  title: string;
  deleted_at: string | null;
};

function TrashView() {
  const { user, loading: authLoading } = useAuth();
  const [trash, setTrash] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Load soft‑deleted tasks
  useEffect(() => {
    if (!user) return;
    const fetchTrash = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, deleted_at")
        .not("deleted_at", "is", null) // rows where deleted_at is NOT NULL
        .order("deleted_at", { ascending: false });
      if (error) {
        toast.error("Failed to load trash");
      } else {
        setTrash(data || []);
      }
      setLoading(false);
    };
    fetchTrash();
  }, [user]);

  // Restore a task
  const restoreTask = async (id: string) => {
    const { error } = await supabase.from("tasks").update({ deleted_at: null }).eq("id", id);
    if (error) {
      toast.error("Failed to restore task");
    } else {
      await logActivity({
        action: "click:restore_task",
        after_state: { task_id: id },
      });
      setTrash(trash.filter((t) => t.id !== id));
      toast.success("Task restored");
    }
  };

  // Permanently purge a task (admin only – optional)
  const purgeTask = async (id: string) => {
    if (!window.confirm("Permanently delete this task? This cannot be undone.")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      toast.error("Failed to purge task");
    } else {
      await logActivity({
        action: "click:purge_task",
        after_state: { task_id: id },
      });
      setTrash(trash.filter((t) => t.id !== id));
      toast.success("Task permanently removed");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background/50 backdrop-blur-md">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card sticky top-0 z-10">
        <Link to="/" className="flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Tasks</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex-1 p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <RefreshCw className="w-6 h-6 text-primary" /> Trash
        </h1>
        {loading ? (
          <p>Loading...</p>
        ) : trash.length === 0 ? (
          <p className="text-muted-foreground">Trash is empty.</p>
        ) : (
          <ul className="space-y-3">
            {trash.map((task) => (
              <li
                key={task.id}
                className="flex justify-between items-center p-3 border rounded bg-card"
              >
                <span className="text-sm">{task.title}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => restoreTask(task.id)}
                    className="text-green-600 hover:opacity-85 transition"
                    title="Restore"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => purgeTask(task.id)}
                    className="text-destructive hover:opacity-85 transition"
                    title="Purge"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
