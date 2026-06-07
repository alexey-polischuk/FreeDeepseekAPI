# FreeDeepseekAPI — WSL Edition

<p align="center">
  <strong>Локальный OpenAI-compatible API proxy для DeepSeek Web Chat</strong><br>
  <strong>Версия для WSL2 (Windows Subsystem for Linux)</strong>
</p>

<p align="center">
  <a href="https://github.com/alexey-polischuk/FreeDeepseekAPI/blob/main/LICENSE"><img alt="License MIT" src="https://img.shields.io/badge/license-MIT-green.svg" /></a>
  <img alt="Node.js 18 plus" src="https://img.shields.io/badge/node-18%2B-339933.svg" />
  <img alt="No npm dependencies" src="https://img.shields.io/badge/dependencies-0-blue.svg" />
  <img alt="OpenAI compatible" src="https://img.shields.io/badge/OpenAI-compatible-111111.svg" />
  <img alt="WSL2" src="https://img.shields.io/badge/platform-WSL2-4A90D9.svg" />
</p>

<p align="center">
  <a href="#-быстрый-старт">Быстрый старт</a> •
  <a href="#-варианты-авторизации">Авторизация</a> •
  <a href="#-примеры-запросов">Примеры</a> •
  <a href="#-модели">Модели</a> •
  <a href="#-endpoints">Endpoints</a> •
  <a href="#-интеграции">Интеграции</a>
</p>

FreeDeepseekAPI поднимает локальный API-сервер для **DeepSeek Web Chat** (`chat.deepseek.com`) и позволяет подключать DeepSeek Web к Open WebUI, LiteLLM, Hermes, Claude Code, OpenAI SDK и другим OpenAI-compatible клиентам — всё это работает в WSL2 на Windows.

Проект работает через ваш обычный залогиненный аккаунт DeepSeek в отдельном Chrome-профиле. Локальный сервер принимает API-запросы и сам ходит в DeepSeek Web через сохранённую browser-сессию.

