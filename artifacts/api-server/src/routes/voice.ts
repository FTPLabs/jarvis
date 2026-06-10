import { Router } from "express";
import { db } from "@workspace/db";
import { activityLogTable, memoryEntriesTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// ─── In-memory voice + learning state ───────────────────────────────────────
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

// Simple in-memory learning store (persists per session, DB-backed for history)
const learningData = {
  conversationCount: 0,
  learnedFacts: {} as Record<string, string>,
  commandFrequency: {} as Record<string, number>,
  userName: "Хозяин",
  topApps: [] as string[],
  screenLog: [] as Array<{ ts: string; event: string; data: string }>,
};

// ─── Ollama ──────────────────────────────────────────────────────────────────
async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function askOllama(userText: string, context: string): Promise<string | null> {
  try {
    const systemPrompt = `Ты JARVIS — персональный ИИ-ассистент на русском языке, как в фильме Железный человек.
Отвечай ТОЛЬКО по-русски. Кратко и чётко — максимум 2 предложения.
Обращайся к пользователю как "${learningData.userName}".
Ты умный, быстрый и всегда полезный.
${context ? `\nКонтекст о пользователе:\n${context}` : ""}`;

    const res = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: voiceState.ollamaModel,
        prompt: `${systemPrompt}\n\nПользователь: ${userText}\nJARVIS:`,
        stream: false,
        options: { temperature: 0.7, num_predict: 120 },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    return data.response?.trim() ?? null;
  } catch {
    return null;
  }
}

// ─── Activity logging ────────────────────────────────────────────────────────
async function logActivity(type: string, message: string, detail?: string) {
  try {
    await db.insert(activityLogTable).values({
      type,
      message: message.slice(0, 500),
      detail: detail?.slice(0, 500) ?? null,
    });
  } catch {}
}

// ─── Auto-learning helpers ───────────────────────────────────────────────────
function buildContext(): string {
  const lines: string[] = [];
  if (learningData.userName !== "Хозяин") lines.push(`Имя: ${learningData.userName}`);
  const facts = Object.entries(learningData.learnedFacts).slice(0, 8);
  if (facts.length) {
    lines.push("Известные факты:");
    facts.forEach(([k, v]) => lines.push(`  ${k}: ${v}`));
  }
  const topCmds = Object.entries(learningData.commandFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cmd]) => cmd);
  if (topCmds.length) lines.push(`Частые запросы: ${topCmds.join(", ")}`);
  return lines.join("\n");
}

function learnFromText(text: string) {
  // Track command frequency
  const key = text.slice(0, 50).toLowerCase();
  learningData.commandFrequency[key] = (learningData.commandFrequency[key] ?? 0) + 1;
  learningData.conversationCount++;

  // Learn name
  const nameMatch = text.match(/меня зовут\s+(\w+)/i);
  if (nameMatch) {
    learningData.userName = nameMatch[1];
    learningData.learnedFacts["имя"] = nameMatch[1];
  }

  // Learn preferences
  const likeMatch = text.match(/я (люблю|предпочитаю|обожаю)\s+(.+)/i);
  if (likeMatch) learningData.learnedFacts[`предпочтение_${Date.now()}`] = likeMatch[2].slice(0, 50);

  // Learn facts "запомни что..."
  const rememberMatch = text.match(/запомни[,\s]+что\s+(.+)/i);
  if (rememberMatch) learningData.learnedFacts[`факт_${Date.now()}`] = rememberMatch[1].slice(0, 100);
}

