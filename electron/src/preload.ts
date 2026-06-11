import { contextBridge, ipcRenderer } from "electron";

  // Разрешённые схемы URL для openExternal
  const ALLOWED_URL_SCHEMES = ["https:", "http:"];

  function isSafeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ALLOWED_URL_SCHEMES.includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  contextBridge.exposeInMainWorld("jarvisAPI", {
    minimizeWindow: () => ipcRenderer.send("window-minimize"),
    maximizeWindow: () => ipcRenderer.send("window-maximize"),
    closeWindow: () => ipcRenderer.send("window-close"),
    openExternal: (url: string) => {
      if (!isSafeUrl(url)) {
        console.error("[preload] openExternal заблокирован: небезопасный URL:", url);
        return;
      }
      ipcRenderer.send("open-external", url);
    },
  });
  