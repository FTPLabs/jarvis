import { useQuery } from "@tanstack/react-query";
  import { apiFetch } from "@/lib/api";
  import { Layout } from "@/components/Layout";
  import { Brain, Tag } from "lucide-react";

  interface LearningData {
    conversationCount: number;
    learnedFacts: Record<string, string>;
    commandFrequency: Record<string, number>;
    userName: string;
    topApps: string[];
  }

  export default function Memory() {
    const { data, isLoading } = useQuery<LearningData>({
      queryKey: ["learning"],
      queryFn: () => apiFetch("/api/voice/learning"),
      refetchInterval: 10000,
    });

    const facts = Object.entries(data?.learnedFacts ?? {});
    const topCmds = Object.entries(data?.commandFrequency ?? {})
      .sort((a, b) => b[1] - a[1]).slice(0, 10);

    return (
      <Layout>
        <div className="space-y-6 max-w-3xl">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#00d4ff]" /> Память JARVIS
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Всё что JARVIS знает о вас — хранится только локально
            </p>
          </div>

          {/* User profile */}
          <div className="glass-panel rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-3">Профиль</p>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(0,212,255,0.15)] flex items-center justify-center text-[#00d4ff] font-bold text-lg">
                {(data?.userName ?? "Х")[0]}
              </div>
              <div>
                <p className="text-white font-semibold text-lg">{data?.userName ?? "ХОЗЯИН"}</p>
                <p className="text-muted-foreground text-sm">{data?.conversationCount ?? 0} команд в истории</p>
              </div>
            </div>
          </div>

          {/* Known facts */}
          <div className="glass-panel rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-3">
              Известные факты ({facts.length})
            </p>
            {isLoading && <p className="text-muted-foreground text-sm">Загрузка...</p>}
            {!isLoading && facts.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-6">
                Нет данных. Поговорите с JARVIS чтобы он узнал о вас больше.
              </p>
            )}
            <div className="grid gap-2">
              {facts.map(([key, value]) => (
                <div key={key} className="flex items-center gap-3 py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                  <Tag className="w-3 h-3 text-[#7c3aed] shrink-0" />
                  <span className="text-xs text-muted-foreground font-mono w-32 truncate">{key}</span>
                  <span className="text-sm text-white flex-1">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top commands */}
          <div className="glass-panel rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-3">
              Частые запросы
            </p>
            {topCmds.length === 0 && (
              <p className="text-muted-foreground text-sm text-center py-4">Нет данных</p>
            )}
            <div className="space-y-2">
              {topCmds.map(([cmd, count], i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-white/80 truncate">{cmd}</span>
                      <span className="text-xs text-[#00d4ff] shrink-0">{count}×</span>
                    </div>
                    <div className="h-1 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00d4ff] rounded-full transition-all"
                        style={{ width: `${Math.min(100, (count / (topCmds[0]?.[1] ?? 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }
  