import { useState, useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { MessageSquare, X, Send, Loader2, Bot, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { sendChatMessage } from "@/lib/api/chatbot.functions";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export function ChatbotFloating() {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const conversationIdRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize conversation ID and history from sessionStorage
  useEffect(() => {
    // 1. Get or create conversation UUID
    let conversationId = sessionStorage.getItem("chatbot_conversation_id");
    if (!conversationId) {
      conversationId = crypto.randomUUID();
      sessionStorage.setItem("chatbot_conversation_id", conversationId);
    }
    conversationIdRef.current = conversationId;

    // 2. Get or create session messages
    const sessionMsgs = sessionStorage.getItem("chatbot_messages");
    if (sessionMsgs) {
      try {
        setMessages(JSON.parse(sessionMsgs));
      } catch (e) {
        console.error("Failed to parse stored chatbot messages", e);
      }
    } else {
      const welcomeMsg: Message = {
        role: "assistant",
        content: "Hi! I am your CodeBoard AI Assistant. I can help you create or join pair-coding rooms, manage tasks, explore features, and navigate the application. How can I help you today?",
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMsg]);
      sessionStorage.setItem("chatbot_messages", JSON.stringify([welcomeMsg]));
    }
  }, []);

  // Fetch past messages from Supabase if authenticated to sync history (optional enhancement)
  useEffect(() => {
    if (!user) return;

    const syncHistory = async () => {
      const conversationId = conversationIdRef.current;
      if (!conversationId) return;

      const { data, error } = await supabase
        .from("chat_history")
        .select("role, message, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (!error && data && data.length > 0) {
        const synced: Message[] = data.map((d) => ({
          role: d.role as "user" | "assistant",
          content: d.message,
          timestamp: d.created_at,
        }));
        setMessages(synced);
        sessionStorage.setItem("chatbot_messages", JSON.stringify(synced));
      }
    };

    syncHistory();
  }, [user]);

  // Auto-scroll to the latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;

    // Clear input & reset error
    setInputValue("");
    setErrorMsg(null);
    setIsLoading(true);

    const timestamp = new Date().toISOString();
    const userMessage: Message = {
      role: "user",
      content: text,
      timestamp,
    };

    // Update frontend state & sessionStorage
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    sessionStorage.setItem("chatbot_messages", JSON.stringify(updatedMessages));

    const conversationId = conversationIdRef.current;

    // Save user message to Supabase
    try {
      await supabase.from("chat_history").insert({
        conversation_id: conversationId,
        user_id: user?.id || null,
        role: "user",
        message: text,
      });
    } catch (e) {
      console.warn("Could not save user message to chat_history table", e);
    }

    try {
      const result = await sendChatMessage({
        data: {
          message: text,
          userId: user?.id || null,
          conversationId,
          timestamp,
          currentPage: location.pathname,
        }
      });

      const assistantMessage: Message = {
        role: "assistant",
        content: result.message,
        timestamp: new Date().toISOString(),
      };

      // Save assistant response to Supabase
      try {
        await supabase.from("chat_history").insert({
          conversation_id: conversationId,
          user_id: user?.id || null,
          role: "assistant",
          message: result.message,
        });
      } catch (e) {
        console.warn("Could not save assistant message to chat_history table", e);
      }

      // Update frontend state & sessionStorage
      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      sessionStorage.setItem("chatbot_messages", JSON.stringify(finalMessages));
    } catch (err) {
      console.error("Chatbot request failed:", err);
      const errorMessage = (err as Error).message || "The AI assistant is currently unavailable. Please try again later.";
      setErrorMsg(errorMessage);
      toast.error("Failed to connect to the AI Agent");
    } finally {
      setIsLoading(false);
    }
  };

  // Safe inline text formatting parser for basic markdown bold, lists, and code blocks
  const renderMessageContent = (content: string) => {
    const parseBold = (text: string): React.ReactNode[] | string => {
      if (!text.includes("**")) return text;
      const parts = text.split("**");
      return parts.map((part, index) => {
        if (index % 2 === 1) {
          return (
            <strong key={index} className="font-bold text-foreground">
              {part}
            </strong>
          );
        }
        return part;
      });
    };

    const lines = content.split("\n");
    return (
      <div className="space-y-1 break-words text-sm leading-relaxed">
        {lines.map((line, idx) => {
          // Unordered list items
          if (line.startsWith("* ") || line.startsWith("- ")) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-2 py-0.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
                <span className="flex-1">{parseBold(line.substring(2))}</span>
              </div>
            );
          }
          // Numbered list items
          const numListMatch = line.match(/^(\d+)\.\s(.*)/);
          if (numListMatch) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-2 py-0.5">
                <span className="font-medium text-foreground/75 shrink-0">{numListMatch[1]}.</span>
                <span className="flex-1">{parseBold(numListMatch[2])}</span>
              </div>
            );
          }
          // Empty lines become spacing
          if (line.trim() === "") {
            return <div key={idx} className="h-2" />;
          }
          // Regular text
          return <p key={idx}>{parseBold(line)}</p>;
        })}
      </div>
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <div
          ref={chatContainerRef}
          className="mb-4 flex h-[500px] w-96 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/95 text-card-foreground shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in-50 slide-in-from-bottom-8 max-sm:fixed max-sm:bottom-0 max-sm:right-0 max-sm:h-full max-sm:w-full max-sm:rounded-none max-sm:border-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/50 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8 border border-primary/20">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-sm font-semibold tracking-tight">CodeBoard AI</h3>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] text-muted-foreground font-medium">Online</span>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <Avatar className="h-7 w-7 shrink-0 border border-muted/55">
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      <Bot className="h-3.5 w-3.5" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm transition-all ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-muted/70 text-foreground border border-border/40 rounded-tl-none"
                  }`}
                >
                  {renderMessageContent(msg.content)}
                </div>
              </div>
            ))}

            {/* Writing / Loading Indicator */}
            {isLoading && (
              <div className="flex gap-2.5 justify-start">
                <Avatar className="h-7 w-7 shrink-0 border border-muted/55">
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    <Bot className="h-3.5 w-3.5" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted/70 text-muted-foreground rounded-2xl rounded-tl-none px-3.5 py-3 border border-border/40 flex items-center justify-center gap-1.5 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                </div>
              </div>
            )}

            {/* Error Message Box */}
            {errorMsg && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 flex items-start gap-2.5 text-destructive animate-in fade-in-50">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Connection Issue</p>
                  <p className="text-[11px] leading-relaxed text-destructive/90">{errorMsg}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Area */}
          <div className="border-t border-border/60 bg-muted/30 p-3 flex gap-2 items-end">
            <Textarea
              placeholder="Ask me to summarize invoices..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[40px] max-h-[120px] resize-none bg-background/50 border-border/80 focus-visible:ring-primary focus-visible:ring-offset-0 flex-1 rounded-xl py-2 px-3 text-sm scrollbar-thin"
              rows={1}
            />
            <Button
              size="icon"
              disabled={isLoading || !inputValue.trim()}
              onClick={handleSendMessage}
              className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-md active:scale-95"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <Button
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl hover:scale-105 transition-all duration-300 border-2 border-border/20"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </Button>
    </div>
  );
}
