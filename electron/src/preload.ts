import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("jarvisAPI", {
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),
  openExternal: (url: string) => ipcRenderer.send("open-external", url),
});
