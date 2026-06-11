import { Link, useLocation } from "wouter";
  import { cn } from "@/lib/utils";
  import {
    LayoutDashboard, Brain, Grid2X2, BarChart3,
    Settings, KeyRound, ChevronRight
  } from "lucide-react";

  declare global {
    interface Window {
      jarvisAPI?: {
        minimizeWindow: () => void;
        maximizeWindow: () => void;
        closeWindow: () => void;
        openExternal: (url: string) => void;
      };
    }
  }

  const NAV = [
    { path: "/", label: "Главная", icon: LayoutDashboard },
    { path: "/memory", label: "Память", icon: Brain },
    { path: "/apps", label: "Приложения", icon: Grid2X2 },
    { path: "/stats", label: "Статистика", icon: BarChart3 },
    { path: "/settings", label: "Настройки", icon: Settings },
    { path: "/license", label: "Лицензия", icon: KeyRound },
  ];

  export function Layout({ children }: { children: React.ReactNode }) {
    const [location] = useLocation();

    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground select-none">
        {/* Title bar — Electron drag region */}
        <div
          className="flex items-center justify-between h-9 px-4 flex-shrink-0 border-b border-[rgba(0,212,255,0.1)]"
          style={{ WebkitAppRegion: "drag" as never, background: "hsl(220 60% 3%)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#00d4ff] animate-pulse shadow-[0_0_6px_#00d4ff]" />
            <span className="text-xs font-mono text-[#00d4ff] tracking-widest uppercase glow-text">JARVIS v1.0</span>
          </div>
          {/* Window controls */}
          <div
            className="flex items-center gap-1"
            style={{ WebkitAppRegion: "no-drag" as never }}
          >
            <button
              onClick={() => window.jarvisAPI?.minimizeWindow()}
              className="w-7 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-white hover:bg-white/10 text-xs transition-colors"
              title="Свернуть"
            >─</button>
            <button
              onClick={() => window.jarvisAPI?.maximizeWindow()}
              className="w-7 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-white hover:bg-white/10 text-xs transition-colors"
              title="Развернуть"
            >□</button>
            <button
              onClick={() => window.jarvisAPI?.closeWindow()}
              className="w-7 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/20 text-xs transition-colors"
              title="В трей"
            >×</button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="flex flex-col w-52 flex-shrink-0 border-r border-[rgba(0,212,255,0.1)]" style={{ background: "hsl(220 60% 3%)" }}>
            <nav className="flex-1 py-3 px-2 space-y-0.5">
              {NAV.map(({ path, label, icon: Icon }) => {
                const active = location === path;
                return (
                  <Link
                    key={path}
                    href={path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-[rgba(0,212,255,0.12)] text-[#00d4ff] shadow-[inset_0_0_12px_rgba(0,212,255,0.08)]"
                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 flex-shrink-0", active && "drop-shadow-[0_0_4px_#00d4ff]")} />
                    <span>{label}</span>
                    {active && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
                  </Link>
                );
              })}
            </nav>
            <div className="px-4 py-3 border-t border-[rgba(0,212,255,0.1)]">
              <p className="text-[10px] text-muted-foreground/50 font-mono">FTPDev © 2026</p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    );
  }
  