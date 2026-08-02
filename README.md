# Nimboza

Прогноз погоды с точностью до вашего района. Десктопное приложение + Mini App для Telegram.

![Version](https://img.shields.io/badge/Version-1.5.0-667eea?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Windows-0078d4?style=flat-square)
![Electron](https://img.shields.io/badge/Electron-43-47848f?style=flat-square)

## Возможности

### Погода
- Анимированные фоны: дождь, снег, облака, солнце, гроза, звёзды, луна
- Темы по времени суток: night, dawn, day, dusk
- Прогноз на 7 дней с графиком температур
- Почасовой прогноз на 24 часа
- График температуры (SVG-кривая как Apple Weather)
- Осадки по часам (бар-чарт)

### Детали
- Ощущается как, Влажность, Давление
- Ветер с компасом направления
- UV индекс, Видимость, Точка росы
- Восход/Закат с анимированной дугой
- Фаза луны, Качество воздуха (AQI)

### Функции
- Геолокация через WiFi triangulation
- Избранные города с синхронизацией
- Telegram OAuth
- Синхронизация PC <-> Mini App (30 сек)
- Автообновление из приложения
- Поделиться погодой (копирование карточки)
- Отправка в Telegram через бота

## Установка

1. Скачайте Nimboza Setup 1.5.0.exe из [Releases](https://github.com/R3G1ST/nimboza/releases)
2. Запустите установщик
3. Разрешите геолокацию или введите город

## Запуск из исходников

`ash
git clone https://github.com/R3G1ST/nimboza.git
cd nimboza
npm install
npm start
`

## Telegram Mini App

[@Controlbot3x_bot](https://t.me/Controlbot3x_bot) | [nimboza.qmbox.ru](https://nimboza.qmbox.ru)

## Технологии

Electron 43, Open-Meteo API, HTML5 Geolocation, Node.js, Telegram Bot API

## Лицензия

MIT License