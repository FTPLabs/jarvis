import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import { useState, useEffect } from "react";
  import { apiFetch } from "@/lib/api";
  import { Layout } from "@/components/Layout";
  import { Settings as SettingsIcon, Save } from "lucide-react";
  import { toast } from "sonner";

  interface SettingsData {
    sttEngine: string;
    ttsEngine: string;
    wakeWord: string;
    wakeWordEnabled: boolean;
    language: string;
    ollamaModel: string;
  }

  export default function Settings() {
    const qc = useQueryClient();
    const { data } = useQuery<SettingsData>({
      queryKey: ["settings"],
      queryFn: () => apiFetch("/api/settings"),
    });

    const [form, setForm] = useState<Partial<SettingsData>>({});
    useEffect(() => { if (data) setForm(data); }, [data]);

    const save = useMutation({
      mutationFn: (settings: Partial<SettingsData>) =>
        apiFetch("/api/settings", { method: "POST", body: JSON.stringify(settings) }),
      onSuccess: () => {
        toast.success("Настройки сохранены");
        qc.invalidateQueries({ queryKey: ["settings"] });
        qc.invalidateQueries({ queryKey: ["voice-status"] });
      },
      onError: () => toast.error("Ошибка сохранения"),
    });

    function Field({ label, name, type = "text", options }: {
      label: string; name: keyof SettingsData; type?: string; options?: string[];
    }) {
      return (
        <div>
          <label className="block text-xs text-muted-foreground uppercase tracking-wider font-mono mb-2">{label}</label>
          {options ? (
            <select
              value={String(form[name] ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(0,212,255,0.2)] rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:border-[#00d4ff] transition-colors"
            >
              {options.map((o) => <option key={o} value={o} style={{ background: "#0a1628" }}>{o}</option>)}
            </select>
          ) : type === "checkbox" ? (
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setForm((f) => ({ ...f, [name]: !f[name] }))}
                className={`w-11 h-6 rounded-full transition-colors relative ${form[name] ? "bg-[rgba(0,212,255,0.5)]" : "bg-[rgba(255,255,255,0.1)]"}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full transition-all bg-white ${form[name] ? "left-6" : "left-1"}`} />
              </div>
              <span className="text-sm text-white">{form[name] ? "Включено" : "Выключено"}</span>
            </label>
          ) : (
            <input
              type={type}
              value={String(form[name] ?? "")}
              onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
              className="w-full bg-[rgba(255,255,255,0.05)] border border-[rgba(0,212,255,0.2)] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-[#00d4ff] transition-colors"
            />
          )}
        </div>
      );
    }

    return (
      <Layout>
        <div className="space-y-6 max-w-lg">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-[#00d4ff]" /> Настройки
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Конфигурация голосового движка</p>
          </div>

          <div className="glass-panel rounded-xl p-5 space-y-5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Голос</p>
            <Field label="Распознавание речи (STT)" name="sttEngine" options={["whisper", "vosk", "google"]} />
            <Field label="Синтез речи (TTS)" name="ttsEngine" options={["piper", "espeak", "google"]} />
            <Field label="Язык" name="language" options={["ru", "en"]} />
          </div>

          <div className="glass-panel rounded-xl p-5 space-y-5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Пробуждение</p>
            <Field label="Ключевое слово" name="wakeWord" />
            <Field label="Активация по слову" name="wakeWordEnabled" type="checkbox" />
          </div>

          <div className="glass-panel rounded-xl p-5 space-y-5">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">AI</p>
            <Field label="Модель Ollama" name="ollamaModel" />
          </div>

          <button
            onClick={() => save.mutate(form)}
            disabled={save.isPending}
            className="flex items-center gap-2 px-6 py-3 bg-[rgba(0,212,255,0.15)] hover:bg-[rgba(0,212,255,0.25)] border border-[rgba(0,212,255,0.3)] rounded-lg text-[#00d4ff] font-medium transition-all disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            {save.isPending ? "Сохранение..." : "Сохранить настройки"}
          </button>
        </div>
      </Layout>
    );
  }
  