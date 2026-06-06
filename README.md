# FreeDeepseekAPI

Локальный OpenAI-compatible API proxy для **DeepSeek Web Chat** (`chat.deepseek.com`). Это отдельный проект под DeepSeek, не часть FreeQwenAPI.

Работает через ваш обычный залогиненный аккаунт DeepSeek в отдельном Chrome-профиле и поднимает локальный endpoint `/v1/chat/completions` для Open WebUI, LiteLLM, Hermes и любых OpenAI-compatible клиентов.

ForgetMeAI: https://t.me/forgetmeai

## Возможности

- OpenAI-compatible endpoint: `POST /v1/chat/completions`
- Streaming SSE и обычные JSON-ответы
- Простая эмуляция tool calling в OpenAI-формате
- Verified aliases для реально работающих DeepSeek Web режимов
- `GET /v1/model-capabilities` с маппингом alias → реальная web-модель/режим
- Отдельная сессия DeepSeek на `user`/агента
- Автовосстановление web-сессии при устаревшем chain
- Quickstart-меню авторизации/запуска в стиле FreeQwenAPI
- Без npm-зависимостей: Node.js 18+

## Быстрый старт

```bash
git clone https://github.com/ForgetMeAI/FreeDeepseekAPI.git
cd FreeDeepseekAPI
npm run auth
npm start
```

`npm run auth` открывает меню авторизации. Выберите пункт `1`, войдите в DeepSeek в отдельном Chrome, отправьте короткое сообщение вроде `ok`, затем вернитесь в терминал и нажмите Enter.

`npm start` тоже показывает меню:

- `1` — авторизоваться / обновить DeepSeek login
- `2` — показать модели и статусы
- `3` — запустить proxy
- `4` — выйти

Для headless/CI-запуска без меню:

```bash
NON_INTERACTIVE=1 npm start
# или
SKIP_ACCOUNT_MENU=1 npm start
```

Проверка:

```bash
curl http://localhost:9655/
curl http://localhost:9655/v1/models
curl http://localhost:9655/v1/model-capabilities
```

Запрос:

```bash
curl -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Привет! Ответь одной фразой."}],
    "stream": false
  }'
```

Reasoning:

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

`reasoning_tokens` — приблизительная оценка по извлечённому DeepSeek Web `THINK`-тексту, потому что web stream не отдаёт официальный token usage по reasoning отдельно.

Web search:

```bash
curl -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat-search",
    "messages": [{"role": "user", "content": "Найди свежий факт про DeepSeek и ответь кратко."}],
    "stream": false
  }'
```

Streaming:

```bash
curl -N -X POST http://localhost:9655/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "Напиши короткую шутку."}],
    "stream": true
  }'
```

Anthropic Messages API shim для Claude Code / Anthropic SDK:

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

Для Claude Code можно указывать backend напрямую:

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:9655"
export ANTHROPIC_AUTH_TOKEN="dummy-key"
export CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1
claude --model deepseek-chat
```

OpenAI Responses API shim:

```bash
curl -X POST http://localhost:9655/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "input": "Ответь ровно OK",
    "stream": false
  }'
```

Tool calling принимает OpenAI tools, Anthropic tools и Responses function tools. Прокси просит DeepSeek вернуть строгий JSON tool call, но также парсит legacy `TOOL_CALL:`, fenced JSON и `<tool_call>...</tool_call>`.

## Модели

`GET /v1/models` возвращает только aliases, которые сейчас проверены и работают через этот proxy:

- `deepseek-chat` — DeepSeek Web `Быстрый`, без reasoning, без web search
- `deepseek-v3` — alias на тот же `Быстрый`
- `deepseek-default` — alias на тот же `Быстрый`
- `deepseek-reasoner` — `Быстрый` + `thinking_enabled=true`
- `deepseek-r1` — совместимый alias на reasoning-режим; это не отдельный `R1` model_type в текущем Web API
- `deepseek-chat-search` — `Быстрый` + web search
- `deepseek-default-search` — alias на `Быстрый` + web search
- `deepseek-reasoner-search` — reasoning + web search
- `deepseek-r1-search` — совместимый alias на reasoning + web search
- `deepseek-expert` — DeepSeek Web `Эксперт`, без web search
- `deepseek-v4-pro` — alias на Web `Эксперт`

Полный маппинг:

```bash
curl http://localhost:9655/v1/model-capabilities
```

По официальной странице DeepSeek V4 Preview `deepseek-chat` и `deepseek-reasoner` сейчас route'ятся в `deepseek-v4-flash` non-thinking/thinking. В самом `chat.deepseek.com` direct stream точное имя чекпойнта не отдаётся (`model: ""`), поэтому proxy фиксирует одновременно web-режим (`default` / `Быстрый`) и актуальную официальную маршрутизацию (`DeepSeek-V4-Flash`).

Текущий вывод DeepSeek Web remote config показывает такие web-режимы:

- `default` / UI `Быстрый` — работает; поддерживает `thinking_enabled` и `search_enabled`.
- `expert` / UI `Эксперт` — работает через актуальный web-контракт (`x-client-version=2.0.0`). В `/v1/models` выдаются `deepseek-expert` и alias `deepseek-v4-pro`. Search для Expert по remote config недоступен, поэтому `deepseek-expert-search` остаётся unsupported.
- `vision` / UI `Распознавание` — виден в remote config, но сейчас direct Web API возвращает `backend_err_by_model` (`Vision is temporarily unavailable`). Поэтому `deepseek-vision` тоже скрыт из `/v1/models`.

## Endpoints

- `GET /` или `GET /health` — статус proxy
- `GET /v1/models` — список рабочих OpenAI-compatible aliases
- `GET /v1/model-capabilities` — полный маппинг aliases, real model, reasoning/web_search/files, supported/unavailable reason
- `POST /v1/chat/completions` — OpenAI-compatible Chat Completions
- `POST /v1/messages` — Anthropic Messages shim для Claude Code / Anthropic SDK
- `POST /v1/responses` — OpenAI Responses API shim для новых OpenAI/Codex-style клиентов
- `GET /v1/sessions` — активные локальные agent sessions
- `POST /reset-session?agent=<id>` — сбросить одну session
- `POST /reset-session?agent=all` — сбросить все sessions

## Open WebUI

Base URL:

```text
http://host.docker.internal:9655/v1
```

Для локального запуска без Docker:

```text
http://localhost:9655/v1
```

API key можно указать любой: proxy сам ходит в DeepSeek Web через сохранённую browser-сессию.

## Обновить логин

```bash
npm run auth
npm start
```

Если DeepSeek начал отвечать `401`, `403` или просит новый PoW/session — повторите `npm run auth` и обновите сохранённую browser-сессию.

## Статус

Экспериментальный web-chat proxy. DeepSeek может менять внутренний API, поэтому для production-кейсов надёжнее официальный платный API DeepSeek.

ForgetMeAI: https://t.me/forgetmeai
