import { Router } from "express";

  const router = Router();

  const DEFAULT_APPS = [
    { id: "chrome", name: "Google Chrome", path: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", icon: null, category: "browser", voiceAliases: ["chrome", "browser", "google"] },
    { id: "firefox", name: "Firefox", path: "C:\\Program Files\\Mozilla Firefox\\firefox.exe", icon: null, category: "browser", voiceAliases: ["firefox", "mozilla"] },
    { id: "spotify", name: "Spotify", path: process.env["APPDATA"] ? `${process.env["APPDATA"]}\\Spotify\\Spotify.exe` : "C:\\Users\\%USERNAME%\\AppData\\Roaming\\Spotify\\Spotify.exe", icon: null, category: "media", voiceAliases: ["spotify", "music"] },
    { id: "discord", name: "Discord", path: process.env["LOCALAPPDATA"] ? `${process.env["LOCALAPPDATA"]}\\Discord\\app.exe` : "C:\\Users\\%USERNAME%\\AppData\\Local\\Discord\\app.exe", icon: null, category: "communication", voiceAliases: ["discord", "chat"] },
    { id: "steam", name: "Steam", path: "C:\\Program Files (x86)\\Steam\\steam.exe", icon: null, category: "gaming", voiceAliases: ["steam", "games", "gaming"] },
    { id: "vscode", name: "VS Code", path: "C:\\Program Files\\Microsoft VS Code\\Code.exe", icon: null, category: "development", voiceAliases: ["vscode", "code", "editor"] },
    { id: "notepad", name: "Notepad", path: "C:\\Windows\\notepad.exe", icon: null, category: "utility", voiceAliases: ["notepad", "text editor"] },
    { id: "calculator", name: "Calculator", path: "C:\\Windows\\System32\\calc.exe", icon: null, category: "utility", voiceAliases: ["calculator", "calc", "math"] },
    { id: "terminal", name: "Terminal", path: "C:\\Windows\\System32\\cmd.exe", icon: null, category: "development", voiceAliases: ["terminal", "command prompt", "cmd"] },
    { id: "explorer", name: "File Explorer", path: "C:\\Windows\\explorer.exe", icon: null, category: "utility", voiceAliases: ["explorer", "files", "file manager"] },
    { id: "obs", name: "OBS Studio", path: "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe", icon: null, category: "streaming", voiceAliases: ["obs", "streaming", "recording"] },
    { id: "vlc", name: "VLC Media Player", path: "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe", icon: null, category: "media", voiceAliases: ["vlc", "video player", "media player"] },
  ];

  router.get("/list", async (req, res) => {
    try {
      return res.json(DEFAULT_APPS.map((a) => ({ ...a, voiceAliases: a.voiceAliases })));
    } catch (err) {
      req.log.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.post("/launch", async (req, res) => {
    try {
      const { appId, name } = req.body;

      let appName: string | null = null;

      if (appId) {
        const found = DEFAULT_APPS.find((a) => a.id === appId);
        appName = found?.name ?? appId;
      } else if (name) {
        const lowerName = name.toLowerCase();
        const found = DEFAULT_APPS.find((a) =>
          a.voiceAliases.some((alias) => lowerName.includes(alias))
        );
        appName = found?.name ?? name;
      }

      if (!appName) {
        return res.json({ success: false, message: "Application not found", appName: null });
      }

      // Запуск приложений доступен только через Python-ядро (desktop/core/main.py POST /native/apps/launch).
      // Express API работает в веб-режиме и не имеет прямого доступа к ОС.
      // Клиент должен проксировать запрос к Python-ядру (порт 8765) для реального запуска.
      return res.json({
        success: false,
        message: `Запуск ${appName} доступен только в desktop-режиме через Python-ядро`,
        appName,
        nativeEndpoint: "http://127.0.0.1:8765/native/apps/launch",
      });
    } catch (err) {
      req.log.error(err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  router.get("/running", async (req, res) => {
    // Реальный список процессов доступен только через Python-ядро: GET /native/apps/running
    // В веб-режиме возвращаем пустой массив — не симулируем фиктивные данные.
    return res.json([]);
  });

  export default router;
  