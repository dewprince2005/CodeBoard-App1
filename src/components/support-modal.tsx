import { useState } from "react";
import { toast } from "sonner";
import {
  MessageSquare,
  User,
  Mail,
  BookOpen,
  Send,
  CheckCircle,
  X
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SupportModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("feedback");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    }

    if (!email) {
      tempErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      tempErrors.email = "Please enter a valid email address";
    }

    if (!message.trim()) {
      tempErrors.message = "Message is required";
    } else if (message.trim().length < 10) {
      tempErrors.message = "Message must be at least 10 characters";
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
      // Simulate API latency for a premium loading state
      await new Promise((resolve) => setTimeout(resolve, 1200));
      toast.success("Thank you! Your message has been sent successfully.");
      setSubmitted(true);
      
      // Auto-close dialog after 1.5 seconds on successful submission
      setTimeout(() => {
        setOpen(false);
        // Reset form state after transition completes
        setTimeout(resetForm, 300);
      }, 1500);
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
    setErrors({});
    setSubmitted(false);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      setOpen(val);
      if (!val) {
        // Reset form on close
        resetForm();
      }
    }}>
      <DialogTrigger asChild>
        <button
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground hover:opacity-90 shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer border border-primary/20 group"
          title="Contact Support"
        >
          <MessageSquare className="w-5 h-5 transition-transform group-hover:rotate-12" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] sm:max-w-[480px] rounded-xl bg-card border border-border p-6 shadow-2xl overflow-hidden">
        {/* Visual Top Border highlight */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent" />

        {submitted ? (
          /* Success View */
          <div className="text-center py-8 space-y-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">Message Sent!</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-2">
                Thank you! We've received your feedback and will get back to you shortly.
              </DialogDescription>
            </div>
          </div>
        ) : (
          /* Form View */
          <div className="space-y-4 animate-in fade-in duration-200">
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                <span>Support & Feedback</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Have questions or feedback about CodeBoard? Let us know how we can help.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/80">Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
                    <User className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder="John Doe"
                    disabled={loading}
                    className={`w-full bg-background border ${
                      errors.name ? "border-destructive/80 focus:ring-destructive/20" : "border-border focus:border-primary/80 focus:ring-primary/25"
                    } rounded-lg pl-9 pr-3 py-2 text-sm text-foreground outline-none transition-all focus:ring-2`}
                  />
                </div>
                {errors.name && (
                  <p className="text-[10px] text-destructive font-medium">{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/80">Email</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="you@example.com"
                    disabled={loading}
                    className={`w-full bg-background border ${
                      errors.email ? "border-destructive/80 focus:ring-destructive/20" : "border-border focus:border-primary/80 focus:ring-primary/25"
                    } rounded-lg pl-9 pr-3 py-2 text-sm text-foreground outline-none transition-all focus:ring-2`}
                  />
                </div>
                {errors.email && (
                  <p className="text-[10px] text-destructive font-medium">{errors.email}</p>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/80">Subject</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
                    <BookOpen className="w-3.5 h-3.5" />
                  </span>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={loading}
                    className="w-full bg-background border border-border focus:border-primary/80 focus:ring-primary/25 rounded-lg pl-9 pr-3 py-2 text-sm text-foreground outline-none transition-all focus:ring-2 appearance-none cursor-pointer"
                  >
                    <option value="feedback">General Feedback</option>
                    <option value="bug">Report a Bug</option>
                    <option value="feature">Request Feature</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground/80">Message</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
                  }}
                  placeholder="Describe your issue or feedback..."
                  disabled={loading}
                  className={`w-full bg-background border ${
                    errors.message ? "border-destructive/80 focus:ring-destructive/20" : "border-border focus:border-primary/80 focus:ring-primary/25"
                  } rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-all focus:ring-2 resize-none`}
                />
                {errors.message && (
                  <p className="text-[10px] text-destructive font-medium">{errors.message}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:opacity-95 text-primary-foreground font-semibold rounded-lg py-2.5 text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Message</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
