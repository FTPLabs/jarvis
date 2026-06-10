import { Router } from "express";
import { db } from "@workspace/db";
import { appsTable } from "@workspace/db";

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
      const app = DEFAULT_APPS.find((a) => a.id === appId);
      appName = app?.name ?? appId;
    } else if (name) {
      const lowerName = name.toLowerCase();
      const app = DEFAULT_APPS.find((a) =>
        a.voiceAliases.some((alias) => lowerName.includes(alias))
      );
      appName = app?.name ?? name;
    }

    if (!appName) {
      return res.json({ success: false, message: "Application not found", appName: null });
    }

    // In web mode: we return what would be launched
    // In desktop Electron mode: the Python backend handles actual launch
    return res.json({
      success: true,
      message: `${appName} launch command sent to system`,
      appName,
    });
  } catch (err) {
    req.log.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/running", async (req, res) => {
  // Simulated running processes (in desktop mode, Python backend provides real data)
  const running = [
    { pid: 1234, name: "chrome.exe", cpu: 2.3, memory: 450.2 },
    { pid: 5678, name: "discord.exe", cpu: 0.8, memory: 280.1 },
    { pid: 9012, name: "spotify.exe", cpu: 0.4, memory: 180.5 },
    { pid: 3456, name: "vscode.exe", cpu: 1.2, memory: 320.8 },
    { pid: 7890, name: "jarvis.exe", cpu: 0.6, memory: 120.3 },
  ];
  return res.json(running);
});

export default router;
