const { contextBridge, ipcRenderer, webUtils } = require("electron");

// Jembatan aman antara renderer (React) dan main process
contextBridge.exposeInMainWorld("island", {
  setIgnoreMouse: (ignore) => ipcRenderer.send("island:ignore-mouse", ignore),
  setFocusable: (focusable) =>
    ipcRenderer.invoke("island:focusable", focusable),

  // Ukuran notch yang sedang dituju: main process memakainya untuk hit-test kursor
  setBounds: (rect) => ipcRenderer.send("island:bounds", rect),
  // Posisi kursor dari main process: { hover: di atas notch?, zone: di zona atas layar? }
  onCursor: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("island:cursor", handler);
    return () => ipcRenderer.removeListener("island:cursor", handler);
  },

  // Pintasan global (Ctrl+Alt+Space): buka island ke pencarian aplikasi
  onOpenSearch: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("island:open-search", handler);
    return () => ipcRenderer.removeListener("island:open-search", handler);
  },

  // Menu tray "Tampilkan island"
  onReveal: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("island:reveal", handler);
    return () => ipcRenderer.removeListener("island:reveal", handler);
  },

  media: {
    get: () => ipcRenderer.invoke("media:get"),
    command: (cmd) => ipcRenderer.send("media:command", cmd),
    onUpdate: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("media:update", handler);
      return () => ipcRenderer.removeListener("media:update", handler);
    },
  },

  notes: {
    load: () => ipcRenderer.invoke("notes:load"),
    save: (text) => ipcRenderer.send("notes:save", text),
  },

  temp: {
    save: (name, bytes) => ipcRenderer.invoke("temp:save", name, bytes),
    clear: () => ipcRenderer.invoke("temp:clear"),
    startDrag: (filePath) => ipcRenderer.send("temp:start-drag", filePath),
    // Path asli file/folder di disk (butuh Electron 29+).
    // Kalau webUtils tidak ada, komponen otomatis memakai save().
    getPath: webUtils ? (file) => webUtils.getPathForFile(file) : undefined,
    addPath: (srcPath) => ipcRenderer.invoke("temp:add-path", srcPath),
    remove: (filePath) => ipcRenderer.invoke("temp:remove", filePath),
  },
  apps: {
    list: () => ipcRenderer.invoke("apps:list"),
    icon: (id) => ipcRenderer.invoke("apps:icon", id),
    launch: (id) => ipcRenderer.invoke("apps:launch", id),
  },
  notifs: {
    get: () => ipcRenderer.invoke("notifs:get"),
    command: (cmd) => ipcRenderer.send("notifs:command", cmd),
    onUpdate: (cb) => {
      const handler = (_e, data) => cb(data);
      ipcRenderer.on("notifs:update", handler);
      return () => ipcRenderer.removeListener("notifs:update", handler);
    },
  },
  todos: {
    load: () => ipcRenderer.invoke("todos:load"),
    save: (text) => ipcRenderer.send("todos:save", text),
  },
  convert: {
    probe: (paths) => ipcRenderer.invoke("convert:probe", paths),
    run: (job) => ipcRenderer.invoke("convert:run", job),
    pick: () => ipcRenderer.invoke("convert:pick"),
    reveal: (p) => ipcRenderer.invoke("convert:reveal", p),
    openFolder: () => ipcRenderer.invoke("convert:open-folder"),
    startDrag: (p) => ipcRenderer.send("convert:start-drag", p),
    onProgress: (cb) => {
      const handler = (_e, data) => cb(data);
      ipcRenderer.on("convert:progress", handler);
      return () => ipcRenderer.removeListener("convert:progress", handler);
    },
  },
});
