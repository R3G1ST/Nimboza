const https = require('https');

const BOT_TOKEN = '8927798773:AAFQVfuXZDfChzYj98qOUIcmMwj-tx7vZQk';
const MINI_APP_URL = 'https://nimboza.qmbox.ru';

let offset = 0;

function api(method, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data ? Buffer.byteLength(data) : 0 },
      timeout: 15000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    if (data) req.write(data);
    req.end();
  });
}

function fetch(url) {
  return new Promise((resolve) => {
    https.get(url, { timeout: 10000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

const codes = {0:"Ясно",1:"Малооблачно",2:"Малооблачно",3:"Пасмурно",45:"Туман",48:"Туман",51:"Морось",53:"Морось",55:"Сильная морось",61:"Дождь",63:"Дождь",65:"Сильный дождь",71:"Снег",73:"Снег",75:"Сильный снег",80:"Ливень",81:"Дождь",82:"Сильный ливень",95:"Гроза",96:"Гроза",99:"Сильная гроза"};
const monthNames = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const dayNames = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];

async function geoCity(city) {
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru`);
  if (!geo || !geo.results || !geo.results.length) return null;
  return geo.results[0];
}

function fmtDay(d) {
  const date = new Date(d);
  return `${dayNames[date.getDay()]} ${date.getDate()} ${monthNames[date.getMonth()]}`;
}

const miniAppKeyboard = {
  keyboard: [[{ text: '🌤️ Открыть погоду', web_app: { url: MINI_APP_URL } }]],
  resize_keyboard: true,
  one_time_keyboard: false
};

const miniAppButton = {
  reply_markup: miniAppKeyboard
};

async function currentWeather(city) {
  const g = await geoCity(city);
  if (!g) return null;
  const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`);
  if (!w || !w.current) return null;
  const c = w.current;
  const now = new Date();
  return `Nimboza — Погода сейчас\n\n${g.name}\n${now.getDate()} ${monthNames[now.getMonth()]}\n\nТемпература: ${Math.round(c.temperature_2m)}°C\nОщущается: ${Math.round(c.apparent_temperature)}°C\nВлажность: ${c.relative_humidity_2m}%\nВетер: ${Math.round(c.wind_speed_10m)} км/ч\n${codes[c.weather_code] || ""}`;
}

async function tomorrowWeather(city) {
  const g = await geoCity(city);
  if (!g) return null;
  const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=2`);
  if (!w || !w.daily) return null;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  return `Погода завтра — ${g.name}\n\n${tomorrow.getDate()} ${monthNames[tomorrow.getMonth()]}\nМакс: ${Math.round(w.daily.temperature_2m_max[1])}°C · Мин: ${Math.round(w.daily.temperature_2m_min[1])}°C\nДождь: ${w.daily.precipitation_probability_max[1]}%\n${codes[w.daily.weather_code[1]] || ""}`;
}

async function yesterdayWeather(city) {
  const g = await geoCity(city);
  if (!g) return null;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];
  const w = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${g.latitude}&longitude=${g.longitude}&start_date=${dateStr}&end_date=${dateStr}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
  if (!w || !w.daily || !w.daily.time[0]) return null;
  return `Погода вчера — ${g.name}\n\n${fmtDay(dateStr)}\nМакс: ${Math.round(w.daily.temperature_2m_max[0])}°C · Мин: ${Math.round(w.daily.temperature_2m_min[0])}°C\nОсадки: ${Math.round(w.daily.precipitation_sum[0] * 10) / 10} мм\n${codes[w.daily.weather_code[0]] || ""}`;
}

async function weekWeather(city) {
  const g = await geoCity(city);
  if (!g) return null;
  const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`);
  if (!w || !w.daily) return null;
  let text = `Погода на неделю — ${g.name}\n\n`;
  for (let i = 0; i < 7; i++) {
    const date = new Date(w.daily.time[i]);
    const dayLabel = i === 0 ? "Сегодня" : i === 1 ? "Завтра" : `${dayNames[date.getDay()]} ${date.getDate()}`;
    text += `${dayLabel}: ${codes[w.daily.weather_code[i]] || "?"} ${Math.round(w.daily.temperature_2m_min[i])}°..${Math.round(w.daily.temperature_2m_max[i])}° 💧${w.daily.precipitation_probability_max[i]}%\n`;
  }
  return text;
}

async function monthWeather(city) {
  const g = await geoCity(city);
  if (!g) return null;
  const w = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`);
  if (!w || !w.daily) return null;
  let text = `Прогноз на 16 дней — ${g.name}\n\n`;
  for (let i = 0; i < w.daily.time.length; i++) {
    const date = new Date(w.daily.time[i]);
    const dayLabel = i === 0 ? "Сегодня" : `${date.getDate()} ${monthNames[date.getMonth()]}`;
    text += `${dayLabel}: ${codes[w.daily.weather_code[i]] || "?"} ${Math.round(w.daily.temperature_2m_min[i])}°..${Math.round(w.daily.temperature_2m_max[i])}° 💧${w.daily.precipitation_probability_max[i]}%\n`;
  }
  return text;
}

function sendWeatherWithButton(chatId, text, isInline) {
  const payload = {
    chat_id: chatId,
    text: text,
    reply_markup: miniAppButton
  };
  if (isInline) {
    payload.parse_mode = undefined;
  }
  return api('sendMessage', payload);
}

async function handleUpdate(update) {
  if (update.callback_query) {
    const cq = update.callback_query;
    if (cq.data === 'open_miniapp') {
      await api('answerCallbackQuery', { callback_query_id: cq.id });
    }
    return;
  }

  if (!update.message) return;
  const msg = update.message;
  const text = (msg.text || '').trim().toLowerCase();
  const chatId = msg.chat.id;

  if (text === 'погода' || text === '/погода' || text === '/weather') {
    const w = await currentWeather('Тюмень');
    if (w) await sendWeatherWithButton(chatId, w);
    return;
  }

  if (text === 'погода завтра' || text === '/завтра') {
    const w = await tomorrowWeather('Тюмень');
    if (w) await sendWeatherWithButton(chatId, w);
    return;
  }

  if (text === 'погода вчера' || text === '/вчера') {
    const w = await yesterdayWeather('Тюмень');
    if (w) await sendWeatherWithButton(chatId, w);
    return;
  }

  if (text === 'погода на неделю' || text === '/неделя') {
    const w = await weekWeather('Тюмень');
    if (w) await sendWeatherWithButton(chatId, w);
    return;
  }

  if (text === 'погода на месяц' || text === '/месяц') {
    const w = await monthWeather('Тюмень');
    if (w) await sendWeatherWithButton(chatId, w);
    return;
  }

  const cityMatch = text.match(/^погода\s+(?:завтра|вчера|на\s+недел[юя]|на\s+месяц)?\s*(.+)$/);
  if (cityMatch) {
    const city = cityMatch[1].trim();
    if (!city) {
      const w = await currentWeather('Тюмень');
      if (w) await sendWeatherWithButton(chatId, w);
      return;
    }
    let w;
    if (text.includes('завтра')) w = await tomorrowWeather(city);
    else if (text.includes('вчера')) w = await yesterdayWeather(city);
    else if (text.includes('недел')) w = await weekWeather(city);
    else if (text.includes('месяц')) w = await monthWeather(city);
    else w = await currentWeather(city);
    if (w) await sendWeatherWithButton(chatId, w);
    else await api('sendMessage', { chat_id: chatId, text: `Город "${city}" не найден` });
    return;
  }

  if (text === '/start' || text === '/help') {
    await api('sendMessage', {
      chat_id: chatId,
      text: "Nimboza Bot\n\nКоманды:\n• погода — сейчас\n• погода завтра\n• погода вчера\n• погода на неделю\n• погода на месяц\n• погода Москва — другой город",
      reply_markup: miniAppButton
    });
  }
}

async function poll() {
  try {
    const res = await api('getUpdates', { offset, timeout: 30 });
    if (res && res.ok && res.result.length) {
      for (const update of res.result) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    }
  } catch(e) {}
  setTimeout(poll, 100);
}

console.log('Nimboza Bot started!');
poll();