// ─── Russian date/time ────────────────────────────────────────────────────────
function ruDate(): string {
  const months = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
  const days = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
  const now = new Date();
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

// ─── Command routing (Russian, no Ollama fallback) ───────────────────────────
async function routeCommand(text: string): Promise<{ responseText: string; action: string | null; actionResult: string | null }> {
  const t = text.toLowerCase().trim();
  const name = learningData.userName;

  // Time / Date
  if (/время|который час|сколько времени|часы/.test(t)) {
    const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    await logActivity("команда", "Запрос времени", text);
    return { responseText: `Сейчас ${time}, ${name}.`, action: "query", actionResult: time };
  }
  if (/дата|какой день|число|день недели/.test(t)) {
    await logActivity("команда", "Запрос даты", text);
    return { responseText: `Сегодня ${ruDate()}.`, action: "query", actionResult: ruDate() };
  }

  // Greetings
  if (/^(привет|здравствуй|добрый|доброе|хай|hello|hi)/.test(t)) {
    const h = new Date().getHours();
    const g = h < 6 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 17 ? "Добрый день" : "Добрый вечер";
    await logActivity("приветствие", "Приветствие", text);
    return { responseText: `${g}, ${name}! Все системы активны. Чем могу помочь?`, action: null, actionResult: null };
  }

  // Learning: remember name
  if (/меня зовут/.test(t)) {
    const m = t.match(/меня зовут\s+(\w+)/i);
    const newName = m?.[1] ?? "";
    if (newName) learningData.userName = newName.charAt(0).toUpperCase() + newName.slice(1);
    await logActivity("обучение", "Запомнил имя", newName);
    return { responseText: `Запомнил, ${learningData.userName}! Приятно познакомиться.`, action: "learn", actionResult: newName };
  }

  // Remember facts
  if (/запомни|заметь/.test(t)) {
    const fact = text.replace(/запомни[,\s]*/i, "").replace(/заметь[,\s]*/i, "").trim();
    if (fact) {
      learningData.learnedFacts[`факт_${Date.now()}`] = fact;
      await db.insert(memoryEntriesTable).values({ content: fact, category: "fact", importance: 3 }).catch(() => {});
      await logActivity("память", "Записан факт", fact);
    }
    return { responseText: `Запомнил: "${fact}". Буду помнить об этом.`, action: "store_memory", actionResult: fact };
  }

  // App launch (Russian)
  const appMap: Record<string, { en: string; ru: string }> = {
    хром: { en: "chrome", ru: "Google Chrome" },
    браузер: { en: "chrome", ru: "Браузер" },
    "хромиум": { en: "chromium", ru: "Chromium" },
    спотифай: { en: "spotify", ru: "Spotify" },
    музыку: { en: "spotify", ru: "Spotify" },
    музыка: { en: "spotify", ru: "Spotify" },
    телеграм: { en: "telegram", ru: "Telegram" },
    дискорд: { en: "discord", ru: "Discord" },
    блокнот: { en: "notepad", ru: "Блокнот" },
    калькулятор: { en: "calculator", ru: "Калькулятор" },
    проводник: { en: "explorer", ru: "Проводник" },
    файлы: { en: "explorer", ru: "Проводник" },
    "vs code": { en: "code", ru: "VS Code" },
    "вс код": { en: "code", ru: "VS Code" },
  };
  for (const [keyword, app] of Object.entries(appMap)) {
    if (t.includes(keyword)) {
      learningData.topApps.push(app.ru);
      await logActivity("запуск", `Запуск ${app.ru}`, text);
      return { responseText: `Запускаю ${app.ru}.`, action: "launch_app", actionResult: app.en };
    }
  }
  if (/открой|запусти|включи/.test(t)) {
    const appName = text.replace(/открой|запусти|включи/gi, "").trim();
    await logActivity("запуск", `Запуск: ${appName}`, text);
    return { responseText: `Пытаюсь запустить ${appName}.`, action: "launch_app", actionResult: appName };
  }

  // Search
  if (/найди|поищи|загугли|погугли|поиск по/.test(t)) {
    const q = text.replace(/найди|поищи|загугли|погугли|поиск по/gi, "").trim();
    await logActivity("поиск", `Поиск: ${q}`, text);
    return { responseText: `Ищу "${q}" в интернете.`, action: "open_url", actionResult: `https://google.com/search?q=${encodeURIComponent(q)}` };
  }

  // YouTube
  if (/ютуб|youtube/.test(t)) {
    const q = text.replace(/ютуб|youtube|включи|открой/gi, "").trim();
    if (q) return { responseText: `Открываю YouTube: ${q}.`, action: "open_url", actionResult: `https://youtube.com/results?search_query=${encodeURIComponent(q)}` };
    return { responseText: `Открываю YouTube.`, action: "open_url", actionResult: "https://youtube.com" };
  }

  // Memory / what do you know
  if (/что ты знаешь|что помнишь|расскажи о себе/.test(t)) {
    const factCount = Object.keys(learningData.learnedFacts).length;
    return { responseText: `Я помню ${factCount} фактов о вас, ${name}. Провёл ${learningData.conversationCount} разговоров. Самообучение активно.`, action: "query", actionResult: null };
  }

  // What can you do
  if (/что ты умеешь|помощь|команды/.test(t)) {
    return {
      responseText: "Умею: открывать приложения, искать в интернете, запоминать факты, отвечать на вопросы, показывать время/дату, управлять системой — всё голосом или текстом.",
      action: null, actionResult: null,
    };
  }

  // Stats query
  if (/статистик|ютуб|тикток|канал/.test(t)) {
    await logActivity("запрос", "Запрос статистики", text);
    return { responseText: "Открываю раздел аналитики. Ваша статистика обновляется в реальном времени.", action: "show_stats", actionResult: null };
  }

  // System info
  if (/памят|озу|оперативн/.test(t)) {
    return { responseText: "Данные ОЗУ доступны на главной панели в разделе телеметрии.", action: "query", actionResult: null };
  }

  // Default: try Ollama first, then smart fallback
  await logActivity("ии", "AI команда", text);
  const context = buildContext();
  const ollamaResp = await askOllama(text, context);
  if (ollamaResp) return { responseText: ollamaResp, action: null, actionResult: null };

  // Smart fallback responses in Russian
  const fallbacks = [
    `Понял, ${name}. Обрабатываю запрос через нейросеть.`,
    `Принято. Анализирую оптимальный ответ.`,
    `Выполняю. Мои нейронные цепи работают над этим.`,
    `Команда получена. Запускаю инференс на локальной модели.`,
    `Слышу вас. Уточните запрос или скажите "что ты умеешь".`,
  ];
  return {
    responseText: fallbacks[Math.floor(Math.random() * fallbacks.length)],
    action: null, actionResult: null,
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────
router.get("/status", async (req, res) => {
  voiceState.ollamaConnected = await checkOllama();
  return res.json(voiceState);
});

router.post("/listen", async (req, res) => {
  const { enabled } = req.body as { enabled: boolean };
  voiceState.listening = Boolean(enabled);
  await logActivity("система", enabled ? "Голос включён" : "Голос выключен");
  voiceState.ollamaConnected = await checkOllama();
  return res.json(voiceState);
});

router.post("/command", async (req, res) => {
  try {
    const { text, source } = req.body as { text: string; source?: string };
    if (!text?.trim()) return res.status(400).json({ error: "Текст обязателен" });

    // Auto-learn from every command
    learnFromText(text);

    const { responseText, action, actionResult } = await routeCommand(text);

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
    return res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Screen/activity event from Electron
router.post("/activity", async (req, res) => {
  const { event, data } = req.body as { event: string; data: string };
  learningData.screenLog.push({ ts: new Date().toISOString(), event, data });
  if (learningData.screenLog.length > 100) learningData.screenLog.shift();

  // Learn from screen activity
  if (event === "app_focused") {
    learningData.commandFrequency[`app:${data}`] = (learningData.commandFrequency[`app:${data}`] ?? 0) + 1;
  }
  await logActivity("экран", event, data);
  return res.json({ ok: true });
});

// Learning stats
router.get("/learning", async (req, res) => {
  return res.json({
    conversationCount: learningData.conversationCount,
    learnedFacts: Object.keys(learningData.learnedFacts).length,
    topCommands: Object.entries(learningData.commandFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cmd, count]) => ({ cmd, count })),
    userName: learningData.userName,
    topApps: [...new Set(learningData.topApps)].slice(0, 5),
    recentActivity: learningData.screenLog.slice(-10),
  });
});

export default router;
