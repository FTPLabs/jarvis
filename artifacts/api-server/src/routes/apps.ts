import { Router } from "express";
import os from "os";

const router = Router();

function getAppPath(win32Path: string, macPath?: string, linuxCmd?: string): string {
  if (process.platform === "win32") return win32Path;
  if (process.platform === "darwin" && macPath) return macPath;
  return linuxCmd ?? win32Path;
}

function getUserHome(): string {
  return os.homedir();
}

const DEFAULT_APPS = [
  {
    id: "chrome", name: "Google Chrome",
    path: getAppPath(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "/Applications/Google Chrome.app",
      "google-chrome"
    ),
    icon: null, category: "browser", voiceAliases: ["chrome", "browser", "google", "хром", "браузер"],
  },
  {
    id: "firefox", name: "Firefox",
    path: getAppPath(
      "C:\\Program Files\\Mozilla Firefox\\firefox.exe",
      "/Applications/Firefox.app",
      "firefox"
    ),
    icon: null, category: "browser", voiceAliases: ["firefox", "mozilla"],
  },
  {
    id: "spotify", name: "Spotify",
    path: getAppPath(
      `${process.env["APPDATA"] ?? getUserHome() + "\\AppData\\Roaming"}\\Spotify\\Spotify.exe`,
      "/Applications/Spotify.app",
      "spotify"
    ),
    icon: null, category: "media", voiceAliases: ["spotify", "music", "спотифай", "музыка"],
  },
  {
    id: "discord", name: "Discord",
    path: getAppPath(
      `${process.env["LOCALAPPDATA"] ?? getUserHome() + "\\AppData\\Local"}\\Discord\\Update.exe`,
      "/Applications/Discord.app",
      "discord"
    ),
    icon: null, category: "communication", voiceAliases: ["discord", "chat", "дискорд"],
  },
  {
    id: "telegram", name: "Telegram",
    path: getAppPath(
      `${process.env["APPDATA"] ?? getUserHome() + "\\AppData\\Roaming"}\\Telegram Desktop\\Telegram.exe`,
      "/Applications/Telegram.app",
      "telegram"
    ),
    icon: null, category: "communication", voiceAliases: ["telegram", "телеграм"],
  },
  {
    id: "steam", name: "Steam",
    path: getAppPath(
      "C:\\Program Files (x86)\\Steam\\steam.exe",
      "/Applications/Steam.app",
      "steam"
    ),
    icon: null, category: "gaming", voiceAliases: ["steam", "games", "gaming", "стим"],
  },
  {
    id: "vscode", name: "VS Code",
    path: getAppPath(
      "C:\\Program Files\\Microsoft VS Code\\Code.exe",
      "/Applications/Visual Studio Code.app",
      "code"
    ),
    icon: null, category: "development", voiceAliases: ["vscode", "code", "editor", "вскод"],
  },
  {
    id: "notepad", name: "Notepad",
    path: getAppPath(
      "C:\\Windows\\notepad.exe",
      undefined,
      "gedit"
    ),
    icon: null, category: "utility", voiceAliases: ["notepad", "text editor", "блокнот"],
  },
  {
    id: "calculator", name: "Calculator",
    path: getAppPath(
      "C:\\Windows\\System32\\calc.exe",
      "/System/Applications/Calculator.app",
      "gnome-calculator"
    ),
    icon: null, category: "utility", voiceAliases: ["calculator", "calc", "math", "калькулятор"],
  },
  {
    id: "terminal", name: "Terminal",
    path: getAppPath(
      "C:\\Windows\\System32\\cmd.exe",
      "/System/Applications/Utilities/Terminal.app",
      "xterm"
    ),
    icon: null, category: "development", voiceAliases: ["terminal", "command prompt", "cmd", "терминал"],
  },
  {
    id: "explorer", name: "File Explorer",
    path: getAppPath(
      "C:\\Windows\\explorer.exe",
      "/System/Library/CoreServices/Finder.app",
      "nautilus"
    ),
    icon: null, category: "utility", voiceAliases: ["explorer", "files", "file manager", "проводник"],
  },
  {
    id: "obs", name: "OBS Studio",
    path: getAppPath(
      "C:\\Program Files\\obs-studio\\bin\\64bit\\obs64.exe",
      "/Applications/OBS.app",
      "obs"
    ),
    icon: null, category: "streaming", voiceAliases: ["obs", "streaming", "recording", "обс"],
  },
  {
    id: "vlc", name: "VLC Media Player",
    path: getAppPath(
      "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe",
      "/Applications/VLC.app",
      "vlc"
    ),
    icon: null, category: "media", voiceAliases: ["vlc", "video player", "media player"],
  },
];

router.get("/list", async (req, res) => {
  try {
    return res.json(DEFAULT_APPS);
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
  return res.json([]);
});

export default router;
