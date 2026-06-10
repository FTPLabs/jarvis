import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { VoiceOrb } from "@/components/voice-orb";
import { SystemStatsRing } from "@/components/system-stats-ring";
import { 
  useGetSystemStats, 
  getGetSystemStatsQueryKey,
  useGetVoiceStatus,
  getGetVoiceStatusQueryKey,
  useProcessVoiceCommand,
  useToggleListening,
  useGetActivityLog,
  getGetActivityLogQueryKey
} from "@workspace/api-client-react";
import { Cpu, HardDrive, MemoryStick, Mic, MicOff, Send, Terminal, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ACTIVITY_TYPE_RU: Record<string, string> = {
  voice: "Голос", text: "Текст", system: "Система",
  command: "Команда", error: "Ошибка",
  команда: "Команда", приветствие: "Привет", запуск: "Запуск",
  память: "Память", обучение: "Обучение", поиск: "Поиск", ии: "ИИ",
};

// Web Speech API types
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}
interface SpeechRecognitionAlternative {
  transcript: string;
}
declare var SpeechRecognition: new() => SpeechRecognition;
declare var webkitSpeechRecognition: new() => SpeechRecognition;

interface ResponseEntry {
  id: string;
  text: string;
  timestamp: string;
  isUser: boolean;
}

