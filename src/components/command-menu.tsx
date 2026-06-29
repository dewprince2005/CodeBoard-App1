import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity-logger";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home,
  LayoutDashboard,
  ListTodo,
  FolderClock,
  Trash2,
  Shield,
  Sun,
  Moon,
  LogOut,
  Plus,
  CheckCircle2,
  Circle,
  Code2,
  User,
} from "lucide-react";

type Task = {
  id: string;
  title: string;
  is_completed: boolean;
};

type Session = {
  id: string;
  room_code: string;
  language: string;
};

type Profile = {
  id: string;
  email: string;
  role: string;
};

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Data lists
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [myRole, setMyRole] = useState<string>("user");

  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  // Keyboard shortcut & Custom event togglers
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };

    const handleToggle = () => {
      setOpen((o) => !o);
    };

    document.addEventListener("keydown", down);
    window.addEventListener("toggle-command-menu", handleToggle);

    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("toggle-command-menu", handleToggle);
    };
  }, []);

  // Fetch data on open
  useEffect(() => {
    if (!open || !user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch current role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        
        const role = profile?.role || "user";
        setMyRole(role);

        // 2. Fetch Tasks (recent 20)
        const tasksQuery = supabase
          .from("tasks")
          .select("id, title, is_completed")
          .is("deleted_at", null)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        // 3. Fetch Sessions (recent 20)
        const sessionsQuery = supabase
          .from("sessions")
          .select("id, room_code, language")
          .order("created_at", { ascending: false })
          .limit(20);

        // 4. Fetch Profiles if admin/moderator
        const profilesQuery = (role === "admin" || role === "moderator")
          ? supabase.from("profiles").select("id, email, role").limit(20)
          : Promise.resolve({ data: [] });

        const [tasksRes, sessionsRes, profilesRes] = await Promise.all([
          tasksQuery,
          sessionsQuery,
          profilesQuery,
        ]);

        if (tasksRes.data) setTasks(tasksRes.data);
        if (sessionsRes.data) setSessions(sessionsRes.data as unknown as Session[]);
        if (profilesRes.data) setProfiles(profilesRes.data as unknown as Profile[]);
      } catch (err) {
        console.error("Failed to load search data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, user]);

  const handleSelectRoute = (to: string) => {
    navigate({ to });
    setOpen(false);
    setSearch("");
  };

  const handleToggleTask = async (task: Task) => {
    const newStatus = !task.is_completed;
    
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, is_completed: newStatus } : t))
    );

    const { error } = await supabase
      .from("tasks")
      .update({ is_completed: newStatus })
      .eq("id", task.id);

    if (error) {
      toast.error("Failed to update task");
      // Revert
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_completed: !newStatus } : t))
      );
    } else {
      await logActivity({
        action: "click:toggle_task",
        after_state: { task_id: task.id, is_completed: newStatus },
      });
      toast.success(newStatus ? "Task completed!" : "Task reopened!");
    }
  };

  const handleCreateTask = async () => {
    const title = search.trim();
    if (!title || !user) return;

    setSearch("");
    const { data, error } = await supabase
      .from("tasks")
      .insert({ title, user_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create task");
      return;
    }

    await logActivity({
      action: "click:add_task",
      after_state: { task_id: data.id, title },
    });

    setTasks((prev) => [data, ...prev]);
    toast.success(`Task "${title}" created!`);
    setOpen(false);
  };

  const handleToggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
    toast.success(`Theme switched to ${theme === "dark" ? "light" : "dark"} mode!`);
    setOpen(false);
  };

  const handleSignOut = async () => {
    await logActivity({ action: "click:sign_out" });
    await signOut();
    setOpen(false);
    navigate({ to: "/auth" });
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search navigation, tasks, sessions, or type to add a task..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="custom-scrollbar">
        <CommandEmpty className="flex flex-col items-center justify-center py-6 px-4">
          <p className="text-sm text-muted-foreground">No matches found.</p>
          {search.trim() !== "" && (
            <button
              onClick={handleCreateTask}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition cursor-pointer shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task: "{search}"</span>
            </button>
          )}
        </CommandEmpty>

        {search.trim() !== "" && (
          <CommandGroup heading="Quick Actions">
            <CommandItem
              onSelect={handleCreateTask}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-primary" />
              <span className="font-medium">Create Task: "{search}"</span>
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleSelectRoute("/")} className="cursor-pointer">
            <Home className="w-4 h-4 mr-2" />
            <span>Home</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectRoute("/dashboard")} className="cursor-pointer">
            <LayoutDashboard className="w-4 h-4 mr-2" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectRoute("/tasks")} className="cursor-pointer">
            <ListTodo className="w-4 h-4 mr-2" />
            <span>Tasks Manager</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectRoute("/history")} className="cursor-pointer">
            <FolderClock className="w-4 h-4 mr-2" />
            <span>Saved Sessions</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelectRoute("/trash")} className="cursor-pointer">
            <Trash2 className="w-4 h-4 mr-2" />
            <span>Trash Bin</span>
          </CommandItem>
          {(myRole === "admin" || myRole === "moderator") && (
            <CommandItem onSelect={() => handleSelectRoute("/admin")} className="cursor-pointer">
              <Shield className="w-4 h-4 mr-2" />
              <span>Admin Panel</span>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={handleToggleTheme} className="cursor-pointer">
            {theme === "dark" ? (
              <Sun className="w-4 h-4 mr-2 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 mr-2 text-violet-400" />
            )}
            <span>Toggle theme ({theme === "dark" ? "Light" : "Dark"})</span>
          </CommandItem>
          {user && (
            <CommandItem onSelect={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              <span>Sign Out</span>
            </CommandItem>
          )}
        </CommandGroup>

        {tasks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="My Tasks (Click to toggle)">
              {tasks.map((task) => (
                <CommandItem
                  key={task.id}
                  onSelect={() => handleToggleTask(task)}
                  className="cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 truncate">
                    {task.is_completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={task.is_completed ? "line-through text-muted-foreground truncate" : "truncate"}>
                      {task.title}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {sessions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Collaborative Sessions">
              {sessions.map((session) => (
                <CommandItem
                  key={session.id}
                  onSelect={() => handleSelectRoute(`/session/${session.id}`)}
                  className="cursor-pointer"
                >
                  <Code2 className="w-4 h-4 mr-2 text-blue-400" />
                  <span className="font-mono">{session.room_code}</span>
                  <span className="ml-2 text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded capitalize">
                    {session.language}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {profiles.length > 0 && (myRole === "admin" || myRole === "moderator") && (
          <>
            <CommandSeparator />
            <CommandGroup heading="User Accounts (Admin)">
              {profiles.map((profile) => (
                <CommandItem
                  key={profile.id}
                  onSelect={() => handleSelectRoute("/admin")}
                  className="cursor-pointer"
                >
                  <User className="w-4 h-4 mr-2 text-violet-400" />
                  <span className="truncate">{profile.email}</span>
                  <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                    profile.role === "admin"
                      ? "bg-violet-500/10 text-violet-400"
                      : profile.role === "moderator"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {profile.role}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
