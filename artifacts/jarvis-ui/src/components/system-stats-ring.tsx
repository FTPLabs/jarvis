import { ReactNode } from "react";
import { motion } from "framer-motion";

export function SystemStatsRing({ 
  value, 
  label, 
  color = "var(--primary)",
  icon
}: { 
  value: number; 
  label: string; 
  color?: string;
  icon?: ReactNode;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            className="text-muted/30"
          />
          <motion.circle
            cx="56"
            cy="56"
            r={radius}
            stroke={color}
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {icon && <div className="mb-1 opacity-70" style={{ color }}>{icon}</div>}
          <span className="text-xl font-mono font-bold leading-none">{Math.round(value)}%</span>
        </div>
      </div>
      <span className="mt-2 text-xs font-mono text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  );
}
