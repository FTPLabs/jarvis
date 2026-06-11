import { useQuery } from "@tanstack/react-query";
  import { apiFetch } from "@/lib/api";
  import { Layout } from "@/components/Layout";
  import { BarChart3, Cpu, HardDrive, Clock, MessageSquare } from "lucide-react";

  interface SystemStats {
    cpuPercent: number | null;
    ramPercent: number;
    ramUsedGb: number;
    ramTotalGb: number;
    uptimeHours: number;
    sessionCommands: number;
    jarvisUptime: number;
    diskPercent: number | null;
  }

  function StatCard({ icon: Icon, label, value, unit, color = "#00d4ff", sub }: {
    icon: React.ElementType; label: string; value: string | number; unit?: string; color?: string; sub?: string;
  }) {
    return (
      <div className="glass-panel rounded-xl p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">{label}</p>
          <p className="text-xl font-bold text-white mt-0.5">
            {value}<span className="text-sm text-muted-foreground font-normal ml-1">{unit}</span>
          </p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </div>
    );
  }

  function BarMeter({ label, percent, color = "#00d4ff" }: { label: string; percent: number; color?: string }) {
    return (
      <div>
        <div className="flex justify-between mb-1.5">
          <span className="text-sm text-white">{label}</span>
          <span className="text-sm font-mono" style={{ color }}>{Math.round(percent)}%</span>
        </div>
        <div className="h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, percent)}%`, background: color,
              boxShadow: `0 0 8px ${color}80` }}
          />
        </div>
      </div>
    );
  }

  export default function Stats() {
    const { data, isLoading } = useQuery<SystemStats>({
      queryKey: ["stats"],
      queryFn: () => apiFetch("/api/stats/system"),
      refetchInterval: 5000,
    });

    return (
      <Layout>
        <div className="space-y-6 max-w-3xl">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#00d4ff]" /> Статистика
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Системные ресурсы и активность JARVIS</p>
          </div>

          {isLoading && (
            <div className="text-muted-foreground text-sm text-center py-12">Загрузка данных...</div>
          )}

          {data && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <StatCard icon={HardDrive} label="RAM" value={data.ramUsedGb} unit="ГБ"
                  sub={`из ${data.ramTotalGb} ГБ`} />
                <StatCard icon={MessageSquare} label="Команд" value={data.sessionCommands} unit="за сессию"
                  color="#7c3aed" />
                <StatCard icon={Clock} label="Система up" value={data.uptimeHours} unit="ч"
                  color="#00d4ff" />
                <StatCard icon={Clock} label="JARVIS up" value={data.jarvisUptime} unit="ч"
                  color="#7c3aed" />
              </div>

              <div className="glass-panel rounded-xl p-5 space-y-5">
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Нагрузка</p>
                {data.cpuPercent !== null && (
                  <BarMeter label="CPU" percent={data.cpuPercent} color="#00d4ff" />
                )}
                {data.cpuPercent === null && (
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm text-white">CPU</span>
                      <span className="text-sm text-muted-foreground">нет данных</span>
                    </div>
                    <div className="h-2 bg-[rgba(255,255,255,0.05)] rounded-full" />
                  </div>
                )}
                <BarMeter label="RAM" percent={data.ramPercent} color="#7c3aed" />
                {data.diskPercent !== null && data.diskPercent !== undefined && (
                  <BarMeter label="Диск" percent={data.diskPercent} color="#00d4ff80" />
                )}
              </div>
            </>
          )}
        </div>
      </Layout>
    );
  }
  