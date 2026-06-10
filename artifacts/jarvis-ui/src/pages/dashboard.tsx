import { useState } from "react";
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
import { Cpu, HardDrive, MemoryStick, Mic, MicOff, Send, Terminal } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const ACTIVITY_TYPE_RU: Record<string, string> = {
  voice: "Голос",
  text: "Текст",
  system: "Система",
  command: "Команда",
  error: "Ошибка",
};

export default function Dashboard() {
  const [commandText, setCommandText] = useState("");
  const [activeCommand, setActiveCommand] = useState(false);
  const [lastResponse, setLastResponse] = useState("");

  const { data: systemStats } = useGetSystemStats({
    query: {
      queryKey: getGetSystemStatsQueryKey(),
      refetchInterval: 3000,
    }
  });

  const { data: voiceStatus } = useGetVoiceStatus({
    query: {
      queryKey: getGetVoiceStatusQueryKey(),
      refetchInterval: 3000,
    }
  });

  const { data: activityLog } = useGetActivityLog({ limit: 5 }, {
    query: {
      queryKey: getGetActivityLogQueryKey({ limit: 5 }),
      refetchInterval: 5000,
    }
  });

  const processCommand = useProcessVoiceCommand();
  const toggleListen = useToggleListening();

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandText.trim()) return;

    setActiveCommand(true);
    processCommand.mutate({ data: { text: commandText, source: "text" } }, {
      onSuccess: (data) => {
        setLastResponse(data.text || "");
        setCommandText("");
      },
      onSettled: () => {
        setTimeout(() => setActiveCommand(false), 2000);
      }
    });
  };

  const handleToggleMic = () => {
    toggleListen.mutate({ data: { enabled: !voiceStatus?.listening } });
  };

  const uptimeHours = systemStats?.uptimeHours ?? 0;

  return (
    <Layout>
      <div className="space-y-8">
        <header className="mb-8 border-b border-primary/20 pb-4">
          <h1 className="text-3xl font-mono uppercase tracking-widest text-primary glow-text">Командный центр</h1>
          <p className="text-muted-foreground font-mono text-sm mt-2">Главный интерфейс управления</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Голосовой орб */}
          <div className="lg:col-span-2 flex flex-col items-center justify-center min-h-[400px] glass-panel rounded-xl p-8 relative overflow-hidden">
            <div className="absolute top-4 left-4 font-mono text-xs text-primary/50">СИС.ЯДРО.АКТИВНО</div>
            <div className="absolute top-4 right-4 font-mono text-xs text-primary/50">
              {voiceStatus?.listening ? "● СЛУШАЕТ" : "○ ПАУЗА"}
            </div>
            <div className="absolute bottom-4 right-4 font-mono text-xs text-primary/50">
              АПТАЙМ: {uptimeHours.toFixed(1)}Ч
            </div>
            
            <VoiceOrb 
              listening={voiceStatus?.listening} 
              active={activeCommand || processCommand.isPending} 
            />

            <div className="mt-4 text-center font-mono text-sm text-primary/60">
              {voiceStatus?.listening 
                ? 'Скажите "Джарвис" или введите команду' 
                : 'Микрофон выключен'}
            </div>

            <div className="mt-8 w-full max-w-md">
              <form onSubmit={handleCommandSubmit} className="relative flex items-center">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  title={voiceStatus?.listening ? "Выключить микрофон" : "Включить микрофон"}
                  className="absolute left-3 p-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {voiceStatus?.listening ? (
                    <Mic className="w-5 h-5 text-primary animate-pulse" />
                  ) : (
                    <MicOff className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="text"
                  value={commandText}
                  onChange={(e) => setCommandText(e.target.value)}
                  placeholder="Введите команду..."
                  className="w-full bg-black/40 border border-primary/30 rounded-full py-3 pl-12 pr-12 font-mono text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-[inset_0_0_20px_rgba(0,212,255,0.05)] transition-all"
                  disabled={processCommand.isPending}
                />
                <button
                  type="submit"
                  title="Отправить"
                  className="absolute right-3 p-2 text-primary hover:text-white transition-colors"
                  disabled={processCommand.isPending}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {(lastResponse || processCommand.isPending) && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 border border-primary/20 bg-primary/5 rounded-lg font-mono text-sm text-primary"
                >
                  <Terminal className="w-4 h-4 inline-block mr-2 text-primary/70" />
                  {processCommand.isPending ? "Обрабатываю..." : lastResponse}
                </motion.div>
              )}
            </div>
          </div>

          {/* Боковая панель */}
          <div className="space-y-8">
            <div className="glass-panel rounded-xl p-6">
              <h3 className="font-mono text-sm text-primary uppercase tracking-widest mb-6 border-b border-primary/20 pb-2">Телеметрия системы</h3>
              <div className="grid grid-cols-2 gap-4">
                <SystemStatsRing value={systemStats?.cpuPercent || 0} label="ЦПУ" icon={<Cpu className="w-4 h-4" />} />
                <SystemStatsRing value={systemStats?.ramPercent || 0} label="ОЗУ" color="var(--accent)" icon={<MemoryStick className="w-4 h-4" />} />
                <SystemStatsRing value={systemStats?.diskPercent || 0} label="Диск" color="var(--chart-5)" icon={<HardDrive className="w-4 h-4" />} />
              </div>
            </div>

            <div className="glass-panel rounded-xl p-6 flex-1">
              <h3 className="font-mono text-sm text-primary uppercase tracking-widest mb-4 border-b border-primary/20 pb-2">Лента активности</h3>
              <div className="space-y-3 font-mono text-xs">
                {activityLog?.length ? activityLog.map((entry) => (
                  <div key={entry.id} className="flex flex-col border-l-2 border-primary/30 pl-3 py-1">
                    <div className="flex justify-between items-center text-muted-foreground mb-1">
                      <span className="uppercase text-[10px]">
                        {ACTIVITY_TYPE_RU[entry.type] ?? entry.type}
                      </span>
                      <span>{format(new Date(entry.timestamp), "HH:mm:ss", { locale: ru })}</span>
                    </div>
                    <span className="text-foreground">{entry.message}</span>
                  </div>
                )) : (
                  <div className="text-muted-foreground text-center py-4">Нет активности</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
