import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Shield,
  Users,
  ListTodo,
  Activity,
  BarChart3,
  TrendingUp,
  Search,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Home,
  LayoutDashboard,
  FolderClock,
  LogOut,
  Menu,
  ChevronDown,
  Clock,
  Server,
  Ticket,
  UserCog,
  FileText,
  Undo2,
  ArrowUpDown,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — CodeBoard" },
      {
        name: "description",
        content: "Admin dashboard for managing users, roles, and platform health.",
      },
    ],
  }),
  component: AdminDashboard,
});

/* ─────────────────── Types ─────────────────── */

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
  updated_at: string;
};

type AuditLog = {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_id: string | null;
  target_email: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
};

type BanUndo = {
  userId: string;
  email: string;
  previousState: boolean;
  timeout: ReturnType<typeof setTimeout>;
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

const ROLES = ["user", "moderator", "admin"] as const;
const PAGE_SIZE = 10;

/* ─────────────────── Component ─────────────────── */

function AdminDashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Current user's profile (for role check)
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Data
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [allTasks, setAllTasks] = useState<{ id: string; created_at: string; is_completed: boolean }[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // User management controls
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<"email" | "created_at" | "role">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Admin panel active tab
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");

  // Undo queue for ban/unban
  const undoQueueRef = useRef<Map<string, BanUndo>>(new Map());
  const [, forceRerender] = useState(0);

  // ─── Auth guard & role check ───
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchMyProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        const profile = data as unknown as Profile;
        setMyProfile(profile);
        if (profile.role !== "admin" && profile.role !== "moderator") {
          setAccessDenied(true);
          toast.error("Access denied. Admin privileges required.");
          navigate({ to: "/dashboard" });
        }
      } else {
        setAccessDenied(true);
        navigate({ to: "/" });
      }
    };
    fetchMyProfile();
  }, [user, navigate]);

  // ─── Fetch all data ───
  useEffect(() => {
    if (!user || accessDenied) return;
    const fetchAll = async () => {
      const [profilesRes, tasksRes, logsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("tasks").select("id, created_at, is_completed").order("created_at", { ascending: false }),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
      ]);

      if (profilesRes.data) setAllProfiles(profilesRes.data as unknown as Profile[]);
      if (tasksRes.data) setAllTasks(tasksRes.data);
      if (logsRes.data) setAuditLogs(logsRes.data as unknown as AuditLog[]);
      setLoading(false);
    };
    fetchAll();
  }, [user, accessDenied]);

  // ─── Real-time subscription on profiles ───
  useEffect(() => {
    if (!user || accessDenied) return;
    const channel = supabase
      .channel("admin-profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAllProfiles((prev) => [payload.new as unknown as Profile, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as unknown as Profile;
            setAllProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setAllProfiles((prev) => prev.filter((p) => p.id !== old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, accessDenied]);

  // ─── Audit log helper ───
  const createAuditLog = useCallback(
    async (
      action: string,
      targetId: string,
      targetEmail: string,
      before: Record<string, unknown> | null,
      after: Record<string, unknown> | null,
    ) => {
      await supabase.from("audit_logs").insert({
        actor_id: user!.id,
        actor_email: user!.email,
        action,
        target_id: targetId,
        target_email: targetEmail,
        before_state: before as any,
        after_state: after as any,
      });
      // Refresh audit logs
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setAuditLogs(data as unknown as AuditLog[]);
    },
    [user],
  );

  // ─── Ban / Unban with 5-second undo ───
  const toggleBan = useCallback(
    (profile: Profile) => {
      const newBanState = !profile.is_banned;

      // Optimistic update
      setAllProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, is_banned: newBanState } : p)),
      );

      // Check if there's an existing undo for this user
      const existing = undoQueueRef.current.get(profile.id);
      if (existing) {
        clearTimeout(existing.timeout);
        undoQueueRef.current.delete(profile.id);
      }

      const timeout = setTimeout(async () => {
        // Commit the ban/unban
        const { error } = await supabase
          .from("profiles")
          .update({ is_banned: newBanState, updated_at: new Date().toISOString() })
          .eq("id", profile.id);

        if (error) {
          toast.error(`Failed to ${newBanState ? "ban" : "unban"} user`);
          setAllProfiles((prev) =>
            prev.map((p) => (p.id === profile.id ? { ...p, is_banned: !newBanState } : p)),
          );
        } else {
          await createAuditLog(
            newBanState ? "BAN_USER" : "UNBAN_USER",
            profile.id,
            profile.email,
            { is_banned: !newBanState },
            { is_banned: newBanState },
          );
        }

        undoQueueRef.current.delete(profile.id);
        forceRerender((n) => n + 1);
      }, 5000);

      undoQueueRef.current.set(profile.id, {
        userId: profile.id,
        email: profile.email,
        previousState: !newBanState,
        timeout,
      });
      forceRerender((n) => n + 1);

      toast(
        `${newBanState ? "Banned" : "Unbanned"} ${profile.email}`,
        {
          action: {
            label: "Undo",
            onClick: () => {
              const undo = undoQueueRef.current.get(profile.id);
              if (undo) {
                clearTimeout(undo.timeout);
                undoQueueRef.current.delete(profile.id);
                setAllProfiles((prev) =>
                  prev.map((p) =>
                    p.id === profile.id ? { ...p, is_banned: undo.previousState } : p,
                  ),
                );
                forceRerender((n) => n + 1);
                toast.info("Action undone");
              }
            },
          },
          duration: 5000,
        },
      );
    },
    [createAuditLog],
  );

  // ─── Role change ───
  const changeRole = useCallback(
    async (profile: Profile, newRole: string) => {
      if (profile.role === newRole) return;
      const prevRole = profile.role;

      setAllProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, role: newRole } : p)),
      );

      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("id", profile.id);

      if (error) {
        toast.error("Failed to update role");
        setAllProfiles((prev) =>
          prev.map((p) => (p.id === profile.id ? { ...p, role: prevRole } : p)),
        );
      } else {
        toast.success(`${profile.email} is now ${newRole}`);
        await createAuditLog(
          "ROLE_CHANGE",
          profile.id,
          profile.email,
          { role: prevRole },
          { role: newRole },
        );
      }
    },
    [createAuditLog],
  );

  // ─── Computed metrics ───
  const totalUsers = allProfiles.length;
  const todaySignups = allProfiles.filter(
    (p) => new Date(p.created_at).toDateString() === new Date().toDateString(),
  ).length;
  const totalTasks = allTasks.length;
  const bannedUsers = allProfiles.filter((p) => p.is_banned).length;

  // Users chart data (last 7 days)
  const usersChartData = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      days[key] = 0;
    }
    allProfiles.forEach((p) => {
      const d = new Date(p.created_at);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (key in days) days[key]++;
    });
    return Object.entries(days).map(([date, count]) => ({ date, users: count }));
  }, [allProfiles]);

  // Tasks chart data (last 7 days)
  const tasksChartData = useMemo(() => {
    const days: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      days[key] = 0;
    }
    allTasks.forEach((t) => {
      const d = new Date(t.created_at);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (key in days) days[key]++;
    });
    return Object.entries(days).map(([date, count]) => ({ date, tasks: count }));
  }, [allTasks]);

  // Filtered & sorted users
  const filteredProfiles = useMemo(() => {
    let list = [...allProfiles];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.email.toLowerCase().includes(q) ||
          (p.name && p.name.toLowerCase().includes(q)),
      );
    }

    if (roleFilter !== "all") {
      list = list.filter((p) => p.role === roleFilter);
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "email") cmp = a.email.localeCompare(b.email);
      else if (sortField === "role") cmp = a.role.localeCompare(b.role);
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [allProfiles, searchQuery, roleFilter, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredProfiles.length / PAGE_SIZE));
  const pagedProfiles = filteredProfiles.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchQuery, roleFilter]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // ─── Loading / access ───
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Shield className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-1">Access Denied</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You need admin or moderator privileges to access this page.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition"
          >
            <Home className="w-4 h-4" /> Go Home
          </Link>
        </div>
      </div>
    );
  }

  // ─── Sidebar nav items ───
  const navItems = [
    { icon: Home, label: "Home", to: "/" as const },
    { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" as const },
    { icon: ListTodo, label: "Tasks", to: "/tasks" as const },
    { icon: FolderClock, label: "Sessions", to: "/history" as const },
    { icon: Shield, label: "Admin Panel", to: "/admin" as const, active: true },
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
        </nav>

        <div className="border-t border-border/50 p-3">
          <div className={`flex items-center gap-3 ${sidebarOpen ? "px-2" : "justify-center"}`}>
            <Avatar className="w-8 h-8 border border-border">
              <AvatarFallback className="bg-primary/20 text-primary font-semibold uppercase text-xs">
                {myProfile?.name?.[0] || user?.email?.[0] || "A"}
              </AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{myProfile?.name || "Admin"}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </div>
            )}
            {sidebarOpen && (
              <button
                onClick={signOut}
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
                <Shield className="w-5 h-5 text-primary" />
                Admin Panel
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                Manage users, roles, and platform health
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {/* ── Metrics cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: "Total Users",
                value: totalUsers,
                icon: Users,
                color: "text-blue-400",
                bg: "bg-blue-500/10",
                border: "border-blue-500/20",
              },
              {
                label: "Today's Signups",
                value: todaySignups,
                icon: TrendingUp,
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20",
              },
              {
                label: "Total Tasks",
                value: totalTasks,
                icon: ListTodo,
                color: "text-violet-400",
                bg: "bg-violet-500/10",
                border: "border-violet-500/20",
              },
              {
                label: "System Uptime",
                value: "99.9%",
                icon: Server,
                color: "text-teal-400",
                bg: "bg-teal-500/10",
                border: "border-teal-500/20",
                subtitle: "All systems operational",
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
                    {"subtitle" in card && (
                      <p className="text-[10px] text-muted-foreground mt-1">{card.subtitle}</p>
                    )}
                  </div>
                  <div className={`p-2.5 rounded-xl ${card.bg} group-hover:scale-110 transition-transform duration-300`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                </div>
                <div className={`absolute -bottom-6 -right-6 w-24 h-24 ${card.bg} rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition-opacity`} />
              </div>
            ))}
          </div>

          {/* ── Charts row ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* User registrations chart */}
            <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">User Registrations (7 days)</h3>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usersChartData}>
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
                    <Bar dataKey="users" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tasks created chart */}
            <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Tasks Created (7 days)</h3>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tasksChartData}>
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
                    <Line
                      type="monotone"
                      dataKey="tasks"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#34d399" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── Tab switcher ── */}
          <div className="flex items-center gap-1 bg-card/60 border border-border rounded-lg p-1 mb-4 w-fit">
            <button
              onClick={() => setActiveTab("users")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === "users"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserCog className="w-4 h-4" />
              User Management
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === "audit"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="w-4 h-4" />
              Audit Logs
            </button>
          </div>

          {/* ── User Management Tab ── */}
          {activeTab === "users" && (
            <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-4 sm:p-5">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name or email…"
                      className="w-full bg-background/60 border border-border rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 transition"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="bg-background/60 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="all">All Roles</option>
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {filteredProfiles.length} result{filteredProfiles.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-background/50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        User
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition"
                        onClick={() => toggleSort("email")}
                      >
                        <div className="flex items-center gap-1">
                          Email
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition"
                        onClick={() => toggleSort("role")}
                      >
                        <div className="flex items-center gap-1">
                          Role
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition"
                        onClick={() => toggleSort("created_at")}
                      >
                        <div className="flex items-center gap-1">
                          Joined
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pagedProfiles.map((p) => {
                      const hasPendingUndo = undoQueueRef.current.has(p.id);
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-accent/30 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <Avatar className="w-7 h-7 border border-border">
                                <AvatarFallback className="bg-primary/15 text-primary font-semibold text-[10px] uppercase">
                                  {p.name?.[0] || p.email[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs font-medium truncate max-w-[120px]">
                                {p.name || "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[180px]">
                            {p.email}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={p.role}
                              onChange={(e) => changeRole(p, e.target.value)}
                              disabled={p.id === user?.id}
                              className={`
                                text-[11px] font-medium px-2 py-1 rounded-md border
                                outline-none transition
                                ${
                                  p.role === "admin"
                                    ? "bg-violet-500/10 border-violet-500/30 text-violet-400"
                                    : p.role === "moderator"
                                      ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                      : "bg-background/60 border-border text-muted-foreground"
                                }
                                ${p.id === user?.id ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                              `}
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`
                                inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full
                                ${
                                  p.is_banned
                                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                }
                              `}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  p.is_banned ? "bg-red-400" : "bg-emerald-400"
                                }`}
                              />
                              {p.is_banned ? "Banned" : "Active"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(p.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {hasPendingUndo && (
                                <button
                                  onClick={() => {
                                    const undo = undoQueueRef.current.get(p.id);
                                    if (undo) {
                                      clearTimeout(undo.timeout);
                                      undoQueueRef.current.delete(p.id);
                                      setAllProfiles((prev) =>
                                        prev.map((pr) =>
                                          pr.id === p.id
                                            ? { ...pr, is_banned: undo.previousState }
                                            : pr,
                                        ),
                                      );
                                      forceRerender((n) => n + 1);
                                    }
                                  }}
                                  className="p-1.5 rounded-md text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition text-[10px] flex items-center gap-1"
                                  title="Undo"
                                >
                                  <Undo2 className="w-3 h-3" />
                                </button>
                              )}
                              <button
                                onClick={() => toggleBan(p)}
                                disabled={p.id === user?.id}
                                className={`
                                  p-1.5 rounded-md text-xs transition flex items-center gap-1
                                  ${p.id === user?.id ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                                  ${
                                    p.is_banned
                                      ? "text-emerald-400 hover:bg-emerald-500/10"
                                      : "text-red-400 hover:bg-red-500/10"
                                  }
                                `}
                                title={p.is_banned ? "Unban" : "Ban"}
                              >
                                {p.is_banned ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <Ban className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {pagedProfiles.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                          No users match your filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, filteredProfiles.length)} of{" "}
                  {filteredProfiles.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-muted-foreground px-2">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-md border border-border hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Audit Logs Tab ── */}
          {activeTab === "audit" && (
            <div className="bg-card/60 backdrop-blur-sm border border-border rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Audit Logs</h3>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-muted-foreground ml-auto">
                  {auditLogs.length} events
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-border rounded-lg">
                  <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No audit events recorded yet
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Actions like banning users or changing roles will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {auditLogs.map((log) => {
                    const isRole = log.action === "ROLE_CHANGE";
                    const isBan = log.action === "BAN_USER";
                    const isUnban = log.action === "UNBAN_USER";

                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-3 border border-border rounded-lg bg-background/40 hover:bg-accent/20 transition"
                      >
                        <div
                          className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isRole
                              ? "bg-violet-500/15 text-violet-400"
                              : isBan
                                ? "bg-red-500/15 text-red-400"
                                : isUnban
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-blue-500/15 text-blue-400"
                          }`}
                        >
                          {isRole ? (
                            <UserCog className="w-3.5 h-3.5" />
                          ) : isBan ? (
                            <Ban className="w-3.5 h-3.5" />
                          ) : isUnban ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <Activity className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold">{log.action.replace(/_/g, " ")}</span>
                            <span className="text-[10px] text-muted-foreground">
                              by {log.actor_email || "system"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Target: <span className="text-foreground/80">{log.target_email || log.target_id || "—"}</span>
                          </p>
                          {log.before_state && log.after_state && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">
                                {JSON.stringify(log.before_state)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">→</span>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">
                                {JSON.stringify(log.after_state)}
                              </span>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            <Clock className="w-3 h-3 inline mr-0.5 -mt-px" />
                            {timeAgo(log.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
