import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { PermissionGate } from "@/components/permission-gate";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ListTodo,
  CheckCircle,
  Circle,
  Plus,
  Trash2,
  Clock,
  TrendingUp,
  User,
  Edit3,
  X,
  Save,
  Activity,
  BarChart3,
  Home,
  FolderClock,
  LogOut,
  Shield,
  Menu,
  ChevronLeft,
  MapPin,
  FileText,
  Search,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { logActivity } from "@/lib/activity-logger";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CodeBoard" },
      {
        name: "description",
        content: "Your personal CodeBoard dashboard with task analytics and activity feed.",
      },
    ],
  }),
  component: UserDashboard,
});

/* ─────────────────── Types ─────────────────── */

type Task = {
  id: string;
  title: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type Profile = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  role: string;
  is_banned: boolean;
  created_at: string;
};

type ActivityItem = {
  id: string;
  text: string;
  time: string;
  type: "create" | "complete" | "delete";
};

const mapLogToActivity = (log: any): ActivityItem => {
  let text = "";
  let type: ActivityItem["type"] = "complete";

  const action = log.action;
  if (action === "click:create_room") {
    text = `Created codeboard room ${log.after_state?.room_code || ""}`;
    type = "create";
  } else if (action === "click:join_room") {
    text = `Joined codeboard room ${log.after_state?.room_code || ""}`;
    type = "create";
  } else if (action === "click:copy_room_code") {
    text = `Copied room code ${log.after_state?.room_code || ""}`;
    type = "complete";
  } else if (action === "click:save_session") {
    text = `Saved collaborative session for room ${log.after_state?.room_code || ""}`;
    type = "complete";
  } else if (action === "click:add_task") {
    text = `Created task: "${log.after_state?.title || ""}"`;
    type = "create";
  } else if (action === "click:toggle_task") {
    const isCompleted = log.after_state?.is_completed;
    text = isCompleted ? `Completed task` : `Reopened task`;
    type = isCompleted ? "complete" : "create";
  } else if (action === "click:delete_task") {
    text = `Moved task to trash`;
    type = "delete";
  } else if (action === "click:restore_task") {
    text = `Restored task from trash`;
    type = "create";
  } else if (action === "click:purge_task") {
    text = `Permanently deleted task`;
    type = "delete";
  } else if (action === "click:save_profile") {
    text = `Updated profile information`;
    type = "complete";
  } else if (action === "change:room_language") {
    text = `Changed room language to ${log.after_state?.language || ""}`;
    type = "complete";
  } else {
    text = action.replace(/_/g, " ").replace(/:/g, " ");
    type = action.includes("delete") || action.includes("purge") ? "delete" : "complete";
  }

  return {
    id: log.id,
    text,
    time: log.created_at,
    type,
  };
};

/* ─────────────────── Helper ─────────────────── */

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PIE_COLORS = ["#34d399", "#6366f1", "#f59e0b"];
const AREA_GRADIENT_ID = "taskAreaGradient";

/* ─────────────────── Component ─────────────────── */

function UserDashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const { can } = usePermissions();
  const handleSignOut = async () => {
    await logActivity({ action: "click:sign_out" });
    await signOut();
  };
  const navigate = useNavigate();

  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Task CRUD state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", bio: "", location: "" });

  // Activity feed
  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([]);

  // ─── Auth guard ───
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, authLoading, navigate]);

  // ─── Fetch profile ───
  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (!error && data) {
        setProfile(data as unknown as Profile);
        setProfileForm({
          name: data.name || "",
          bio: data.bio || "",
          location: data.location || "",
        });
      }
    };
    fetchProfile();
  }, [user]);

  // ─── Fetch tasks ───
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
        setTasks((data || []) as unknown as Task[]);
      }
      setLoading(false);
    };
    fetchTasks();
  }, [user]);

  // ─── Fetch activity feed from audit logs ───
  useEffect(() => {
    if (!user) return;
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("actor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!error && data) {
        setActivityFeed(data.map(mapLogToActivity));
      }
    };
    fetchLogs();
  }, [user]);

  // ─── Realtime subscription for audit logs ───
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("dashboard-audit-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs", filter: `actor_id=eq.${user.id}` },
        (payload) => {
          const newLog = payload.new;
          setActivityFeed((prev) => [mapLogToActivity(newLog), ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // ─── Realtime subscription ───
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("dashboard-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newTask = payload.new as unknown as Task;
            if (!newTask.deleted_at) {
              setTasks((prev) => [newTask, ...prev.filter((t) => t.id !== newTask.id)]);
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as unknown as Task;
            if (updated.deleted_at) {
              setTasks((prev) => prev.filter((t) => t.id !== updated.id));
            } else {
              setTasks((prev) => {
                const exists = prev.some((t) => t.id === updated.id);
                if (exists) {
                  return prev.map((t) => (t.id === updated.id ? updated : t));
                } else {
                  return [updated, ...prev].sort(
                    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  );
                }
              });
            }
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string; title?: string };
            setTasks((prev) => prev.filter((t) => t.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // ─── CRUD operations ───
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
      toast.error(`Error: ${error.message || "Failed to add task"}`);
      return;
    }
    setTasks((prev) => [data as unknown as Task, ...prev]);
    await logActivity({
      action: "click:add_task",
      after_state: { task_id: data.id, title: tempTitle },
    });
    toast.success("Task added");
  };

  const toggleTask = async (task: Task) => {
    const newStatus = !task.is_completed;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, is_completed: newStatus } : t)));

    const { error } = await supabase
      .from("tasks")
      .update({ is_completed: newStatus })
      .eq("id", task.id);

    if (error) {
      toast.error("Failed to update task");
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, is_completed: !newStatus } : t)));
    } else {
      await logActivity({
        action: "click:toggle_task",
        after_state: { task_id: task.id, is_completed: newStatus },
      });
    }
  };

  const deleteTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
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
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("Task moved to trash");
    }
  };

  const startEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  const saveEditTask = async () => {
    if (!editingTaskId || !editingTitle.trim()) return;
    const { error } = await supabase
      .from("tasks")
      .update({ title: editingTitle.trim() })
      .eq("id", editingTaskId);
    if (error) {
      toast.error("Failed to update task title");
    } else {
      await logActivity({
        action: "click:save_edit_task",
        after_state: { task_id: editingTaskId, title: editingTitle.trim() },
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === editingTaskId ? { ...t, title: editingTitle.trim() } : t)),
      );
      toast.success("Task updated");
    }
    setEditingTaskId(null);
    setEditingTitle("");
  };

  // ─── Profile save ───
  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        name: profileForm.name.trim() || null,
        bio: profileForm.bio.trim() || null,
        location: profileForm.location.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      await logActivity({
        action: "click:save_profile",
        after_state: { name: profileForm.name.trim(), bio: profileForm.bio.trim(), location: profileForm.location.trim() },
      });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: profileForm.name.trim() || null,
              bio: profileForm.bio.trim() || null,
              location: profileForm.location.trim() || null,
            }
          : prev,
      );
      toast.success("Profile updated");
      setEditingProfile(false);
    }
  };

  // ─── Computed ───
  const filteredTasks = useMemo(() => {
    if (filter === "active") return tasks.filter((t) => !t.is_completed);
    if (filter === "completed") return tasks.filter((t) => t.is_completed);
    return tasks;
  }, [tasks, filter]);

  const completedCount = tasks.filter((t) => t.is_completed).length;
  const pendingCount = tasks.length - completedCount;
  const completionRate = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const pieData = useMemo(
    () => [
      { name: "Completed", value: completedCount },
      { name: "Pending", value: pendingCount },
    ],
    [completedCount, pendingCount],
  );

  const areaData = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      days[key] = 0;
    }
    tasks.forEach((t) => {
      const d = new Date(t.created_at);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (key in days) days[key]++;
    });
    return Object.entries(days).map(([date, count]) => ({ date, tasks: count }));
  }, [tasks]);

  // ─── Loading ───
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  // ─── Sidebar navigation items ───
  const navItems = [
    { icon: Home, label: "Home", to: "/" as const },
    { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" as const, active: true },
    { icon: ListTodo, label: "Tasks", to: "/tasks" as const },
    { icon: FolderClock, label: "Sessions", to: "/history" as const },
    { icon: Trash2, label: "Trash Bin", to: "/trash" as const },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Mobile sidebar overlay ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col
          bg-card/80 backdrop-blur-xl border-r border-border
          transition-all duration-300 ease-in-out
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${sidebarOpen ? "w-64" : "w-[72px]"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-border/50">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 min-w-[2rem] rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shadow-[0_0_12px_rgba(52,211,153,0.3)]">
              {"</>"}
            </div>
            {sidebarOpen && (
              <span className="font-semibold text-base tracking-tight whitespace-nowrap">
                CodeBoard
              </span>
            )}
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden lg:flex p-1 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-foreground transition"
          >
            <ChevronLeft
              className={`w-4 h-4 transition-transform duration-300 ${!sidebarOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              onClick={() => setMobileSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 group relative
                ${
                  item.active
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }
              `}
            >
              {item.active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
              )}
              <item.icon className={`w-[18px] h-[18px] min-w-[18px] ${item.active ? "text-primary" : ""}`} />
              {sidebarOpen && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          ))}

          {profile?.role === "admin" || profile?.role === "moderator" ? (
            <Link
              to="/admin"
              onClick={() => setMobileSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-all duration-200"
            >
              <Shield className="w-[18px] h-[18px] min-w-[18px]" />
              {sidebarOpen && <span className="whitespace-nowrap">Admin Panel</span>}
            </Link>
          ) : null}
        </nav>

        {/* User footer */}
        <div className="border-t border-border/50 p-3">
          <div
            className={`flex items-center gap-3 ${sidebarOpen ? "px-2" : "justify-center"}`}
          >
            <Avatar className="w-8 h-8 border border-border">
              <AvatarFallback className="bg-primary/20 text-primary font-semibold uppercase text-xs">
                {profile?.name?.[0] || user?.email?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{profile?.name || "User"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            )}
            {sidebarOpen && (
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-border bg-background/70 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-accent/60 text-muted-foreground"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                <LayoutDashboard className="w-5 h-5 text-primary" />
                Dashboard
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                Welcome back, {profile?.name || user?.email?.split("@")[0]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: "Total Tasks",
                value: tasks.length,
                icon: ListTodo,
                color: "text-blue-400",
                bg: "bg-blue-500/10",
                border: "border-blue-500/20",
              },
              {
                label: "Completed",
                value: completedCount,
                icon: CheckCircle,
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
              },
              {
                label: "Pending",
                value: pendingCount,
                icon: Clock,
                color: "text-amber-400",
                bg: "bg-amber-500/10",
                border: "border-amber-500/20",
              },
              {
                label: "Completion Rate",
                value: `${completionRate}%`,
                icon: TrendingUp,
                color: "text-violet-400",
                bg: "bg-violet-500/10",
                border: "border-violet-500/20",
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`
                  relative overflow-hidden rounded-xl border ${card.border}
                  bg-card/60 backdrop-blur-sm p-4 sm:p-5
                  hover:shadow-lg hover:shadow-black/5 transition-all duration-300
                  group
                `}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {card.label}
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1.5 tracking-tight">{card.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${card.bg} group-hover:scale-110 transition-transform duration-300`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
                {/* Ambient glow */}
                <div className={`absolute -bottom-6 -right-6 w-24 h-24 ${card.bg} rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition-opacity`} />
              </div>
            ))}
          </div>

          {/* ── Charts Row ── */}
          <PermissionGate
            permission="view_analytics"
            fallback={
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <div className="lg:col-span-2 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/50 bg-muted/10 p-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                    <BarChart3 className="h-6 w-6 text-primary/50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Analytics Locked</p>
                    <p className="mt-1 text-xs text-muted-foreground">Upgrade your role to view task analytics charts.</p>
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/50 bg-muted/10 p-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                    <Activity className="h-6 w-6 text-primary/50" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Status Chart Locked</p>
                    <p className="mt-1 text-xs text-muted-foreground">Analytics require elevated permissions.</p>
                  </div>
                </div>
              </div>
            }
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Area Chart — Task activity */}
              <div className="lg:col-span-2 bg-card/60 backdrop-blur-sm border border-border rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Tasks Created (Last 7 Days)</h3>
                </div>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={areaData}>
                      <defs>
                        <linearGradient id={AREA_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(30,30,40,0.95)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="tasks"
                        stroke="#34d399"
                        strokeWidth={2}
                        fill={`url(#${AREA_GRADIENT_ID})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart — Task status */}
              <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Task Status</h3>
                </div>
                <div className="h-[220px] flex items-center justify-center">
                  {tasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No tasks yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                          strokeWidth={0}
                        >
                          {pieData.map((_entry, i) => (
                            <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "rgba(30,30,40,0.95)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={30}
                          iconSize={8}
                          formatter={(value: string) => (
                            <span style={{ color: "#9ca3af", fontSize: "11px" }}>{value}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </PermissionGate>

          {/* ── Tasks + Profile + Activity row ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Tasks Panel */}
            <div className="xl:col-span-2 bg-card/60 backdrop-blur-sm border border-border rounded-xl p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">My Tasks</h3>
                  <span className="text-[10px] bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full">
                    {filteredTasks.length}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-background/50 border border-border rounded-lg p-0.5">
                  {(["all", "active", "completed"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                        filter === f
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add task form */}
              <form onSubmit={addTask} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="What needs to be done?"
                  className="flex-1 bg-background/60 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 transition"
                />
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim()}
                  className="bg-primary text-primary-foreground px-3 py-2 rounded-lg font-medium flex items-center gap-1.5 hover:opacity-90 disabled:opacity-40 transition text-sm"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </form>

              {/* Task list */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-border rounded-lg">
                    <ListTodo className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {filter === "all" ? "No tasks yet — add one above!" : `No ${filter} tasks`}
                    </p>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between px-3 py-2.5 border border-border rounded-lg bg-background/40 hover:bg-accent/30 transition group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => toggleTask(task)}
                          className="text-muted-foreground hover:text-primary transition focus:outline-none flex-shrink-0"
                        >
                          {task.is_completed ? (
                            <CheckCircle className="w-[18px] h-[18px] text-emerald-400" />
                          ) : (
                            <Circle className="w-[18px] h-[18px]" />
                          )}
                        </button>

                        {editingTaskId === task.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && saveEditTask()}
                              className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary/40"
                              autoFocus
                            />
                            <button
                              onClick={saveEditTask}
                              className="p-1 text-emerald-400 hover:bg-emerald-400/10 rounded transition"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingTaskId(null)}
                              className="p-1 text-muted-foreground hover:bg-accent rounded transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`text-sm truncate ${
                              task.is_completed ? "line-through text-muted-foreground" : "text-foreground"
                            }`}
                          >
                            {task.title}
                          </span>
                        )}
                      </div>

                      {editingTaskId !== task.id && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                          <button
                            onClick={() => startEditTask(task)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-1.5 text-destructive/70 hover:text-destructive hover:bg-destructive/10 rounded-md transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right column: Profile + Activity */}
            <div className="space-y-4">
              {/* Profile Card */}
              <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-4 sm:p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold">Profile</h3>
                  </div>
                  <button
                    onClick={() => setEditingProfile(!editingProfile)}
                    className="p-1.5 rounded-md hover:bg-accent/60 text-muted-foreground hover:text-foreground transition"
                  >
                    {editingProfile ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex flex-col items-center text-center mb-4">
                  <Avatar className="w-16 h-16 border-2 border-primary/30 mb-3 shadow-[0_0_20px_rgba(52,211,153,0.15)]">
                    <AvatarFallback className="bg-primary/15 text-primary font-bold text-xl">
                      {profile?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  {!editingProfile ? (
                    <>
                      <h4 className="font-semibold text-sm">{profile?.name || "Unnamed"}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
                      {profile?.bio && (
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-[200px]">
                          {profile.bio}
                        </p>
                      )}
                      {profile?.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                          <MapPin className="w-3 h-3" />
                          <span>{profile.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-[10px] mt-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                        <Shield className="w-3 h-3" />
                        {profile?.role || "user"}
                      </div>
                    </>
                  ) : (
                    <div className="w-full space-y-2.5 mt-1 text-left">
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Name
                        </label>
                        <input
                          value={profileForm.name}
                          onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                          className="w-full bg-background/60 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Bio
                        </label>
                        <textarea
                          value={profileForm.bio}
                          onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value }))}
                          rows={2}
                          className="w-full bg-background/60 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 mt-0.5 resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Location
                        </label>
                        <input
                          value={profileForm.location}
                          onChange={(e) => setProfileForm((p) => ({ ...p, location: e.target.value }))}
                          className="w-full bg-background/60 border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40 mt-0.5"
                        />
                      </div>
                      <button
                        onClick={saveProfile}
                        className="w-full bg-primary text-primary-foreground py-2 rounded-lg text-xs font-medium hover:opacity-90 transition flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Profile
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Activity Feed */}
              <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold">Activity Feed</h3>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                  {activityFeed.length === 0 ? (
                    <div className="text-center py-6">
                      <FileText className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">
                        Activity will appear here in real time
                      </p>
                    </div>
                  ) : (
                    activityFeed.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-2.5 py-1.5 animate-in fade-in slide-in-from-top-1 duration-300"
                      >
                        <div
                          className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            item.type === "create"
                              ? "bg-blue-500/15 text-blue-400"
                              : item.type === "complete"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          {item.type === "create" ? (
                            <Plus className="w-3 h-3" />
                          ) : item.type === "complete" ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground leading-relaxed truncate">
                            {item.text}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {timeAgo(item.time)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
