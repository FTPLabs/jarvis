import { Layout } from "@/components/layout";
import { 
  useGetYoutubeStats,
  getGetYoutubeStatsQueryKey,
  useGetTiktokStats,
  getGetTiktokStatsQueryKey
} from "@workspace/api-client-react";
import { Youtube, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

const mockPerformanceData = [
  { time: "00:00", cpu: 12, ram: 45 },
  { time: "04:00", cpu: 8, ram: 42 },
  { time: "08:00", cpu: 35, ram: 58 },
  { time: "12:00", cpu: 65, ram: 72 },
  { time: "16:00", cpu: 42, ram: 60 },
  { time: "20:00", cpu: 28, ram: 50 },
  { time: "24:00", cpu: 15, ram: 46 },
];

const TREND_RU: Record<string, string> = { up: "Рост", down: "Падение", stable: "Стабильно" };

export default function Stats() {
  const { data: ytStats } = useGetYoutubeStats({
    query: { queryKey: getGetYoutubeStatsQueryKey() }
  });
  const { data: ttStats } = useGetTiktokStats({
    query: { queryKey: getGetTiktokStatsQueryKey() }
  });

  const getTrendIcon = (trend?: string) => {
    if (trend === "up") return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === "down") return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <Layout>
      <div className="space-y-8">
        <header className="mb-8 border-b border-primary/20 pb-4">
          <h1 className="text-3xl font-mono uppercase tracking-widest text-primary glow-text">Аналитика</h1>
          <p className="text-muted-foreground font-mono text-sm mt-2">Метрики платформ и телеметрия системы</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* YouTube */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Youtube className="w-6 h-6 text-red-500 mr-3 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <h2 className="font-mono text-xl text-foreground tracking-wider">YouTube</h2>
              </div>
              <div className="text-xs font-mono uppercase px-2 py-1 rounded bg-black/40 border border-primary/20 text-primary">
                {ytStats?.configured ? "Подключён" : "Офлайн"}
              </div>
            </div>

            {ytStats?.configured ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/30 p-4 rounded-lg border border-primary/10">
                    <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Подписчики</div>
                    <div className="text-2xl font-bold text-primary font-mono">{ytStats.subscribers?.toLocaleString("ru")}</div>
                  </div>
                  <div className="bg-black/30 p-4 rounded-lg border border-primary/10">
                    <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Всего просмотров</div>
                    <div className="text-2xl font-bold text-accent font-mono">{ytStats.totalViews?.toLocaleString("ru")}</div>
                  </div>
                  <div className="bg-black/30 p-4 rounded-lg border border-primary/10">
                    <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Доход/месяц</div>
                    <div className="text-2xl font-bold text-green-400 font-mono">${ytStats.estimatedMonthlyRevenue?.toLocaleString("ru")}</div>
                  </div>
                  <div className="bg-black/30 p-4 rounded-lg border border-primary/10">
                    <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Тренд</div>
                    <div className="flex items-center gap-2 text-xl font-bold font-mono">
                      {TREND_RU[ytStats.trend ?? ""] ?? ytStats.trend} {getTrendIcon(ytStats.trend)}
                    </div>
                  </div>
                </div>
                <div className="bg-black/30 p-4 rounded-lg border border-primary/10">
                  <div className="text-xs font-mono text-muted-foreground uppercase mb-2">Последнее видео</div>
                  <div className="font-bold text-sm truncate">{ytStats.lastVideoTitle}</div>
                  <div className="text-xs text-primary mt-1 font-mono">{ytStats.lastVideoViews?.toLocaleString("ru")} просмотров</div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed border-primary/20 rounded-lg">
                API ключ не настроен → Настройки
              </div>
            )}
          </motion.div>

          {/* TikTok */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <svg viewBox="0 0 24 24" className="w-6 h-6 mr-3 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
                <h2 className="font-mono text-xl text-foreground tracking-wider">TikTok</h2>
              </div>
              <div className="text-xs font-mono uppercase px-2 py-1 rounded bg-black/40 border border-primary/20 text-primary">
                {ttStats?.configured ? "Подключён" : "Офлайн"}
              </div>
            </div>

            {ttStats?.configured ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/30 p-4 rounded-lg border border-primary/10">
                  <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Подписчики</div>
                  <div className="text-2xl font-bold text-primary font-mono">{ttStats.followers?.toLocaleString("ru")}</div>
                </div>
                <div className="bg-black/30 p-4 rounded-lg border border-primary/10">
                  <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Лайки</div>
                  <div className="text-2xl font-bold text-accent font-mono">{ttStats.totalLikes?.toLocaleString("ru")}</div>
                </div>
                <div className="bg-black/30 p-4 rounded-lg border border-primary/10">
                  <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Видео</div>
                  <div className="text-2xl font-bold text-foreground font-mono">{ttStats.videoCount?.toLocaleString("ru")}</div>
                </div>
                <div className="bg-black/30 p-4 rounded-lg border border-primary/10">
                  <div className="text-xs font-mono text-muted-foreground uppercase mb-1">Тренд</div>
                  <div className="flex items-center gap-2 text-xl font-bold font-mono">
                    {TREND_RU[ttStats.trend ?? ""] ?? ttStats.trend} {getTrendIcon(ttStats.trend)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground font-mono text-sm border border-dashed border-primary/20 rounded-lg">
                Имя пользователя не настроено → Настройки
              </div>
            )}
          </motion.div>

          {/* График производительности */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 glass-panel rounded-xl p-6">
            <h2 className="font-mono text-xl text-primary tracking-wider mb-6">История нагрузки (24ч)</h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mockPerformanceData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.1)" vertical={false} />
                  <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'monospace' }}
                    axisLine={false} tickLine={false} />
                  <YAxis stroke="rgba(255,255,255,0.3)"
                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'monospace' }}
                    axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'rgba(5,10,20,0.9)', borderColor: 'rgba(0,212,255,0.3)', fontFamily: 'monospace' }}
                    itemStyle={{ color: '#fff' }} />
                  <Line type="monotone" dataKey="cpu" stroke="var(--primary)" strokeWidth={2}
                    dot={{ fill: 'var(--background)', stroke: 'var(--primary)', strokeWidth: 2, r: 4 }} name="ЦПУ %" />
                  <Line type="monotone" dataKey="ram" stroke="var(--accent)" strokeWidth={2}
                    dot={{ fill: 'var(--background)', stroke: 'var(--accent)', strokeWidth: 2, r: 4 }} name="ОЗУ %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center space-x-6 mt-4 font-mono text-sm">
              <div className="flex items-center text-primary"><div className="w-3 h-3 rounded-full bg-primary mr-2" /> ЦПУ %</div>
              <div className="flex items-center text-accent"><div className="w-3 h-3 rounded-full bg-accent mr-2" /> ОЗУ %</div>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
