import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import { useState } from "react";
  import { apiFetch } from "@/lib/api";
  import { Layout } from "@/components/Layout";
  import { cn } from "@/lib/utils";
  import { Mic, MicOff, Send, Wifi, WifiOff, Activity, Bot } from "lucide-react";
  import { toast } from "sonner";

  interface VoiceStatus {
    listening: boolean;
    ollamaConnected: boolean;
    ollamaModel: string;
    wakeWord: string;
    conversationCount: number;
    userName: string;
  }
  interface ActivityRow {
    id: number;
    type: string;
    message: string;
    timestamp: string;
  }

  export default function Dashboard() {
    const qc = useQueryClient();
    const [cmd, setCmd] = useState("");

    const { data: status } = useQuery<VoiceStatus>({
      queryKey: ["voice-status"],
      queryFn: () => apiFetch("/api/voice/status"),
      refetchInterval: 5000,
    });

    const { data: activity } = useQuery<ActivityRow[]>({
      queryKey: ["activity"],
      queryFn: () => apiFetch("/api/stats/activity?limit=8"),
      refetchInterval: 5000,
    });

    const toggleMic = useMutation({
      mutationFn: (enabled: boolean) =>
        apiFetch("/api/voice/listen", { method: "POST", body: JSON.stringify({ enabled }) }),
      onSuccess: () => qc.invalidateQueries({ queryKey: ["voice-status"] }),
      onError: () => toast.error("Ошибка соединения с сервером"),
    });

    const sendCmd = useMutation({
      mutationFn: (text: string) =>
        apiFetch<{ response: string }>("/api/voice/command", {
          method: "POST",
          body: JSON.stringify({ text, source: "ui" }),
        }),
      onSuccess: (data) => {
        toast.success(data.response, { duration: 6000 });
        qc.invalidateQueries({ queryKey: ["activity"] });
        setCmd("");
      },
      onError: () => toast.error("JARVIS не отвечает. Проверьте сервер."),
    });

    const listening = status?.listening ?? false;

    return (
      <Layout>
        <div className="space-y-6 max-w-4xl">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-white glow-text">JARVIS</h1>
            <p className="text-muted-foreground text-sm">
              Добро пожаловать, <span className="text-[#00d4ff]">{status?.userName ?? "ХОЗЯИН"}</span>
            </p>
          </div>

          {/* Status row */}
          <div className="grid grid-cols-3 gap-4">
            {/* Voice */}
            <div className={cn("glass-panel rounded-xl p-4 flex flex-col items-center gap-3 cursor-pointer transition-all", listening ? "glow-border" : "")}
              onClick={() => toggleMic.mutate(!listening)}>
              <div className={cn("w-14 h-14 rounded-full flex items-center justify-center transition-all",
                listening ? "bg-[rgba(0,212,255,0.15)] animate-[pulse-cyan_2s_ease-in-out_infinite]" : "bg-[rgba(255,255,255,0.05)]")}>
                {listening
                  ? <Mic className="w-7 h-7 text-[#00d4ff]" />
                  : <MicOff className="w-7 h-7 text-muted-foreground" />}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">{listening ? "Слушаю" : "Пауза"}</p>
                <p className="text-xs text-muted-foreground">{status?.wakeWord ?? "Джарвис"}</p>
              </div>
            </div>

            {/* Ollama */}
            <div className="glass-panel rounded-xl p-4 flex flex-col items-center gap-3">
              <div className={cn("w-14 h-14 rounded-full flex items-center justify-center",
                status?.ollamaConnected ? "bg-[rgba(0,212,255,0.15)]" : "bg-[rgba(255,255,255,0.05)]")}>
                {status?.ollamaConnected
                  ? <Wifi className="w-7 h-7 text-[#00d4ff]" />
                  : <WifiOff className="w-7 h-7 text-muted-foreground" />}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">{status?.ollamaConnected ? "Ollama OK" : "Ollama офлайн"}</p>
                <p className="text-xs text-muted-foreground">{status?.ollamaModel ?? "–"}</p>
              </div>
            </div>

            {/* Sessions */}
            <div className="glass-panel rounded-xl p-4 flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-[rgba(124,58,237,0.15)] flex items-center justify-center">
                <Activity className="w-7 h-7 text-[#7c3aed]" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{status?.conversationCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Команд</p>
              </div>
            </div>
          </div>

          {/* Command input */}
          <div className="glass-panel rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-widest font-mono">Команда</p>
            <div className="flex gap-2">
              <input
                value={cmd}
                onChange={(e) => setCmd(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && cmd.trim() && sendCmd.mutate(cmd.trim())}
                placeholder="Введите команду для JARVIS..."
                className="flex-1 bg-[rgba(255,255,255,0.05)] border border-[rgba(0,212,255,0.2)] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-[#00d4ff] focus:shadow-[0_0_0_1px_rgba(0,212,255,0.3)] transition-all"
              />
              <button
                onClick={() => cmd.trim() && sendCmd.mutate(cmd.trim())}
                disabled={!cmd.trim() || sendCmd.isPending}
                className="px-4 py-2.5 bg-[rgba(0,212,255,0.15)] hover:bg-[rgba(0,212,255,0.25)] border border-[rgba(0,212,255,0.3)] rounded-lg text-[#00d4ff] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            {sendCmd.isPending && (
              <p className="text-xs text-[#00d4ff] mt-2 animate-pulse">JARVIS думает...</p>
            )}
          </div>

          {/* Recent activity */}
          <div className="glass-panel rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-3 uppercase tracking-widest font-mono flex items-center gap-2">
              <Bot className="w-3 h-3" /> Последние события
            </p>
            <div className="space-y-1.5">
              {!activity?.length && (
                <p className="text-sm text-muted-foreground text-center py-4">Нет активности</p>
              )}
              {activity?.map((row) => (
                <div key={row.id} className="flex items-start gap-3 py-1.5 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                  <span className={cn("text-xs font-mono mt-0.5 shrink-0 uppercase",
                    row.type === "command" ? "text-[#00d4ff]" : row.type === "response" ? "text-[#7c3aed]" : "text-muted-foreground")}>
                    {row.type}
                  </span>
                  <span className="text-sm text-white/80 flex-1 truncate">{row.message}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(row.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }
  