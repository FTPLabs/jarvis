import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function VoiceOrb({ listening = false, active = false }: { listening?: boolean; active?: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Outer rings */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full border border-primary/30",
        )}
        animate={{
          scale: listening ? [1, 1.2, 1] : [1, 1.05, 1],
          opacity: listening ? [0.3, 0.8, 0.3] : [0.1, 0.3, 0.1],
        }}
        transition={{
          duration: listening ? 1.5 : 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className={cn(
          "absolute inset-4 rounded-full border border-primary/40",
        )}
        animate={{
          scale: listening ? [1, 1.15, 1] : [1, 1.02, 1],
          opacity: listening ? [0.4, 0.9, 0.4] : [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: listening ? 1.2 : 3.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.2,
        }}
      />
      
      {/* Core */}
      <motion.div
        className={cn(
          "w-32 h-32 rounded-full relative z-10 flex items-center justify-center",
          listening ? "bg-primary" : "bg-primary/20",
          "shadow-[0_0_50px_rgba(0,212,255,0.4)]",
          active && "shadow-[0_0_80px_rgba(0,212,255,0.8)]"
        )}
        animate={{
          scale: active ? [1, 1.1, 1] : 1,
        }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-24 h-24 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border border-primary/50">
          <div className={cn(
            "w-12 h-12 rounded-full",
            listening ? "bg-primary shadow-[0_0_20px_rgba(0,212,255,1)] animate-pulse" : "bg-primary/50 shadow-[inset_0_0_10px_rgba(0,212,255,0.8)]"
          )} />
        </div>
      </motion.div>
      
      {/* Listening wave particles */}
      {listening && (
        <>
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-primary"
              initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
              animate={{ 
                opacity: 0, 
                scale: 3,
                x: Math.cos(i * (Math.PI / 4)) * 100,
                y: Math.sin(i * (Math.PI / 4)) * 100
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeOut"
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
