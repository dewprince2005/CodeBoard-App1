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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileCode, File } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/session/$id")({
  component: SessionView,
});

const langExt = (l: string) => {
  switch (l) {
    case "python":
      return python();
    case "java":
      return java();
    case "cpp":
      return cpp();
    default:
      return javascript();
  }
};

const getFileExtension = (language: string): string => {
  switch (language.toLowerCase()) {
    case "python":
      return "py";
    case "java":
      return "java";
    case "cpp":
      return "cpp";
    case "javascript":
      return "js";
    case "typescript":
      return "ts";
    default:
      return "txt";
  }
};

const exportRawCode = (session: { final_code: string; language: string; room_code: string }) => {
  try {
    const ext = getFileExtension(session.language);
    const blob = new Blob([session.final_code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session_${session.room_code}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Source code downloaded successfully!");
  } catch (err) {
    console.error(err);
    toast.error("Failed to export source code");
  }
};

const exportToDocs = (session: {
  final_code: string;
  language: string;
  room_code: string;
  duration_sec: number;
  created_at: string;
}) => {
  try {
    const title = `CodeBoard Session: ${session.room_code}`;
    const dateStr = new Date(session.created_at).toLocaleString();
    const durationStr = `${Math.floor(session.duration_sec / 60)}m ${session.duration_sec % 60}s`;

    // Escape HTML characters in source code
    const escapedCode = session.final_code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #334155;
            margin: 40px;
          }
          .header {
            border-bottom: 2px solid #10b981;
            padding-bottom: 15px;
            margin-bottom: 25px;
          }
          .title {
            font-size: 24px;
            color: #10b981;
            font-weight: bold;
            margin: 0;
          }
          .meta-table {
            width: 100%;
            margin-top: 15px;
            font-size: 13px;
            color: #64748b;
          }
          .meta-table td {
            padding: 3px 0;
          }
          .code-container {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 15px;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            color: #0f172a;
            white-space: pre-wrap;
            word-break: break-all;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">CODEBOARD SESSION EXPORT</h1>
          <table class="meta-table">
            <tr>
              <td><strong>Room Code:</strong> ${session.room_code}</td>
              <td><strong>Language:</strong> ${session.language}</td>
            </tr>
            <tr>
              <td><strong>Duration:</strong> ${durationStr}</td>
              <td><strong>Exported On:</strong> ${dateStr}</td>
            </tr>
          </table>
        </div>
        <h2>Source Code</h2>
        <pre class="code-container"><code>${escapedCode}</code></pre>
      </body>
      </html>
    `;

    const blob = new Blob(["\ufeff" + htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session_${session.room_code}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Word document downloaded successfully!");
  } catch (err) {
    console.error(err);
    toast.error("Failed to export Word document");
  }
};

const exportToPDF = async (session: {
  final_code: string;
  language: string;
  room_code: string;
  duration_sec: number;
  created_at: string;
}) => {
  const toastId = toast.loading("Generating PDF...");
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    // Set metadata
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129); // CodeBoard green
    doc.text("CODEBOARD SESSION EXPORT", 20, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Room Code: ${session.room_code}`, 20, 30);
    doc.text(`Language: ${session.language}`, 20, 35);
    doc.text(
      `Duration: ${Math.floor(session.duration_sec / 60)}m ${session.duration_sec % 60}s`,
      20,
      40,
    );
    doc.text(`Exported On: ${new Date().toLocaleString()}`, 20, 45);

    // Draw line separator
    doc.setDrawColor(226, 232, 240); // border color
    doc.line(20, 50, 190, 50);

    // Add final code
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42); // slate-900

    const codeLines = doc.splitTextToSize(session.final_code, 170); // wrap to 170mm width

    let y = 60;
    const pageHeight = 280; // height limit for text

    for (let i = 0; i < codeLines.length; i++) {
      if (y > pageHeight) {
        doc.addPage();
        y = 20; // reset y on new page
      }
      doc.text(codeLines[i], 20, y);
      y += 4.5; // line spacing
    }

    doc.save(`session_${session.room_code}.pdf`);
    toast.dismiss(toastId);
    toast.success("PDF downloaded successfully!");
  } catch (err) {
    console.error(err);
    toast.dismiss(toastId);
    toast.error("Failed to generate PDF");
  }
};

function SessionView() {
  const { id } = Route.useParams();
  const { theme } = useTheme();
  const [data, setData] = useState<{
    final_code: string;
    language: string;
    room_code: string;
    duration_sec: number;
    created_at: string;
  } | null>(null);
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
          <Link to="/history" className="text-primary text-sm mt-3 inline-block">
            ← Back to history
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link to="/history" className="text-sm text-muted-foreground hover:text-foreground">
            ← History
          </Link>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {data && (
            <>
              <div className="flex items-center gap-3 text-muted-foreground font-medium">
                <span className="font-mono tracking-widest bg-secondary px-2 py-1 rounded text-foreground">
                  {data.room_code}
                </span>
                <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {data.language}
                </span>
                <span>
                  {Math.floor(data.duration_sec / 60)}m {data.duration_sec % 60}s
                </span>
              </div>

              <div className="h-4 w-px bg-border" />

              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-xs hover:opacity-90 transition cursor-pointer shadow-sm focus:outline-none">
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 mt-1.5 backdrop-blur-md bg-card/90"
                >
                  <DropdownMenuLabel>Choose Format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => exportToPDF(data)}
                    className="flex items-center gap-2 cursor-pointer focus:bg-accent"
                  >
                    <FileText className="w-4 h-4 text-red-400" />
                    <span>Export as PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportToDocs(data)}
                    className="flex items-center gap-2 cursor-pointer focus:bg-accent"
                  >
                    <File className="w-4 h-4 text-blue-400" />
                    <span>Export as DOCS (Word)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => exportRawCode(data)}
                    className="flex items-center gap-2 cursor-pointer focus:bg-accent"
                  >
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    <span>Export Source Code</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
