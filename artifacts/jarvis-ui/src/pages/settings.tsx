import { Layout } from "@/components/layout";
import { 
  useGetSettings,
  getGetSettingsQueryKey,
  useUpdateSettings,
  useListSkills,
  getListSkillsQueryKey
} from "@workspace/api-client-react";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Cpu, Globe, Mic, Volume2, Key, Bell, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  
  const { data: settings } = useGetSettings({
    query: { queryKey: getGetSettingsQueryKey() }
  });

  const { data: skills } = useListSkills({
    query: { queryKey: getListSkillsQueryKey() }
  });

  const updateSettings = useUpdateSettings();

  const [formData, setFormData] = useState<any>({});
  const initialized = useRef(false);

  useEffect(() => {
    if (settings && !initialized.current) {
      setFormData(settings);
      initialized.current = true;
    }
  }, [settings]);

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateSettings.mutate({ data: formData }, {
      onSuccess: () => {
        toast({
          title: "Настройки сохранены",
          description: "Конфигурация успешно применена.",
        });
      }
    });
  };

  return (
    <Layout>
      <div className="space-y-8 pb-20">
        <header className="mb-8 border-b border-primary/20 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-mono uppercase tracking-widest text-primary glow-text">Настройки системы</h1>
            <p className="text-muted-foreground font-mono text-sm mt-2">Параметры ядра и интеграции</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="px-6 py-2 bg-primary/20 text-primary border border-primary hover:bg-primary/30 font-mono text-sm rounded shadow-[0_0_15px_rgba(0,212,255,0.2)] transition-all"
          >
            {updateSettings.isPending ? "СОХРАНЕНИЕ..." : "ПРИМЕНИТЬ"}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Настройки ИИ */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center mb-6 border-b border-primary/20 pb-2">
                <Cpu className="w-5 h-5 text-primary mr-3" />
                <h2 className="font-mono text-lg text-primary uppercase tracking-wider">Мозговой интерфейс (Ollama)</h2>
              </div>
              <div className="space-y-4 font-mono text-sm">
                <div>
                  <label className="block text-muted-foreground mb-1 uppercase text-xs">Адрес сервера</label>
                  <input 
                    type="text" 
                    value={formData.ollamaUrl || ""}
                    onChange={e => handleChange("ollamaUrl", e.target.value)}
                    className="w-full bg-black/40 border border-primary/30 rounded p-2 text-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-[inset_0_0_10px_rgba(0,212,255,0.05)]"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 uppercase text-xs">Основная модель</label>
                  <input 
                    type="text" 
                    value={formData.ollamaModel || ""}
                    onChange={e => handleChange("ollamaModel", e.target.value)}
                    className="w-full bg-black/40 border border-primary/30 rounded p-2 text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center mb-6 border-b border-primary/20 pb-2">
                <Mic className="w-5 h-5 text-accent mr-3" />
                <h2 className="font-mono text-lg text-accent uppercase tracking-wider">Голосовые движки</h2>
              </div>
              <div className="space-y-4 font-mono text-sm">
                <div className="flex justify-between items-center bg-black/20 p-3 border border-primary/10 rounded">
                  <div>
                    <div className="text-foreground">Распознавание активационного слова</div>
                    <div className="text-xs text-muted-foreground">Всегда слушает "{formData.wakeWord || 'Джарвис'}"</div>
                  </div>
                  <Switch 
                    checked={formData.wakeWordEnabled} 
                    onCheckedChange={v => handleChange("wakeWordEnabled", v)}
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 uppercase text-xs">Активационное слово</label>
                  <input 
                    type="text" 
                    value={formData.wakeWord || ""}
                    onChange={e => handleChange("wakeWord", e.target.value)}
                    className="w-full bg-black/40 border border-primary/30 rounded p-2 text-primary focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-muted-foreground mb-1 uppercase text-xs">Распознавание речи</label>
                    <select 
                      value={formData.sttEngine || ""}
                      onChange={e => handleChange("sttEngine", e.target.value)}
                      className="w-full bg-black/40 border border-primary/30 rounded p-2 text-primary focus:outline-none appearance-none"
                    >
                      <option value="whisper">Whisper (локально)</option>
                      <option value="browser">Системный</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-muted-foreground mb-1 uppercase text-xs">Синтез речи</label>
                    <select 
                      value={formData.ttsEngine || ""}
                      onChange={e => handleChange("ttsEngine", e.target.value)}
                      className="w-full bg-black/40 border border-primary/30 rounded p-2 text-primary focus:outline-none appearance-none"
                    >
                      <option value="piper">Piper (локально, RU)</option>
                      <option value="chatterbox">Chatterbox (клонирование)</option>
                      <option value="system">Системный голос</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center mb-6 border-b border-primary/20 pb-2">
                <Volume2 className="w-5 h-5 text-chart-4 mr-3" />
                <h2 className="font-mono text-lg text-chart-4 uppercase tracking-wider">Матрица личности</h2>
              </div>
              <div className="space-y-6 font-mono text-sm">
                <div className="flex justify-between items-center bg-black/20 p-3 border border-primary/10 rounded">
                  <div>
                    <div className="text-foreground">Клонирование голоса</div>
                    <div className="text-xs text-muted-foreground">Использовать обученную модель голоса</div>
                  </div>
                  <Switch 
                    checked={formData.voiceCloneEnabled} 
                    onCheckedChange={v => handleChange("voiceCloneEnabled", v)}
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs uppercase text-muted-foreground mb-3">
                    <span>Интенсивность эмоций</span>
                    <span className="text-primary">{formData.emotionIntensity}%</span>
                  </div>
                  <Slider 
                    value={[formData.emotionIntensity || 50]} 
                    max={100} 
                    step={1}
                    onValueChange={v => handleChange("emotionIntensity", v[0])}
                    className="my-4"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Роботизированный</span>
                    <span>Человечный</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Интеграции */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-6">
            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center mb-6 border-b border-primary/20 pb-2">
                <Key className="w-5 h-5 text-chart-5 mr-3" />
                <h2 className="font-mono text-lg text-chart-5 uppercase tracking-wider">API ключи</h2>
              </div>
              <div className="space-y-4 font-mono text-sm">
                <div>
                  <label className="block text-muted-foreground mb-1 uppercase text-xs">YouTube API ключ</label>
                  <input 
                    type="password" 
                    value={formData.youtubeApiKey || ""}
                    onChange={e => handleChange("youtubeApiKey", e.target.value)}
                    className="w-full bg-black/40 border border-primary/30 rounded p-2 text-primary focus:outline-none"
                    placeholder="••••••••••••••••••••••••••••"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 uppercase text-xs">YouTube ID канала</label>
                  <input 
                    type="text" 
                    value={formData.youtubeChannelId || ""}
                    onChange={e => handleChange("youtubeChannelId", e.target.value)}
                    className="w-full bg-black/40 border border-primary/30 rounded p-2 text-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-muted-foreground mb-1 uppercase text-xs">Имя пользователя TikTok</label>
                  <input 
                    type="text" 
                    value={formData.tiktokUsername || ""}
                    onChange={e => handleChange("tiktokUsername", e.target.value)}
                    className="w-full bg-black/40 border border-primary/30 rounded p-2 text-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center mb-6 border-b border-primary/20 pb-2">
                <Bell className="w-5 h-5 text-green-400 mr-3" />
                <h2 className="font-mono text-lg text-green-400 uppercase tracking-wider">Протоколы напоминаний</h2>
              </div>
              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between items-center bg-black/20 p-3 border border-primary/10 rounded">
                  <span className="text-foreground">Напоминания о воде</span>
                  <Switch 
                    checked={formData.waterReminderEnabled} 
                    onCheckedChange={v => handleChange("waterReminderEnabled", v)}
                  />
                </div>
                <div className="flex justify-between items-center bg-black/20 p-3 border border-primary/10 rounded">
                  <span className="text-foreground">Перерывы и осанка</span>
                  <Switch 
                    checked={formData.breakReminderEnabled} 
                    onCheckedChange={v => handleChange("breakReminderEnabled", v)}
                  />
                </div>
                <div className="flex justify-between items-center bg-black/20 p-3 border border-primary/10 rounded">
                  <span className="text-foreground">Сон ({formData.sleepTime})</span>
                  <Switch 
                    checked={formData.sleepReminderEnabled} 
                    onCheckedChange={v => handleChange("sleepReminderEnabled", v)}
                  />
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-xl p-6">
              <div className="flex items-center mb-6 border-b border-primary/20 pb-2">
                <Workflow className="w-5 h-5 text-primary mr-3" />
                <h2 className="font-mono text-lg text-primary uppercase tracking-wider">Установленные навыки</h2>
              </div>
              <div className="space-y-3 font-mono text-sm">
                {skills?.map(skill => (
                  <div key={skill.id} className="border border-primary/20 bg-primary/5 rounded p-3 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-primary flex items-center">
                        {skill.name} <span className="ml-2 text-[10px] text-muted-foreground px-1 bg-black/50 rounded">v{skill.version}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{skill.description}</div>
                    </div>
                    <div className={cn("text-xs px-2 py-1 rounded uppercase tracking-wider border", skill.enabled ? "bg-primary/20 text-primary border-primary/30" : "bg-muted/20 text-muted-foreground border-muted/30")}>
                      {skill.enabled ? "Активен" : "Отключён"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
