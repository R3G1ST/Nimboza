const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const https = require("https");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

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

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.checkForUpdatesAndNotify().catch(() => {});

  autoUpdater.on("update-available", (info) => {
    dialog.showMessageBox(win, {
      type: "info",
      title: "Доступно обновление",
      message: `Доступна новая версия: ${info.version}`,
      buttons: ["Обновить", "Позже"],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on("update-downloaded", () => {
    dialog.showMessageBox(win, {
      type: "info",
      title: "Обновление загружено",
      message: "Обновление загружено. Приложение будет перезапущено.",
      buttons: ["Перезапустить"],
    }).then(() => {
      autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on("error", () => {});
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  botRunning = true;
  pollBot();
});

app.on("window-all-closed", () => { botRunning = false; app.quit(); });
