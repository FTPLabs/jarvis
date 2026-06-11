import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import { useState } from "react";
  import { apiFetch } from "@/lib/api";
  import { Layout } from "@/components/Layout";
  import { KeyRound, ShieldCheck, ShieldAlert, Copy } from "lucide-react";
  import { toast } from "sonner";

  interface LicenseStatus {
    hwid: string;
    activated: boolean;
    licenseType: string | null;
    expiresAt: string | null;
    daysRemaining: number | null;
    email: string | null;
  }

  export default function License() {
    const qc = useQueryClient();
    const [key, setKey] = useState("");

    const { data, isLoading } = useQuery<LicenseStatus>({
      queryKey: ["license"],
      queryFn: () => apiFetch("/api/license/status"),
      refetchInterval: 30000,
    });

    const activate = useMutation({
      mutationFn: (licenseKey: string) =>
        apiFetch("/api/license/activate", {
          method: "POST",
          body: JSON.stringify({ licenseKey }),
        }),
      onSuccess: () => {
        toast.success("Лицензия активирована!");
        qc.invalidateQueries({ queryKey: ["license"] });
        setKey("");
      },
      onError: (err: Error) => toast.error(err.message ?? "Неверный ключ"),
    });

    function copyHWID() {
      if (data?.hwid) {
        navigator.clipboard.writeText(data.hwid).catch(() => {});
        toast.success("HWID скопирован");
      }
    }

    const isPermanent = data?.licenseType === "permanent" || data?.licenseType === "PERM";
    const isDemo = data?.licenseType === "demo" || data?.licenseType === "DEMO";

    return (
      <Layout>
        <div className="space-y-6 max-w-lg">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#00d4ff]" /> Лицензия
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Управление активацией JARVIS</p>
          </div>

          {/* Status */}
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${data?.activated ? "bg-[rgba(0,212,255,0.15)]" : "bg-[rgba(255,255,255,0.05)]"}`}>
                {data?.activated
                  ? <ShieldCheck className="w-7 h-7 text-[#00d4ff]" />
                  : <ShieldAlert className="w-7 h-7 text-muted-foreground" />}
              </div>
              <div>
                <p className="text-lg font-bold text-white">
                  {isLoading ? "Загрузка..." : data?.activated ? "Активировано" : "Не активировано"}
                </p>
                {data?.activated && (
                  <div className="text-sm text-muted-foreground space-y-0.5 mt-1">
                    <p>Тип: <span className="text-[#00d4ff]">{isPermanent ? "Постоянная" : isDemo ? "Демо" : data.licenseType}</span></p>
                    {data.expiresAt && (
                      <p>Истекает: {new Date(data.expiresAt).toLocaleDateString("ru-RU")}
                        {data.daysRemaining !== null && <span className="text-[#7c3aed]"> ({data.daysRemaining} дн.)</span>}
                      </p>
                    )}
                    {isPermanent && <p className="text-[#00d4ff]">Бессрочная лицензия ✓</p>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* HWID */}
          <div className="glass-panel rounded-xl p-5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono mb-3">ID компьютера (HWID)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-[rgba(0,0,0,0.3)] border border-[rgba(0,212,255,0.15)] rounded-lg px-4 py-2.5 text-sm text-[#00d4ff] font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                {data?.hwid ?? "Загрузка..."}
              </code>
              <button
                onClick={copyHWID}
                className="px-3 py-2.5 bg-[rgba(0,212,255,0.1)] hover:bg-[rgba(0,212,255,0.2)] border border-[rgba(0,212,255,0.2)] rounded-lg text-[#00d4ff] transition-all"
                title="Скопировать HWID"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Привяжите этот ID к лицензионному ключу при покупке</p>
          </div>

          {/* Activation */}
          <div className="glass-panel rounded-xl p-5 space-y-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Активация</p>
            <div>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="JARVIS-XXXX-XXXX-XXXX"
                className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(0,212,255,0.2)] rounded-lg px-4 py-3 text-sm text-white placeholder:text-muted-foreground font-mono outline-none focus:border-[#00d4ff] transition-colors"
              />
            </div>
            <button
              onClick={() => key.trim() && activate.mutate(key.trim())}
              disabled={!key.trim() || activate.isPending}
              className="w-full py-3 bg-[rgba(0,212,255,0.15)] hover:bg-[rgba(0,212,255,0.25)] border border-[rgba(0,212,255,0.3)] rounded-lg text-[#00d4ff] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {activate.isPending ? "Активация..." : "Активировать лицензию"}
            </button>
            <p className="text-xs text-muted-foreground">
              Демо-ключ для тестирования: <span className="text-[#00d4ff] font-mono">JARVIS-DEMO-TEST-2024</span>
            </p>
          </div>
        </div>
      </Layout>
    );
  }
  