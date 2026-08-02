const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const path = require("path");
const https = require("https");
const http = require("http");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");
const { exec } = require("child_process");

let win;

const settingsFile = path.join(process.env.APPDATA || process.env.HOME, "weather-settings.json");
let settings = { chatId: "", city: "Тюмень", botToken: "" };
try { settings = JSON.parse(fs.readFileSync(settingsFile, "utf8")); } catch(e) {}

// Telegram Bot
let botOffset = 0;
let botRunning = false;

function botApi(method, body) {
  if (!settings.botToken) return Promise.resolve(null);
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${settings.botToken}/${method}`,
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json", "Content-Length": data ? Buffer.byteLength(data) : 0 },
      timeout: 15000
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
    if (data) req.write(data);
    req.end();
  });
}

function botFetch(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 10000 }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
    }).on("error", () => resolve(null));
  });
}

const weatherCodes = {0:"Ясно",1:"Малооблачно",2:"Малооблачно",3:"Пасмурно",45:"Туман",48:"Туман",51:"Морось",53:"Морось",55:"Сильная морось",61:"Дождь",63:"Дождь",65:"Сильный дождь",71:"Снег",73:"Снег",75:"Сильный снег",80:"Ливень",81:"Дождь",82:"Сильный ливень",95:"Гроза",96:"Гроза",99:"Сильная гроза"};

async function getWeatherText(city) {
  const geo = await botFetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru`);
  if (!geo || !geo.results || !geo.results.length) return null;
  const { latitude: lat, longitude: lon, name } = geo.results[0];
  const w = await botFetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1`);
  if (!w) return null;
  const c = w.current;
  const desc = weatherCodes[c.weather_code] || "Неизвестно";
  return `Nimboza — Погода\n\n${name}\nТемпература: ${Math.round(c.temperature_2m)}°C (ощущается ${Math.round(c.apparent_temperature)}°C)\nДиапазон: ${Math.round(w.daily.temperature_2m_min[0])}°C — ${Math.round(w.daily.temperature_2m_max[0])}°C\nВлажность: ${c.relative_humidity_2m}%\nВетер: ${Math.round(c.wind_speed_10m)} км/ч\nДождь: ${w.daily.precipitation_probability_max[0]}%\n\n${desc}`;
}

async function handleBotMessage(msg) {
  if (!msg || !msg.text) return;
  const text = msg.text.trim().toLowerCase();
  const chatId = msg.chat.id;
  if (text === "погода" || text === "/погода" || text === "/weather") {
    const weather = await getWeatherText(settings.city || "Тюмень");
    if (weather) await botApi("sendMessage", { chat_id: chatId, text: weather });
  } else if (text.startsWith("погода ")) {
    const city = msg.text.trim().slice(7).trim();
    const weather = await getWeatherText(city);
    if (weather) await botApi("sendMessage", { chat_id: chatId, text: weather });
    else await botApi("sendMessage", { chat_id: chatId, text: `Город "${city}" не найден` });
  } else if (text === "/start" || text === "/help") {
    await botApi("sendMessage", { chat_id: chatId, text: "Nimboza Bot\n\nКоманды:\n• погода — погода в вашем городе\n• погода Москва — погода в другом городе" });
  }
}

async function pollBot() {
  if (!settings.botToken || !botRunning) return;
  try {
    const res = await botApi("getUpdates", { offset: botOffset, timeout: 30 });
    if (res && res.ok && res.result.length) {
      for (const update of res.result) {
        botOffset = update.update_id + 1;
        await handleBotMessage(update.message);
      }
    }
  } catch(e) {}
  if (botRunning) setTimeout(pollBot, 100);
}

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

// --- IPC: Check & Download Update ---
function githubGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod.get(url, { headers: { "User-Agent": "Nimboza" }, timeout: 15000 }, (res) => {
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
    const mod = url.startsWith("https") ? https : http;
    const follow = (u) => {
      mod.get(u, { headers: { "User-Agent": "Nimboza" }, timeout: 30000 }, (res) => {
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
  app.quit();
  return { status: "installing" };
});

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  botRunning = true;
  pollBot();
});

app.on("window-all-closed", () => { botRunning = false; app.quit(); });
