import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// In-memory voice state
let voiceState = {
  listening: false,
  sttEngine: "whisper",
  ttsEngine: "piper",
  wakeWordEnabled: true,
  wakeWord: "Jarvis",
  ollamaConnected: false,
  ollamaModel: "llama3:8b",
};

// Check Ollama connection
async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function logActivity(type: string, message: string, detail?: string) {
  await db.insert(activityLogTable).values({ type, message, detail: detail ?? null });
}

async function processCommand(text: string): Promise<{ responseText: string; action: string | null; actionResult: string | null }> {
  const lower = text.toLowerCase();

  // App launch commands
  if (lower.includes("open") || lower.includes("launch") || lower.includes("start")) {
    const apps: Record<string, string> = {
      chrome: "Google Chrome", firefox: "Firefox", spotify: "Spotify",
      discord: "Discord", steam: "Steam", vscode: "VS Code",
      notepad: "Notepad", calculator: "Calculator", terminal: "Terminal",
    };
    for (const [key, appName] of Object.entries(apps)) {
      if (lower.includes(key)) {
        await logActivity("app", `Launched ${appName}`, text);
        return {
          responseText: `Launching ${appName} right away.`,
          action: "launch_app",
          actionResult: appName,
        };
      }
    }
  }

  // Time/date
  if (lower.includes("time") || lower.includes("date")) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const dateStr = now.toLocaleDateString();
    await logActivity("command", "Time query", text);
    return {
      responseText: `It is currently ${timeStr} on ${dateStr}.`,
      action: "query",
      actionResult: `${timeStr}, ${dateStr}`,
    };
  }

  // Reminder commands
  if (lower.includes("remind") || lower.includes("reminder")) {
    await logActivity("reminder", "Reminder set", text);
    return {
      responseText: "Reminder noted. I will alert you at the specified time.",
      action: "set_reminder",
      actionResult: text,
    };
  }

  // Memory commands
  if (lower.includes("remember") || lower.includes("note")) {
    await logActivity("command", "Memory stored", text);
    return {
      responseText: "I have committed that to long-term memory.",
      action: "store_memory",
      actionResult: text,
    };
  }

  // Weather
  if (lower.includes("weather")) {
    return {
      responseText: "I currently have no internet connection for weather data. Please check your network configuration.",
      action: "query",
      actionResult: null,
    };
  }

  // Greetings
  if (lower.match(/^(hello|hi|hey|good morning|good evening|good night)/)) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    await logActivity("command", "Greeting", text);
    return {
      responseText: `${greeting}. All systems are online and ready. How can I assist you today?`,
      action: null,
      actionResult: null,
    };
  }

  // YouTube/TikTok stats
  if (lower.includes("youtube") || lower.includes("tiktok") || lower.includes("stats")) {
    await logActivity("command", "Stats query", text);
    return {
      responseText: "Pulling your latest analytics. Navigate to the Stats panel for a full breakdown.",
      action: "show_stats",
      actionResult: null,
    };
  }

  // Default: simulate Ollama response
  await logActivity("command", "AI command", text);
  const responses = [
    "Understood. Processing your request through the neural network.",
    "Acknowledged. I am analyzing the optimal response.",
    "Command received. Running inference on local model.",
    "Processing complete. Is there anything else you require?",
    "Task acknowledged. My circuits are fully engaged on this.",
  ];
  const responseText = responses[Math.floor(Math.random() * responses.length)];
  return { responseText, action: null, actionResult: null };
}

router.get("/status", async (req, res) => {
  voiceState.ollamaConnected = await checkOllama();
  return res.json(voiceState);
});

router.post("/listen", async (req, res) => {
  const { enabled } = req.body;
  voiceState.listening = Boolean(enabled);
  await logActivity("system", enabled ? "Voice listening activated" : "Voice listening deactivated");
  voiceState.ollamaConnected = await checkOllama();
  return res.json(voiceState);
});

router.post("/command", async (req, res) => {
  try {
    const { text, source } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });

    const { responseText, action, actionResult } = await processCommand(text);

    return res.json({
      id: crypto.randomUUID(),
      text: responseText,
      action: action ?? null,
      actionResult: actionResult ?? null,
      ttsUrl: null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
