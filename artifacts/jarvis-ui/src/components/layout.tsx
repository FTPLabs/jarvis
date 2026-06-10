import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  Activity, 
  BrainCircuit, 
  Cpu, 
  Grid, 
  Key, 
  LayoutDashboard, 
  Settings as SettingsIcon 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealthCheck, getHealthCheckQueryKey } from "@workspace/api-client-react";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Центр", icon: LayoutDashboard },
    { href: "/memory", label: "Память", icon: BrainCircuit },
    { href: "/apps", label: "Приложения", icon: Grid },
    { href: "/stats", label: "Статистика", icon: Activity },
    { href: "/settings", label: "Настройки", icon: SettingsIcon },
    { href: "/license", label: "Лицензия", icon: Key },
  ];

  const { data: health } = useHealthCheck({
    query: {
      queryKey: getHealthCheckQueryKey(),
      refetchInterval: 10000,
    }
  });

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground scanline dark">
      {/* Боковая панель */}
      <div className="w-20 lg:w-64 border-r border-primary/20 bg-background/50 backdrop-blur-xl flex flex-col justify-between z-20">
        <div>
          <div className="h-20 flex items-center justify-center lg:justify-start lg:px-6 border-b border-primary/20">
            <Cpu className="w-8 h-8 text-primary glow-text" />
            <span className="ml-3 font-mono font-bold text-xl tracking-widest hidden lg:block text-primary glow-text">
              J.A.R.V.I.S
            </span>
          </div>
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href} className="block">
                  <div
                    className={cn(
                      "flex items-center p-3 rounded-md transition-all duration-300 group cursor-pointer",
                      isActive
                        ? "bg-primary/20 text-primary border border-primary/30 shadow-[inset_0_0_10px_rgba(0,212,255,0.2)]"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "w-6 h-6",
                        isActive ? "text-primary drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]" : "group-hover:text-primary transition-colors"
                      )}
                    />
                    <span className="ml-3 font-mono text-sm uppercase hidden lg:block">
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-primary/20">
          <div className="flex items-center justify-center lg:justify-start space-x-3">
            <div className="relative flex h-3 w-3">
              <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", health?.status === "ok" ? "bg-primary" : "bg-destructive")}></span>
              <span className={cn("relative inline-flex rounded-full h-3 w-3", health?.status === "ok" ? "bg-primary" : "bg-destructive")}></span>
            </div>
            <span className="text-xs font-mono uppercase tracking-widest hidden lg:block text-muted-foreground">
              {health?.status === "ok" ? "Система активна" : "Офлайн"}
            </span>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 overflow-auto relative">
        <main className="p-6 md:p-10 max-w-7xl mx-auto z-10 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