export default function Dashboard() {
  const [commandText, setCommandText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [conversation, setConversation] = useState<ResponseEntry[]>([]);
  const [micError, setMicError] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const { data: systemStats } = useGetSystemStats({
    query: { queryKey: getGetSystemStatsQueryKey(), refetchInterval: 3000 }
  });
  const { data: voiceStatus } = useGetVoiceStatus({
    query: { queryKey: getGetVoiceStatusQueryKey(), refetchInterval: 3000 }
  });
  const { data: activityLog } = useGetActivityLog({ limit: 5 }, {
    query: { queryKey: getGetActivityLogQueryKey({ limit: 5 }), refetchInterval: 5000 }
  });

  const processCommand = useProcessVoiceCommand();
  const toggleListen = useToggleListening();

  // Auto-scroll conversation
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Send command to API
  const sendCommand = useCallback(async (text: string, source: "text" | "voice" = "text") => {
    if (!text.trim() || isProcessing) return;
    setIsProcessing(true);

    // Add user message to conversation
    const userEntry: ResponseEntry = {
      id: crypto.randomUUID(),
      text,
      timestamp: new Date().toISOString(),
      isUser: true,
    };
    setConversation(prev => [...prev, userEntry]);
    setCommandText("");

    try {
      const res = await fetch(`${BASE}/api/voice/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source }),
      });
      const data = await res.json() as { id: string; text: string; timestamp: string; action?: string; actionResult?: string };

      // Add JARVIS response
      setConversation(prev => [...prev, {
        id: data.id,
        text: data.text,
        timestamp: data.timestamp,
        isUser: false,
      }]);

      // Handle actions
      if (data.action === "open_url" && data.actionResult) {
        window.open(data.actionResult, "_blank");
      }
      if (data.action === "launch_app" && data.actionResult) {
        await fetch(`${BASE}/api/apps/launch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appId: data.actionResult }),
        }).catch(() => {});
      }

      // Browser TTS in Russian
      if ("speechSynthesis" in window && data.text) {
        const utt = new SpeechSynthesisUtterance(data.text);
        utt.lang = "ru-RU";
        utt.rate = 1.0;
        utt.pitch = 0.9;
        // Try to find Russian voice
        const voices = window.speechSynthesis.getVoices();
        const ruVoice = voices.find(v => v.lang.startsWith("ru"));
        if (ruVoice) utt.voice = ruVoice;
        window.speechSynthesis.speak(utt);
      }
    } catch (e) {
      setConversation(prev => [...prev, {
        id: crypto.randomUUID(),
        text: "Ошибка соединения с сервером JARVIS.",
        timestamp: new Date().toISOString(),
        isUser: false,
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  // Web Speech API microphone
  const startMic = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMicError("Браузер не поддерживает распознавание речи. Используйте Chrome.");
      return;
    }
    const recognition = new SR() as SpeechRecognition;
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript(interim || final);
      if (final) {
        setIsMicActive(false);
        recognitionRef.current = null;
        sendCommand(final, "voice");
        setTranscript("");
      }
    };

    recognition.onerror = () => {
      setMicError("Ошибка микрофона. Разрешите доступ в настройках браузера.");
      setIsMicActive(false);
    };

    recognition.onend = () => {
      setIsMicActive(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsMicActive(true);
    setMicError("");
    toggleListen.mutate({ data: { enabled: true } });
  }, [sendCommand]);

  const stopMic = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsMicActive(false);
    setTranscript("");
    toggleListen.mutate({ data: { enabled: false } });
  }, []);

  const handleMicToggle = () => {
    if (isMicActive) stopMic();
    else startMic();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commandText.trim()) sendCommand(commandText, "text");
  };

  return (
    <Layout>
      <div className="space-y-8">
        <header className="mb-8 border-b border-primary/20 pb-4">
          <h1 className="text-3xl font-mono uppercase tracking-widest text-primary glow-text">Командный центр</h1>
          <p className="text-muted-foreground font-mono text-sm mt-2">Главный интерфейс управления</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Голосовой орб + чат */}
          <div className="lg:col-span-2 flex flex-col min-h-[520px] glass-panel rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-4 left-4 font-mono text-xs text-primary/50">СИС.ЯДРО.АКТИВНО</div>
            <div className="absolute top-4 right-4 font-mono text-xs text-primary/50">
              {isMicActive ? <span className="text-primary animate-pulse">● ЗАПИСЬ</span> : voiceStatus?.listening ? "● ГОТОВ" : "○ ПАУЗА"}
            </div>

            {/* Орб */}
            <div className="flex justify-center py-4">
              <VoiceOrb listening={isMicActive} active={isProcessing} />
            </div>

            {/* Transcript preview */}
            {transcript && (
              <div className="text-center font-mono text-sm text-primary/70 italic mb-2">
                "{transcript}..."
              </div>
            )}

            {/* Conversation history */}
            <div className="flex-1 overflow-y-auto space-y-3 my-4 px-2 min-h-[120px] max-h-[260px]">
              {conversation.length === 0 && (
                <div className="text-center text-muted-foreground font-mono text-sm py-8 opacity-60">
                  Нажмите на микрофон или введите команду
                </div>
              )}
              <AnimatePresence>
                {conversation.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${entry.isUser ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[80%] rounded-xl px-4 py-2 font-mono text-sm ${
                      entry.isUser
                        ? "bg-primary/20 border border-primary/30 text-primary text-right"
                        : "bg-white/5 border border-white/10 text-foreground"
                    }`}>
                      {!entry.isUser && (
                        <div className="flex items-center text-xs text-primary/60 mb-1">
                          <Terminal className="w-3 h-3 mr-1" /> JARVIS
                        </div>
                      )}
                      {entry.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={chatBottomRef} />
            </div>

            {/* Mic error */}
            {micError && (
              <div className="text-xs text-destructive font-mono mb-2 text-center">{micError}</div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} className="relative flex items-center mt-auto">
              <button
                type="button"
                onClick={handleMicToggle}
                title={isMicActive ? "Остановить запись" : "Говорить"}
                className={`absolute left-3 p-2 transition-all rounded-full ${
                  isMicActive
                    ? "text-primary bg-primary/20 animate-pulse shadow-[0_0_10px_rgba(0,212,255,0.5)]"
                    : "text-muted-foreground hover:text-primary"
                }`}
              >
                {isMicActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>
              <input
                type="text"
                value={commandText}
                onChange={e => setCommandText(e.target.value)}
                placeholder={isMicActive ? "Говорите..." : "Введите команду или вопрос..."}
                className="w-full bg-black/40 border border-primary/30 rounded-full py-3 pl-12 pr-12 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-[inset_0_0_20px_rgba(0,212,255,0.05)] transition-all placeholder:text-muted-foreground/50"
                disabled={isProcessing || isMicActive}
              />
              <button
                type="submit"
                title="Отправить"
                className="absolute right-3 p-2 text-primary hover:text-white transition-colors disabled:opacity-30"
                disabled={isProcessing || !commandText.trim()}
              >
                {isProcessing ? (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>

          {/* Боковая панель */}
          <div className="space-y-6">
            <div className="glass-panel rounded-xl p-6">
              <h3 className="font-mono text-sm text-primary uppercase tracking-widest mb-4 border-b border-primary/20 pb-2">Телеметрия системы</h3>
              <div className="grid grid-cols-2 gap-4">
                <SystemStatsRing value={systemStats?.cpuPercent ?? 0} label="ЦПУ" icon={<Cpu className="w-4 h-4" />} />
                <SystemStatsRing value={systemStats?.ramPercent ?? 0} label="ОЗУ" color="var(--accent)" icon={<MemoryStick className="w-4 h-4" />} />
                <SystemStatsRing value={systemStats?.diskPercent ?? 0} label="Диск" color="var(--chart-5)" icon={<HardDrive className="w-4 h-4" />} />
              </div>
              <div className="mt-3 pt-3 border-t border-primary/10 font-mono text-xs text-muted-foreground flex justify-between">
                <span>Аптайм: {(systemStats?.uptimeHours ?? 0).toFixed(1)}ч</span>
                <span>Команд: {systemStats?.sessionCommands ?? 0}</span>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-4">
              <h3 className="font-mono text-sm text-primary uppercase tracking-widest mb-3 border-b border-primary/20 pb-2 flex items-center gap-2">
                <Brain className="w-4 h-4" /> Лента активности
              </h3>
              <div className="space-y-2 font-mono text-xs">
                {activityLog?.length ? activityLog.map((entry) => (
                  <div key={entry.id} className="border-l-2 border-primary/30 pl-2 py-0.5">
                    <div className="flex justify-between text-muted-foreground mb-0.5">
                      <span className="uppercase text-[10px]">{ACTIVITY_TYPE_RU[entry.type] ?? entry.type}</span>
                      <span>{format(new Date(entry.timestamp), "HH:mm:ss", { locale: ru })}</span>
                    </div>
                    <span className="text-foreground/80 line-clamp-1">{entry.message}</span>
                  </div>
                )) : (
                  <div className="text-center py-4 text-muted-foreground/50">Нет активности</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
