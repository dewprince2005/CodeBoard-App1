import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Trash2, CheckCircle, Circle, Plus, ListTodo, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, FolderClock } from "lucide-react";
import { logActivity } from "@/lib/activity-logger";

export const Route = createFileRoute("/tasks")({
  component: TaskManager,
});

type Task = {
  id: string;
  title: string;
  is_completed: boolean;
  created_at: string;
  deleted_at: string | null;
};

function TaskManager() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await logActivity({ action: "click:sign_out" });
    await signOut();
  };
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, authLoading, navigate]);

  // Fetch Tasks (List View)
  useEffect(() => {
    if (!user) return;
    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load tasks");
      } else {
        setTasks(data || []);
      }
      setLoading(false);
    };
    fetchTasks();
  }, [user]);

  // Create Task
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !user) return;

    const tempTitle = newTaskTitle.trim();
    setNewTaskTitle("");

    const { data, error } = await supabase
      .from("tasks")
      .insert({ title: tempTitle, user_id: user.id })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      toast.error(`Error: ${error.message || "Failed to add task"}`);
      return;
    }
    
    await logActivity({
      action: "click:add_task",
      after_state: { task_id: data.id, title: tempTitle },
    });
    setTasks([data, ...tasks]);
    toast.success("Task added");
  };

  // Update Task (Toggle Completion)
  const toggleTask = async (task: Task) => {
    const newStatus = !task.is_completed;
    
    // Optimistic UI update
    setTasks(tasks.map(t => t.id === task.id ? { ...t, is_completed: newStatus } : t));

    const { error } = await supabase
      .from("tasks")
      .update({ is_completed: newStatus })
      .eq("id", task.id);

    if (error) {
      toast.error("Failed to update task");
      // Revert on error
      setTasks(tasks.map(t => t.id === task.id ? { ...t, is_completed: !newStatus } : t));
    } else {
      await logActivity({
        action: "click:toggle_task",
        after_state: { task_id: task.id, is_completed: newStatus },
      });
    }
  };

  // Soft Delete Task with confirmation
  const deleteTask = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;

    const { error } = await supabase
      .from("tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete task");
    } else {
      await logActivity({
        action: "click:delete_task",
        after_state: { task_id: id },
      });
      // Optimistically remove from UI (soft‑deleted rows are filtered by RLS)
      setTasks(tasks.filter(t => t.id !== id));
      toast.success("Task moved to trash");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold">
              {"</>"}
            </div>
            <span className="font-semibold text-lg tracking-tight">CodeBoard</span>
          </Link>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("toggle-command-menu"))}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/20 hover:bg-accent/60 text-muted-foreground hover:text-foreground transition text-xs font-medium cursor-pointer focus:outline-none"
            title="Search and Commands"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search...</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[9px] font-medium opacity-80">
              <span>⌘</span>K
            </kbd>
          </button>
          <ThemeToggle />

          {user && (
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
                  <Link to="/" className="flex w-full items-center gap-2 cursor-pointer">
                    <ListTodo className="w-4 h-4" />
                    <span>Rooms</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/history" className="flex w-full items-center gap-2 cursor-pointer">
                    <FolderClock className="w-4 h-4" />
                    <span>Saved Sessions</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/trash" className="flex w-full items-center gap-2 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                    <span>Trash Bin</span>
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
          )}
        </div>
      </header>

      <main className="flex-1 px-6 py-12 flex justify-center items-start">
        <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-primary" />
            Task Manager
          </h1>

          {/* Create View */}
          <form onSubmit={addTask} className="flex gap-3 mb-8">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="flex-1 bg-input border border-border rounded-md px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>

          {/* List View */}
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 border border-dashed border-border rounded-lg">
                No tasks yet. Add one above!
              </p>
            ) : (
              tasks.map((task) => (
                <div 
                  key={task.id} 
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-background hover:bg-accent/50 transition group"
                >
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleTask(task)}>
                    <button className="text-muted-foreground hover:text-primary transition focus:outline-none">
                      {task.is_completed ? (
                        <CheckCircle className="w-5 h-5 text-primary" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <span className={`text-sm ${task.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {task.title}
                    </span>
                  </div>
                  
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="text-destructive opacity-0 group-hover:opacity-100 transition p-2 hover:bg-destructive/10 rounded-md focus:outline-none focus:opacity-100"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
