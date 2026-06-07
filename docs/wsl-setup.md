# Запуск FreeDeepseekAPI в WSL

> Руководство по запуску FreeDeepseekAPI в Windows Subsystem for Linux (WSL2)

## Предварительные требования

- WSL2 с включённым WSLg (Windows 11 или Windows 10 с поддержкой GUI)
- Node.js 18+ (проверка: `node --version`)
- Аккаунт на chat.deepseek.com

## Проверка WSLg

```bash
echo $DISPLAY        # должно быть :0
echo $WAYLAND_DISPLAY # должно быть wayland-0
ls /tmp/.X11-unix/   # должен быть X0
```

Если переменные пустые — WSLg не включён. Обновите WSL: `wsl --update` из PowerShell.

---

## Вариант 1 — Chromium/Chrome в WSL через WSLg

Устанавливаем браузер прямо в WSL. Он откроется через WSLg (всплывёт окно на рабочем столе Windows).

### Установка Chromium

```bash
sudo apt update
sudo apt install -y chromium-browser
```

Если `chromium-browser` недоступен (snap-проблема в Ubuntu WSL):

```bash
sudo apt install -y chromium
```

### Установка Google Chrome в WSL

```bash
# Скачиваем .deb
wget -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb

# Устанавливаем
sudo apt install -y /tmp/google-chrome.deb

# Если не хватает зависимостей:
sudo apt --fix-broken install -y
```

### Запуск авторизации

```bash
git clone https://github.com/alexey-polischuk/FreeDeepseekAPI.git
cd FreeDeepseekAPI

# Chromium
CHROME_PATH=/usr/bin/chromium-browser npm run auth

# или Google Chrome
CHROME_PATH=/usr/bin/google-chrome npm run auth

# или если Chrome не находится автоматически
CHROME_PATH=/usr/bin/google-chrome-stable npm run auth
```

Откроется окно Chrome в WSLg. Залогиньтесь на chat.deepseek.com, отправьте "ok", нажмите Enter в терминале.

### Запуск сервера

```bash
npm start
# Выбрать пункт 3 (Start proxy)
# Сервер будет на http://localhost:9655
```

---

## Вариант 2 — Chrome for Testing через Puppeteer

Скрипт `deepseek_chrome_auth.js` умеет автоматически скачать "Chrome for Testing" через Puppeteer — отдельный автономный браузер, который не зависит от системного Chrome.

### Установка Puppeteer

```bash
cd FreeDeepseekAPI
npm install puppeteer
```

Puppeteer автоматически скачает Chrome for Testing в `~/.cache/puppeteer/chrome/`.

### Запуск авторизации

```bash
npm run auth
# или
node scripts/deepseek_chrome_auth.js
```

Скрипт автоматически найдёт Puppeteer-овский Chrome и откроет его через WSLg.

### Запуск сервера

```bash
npm start
```

### Плюсы и минусы

| Плюс | Минус |
|------|-------|
| Автоматическая загрузка браузера | ~300 МБ скачивание |
| Не зависит от системного Chrome | Нужен npm install puppeteer |
| Изолированный профиль | Требует WSLg для окна авторизации |

---

## Вариант 3 — Ручная авторизация без браузера в WSL

Если WSLg не работает или вы не хотите запускать браузер в WSL — можно авторизоваться вручную: вытащить токен и куки из браузера Windows и записать в `deepseek-auth.json`. После этого сервер работает полностью headless.

### Шаг 1 — Получить данные авторизации

**Способ A: Через DevTools в Windows Chrome**

1. Откройте Chrome в Windows и залогиньтесь на https://chat.deepseek.com
2. Нажмите F12 -> Console
3. Выполните:
```javascript
// Токен
const token = localStorage.getItem('userToken') || localStorage.getItem('token') || '';

// Куки
const cookie = document.cookie;

// Отправьте тестовое сообщение в DeepSeek, затем:
const result = {token, cookie, baseUrl: 'https://chat.deepseek.com'};
console.log(JSON.stringify(result, null, 2));
```
4. Скопируйте результат

**Способ B: Через Chrome Extension из репо**

В папке `chrome-extension/` есть расширение для Chrome, которое автоматически извлекает данные авторизации.

1. Откройте `chrome://extensions/` в Windows Chrome
2. Включите "Режим разработчика"
3. Нажмите "Загрузить распакованное расширение" -> выберите папку `chrome-extension`
4. Залогиньтесь на chat.deepseek.com
5. Нажмите на иконку расширения — оно покажет/скопирует auth-данные

### Шаг 2 — Создать deepseek-auth.json

```bash
cd FreeDeepseekAPI

cat > deepseek-auth.json << 'EOF'
{
  "token": "ВАШ_ТОКЕН_СЮДА",
  "cookie": "ВАШИ_КУКИ_СЮДА",
  "hif_dliq": "",
  "hif_leim": "",
  "wasmUrl": "https://fe-static.deepseek.com/chat/static/sha3_wasm_bg.7b9ca65ddd.wasm",
  "baseUrl": "https://chat.deepseek.com"
}
EOF
```

### Шаг 3 — Запуск сервера (headless, без браузера)

```bash
NON_INTERACTIVE=1 npm start
# или
SKIP_ACCOUNT_MENU=1 npm start
```

Сервер запустится на http://localhost:9655 без открытия браузера.

### Плюсы и минусы

| Плюс | Минус |
|------|-------|
| Не нужен WSLg | Нужно обновлять токен вручную при истечении |
| Полностью headless | Нет автообновления сессии |
| Минимум зависимостей | Куки могут истечь |

---

## Проверка работоспособности

После запуска сервера любым из вариантов:

```bash
# Проверка здоровья
curl http://localhost:9655/health

# Список моделей
curl http://localhost:9655/v1/models

# Тестовый запрос
curl -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "Привет! Ответь одной фразой."}], "stream": false}'
```

---

## Автозапуск при старте WSL (опционально)

### Через cron

```bash
# Установить cron если нет
sudo apt install -y cron

# Добавить задачу
(crontab -l 2>/dev/null; echo "@reboot cd $HOME/FreeDeepseekAPI && NON_INTERACTIVE=1 npm start &") | crontab -

# Включить cron
sudo service cron start
```

### Через systemd (если включён)

Создайте файл `/etc/systemd/system/freedeepseek.service`:

```ini
[Unit]
Description=FreeDeepseekAPI Proxy
After=network.target

[Service]
Type=simple
User=alexeypolischuk
WorkingDirectory=/home/alexeypolischuk/FreeDeepseekAPI
ExecStart=/usr/bin/node server.js
Environment=NON_INTERACTIVE=1
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable freedeepseek
sudo systemctl start freedeepseek
```

### Через .bashrc / .profile

```bash
echo 'cd ~/FreeDeepseekAPI && NON_INTERACTIVE=1 node server.js &' >> ~/.bashrc
```

---

## Решение проблем

### WSLg не работает (нет DISPLAY)

```bash
# В PowerShell (Windows):
wsl --update
wsl --shutdown
# Перезапустить WSL
```

### Chrome не запускается в WSL

```bash
# Проверьте зависимости:
ldd /usr/bin/google-chrome | grep "not found"

# Установите недостающие:
sudo apt --fix-broken install
sudo apt install -y libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 libxshmfence1
```

### Токен истёк

Повторите авторизацию (Вариант 1 или 2) или обновите `deepseek-auth.json` вручную (Вариант 3).

### Порт 9655 занят

```bash
# Установить другой порт:
PORT=8765 npm start
```
