import { Router } from "express";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { activityLogTable, memoryEntriesTable, settingsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import crypto from "crypto";

const router = Router();
const MAX_SCREEN_LOG = 200;

let voiceState = {
  listening: true,
  sttEngine: "whisper",
  ttsEngine: "piper",
  wakeWordEnabled: true,
  wakeWord: "Джарвис",
  ollamaConnected: false,
  ollamaModel: "llama3:8b",
  language: "ru",
};

async function syncVoiceStateFromDB(): Promise<void> {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    if (map.sttEngine) voiceState.sttEngine = map.sttEngine;
    if (map.ttsEngine) voiceState.ttsEngine = map.ttsEngine;
    if (map.wakeWord) voiceState.wakeWord = map.wakeWord;
    if (map.wakeWordEnabled !== undefined) voiceState.wakeWordEnabled = map.wakeWordEnabled === "true";
    if (map.language) voiceState.language = map.language;
    if (map.ollamaModel) voiceState.ollamaModel = map.ollamaModel;
  } catch (err) {
    logger.warn({ err }, "[voice] Не удалось синхронизировать настройки из БД");
  }
}
syncVoiceStateFromDB().catch(() => {});

const learningData = {
  conversationCount: 0,
  learnedFacts: {} as Record<string, string>,
  commandFrequency: {} as Record<string, number>,
  userName: "ХОЗЯИН",
  topApps: [] as string[],
  screenLog: [] as Array<{ ts: string; event: string; data: string }>,
};

async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

async function askOllama(userText: string, context: string): Promise<string | null> {
  try {
    const systemPrompt = [
      "Ты JARVIS — персональный голосовой ассистент на русском языке.",
      "Отвечай ТОЛЬКО по-русски. Кратко и чётко — максимум 2 предложения.",
      'Обращайся к пользователю "ХОЗЯИН" — именно так, всегда.',
      context ? "Контекст о пользователе:\n" + context : "",
    ].filter(Boolean).join("\n");

    const res = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: voiceState.ollamaModel,
        prompt: systemPrompt + "\n\nПользователь: " + userText + "\nJARVIS:",
        stream: false,
        options: { temperature: 0.7, num_predict: 120 },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    return data.response?.trim() ?? null;
  } catch { return null; }
}

async function logActivity(type: string, message: string, detail?: string) {
  try {
    await db.insert(activityLogTable).values({
      type,
      message: message.slice(0, 500),
      detail: detail?.slice(0, 500) ?? null,
    });
  } catch (err) {
    logger.error({ err }, "[logActivity] DB error");
  }
}

function buildContext(): string {
  const lines: string[] = [];
  if (learningData.userName !== "ХОЗЯИН") lines.push("Имя: " + learningData.userName);
  const facts = Object.entries(learningData.learnedFacts).slice(0, 8);
  if (facts.length) {
    lines.push("Известные факты:");
    facts.forEach(([k, v]) => lines.push("  " + k + ": " + v));
  }
  const topCmds = Object.entries(learningData.commandFrequency)
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cmd]) => cmd);
  if (topCmds.length) lines.push("Частые запросы: " + topCmds.join(", "));
  return lines.join("\n");
}

function learnFromText(text: string) {
  const key = text.slice(0, 50).toLowerCase();
  learningData.commandFrequency[key] = (learningData.commandFrequency[key] ?? 0) + 1;
  learningData.conversationCount++;

  const nameMatch = text.match(/меня зовут\s+(\w+)/i);
  if (nameMatch) {
    learningData.userName = nameMatch[1];
    learningData.learnedFacts["имя"] = nameMatch[1];
    db.insert(memoryEntriesTable)
      .values({ content: nameMatch[1], category: "name", importance: 5 })
      .catch((err) => logger.warn({ err }, "[learnFromText] Ошибка записи имени в БД"));
  }

  const likeMatch = text.match(/я (люблю|предпочитаю|обожаю)\s+(.+)/i);
  if (likeMatch) {
    const pref = likeMatch[2].slice(0, 60);
    learningData.learnedFacts["предпочтение_" + Date.now()] = pref;
    db.insert(memoryEntriesTable)
      .values({ content: pref, category: "preference", importance: 3 })
      .catch((err) => logger.warn({ err }, "[learnFromText] Ошибка записи предпочтения в БД"));
  }
}

router.get("/status", async (req, res) => {
  voiceState.ollamaConnected = await checkOllama();
  return res.json({
    ...voiceState,
    sessionId: crypto.randomUUID(),
    learnedFacts: Object.keys(learningData.learnedFacts).length,
    conversationCount: learningData.conversationCount,
    userName: learningData.userName,
  });
});

router.post("/listen", async (req, res) => {
  try {
    const { enabled } = req.body as { enabled?: boolean };
    if (enabled !== undefined) voiceState.listening = Boolean(enabled);
    const action = voiceState.listening ? "started" : "stopped";
    await logActivity("voice", "Прослушивание " + action);
    return res.json({ listening: voiceState.listening, action });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Internal server error" }); }
});

router.post("/command", async (req, res) => {
  try {
    const { text, source } = req.body as { text?: string; source?: string };
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "text is required" });
    }
    const userText = text.trim().slice(0, 1000);
    learnFromText(userText);
    await logActivity("command", userText, source ?? "api");
    const context = buildContext();
    voiceState.ollamaConnected = await checkOllama();
    let response: string;
    if (voiceState.ollamaConnected) {
      response = (await askOllama(userText, context)) ?? "Команда принята: " + userText;
    } else {
      response = "Ollama недоступна. Команда: " + userText;
    }
    await logActivity("response", response.slice(0, 200));
    return res.json({ response, source: source ?? "api", learned: true, ollamaUsed: voiceState.ollamaConnected });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Internal server error" }); }
});

router.post("/screen-event", async (req, res) => {
  try {
    const { event, data } = req.body as { event?: string; data?: string };
    if (!event) return res.status(400).json({ error: "event is required" });
    const entry = { ts: new Date().toISOString(), event: String(event), data: String(data ?? "") };
    learningData.screenLog.push(entry);
    if (learningData.screenLog.length > MAX_SCREEN_LOG) {
      learningData.screenLog.splice(0, learningData.screenLog.length - MAX_SCREEN_LOG);
    }
    return res.json({ ok: true });
  } catch (err) { req.log.error(err); return res.status(500).json({ error: "Internal server error" }); }
});

router.get("/learning", async (req, res) => {
  return res.json({
    conversationCount: learningData.conversationCount,
    learnedFacts: learningData.learnedFacts,
    commandFrequency: learningData.commandFrequency,
    userName: learningData.userName,
    topApps: learningData.topApps,
  });
});

export function updateVoiceStateSettings(updates: Partial<typeof voiceState>): void {
  Object.assign(voiceState, updates);
}

export default router;