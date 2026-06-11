import { useQuery } from "@tanstack/react-query";
  import { apiFetch } from "@/lib/api";
  import { Layout } from "@/components/Layout";
  import { Grid2X2 } from "lucide-react";

  interface AppEntry {
    id: number;
    name: string;
    category?: string | null;
    lastUsed?: string | null;
    useCount?: number | null;
    isRunning?: boolean | null;
  }

  export default function Apps() {
    const { data, isLoading } = useQuery<AppEntry[]>({
      queryKey: ["apps"],
      queryFn: () => apiFetch("/api/apps"),
      refetchInterval: 15000,
    });

    return (
      <Layout>
        <div className="space-y-6 max-w-3xl">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Grid2X2 className="w-5 h-5 text-[#00d4ff]" /> Приложения
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Приложения обнаруженные JARVIS
            </p>
          </div>

          <div className="glass-panel rounded-xl p-5">
            {isLoading && <p className="text-muted-foreground text-sm">Загрузка...</p>}
            {!isLoading && (!data || data.length === 0) && (
              <p className="text-muted-foreground text-sm text-center py-8">
                Нет данных о приложениях
              </p>
            )}
            <div className="grid gap-2">
              {data?.map((app) => (
                <div key={app.id} className="flex items-center gap-4 py-3 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                  <div className="w-9 h-9 rounded-lg bg-[rgba(0,212,255,0.1)] flex items-center justify-center text-[#00d4ff] font-bold text-sm">
                    {app.name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{app.name}</p>
                    <p className="text-xs text-muted-foreground">{app.category ?? "Без категории"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {app.isRunning && (
                      <span className="text-xs text-[#00d4ff] bg-[rgba(0,212,255,0.1)] px-2 py-0.5 rounded-full">
                        Активно
                      </span>
                    )}
                    {app.useCount != null && app.useCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">{app.useCount}× использовано</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }
  