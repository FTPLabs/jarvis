import { Layout } from "@/components/layout";
import { 
  useListInstalledApps, 
  getListInstalledAppsQueryKey,
  useListRunningApps,
  getListRunningAppsQueryKey,
  useLaunchApp
} from "@workspace/api-client-react";
import { Box, Play, Terminal } from "lucide-react";
import { motion } from "framer-motion";

const CATEGORY_RU: Record<string, string> = {
  browser: "Браузер",
  media: "Медиа",
  communication: "Общение",
  productivity: "Продуктивность",
  gaming: "Игры",
  development: "Разработка",
  system: "Система",
  utility: "Утилиты",
};

export default function Apps() {
  const { data: installedApps } = useListInstalledApps({
    query: { queryKey: getListInstalledAppsQueryKey() }
  });

  const { data: runningApps } = useListRunningApps({
    query: { 
      queryKey: getListRunningAppsQueryKey(),
      refetchInterval: 3000
    }
  });

  const launchApp = useLaunchApp();

  const handleLaunch = (appId: string) => {
    launchApp.mutate({ data: { appId } });
  };

  return (
    <Layout>
      <div className="space-y-8">
        <header className="mb-8 border-b border-primary/20 pb-4">
          <h1 className="text-3xl font-mono uppercase tracking-widest text-primary glow-text">Запуск программ</h1>
          <p className="text-muted-foreground font-mono text-sm mt-2">Голосовое управление приложениями и монитор процессов</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="font-mono text-xl mb-4 text-primary">Быстрый запуск</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {installedApps?.map((app) => (
                <motion.div 
                  key={app.id}
                  whileHover={{ scale: 1.02 }}
                  className="glass-panel rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer border border-primary/10 hover:border-primary/50 transition-colors group relative overflow-hidden"
                  onClick={() => handleLaunch(app.id)}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {app.icon ? (
                    <img src={app.icon} alt={app.name} className="w-12 h-12 mb-4 drop-shadow-[0_0_8px_rgba(0,212,255,0.5)]" />
                  ) : (
                    <Box className="w-12 h-12 mb-4 text-primary opacity-80 group-hover:opacity-100 group-hover:drop-shadow-[0_0_8px_rgba(0,212,255,0.8)] transition-all" />
                  )}
                  <h3 className="font-bold mb-1">{app.name}</h3>
                  <div className="text-xs font-mono text-muted-foreground uppercase">
                    {CATEGORY_RU[app.category] ?? app.category}
                  </div>
                  <div className="mt-3 flex flex-wrap justify-center gap-1">
                    {app.voiceAliases.slice(0, 2).map((alias) => (
                      <span key={alias} className="text-[9px] font-mono px-1.5 py-0.5 bg-primary/10 text-primary/70 rounded">"{alias}"</span>
                    ))}
                  </div>
                </motion.div>
              ))}
              {!installedApps?.length && (
                <div className="col-span-3 text-center py-12 text-muted-foreground font-mono">Нет приложений</div>
              )}
            </div>
          </div>

          <div>
            <h2 className="font-mono text-xl mb-4 text-accent">Активные процессы</h2>
            <div className="glass-panel rounded-xl p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              {runningApps?.map((app) => (
                <div key={app.pid} className="border border-accent/20 bg-accent/5 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center text-accent font-bold text-sm truncate mr-2">
                      <Terminal className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="truncate">{app.name}</span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground flex-shrink-0">PID: {app.pid}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-black/30 p-1.5 rounded flex justify-between">
                      <span className="text-muted-foreground">ЦПУ</span>
                      <span className="text-accent">{app.cpu.toFixed(1)}%</span>
                    </div>
                    <div className="bg-black/30 p-1.5 rounded flex justify-between">
                      <span className="text-muted-foreground">ОЗУ</span>
                      <span className="text-accent">{app.memory.toFixed(0)}МБ</span>
                    </div>
                  </div>
                </div>
              ))}
              {(!runningApps || runningApps.length === 0) && (
                <div className="text-center p-6 font-mono text-sm text-muted-foreground border border-dashed border-accent/20 rounded-lg">
                  Нет активных процессов
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
