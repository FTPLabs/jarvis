import { Layout } from "@/components/layout";
import { 
  useGetLicenseStatus,
  getGetLicenseStatusQueryKey,
  useActivateLicense
} from "@workspace/api-client-react";
import { Shield, ShieldAlert, ShieldCheck, Fingerprint, Lock } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function License() {
  const { toast } = useToast();
  const [licenseKey, setLicenseKey] = useState("");
  const [email, setEmail] = useState("");

  const { data: status, refetch } = useGetLicenseStatus({
    query: { queryKey: getGetLicenseStatusQueryKey() }
  });

  const activate = useActivateLicense();

  const handleActivate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;

    activate.mutate({ data: { licenseKey, email } }, {
      onSuccess: () => {
        toast({
          title: "Лицензия активирована",
          description: "Аутентификация прошла успешно. Полный доступ открыт.",
        });
        refetch();
        setLicenseKey("");
        setEmail("");
      },
      onError: () => {
        toast({
          title: "Ошибка активации",
          description: "Неверный ключ лицензии или ошибка авторизации.",
          variant: "destructive"
        });
      }
    });
  };

  const isActivated = status?.activated;

  return (
    <Layout>
      <div className="space-y-8 flex flex-col items-center justify-center min-h-[80vh]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl glass-panel rounded-2xl p-1 relative overflow-hidden"
        >
          <div className={cn(
            "absolute inset-0 opacity-20 blur-3xl transition-colors duration-1000",
            isActivated ? "bg-primary" : "bg-destructive"
          )} />

          <div className="bg-background/90 backdrop-blur-xl rounded-xl p-8 lg:p-12 relative z-10 border border-white/5">
            <div className="flex flex-col items-center text-center mb-10 border-b border-white/10 pb-8">
              <div className="relative mb-6">
                {isActivated ? (
                  <ShieldCheck className="w-20 h-20 text-primary drop-shadow-[0_0_15px_rgba(0,212,255,0.8)]" />
                ) : (
                  <ShieldAlert className="w-20 h-20 text-destructive drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
                )}
              </div>
              <h1 className="text-3xl font-mono uppercase tracking-widest text-foreground mb-2">
                Авторизация системы
              </h1>
              <p className="text-muted-foreground font-mono text-sm max-w-md mx-auto">
                {isActivated 
                  ? "Личность подтверждена. Все системы разблокированы и работают на полную мощность."
                  : "Активен режим ограничений. Введите ключ лицензии для разблокировки полных возможностей."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              <div className="space-y-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Аппаратный ID</div>
                <div className="bg-black/50 border border-primary/20 rounded-lg p-4 flex items-center shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
                  <Fingerprint className="w-5 h-5 text-primary mr-3 flex-shrink-0" />
                  <code className="text-primary text-xs tracking-widest break-all">{status?.hwid || "СКАНИРОВАНИЕ..."}</code>
                </div>
              </div>

              <div className="space-y-4">
                <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2">Статус лицензии</div>
                <div className={cn(
                  "bg-black/50 border rounded-lg p-4 flex items-center shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]",
                  isActivated ? "border-primary/20 text-primary" : "border-destructive/20 text-destructive"
                )}>
                  {isActivated ? <Shield className="w-5 h-5 mr-3" /> : <Lock className="w-5 h-5 mr-3" />}
                  <div className="flex flex-col">
                    <span className="font-mono font-bold tracking-widest uppercase">
                      {isActivated ? "Авторизован" : "Не активирован"}
                    </span>
                    {isActivated && status?.licenseType && (
                      <span className="text-xs uppercase opacity-70">
                        {status.licenseType === "permanent" ? "Постоянная" : "Пробная"}
                        {status.daysRemaining !== null ? ` — осталось ${status.daysRemaining} дней` : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {!isActivated && (
              <form onSubmit={handleActivate} className="space-y-5 bg-black/20 p-6 rounded-xl border border-white/5">
                <div>
                  <label className="block text-muted-foreground font-mono uppercase text-xs mb-2">Лицензионный ключ</label>
                  <input 
                    type="text" 
                    value={licenseKey}
                    onChange={e => setLicenseKey(e.target.value.toUpperCase())}
                    placeholder="JARVIS-XXXX-XXXX-XXXX"
                    className="w-full bg-black/40 border border-primary/30 rounded-lg p-3 text-center text-primary font-mono tracking-widest focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary uppercase transition-all"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground font-mono uppercase text-xs mb-2">Email (необязательно)</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="operator@stark.com"
                    className="w-full bg-black/40 border border-primary/30 rounded-lg p-3 text-center text-primary font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={activate.isPending || !licenseKey.trim()}
                  className="w-full py-3 bg-primary/20 text-primary border border-primary hover:bg-primary hover:text-background font-mono text-sm uppercase tracking-widest rounded-lg transition-all duration-300 shadow-[0_0_15px_rgba(0,212,255,0.2)] hover:shadow-[0_0_25px_rgba(0,212,255,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {activate.isPending ? "Проверяю..." : "Активировать лицензию"}
                </button>
                <p className="text-center text-xs text-muted-foreground font-mono">
                  Демо-ключ для теста: <span className="text-primary">JARVIS-DEMO-TEST-2024</span>
                </p>
              </form>
            )}

            {isActivated && (
              <div className="flex flex-col items-center justify-center space-y-2 mt-8 border border-primary/10 bg-primary/5 rounded-xl p-6">
                <span className="font-mono text-sm text-primary uppercase tracking-widest">Протокол активен</span>
                {status?.expiresAt && (
                  <span className="font-mono text-xs text-muted-foreground">
                    Действует до: {format(new Date(status.expiresAt), "d MMMM yyyy", { locale: ru })}
                  </span>
                )}
                {status?.email && (
                  <span className="font-mono text-xs text-muted-foreground">Зарегистрирован: {status.email}</span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
