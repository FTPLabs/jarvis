import { Router } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const DEFAULT_SETTINGS = {
  ollamaUrl: "http://127.0.0.1:11434",
  ollamaModel: "llama3:8b",
  sttEngine: "whisper",
  ttsEngine: "piper",
  wakeWord: "Джарвис",
  wakeWordEnabled: "true",
  language: "ru",
  youtubeChannelId: "",
  youtubeApiKey: "",
  tiktokUsername: "",
  reminderInterval: "60",
  waterReminderEnabled: "true",
  breakReminderEnabled: "true",
  sleepReminderEnabled: "true",
  sleepTime: "23:00",
  voiceCloneEnabled: "false",
  emotionIntensity: "0.7",
};

async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

function formatSettings(map: Record<string, string>) {
  return {
    ollamaUrl: map.ollamaUrl || DEFAULT_SETTINGS.ollamaUrl,
    ollamaModel: map.ollamaModel || DEFAULT_SETTINGS.ollamaModel,
    sttEngine: map.sttEngine || DEFAULT_SETTINGS.sttEngine,
    ttsEngine: map.ttsEngine || DEFAULT_SETTINGS.ttsEngine,
    wakeWord: map.wakeWord || DEFAULT_SETTINGS.wakeWord,
    wakeWordEnabled: map.wakeWordEnabled === "true",
    language: map.language || DEFAULT_SETTINGS.language,
    youtubeChannelId: map.youtubeChannelId || null,
    youtubeApiKey: map.youtubeApiKey || null,
    tiktokUsername: map.tiktokUsername || null,
    reminderInterval: Number(map.reminderInterval) || 60,
    waterReminderEnabled: map.waterReminderEnabled === "true",
    breakReminderEnabled: map.breakReminderEnabled === "true",
    sleepReminderEnabled: map.sleepReminderEnabled === "true",
    sleepTime: map.sleepTime || DEFAULT_SETTINGS.sleepTime,
    voiceCloneEnabled: map.voiceCloneEnabled === "true",
    emotionIntensity: Number(map.emotionIntensity) || 0.7,
  };
}

router.get("/", async (req, res) => {
  try {
    const map = await getAllSettings();
    return res.json(formatSettings(map));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/", async (req, res) => {
  try {
    const updates = req.body as Record<string, unknown>;

    const now = new Date();
    for (const [key, rawValue] of Object.entries(updates)) {
      const value = String(rawValue);
      await db.insert(settingsTable)
        .values({ key, value, updatedAt: now })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: now } });
    }

    const map = await getAllSettings();
    return res.json(formatSettings(map));
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const BUILT_IN_SKILLS = [
  { id: "app-control", name: "App Control", description: "Launch and close applications by voice", enabled: true, version: "1.0.0", author: "JARVIS Core" },
  { id: "memory", name: "Long-Term Memory", description: "Remember user preferences, goals and tasks", enabled: true, version: "1.0.0", author: "JARVIS Core" },
  { id: "youtube-analytics", name: "YouTube Analytics", description: "Track channel stats and revenue in real-time", enabled: true, version: "1.0.0", author: "JARVIS Core" },
  { id: "tiktok-analytics", name: "TikTok Analytics", description: "Monitor follower growth and video performance", enabled: true, version: "1.0.0", author: "JARVIS Core" },
  { id: "health-reminders", name: "Health Reminders", description: "Water, break, and sleep reminders for wellbeing", enabled: true, version: "1.0.0", author: "JARVIS Core" },
  { id: "voice-clone", name: "Voice Cloning", description: "Clone any voice from 3-10 seconds of audio", enabled: false, version: "0.9.0", author: "JARVIS Core" },
  { id: "google-workspace", name: "Google Workspace", description: "Gmail, Calendar, Drive integration via MCP", enabled: false, version: "1.0.0", author: "MCP" },
  { id: "notion", name: "Notion", description: "Sync notes and databases with Notion", enabled: false, version: "1.0.0", author: "MCP" },
  { id: "github", name: "GitHub", description: "Manage repos, issues, and PRs by voice", enabled: false, version: "1.0.0", author: "MCP" },
  { id: "discord", name: "Discord", description: "Send messages and manage servers", enabled: false, version: "1.0.0", author: "MCP" },
];

router.get("/skills", async (req, res) => {
  return res.json(BUILT_IN_SKILLS);
});

export default router;
