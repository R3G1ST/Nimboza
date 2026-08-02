# Nimboza

Прогноз погоды с точностью до вашего района. Десктопное приложение + Mini App для Telegram.

![Nimboza](https://img.shields.io/badge/Version-1.5.0-667eea?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Windows-0078d4?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-43-47848f?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## Возможности

### Погода
- Текущая погода с анимированным фоном (дождь, снег, облака, солнце, гроза, звёзды, луна)
- **Темы по времени суток:** night, dawn, day, dusk
- Прогноз на 7 дней с графиком температур
- Почасовой прогноз на 24 часа
- **График температуры** — SVG-кривая как в Apple Weather
- **Осадки по часам** — интерактивный бар-чарт

### Детали
- 🌡️ Ощущается как
- 💧 Влажность
- 🔵 Давление
- 💨 Ветер с компасом направления
- ☀️ UV индекс
- 👁️ Видимость
- 💦 Точка росы
- 🌅 Восход/Закат с анимированной дугой
- 🌙 Фаза луны
- 🌬️ Качество воздуха (AQI)

### Функции
- **Геолокация** — автоопределение города через WiFi triangulation
- **Избранные города** — сохраняются и синхронизируются
- **Telegram OAuth** — привязка аккаунта в один клик
- **Синхронизация** — PC ↔ Mini App в реальном времени (30 сек)
- **Автообновление** — проверка и установка обновлений из приложения
- **Поделиться погодой** — копирование красивой карточки
- **Отправка в Telegram** — через серверного бота

### Mini App
- Telegram Mini App: [@Controlbot3x_bot](https://t.me/Controlbot3x_bot)
- Доступен по адресу: [nimboza.qmbox.ru](https://nimboza.qmbox.ru)
- Полный функционал десктопного приложения

## Установка

1. Скачайте Nimboza Setup 1.5.0.exe из [Releases](https://github.com/R3G1ST/nimboza/releases)
2. Запустите установщик
3. При первом запуске разрешите геолокацию или введите город вручную

## Запуск из исходников

`ash
git clone https://github.com/R3G1ST/nimboza.git
cd nimboza
npm install
npm start
`

## Технологии

- **Electron 43** — десктопное приложение
- **Open-Meteo API** — бесплатный API погоды (без ключа)
- **HTML5 Geolocation** — определение местоположения
- **Node.js** — серверная часть
- **Telegram Bot API** — уведомления и Mini App

## Структура проекта

`
nimboza/
├── main.js           # Electron main process
├── index.html        # UI десктопного приложения
├── miniapp/
│   └── index.html    # Telegram Mini App
├── package.json
└── icon.png
`

## Лицензия

MIT License