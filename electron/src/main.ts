import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  Notification,
} from "electron";
import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

const isDev = !app.isPackaged;
const NATIVE_PORT = 8765;
const UI_PORT = isDev ? 5173 : 8080;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let pythonProcess: ChildProcess | null = null;
let forceQuit = false;
let pythonRestartCount = 0;

// ─── Единственный экземпляр ───────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

// ─── Python Core ──────────────────────────────────────────────────────────
function startPythonCore(): void {
  const corePath = isDev
    ? path.join(__dirname, "../../desktop/core/main.py")
    : path.join(process.resourcesPath, "core/main.py");

  const python = process.platform === "win32" ? "python" : "python3";

  pythonProcess = spawn(python, [corePath], {
    stdio: ["pipe", "pipe", "pipe"],
    detached: false,
  });

  pythonProcess.stdout?.on("data", (d) =>
    console.log("[JARVIS Core]", d.toString().trim())
  );
  pythonProcess.stderr?.on("data", (d) =>
    console.error("[JARVIS Core]", d.toString().trim())
  );
  pythonProcess.on("exit", (code) => {
    console.log(`Python Core завершён (код: ${code})`);
    pythonProcess = null;
    // Auto-restart если вылетел не по команде (max 5 попыток с backoff)
    if (!forceQuit && code !== 0) {
      pythonRestartCount++;
      if (pythonRestartCount <= 5) {
        const delay = Math.min(3000 * pythonRestartCount, 15000);
        console.log(`Python Core: рестарт ${pythonRestartCount}/5 через ${delay}ms...`);
        setTimeout(startPythonCore, delay);
      } else {
        console.error("Python Core: превышен лимит перезапусков (5). Проверьте зависимости.");
      }
    }
  });
  // Сброс счётчика рестартов при успешном запуске
  pythonRestartCount = 0;
  console.log(`JARVIS ядро запущено (PID: ${pythonProcess.pid})`);
}

// ─── Main Window ──────────────────────────────────────────────────────────
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: false,
    show: false, // Старт скрытым — только трей
    skipTaskbar: false,
    titleBarStyle: "hidden",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "../assets/jarvis.ico"),
  });

  const url = isDev
    ? `http://localhost:${UI_PORT}`
    : `http://localhost:${UI_PORT}`;

  mainWindow.loadURL(url);

  mainWindow.once("ready-to-show", () => {
    // Не показываем окно сразу — только при клике на трей
    if (isDev) {
      mainWindow?.show();
      mainWindow?.webContents.openDevTools({ mode: "detach" });
    }
  });

  // Закрытие → скрыть в трей, не завершать
  mainWindow.on("close", (event) => {
    if (!forceQuit) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── System Tray ──────────────────────────────────────────────────────────
function createTray(): void {
  const iconPath = path.join(__dirname, "../assets/tray-icon.png");
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();

  tray = new Tray(icon);
  tray.setToolTip("JARVIS — Голосовой ассистент\nАктивен в фоне");

  const updateMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Открыть JARVIS",
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      {
        label: "Свернуть",
        click: () => mainWindow?.hide(),
      },
      { type: "separator" },
      {
        label: "Голос: вкл/выкл",
        click: () => toggleVoice(),
      },
      { type: "separator" },
      {
        label: "Выйти из JARVIS",
        click: () => {
          forceQuit = true;
          app.quit();
        },
      },
    ]);
    tray!.setContextMenu(contextMenu);
  };

  updateMenu();

  tray.on("click", () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
}

// ─── Voice Control ────────────────────────────────────────────────────────
let voiceEnabled = true;

async function toggleVoice() {
  voiceEnabled = !voiceEnabled;
  try {
    await fetch(`http://127.0.0.1:${NATIVE_PORT}/native/voice/listen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: voiceEnabled }),
    });
    showNotification(voiceEnabled ? "Голос включён" : "Голос выключен");
  } catch (e) {
    console.error("Не удалось переключить голос:", e);
  }
}

function showNotification(message: string) {
  if (Notification.isSupported()) {
    new Notification({
      title: "JARVIS",
      body: message,
      silent: true,
    }).show();
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────
function setupIPC(): void {
  ipcMain.on("window-minimize", () => mainWindow?.minimize());
  ipcMain.on("window-maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on("window-close", () => mainWindow?.hide()); // Скрыть в трей
  ipcMain.on("open-external", (_event, url: string) => shell.openExternal(url));
  ipcMain.handle("get-hwid", async () => {
    try {
      const res = await fetch(
        `http://127.0.0.1:${NATIVE_PORT}/native/license/status`
      );
      const data = await res.json();
      return data.hwid;
    } catch {
      return "UNAVAILABLE";
    }
  });
}

// ─── Auto-Start Windows ───────────────────────────────────────────────────
function setupWindowsAutoStart() {
  if (process.platform !== "win32") return;
  const exePath = process.execPath;
  app.setLoginItemSettings({
    openAtLogin: true,
    path: exePath,
    args: ["--hidden"],
  });
}

// ─── App Lifecycle ────────────────────────────────────────────────────────
app.on("ready", async () => {
  // Python core
  startPythonCore();
  await new Promise((r) => setTimeout(r, 2000));

  createWindow();
  createTray();
  setupIPC();
  setupWindowsAutoStart();

  // Горячая клавиша Ctrl+Shift+J — показать/скрыть JARVIS
  globalShortcut.register("CommandOrControl+Shift+J", () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  // Уведомление о запуске в фоне
  setTimeout(() => {
    showNotification("JARVIS активен в фоне.\nСкажите 'Джарвис' или нажмите Ctrl+Shift+J");
  }, 3000);

  console.log("JARVIS запущен в фоне. Трей активен.");
});

// Держим приложение живым даже без окон
app.on("window-all-closed", () => {
  // НЕ quit — работает в трее
});

app.on("before-quit", () => {
  forceQuit = true;
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill("SIGTERM");
  }
  tray?.destroy();
  globalShortcut.unregisterAll();
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
  else mainWindow.show();
});
