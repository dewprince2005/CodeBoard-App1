import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  Mail,
  MessageSquare,
  Send,
  User,
  ArrowLeft,
  CheckCircle,
  Twitter,
  Github,
  Globe,
  BookOpen,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact CodeBoard — Get in Touch" },
      {
        name: "description",
        content: "Have questions, suggestions, or feedback about CodeBoard? Reach out to our team.",
      },
      { property: "og:title", content: "Contact CodeBoard" },
      {
        property: "og:description",
        content: "Have questions, suggestions, or feedback about CodeBoard? Reach out to our team.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("feedback");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    message?: string;
  }>({});

  const validate = () => {
    const tempErrors: typeof errors = {};
    if (!name.trim()) {
      tempErrors.name = "Name is required";
    } else if (name.trim().length < 2) {
      tempErrors.name = "Name must be at least 2 characters";
    } else if (name.trim().length > 100) {
      tempErrors.name = "Name must be under 100 characters";
    }

    if (!email) {
      tempErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = "Please enter a valid email address";
    } else if (email.length > 254) {
      tempErrors.email = "Email address is too long (maximum 254 characters)";
    }

    if (!message.trim()) {
      tempErrors.message = "Message is required";
    } else if (message.trim().length < 10) {
      tempErrors.message = "Message must be at least 10 characters";
    } else if (message.length > 5000) {
      tempErrors.message = "Message is too long (maximum 5000 characters)";
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please correct the errors in the form.");
      return;
    }

    setLoading(true);
    try {
      // Honeypot check for spam protection (Page 5 checklist)
      if (honeypot) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        toast.success("Thank you! Your message has been sent successfully.");
        setSubmitted(true);
        return;
      }

      // Store: save to Supabase table for record-keeping (Page 5 checklist)
      const { error } = await supabase.from("contact_messages").insert({
        name,
        email,
        subject,
        message,
      });

      if (error) throw error;

      toast.success("Thank you! Your message has been sent successfully.");
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setSubject("feedback");
    setMessage("");
    setHoneypot("");
    setErrors({});
    setSubmitted(false);
  };

  return (
    <div className="min-h-screen relative flex flex-col bg-background text-foreground overflow-hidden">
      {/* Premium ambient light effects */}
      <div className="absolute top-[-10%] left-[-15%] w-[60%] h-[60%] bg-[radial-gradient(circle,rgba(124,58,237,0.08)_0%,transparent_75%)] dark:bg-[radial-gradient(circle,rgba(124,58,237,0.15)_0%,transparent_75%)] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-15%] w-[60%] h-[60%] bg-[radial-gradient(circle,rgba(6,182,212,0.06)_0%,transparent_75%)] dark:bg-[radial-gradient(circle,rgba(6,182,212,0.12)_0%,transparent_75%)] rounded-full blur-[140px] pointer-events-none" />

      {/* Grid lines background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370e_1px,transparent_1px),linear-gradient(to_bottom,#1f29370e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-background/30 backdrop-blur-md sticky top-0 z-50">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs shadow-[0_0_10px_rgba(52,211,153,0.3)]">
            {"</>"}
          </div>
          <span className="font-semibold tracking-tight">CodeBoard</span>
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 md:py-20 z-10">
        {/* Title Section */}
        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Get in <span className="text-primary">Touch</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            Have feedback, feature requests, or questions about CodeBoard? Let us know how we can
            improve your real-time collaborative coding experience.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-8 items-start">
          {/* Info Side Column (Left) */}
          <div className="md:col-span-2 space-y-6">
            {/* System Status Card */}
            <div className="backdrop-blur-xl bg-card/30 border border-border/40 rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:border-border/80 hover:shadow-lg">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  System Status
                </span>
              </div>
              <h3 className="text-lg font-bold mt-2 text-foreground">All Systems Operational</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Collaborative coding servers are currently active with 99.9% uptime.
              </p>
            </div>

            {/* Direct Contact Card */}
            <div className="backdrop-blur-xl bg-card/30 border border-border/40 rounded-2xl p-6 space-y-5 transition-all duration-300 hover:border-border/80">
              <h3 className="text-md font-semibold text-foreground border-b border-border/30 pb-2">
                Developer Hub
              </h3>

              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary mt-0.5">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs text-muted-foreground font-medium">Support Email</h4>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    support@codeboard.dev
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary mt-0.5">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs text-muted-foreground font-medium">
                    Typical Response Time
                  </h4>
                  <p className="text-sm font-semibold text-foreground mt-0.5">Within 24 Hours</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-primary/10 text-primary mt-0.5">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs text-muted-foreground font-medium">Socials & Source</h4>
                  <div className="flex items-center gap-4 mt-2">
                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 text-xs font-medium"
                    >
                      <Github className="w-3.5 h-3.5" />
                      <span>GitHub</span>
                    </a>
                    <a
                      href="https://twitter.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground transition flex items-center gap-1.5 text-xs font-medium"
                    >
                      <Twitter className="w-3.5 h-3.5" />
                      <span>Twitter</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Column (Right) */}
          <div className="md:col-span-3">
            <div className="backdrop-blur-xl bg-card/40 border border-border/60 shadow-2xl rounded-2xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

              {submitted ? (
                /* Success View */
                <div className="text-center py-10 space-y-6 animate-in fade-in zoom-in duration-300">
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-[0_0_20px_rgba(52,211,153,0.15)]">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Message Sent!</h2>
                    <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                      Thank you for contacting CodeBoard. We have received your message and will get
                      back to you as soon as possible.
                    </p>
                  </div>
                  <div className="pt-4 flex justify-center gap-4">
                    <button
                      onClick={resetForm}
                      className="text-sm font-medium border border-border bg-background px-5 py-2.5 rounded-lg hover:bg-accent transition"
                    >
                      Send Another Message
                    </button>
                    <Link
                      to="/"
                      className="text-sm font-medium bg-primary text-primary-foreground px-5 py-2.5 rounded-lg hover:opacity-95 shadow-lg transition"
                    >
                      Return Home
                    </Link>
                  </div>
                </div>
              ) : (
                /* Form View */
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h2 className="text-xl font-bold text-foreground">Send a Message</h2>

                  {/* Name field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Your Name</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground pointer-events-none">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (errors.name) {
                            setErrors((prev) => ({ ...prev, name: undefined }));
                          }
                        }}
                        placeholder="John Doe"
                        className={`w-full bg-black/30 border ${
                          errors.name
                            ? "border-destructive/80 focus:ring-destructive/30"
                            : "border-border/60 focus:border-primary/80 focus:ring-primary/20"
                        } rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground outline-none transition-all focus:ring-2`}
                        disabled={loading}
                      />
                    </div>
                    {errors.name && (
                      <p className="text-[11px] text-destructive font-medium mt-1">{errors.name}</p>
                    )}
                  </div>

                  {/* Email field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Email Address</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground pointer-events-none">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) {
                            setErrors((prev) => ({ ...prev, email: undefined }));
                          }
                        }}
                        placeholder="you@example.com"
                        className={`w-full bg-black/30 border ${
                          errors.email
                            ? "border-destructive/80 focus:ring-destructive/30"
                            : "border-border/60 focus:border-primary/80 focus:ring-primary/20"
                        } rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground outline-none transition-all focus:ring-2`}
                        disabled={loading}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-[11px] text-destructive font-medium mt-1">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Subject field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Subject</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-muted-foreground pointer-events-none">
                        <BookOpen className="w-4 h-4" />
                      </span>
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full bg-black/30 border border-border/60 focus:border-primary/80 focus:ring-primary/20 rounded-lg pl-10 pr-4 py-2.5 text-sm text-foreground outline-none transition-all focus:ring-2 appearance-none cursor-pointer"
                        disabled={loading}
                      >
                        <option value="feedback">General Feedback</option>
                        <option value="bug">Report a Bug</option>
                        <option value="feature">Request Feature</option>
                        <option value="business">Business Inquiries</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3.5 pointer-events-none text-muted-foreground">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Message field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">Message</label>
                    <textarea
                      rows={5}
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        if (errors.message) {
                          setErrors((prev) => ({ ...prev, message: undefined }));
                        }
                      }}
                      placeholder="Write your message here..."
                      className={`w-full bg-black/30 border ${
                        errors.message
                          ? "border-destructive/80 focus:ring-destructive/30"
                          : "border-border/60 focus:border-primary/80 focus:ring-primary/20"
                      } rounded-lg px-4 py-2.5 text-sm text-foreground outline-none transition-all focus:ring-2 resize-y`}
                      disabled={loading}
                    />
                    {errors.message && (
                      <p className="text-[11px] text-destructive font-medium mt-1">
                        {errors.message}
                      </p>
                    )}
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1 px-1">
                      <span>Minimum 10 characters</span>
                      <span
                        className={message.length > 5000 ? "text-destructive font-semibold" : ""}
                      >
                        {message.length}/5000
                      </span>
                    </div>
                  </div>

                  {/* Honeypot spam protection (Page 5 checklist) */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="website" className="text-xs">
                      Leave this blank
                    </label>
                    <input
                      id="website"
                      type="text"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-lg py-3 text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_20px_rgba(52,211,153,0.15)] hover:shadow-[0_4px_20px_rgba(52,211,153,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Message</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-muted-foreground py-6 border-t border-border/40 bg-background/20 mt-auto">
        CodeBoard · Real-time collaborative coding
      </footer>
    </div>
  );
}
