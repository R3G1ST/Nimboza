const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const https = require("https");
const fs = require("fs");

let win;

const settingsFile = path.join(process.env.APPDATA || process.env.HOME, "weather-settings.json");
let settings = { city: "Тюмень" };
try { settings = JSON.parse(fs.readFileSync(settingsFile, "utf8")); } catch(e) {}

function createWindow() {
  win = new BrowserWindow({
    width: 500,
    height: 700,
    title: "Nimboza",
    resizable: false,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      scrollBounce: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile("index.html");
  win.webContents.on("did-finish-load", () => {
    win.webContents.setZoomFactor(1);
  });
}

const CURRENT_VERSION = app.getVersion();

ipcMain.handle("get-version", () => CURRENT_VERSION);

// --- IPC: Check & Download Update ---
function githubGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Nimboza" }, timeout: 15000 }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        return githubGet(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve({ status: res.statusCode, data }));
    }).on("error", reject);
  });
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, { headers: { "User-Agent": "Nimboza" }, timeout: 30000 }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          return follow(res.headers.location);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const total = parseInt(res.headers["content-length"] || "0", 10);
        let downloaded = 0;
        const file = fs.createWriteStream(dest);
        res.on("data", (chunk) => {
          downloaded += chunk.length;
          file.write(chunk);
          if (onProgress && total) onProgress(downloaded, total);
        });
        res.on("end", () => { file.end(); resolve(); });
        res.on("error", reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

ipcMain.handle("check-update", async () => {
  try {
    const res = await githubGet("https://api.github.com/repos/R3G1ST/nimboza/releases/latest");
    const release = JSON.parse(res.data);
    const latest = release.tag_name.replace("v", "");
    if (latest !== CURRENT_VERSION) {
      const asset = (release.assets || []).find(a => a.name.endsWith(".exe"));
      if (!asset) return { status: "no_asset", version: latest };
      return { status: "available", version: latest, url: asset.browser_download_url, name: asset.name, size: asset.size };
    }
    return { status: "up_to_date", version: CURRENT_VERSION };
  } catch(e) {
    return { status: "error", message: e.message };
  }
});

ipcMain.handle("download-update", async (event, url) => {
  const dest = path.join(app.getPath("temp"), "Nimboza-Update.exe");
  try {
    await downloadFile(url, dest, (downloaded, total) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send("update-progress", { downloaded, total });
      }
    });
    return { status: "done", path: dest };
  } catch(e) {
    return { status: "error", message: e.message };
  }
});

ipcMain.handle("install-update", async (event, installerPath) => {
  const confirmed = await dialog.showMessageBox(win, {
    type: "question",
    title: "Установить обновление",
    message: "Обновление загружено. Установить сейчас?\nПриложение будет закрыто.",
    buttons: ["Установить", "Отмена"],
    defaultId: 0,
  });
  if (confirmed.response !== 0) return { status: "cancelled" };
  const { spawn } = require("child_process");
  const child = spawn(installerPath, [], { detached: true, stdio: "ignore" });
  child.unref();
  setTimeout(() => app.quit(), 1000);
  return { status: "installing" };
});

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => { app.quit(); });
