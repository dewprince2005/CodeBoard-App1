import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const sendChatMessage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      message: z.string().min(1),
      userId: z.string().nullable().optional(),
      conversationId: z.string(),
      timestamp: z.string(),
      currentPage: z.string(),
    })
  )
  .handler(async ({ data }) => {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn("[Chatbot Proxy] N8N_WEBHOOK_URL environment variable is not defined. Falling back to mock responses.");
      
      // Simulate network lag (1 second) for realistic loading state
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const lowerMsg = data.message.toLowerCase();
      let responseMessage = "Hello! I am your CodeBoard AI assistant. Currently, the n8n webhook integration is not configured (N8N_WEBHOOK_URL is missing in .env). Please read the setup guide or ask me about CodeBoard features!";

      if (lowerMsg.includes("room") || lowerMsg.includes("codeboard")) {
        if (lowerMsg.includes("create")) {
          responseMessage = "To create a coding room, go to the homepage, choose your language (e.g., JavaScript, Python, Java, C++), and click **Create Room**. A random 8-letter room code (like **ABCD2345**) will be generated, and you will be redirected to the workspace. You can share this code with anyone to start pair-programming in real-time!";
        } else if (lowerMsg.includes("join")) {
          responseMessage = "To join an existing coding room, obtain the 8-character room code from your partner, enter it in the **Room Code** field on the homepage, and click **Join Room**. You will immediately connect to their live coding session.";
        } else {
          responseMessage = "CodeBoard supports real-time collaborative rooms. Each room features sync-editing, language selection, and live updates. Currently, JavaScript, Python, Java, and C++ syntax highlighting are supported via the CodeMirror editor.";
        }
      } else if (lowerMsg.includes("task") || lowerMsg.includes("todo")) {
        if (lowerMsg.includes("add") || lowerMsg.includes("create")) {
          responseMessage = "To add a new task, navigate to the **Task Manager** page (click the task checklist icon in the header or go to `/tasks`), type your task description in the input box, and press **Add Task**. Once the n8n webhook is active, you can also ask me to add tasks for you directly!";
        } else {
          responseMessage = "CodeBoard has a built-in **Task Manager** connected to Supabase. You can list, add, complete, and delete your tasks. Go to `/tasks` in your browser to view your dashboard.";
        }
      } else if (lowerMsg.includes("help") || lowerMsg.includes("feature")) {
        responseMessage = "I can help you navigate CodeBoard. Here is what you can do:\n\n* **Real-time coding**: Create or join pair-coding rooms using a shared 8-letter code.\n* **CodeMirror Editor**: Write code in JavaScript, Python, Java, or C++ with themes like One Dark.\n* **Task Tracking**: Manage development tasks linked to your user profile in Supabase.\n* **Session History**: Review recently visited coding rooms and action logs.\n\nAsk me about rooms, tasks, or languages to learn more!";
      }

      return {
        message: responseMessage,
        status: "mocked"
      };
    }

    try {
      console.log(`[Chatbot Proxy] Sending message to n8n webhook: ${webhookUrl}`);
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: data.message,
          userId: data.userId,
          conversationId: data.conversationId,
          timestamp: data.timestamp,
          currentPage: data.currentPage,
        }),
      });

      if (!response.ok) {
        console.error(`[Chatbot Proxy] n8n error status: ${response.status}`);
        throw new Error(`n8n webhook returned status ${response.status}`);
      }

      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (err) {
        // Fallback for non-JSON string responses
        responseData = { message: responseText };
      }

      // n8n agents typically return output in fields like: output, message, text, or response
      const reply = 
        responseData.output || 
        responseData.message || 
        responseData.text || 
        responseData.response || 
        (typeof responseData === 'string' ? responseData : JSON.stringify(responseData));

      if (!reply) {
        throw new Error("Empty response received from the n8n AI Agent.");
      }

      return {
        message: reply,
        status: "success"
      };
    } catch (error) {
      console.error("[Chatbot Proxy] Webhook connection error:", error);
      throw new Error("Unable to reach the AI assistant. Please verify your connection or n8n webhook URL configuration.");
    }
  });