> Это форк [ForgetMeAI/FreeDeepseekAPI](https://github.com/ForgetMeAI/FreeDeepseekAPI), адаптированный для работы в WSL2. Убраны macOS-специфичные пути, добавлена поддержка WSLg/Snap Chromium.

> Внимание: Это экспериментальный web-chat proxy. DeepSeek может менять внутренний Web API без предупреждения. Для production-кейсов надёжнее официальный платный API DeepSeek.

---

## Навигация

- [Что это даёт](#-что-это-даёт)
- [Возможности](#-возможности)
- [Быстрый старт](#-быстрый-старт)
- [Варианты авторизации](#-варианты-авторизации)
- [Проверка работы](#-проверка-работы)
- [Примеры запросов](#-примеры-запросов)
- [Модели](#-модели)
- [Endpoints](#-endpoints)
- [Интеграции](#-интеграции)
- [Обновить логин](#-обновить-логин)
- [Статус проекта](#-статус-проекта)

---

## Что это даёт

- Использовать DeepSeek Web как локальный API endpoint в WSL2
- Подключать DeepSeek к Open WebUI и другим OpenAI-compatible клиентам
- Получать обычные JSON-ответы или streaming SSE
- Использовать reasoning-модели с отдельным `reasoning_content`
- Работать с Anthropic Messages API shim для Claude Code
- Использовать OpenAI Responses API shim
- Держать отдельные web-сессии для разных агентов/users

## Возможности

- **OpenAI-compatible API:** `POST /v1/chat/completions`
- **Anthropic-compatible shim:** `POST /v1/messages`
- **OpenAI Responses shim:** `POST /v1/responses`
- **Streaming:** SSE chunks и обычные non-stream JSON-ответы
- **Reasoning output:** отдельный `reasoning_content` для thinking-моделей
- **Tool calling:** парсинг OpenAI tools, Anthropic tools и Responses function tools
- **Model capabilities:** `GET /v1/model-capabilities` с alias -> real web mode
- **Agent sessions:** отдельная DeepSeek-сессия на `user` / agent id
- **Session recovery:** авто-сброс устаревших chains/sessions
- **Zero dependencies:** Node.js 18+, без npm-зависимостей
- **WSL-optimized:** поиск Chromium/Chrome по WSL/Linux путям

---

## Быстрый старт

### Предварительные требования

- WSL2 с включённым WSLg (Windows 11 или Windows 10 с поддержкой GUI)
- Node.js 18+
- Chromium или Google Chrome в WSL
- Аккаунт на chat.deepseek.com

### Проверка WSLg

```bash
echo $DISPLAY        # должно быть :0
echo $WAYLAND_DISPLAY # должно быть wayland-0
```

Если переменные пустые — WSLg не включён. Обновите WSL: `wsl --update` из PowerShell.

### Установка

```bash
git clone https://github.com/alexey-polischuk/FreeDeepseekAPI.git
cd FreeDeepseekAPI
```

### Установка браузера (если нет)

```bash
# Chromium через snap (самый простой вариант в Ubuntu WSL)
sudo snap install chromium

# Или Google Chrome
wget -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y /tmp/google-chrome.deb
```

### Авторизация и запуск

```bash
# Шаг 1 — Авторизация (интерактивная, откроет окно браузера через WSLg)
npm run auth

# Шаг 2 — Запуск сервера
NON_INTERACTIVE=1 npm start

# Сервер на http://localhost:9655
```

---

## Варианты авторизации

### Вариант 1 — Chromium/Chrome в WSL через WSLg (рекомендуется)

```bash
# Chromium
CHROME_PATH=/snap/bin/chromium npm run auth

# Google Chrome
CHROME_PATH=/usr/bin/google-chrome-stable npm run auth
```

Откроется окно браузера через WSLg. Залогиньтесь на chat.deepseek.com, отправьте "ok", нажмите Enter в терминале.

### Вариант 2 — Chrome for Testing через Puppeteer

```bash
npm install puppeteer   # скачает Chrome for Testing (~300 МБ)
npm run auth
```

### Вариант 3 — Ручная авторизация без браузера в WSL

Вытащить токен и куки из Windows Chrome и записать в `deepseek-auth.json`. Сервер после этого работает полностью headless.

Подробности — в [docs/wsl-setup.md](docs/wsl-setup.md).

---

## Проверка работы

```bash
curl http://localhost:9655/
curl http://localhost:9655/v1/models
curl http://localhost:9655/v1/model-capabilities
```

---

## Примеры запросов

### Chat Completions

```bash
curl -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Привет! Ответь одной фразой."}],
    "stream": false
  }'
```

### Reasoning

```bash
curl -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-reasoner",
    "messages": [{"role": "user", "content": "Реши коротко: почему небо голубое?"}],
    "stream": false
  }'
```

Для reasoning-моделей API отдаёт цепочку размышления отдельно от финального ответа:

- non-stream: `choices[0].message.reasoning_content`
- stream: `choices[0].delta.reasoning_content`
- usage: `usage.completion_tokens_details.reasoning_tokens`

### Web search

```bash
curl -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat-search",
    "messages": [{"role": "user", "content": "Найди свежий факт про DeepSeek."}],
    "stream": false
  }'
```

### Streaming

```bash
curl -N -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Напиши короткую шутку."}],
    "stream": true
  }'
```

### Anthropic Messages API (Claude Code)

```bash
curl -X POST http://localhost:9655/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "max_tokens": 512,
    "messages": [{"role": "user", "content": "Ответь ровно OK"}],
    "stream": false
  }'
```

### OpenAI Responses API

```bash
curl -X POST http://localhost:9655/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "input": "Ответь ровно OK",
    "stream": false
  }'
```

---

## Модели

`GET /v1/models` возвращает проверенные aliases.

| Alias | Web mode | Reasoning | Web search | Комментарий |
|-------|----------|-----------|------------|-------------|
| `deepseek-chat` | Быстрый / default | нет | нет | базовый chat |
| `deepseek-v3` | Быстрый / default | нет | нет | совместимый alias |
| `deepseek-default` | Быстрый / default | нет | нет | совместимый alias |
| `deepseek-reasoner` | Быстрый / default | да | нет | thinking_enabled=true |
| `deepseek-r1` | Быстрый / default | да | нет | R1-compatible alias |
| `deepseek-chat-search` | Быстрый / default | нет | да | web search |
| `deepseek-default-search` | Быстрый / default | нет | да | web search alias |
| `deepseek-reasoner-search` | Быстрый / default | да | да | reasoning + search |
| `deepseek-r1-search` | Быстрый / default | да | да | R1-compatible + search |
| `deepseek-expert` | Эксперт / expert | нет | нет | Expert mode |
| `deepseek-v4-pro` | Эксперт / expert | да | нет | Expert + reasoning |

Полный маппинг:
```bash
curl http://localhost:9655/v1/model-capabilities
```

---

## Endpoints

| Method | Path | Назначение |
|--------|------|------------|
| `GET` | `/` или `/health` | статус proxy |
| `GET` | `/v1/models` | список рабочих OpenAI-compatible aliases |
| `GET` | `/v1/model-capabilities` | полный маппинг aliases, real model, capabilities |
| `POST` | `/v1/chat/completions` | OpenAI-compatible Chat Completions |
| `POST` | `/v1/messages` | Anthropic Messages API shim |
| `POST` | `/v1/responses` | OpenAI Responses API shim |
| `GET` | `/v1/sessions` | активные локальные agent sessions |
| `POST` | `/reset-session?agent=<id>` | сбросить одну session |
| `POST` | `/reset-session?agent=all` | сбросить все sessions |

---

## Интеграции

### Open WebUI

Base URL для Open WebUI в Docker:
```
http://host.docker.internal:9655/v1
```

Локальный запуск без Docker:
```
http://localhost:9655/v1
```

API key можно указать любой.

### Claude Code

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:9655"
export ANTHROPIC_AUTH_TOKEN=*** CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1
claude --model deepseek-chat
```

### Hermes Agent

```yaml
model:
  default: deepseek-chat
  provider: custom
  base_url: http://127.0.0.1:9655/v1
```

### OpenAI SDK (Python)

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:9655/v1", api_key="unused")
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "Привет!"}]
)
```

---

## Обновить логин

```bash
npm run auth
NON_INTERACTIVE=1 npm start
```

Если DeepSeek начал отвечать 401, 403 — повторите авторизацию.

---

## Тесты

```bash
# Синтаксическая проверка
npm test

# Live smoke-тесты (сервер должен быть запущен)
BASE_URL=http://127.0.0.1:9655 MODEL=deepseek-chat npm run test:live
```

---

## Статус проекта

FreeDeepseekAPI — экспериментальный web-chat proxy для локального использования в WSL2. Он зависит от текущего контракта DeepSeek Web Chat, поэтому при изменениях на стороне DeepSeek может потребоваться обновление.

Если что-то перестало работать:
1. обновите логин через `npm run auth`;
2. проверьте `/v1/model-capabilities`;
3. повторите запрос на свежей сессии;
4. если проблема сохраняется — DeepSeek изменил внутренний Web API.

---

<p align="center">
  <strong>Форк ForgetMeAI/FreeDeepseekAPI</strong> · Адаптация для WSL2
</p>
