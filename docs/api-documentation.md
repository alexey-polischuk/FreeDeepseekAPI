# FreeDeepseekAPI — Документация API

## Обзор

FreeDeepseekAPI — локальный OpenAI/Anthropic-совместимый прокси-сервер для DeepSeek Web Chat (`chat.deepseek.com`). Позволяет использовать DeepSeek Web как бесплатный API endpoint для Hermes, Claude Code, OpenAI SDK, Open WebUI и других совместимых клиентов.

**Платформа:** WSL2 (Windows Subsystem for Linux)  
**Сервер:** Node.js HTTP на порту 9655  
**Модель:** DeepSeek-V4-Flash (через DeepSeek Web)

---

## 1. Архитектура

```
┌──────────────┐     POST /v1/chat/completions     ┌──────────────────┐
│              │ ──────────────────────────────►    │                  │
│  Ваш клиент   │    {messages, tools, user,         │  FreeDeepseekAPI │
│  (Hermes,     │     stream}                        │  (port 9655)     │
│  Open WebUI,  │ ◄──────────────────────────────    │                  │
│  curl и т.д.) │    {choices[].message.content      │  Node.js HTTP    │
│              │     or tool_calls}                  │  Server          │
└──────────────┘                                      └────────┬─────────┘
                                                               │
                                     ┌─────────────────────────┼──────────────┐
                                     │                         │              │
                                     ▼                         ▼              ▼
                           ┌──────────────────┐    ┌──────────────────┐
                           │  PoW Challenge   │    │  Chat Completion │
                           │  /api/v0/chat/   │    │  /api/v0/chat/   │
                           │  create_pow_     │    │  completion      │
                           │  challenge       │    │                  │
                           └──────────────────┘    └──────────────────┘
                                                          │
                                                          ▼
                                                ┌──────────────────┐
                                                │  DeepSeek Web    │
                                                │  chat.deepseek   │
                                                │  .com            │
                                                │  (Free V4 Flash) │
                                                └──────────────────┘
```

---

## 2. Endpoints прокси-сервера

### 2.1 Health Check

```
GET /health
GET /

Response:
{
  "status": "ok",
  "config_ready": true,
  "agents": <int>
}
```

### 2.2 Список моделей

```
GET /v1/models

Response:
{
  "data": [
    {"id": "deepseek-chat", ...},
    {"id": "deepseek-reasoner", ...},
    {"id": "deepseek-chat-search", ...},
    ...
  ]
}
```

### 2.3 Chat Completions (OpenAI)

```
POST /v1/chat/completions

Headers:
  Content-Type: application/json
  Authorization: Bearer ***    ← опционально, игнорируется

Body (OpenAI-compatible):
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "tools": [...],                ← опционально, для tool calling
  "stream": true|false,
  "user": "agent-id"            ← опционально, для изоляции сессий
}

Response (non-stream):
{
  "id": "ds-<timestamp>",
  "object": "chat.completion",
  "model": "deepseek-chat",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "...",
      "reasoning_content": "...",     ← только для reasoning-моделей
      "tool_calls": [...]             ← только при tool calling
    },
    "finish_reason": "stop" | "tool_calls"
  }],
  "usage": {
    "prompt_tokens": <int>,
    "completion_tokens": <int>,
    "total_tokens": <int>,
    "completion_tokens_details": {
      "reasoning_tokens": <int>
    }
  }
}

Response (stream): SSE chunks в формате OpenAI
```

### 2.4 Anthropic Messages API

```
POST /v1/messages

Request:
{
  "model": "deepseek-chat",
  "max_tokens": 1024,
  "system": "optional system prompt",
  "messages": [{"role":"user","content":"Hello"}],
  "tools": [{"name":"get_time","description":"...","input_schema":{...}}],
  "stream": true|false,
  "metadata": {"user_id":"agent-session-id"}
}

Response: Anthropic content blocks format (stream/non-stream)
```

### 2.5 OpenAI Responses API

```
POST /v1/responses

Request:
{
  "model": "deepseek-chat",
  "input": "Hello" | [{"role":"user","content":"Hello"}],
  "instructions": "optional system prompt",
  "tools": [{"type":"function","name":"...","parameters":{...}}],
  "stream": true|false
}

Response: Responses API format
```

### 2.6 Другие endpoints

| Method | Path | Назначение |
|--------|------|------------|
| `GET` | `/v1/model-capabilities` | Полный маппинг aliases, real model, capabilities |
| `GET` | `/v1/sessions` | Активные локальные agent sessions |
| `POST` | `/reset-session?agent=<id>` | Сбросить одну session |
| `POST` | `/reset-session?agent=all` | Сбросить все sessions |

---

## 3. Модели

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

---

## 4. Tool Calling

Прокси поддерживает tool calling через текстовую инъекцию + парсинг (DeepSeek Web не имеет нативного tool support).

Поддерживаемые форматы:
- OpenAI `tools`: `[{type:"function", function:{name, description, parameters}}]`
- Anthropic `tools`: `[{name, description, input_schema}]`
- Responses API: `[{type:"function", name, description, parameters}]`

Парсер распознаёт:
- Строгий JSON: `{"tool_call":{"name":"tool","arguments":{...}}}`
- Legacy формат: `TOOL_CALL: tool\narguments: {...}`
- Fenced JSON блоки
- XML-ish обёртки

---

## 5. Мульти-агентные сессии

Каждый запрос привязывается к session key:
- localhost → session по `user` полю или IP
- Внешние IP → session по `user` полю или remote IP

Каждый агент получает изолированную DeepSeek web-сессию.

### Авто-восстановление

| Условие | Действие |
|---------|----------|
| Message count >= 50 | Авто-сброс сессии, сохранить history buffer |
| Возраст сессии > 2 часа | Авто-сброс (DeepSeek web session TTL) |
| HTTP 400/404/500 | Сброс и retry |
| Пустой ответ | HTTP 502 |

---

## 6. Конфигурация

### Авторизация

Файл `deepseek-auth.json` (автогенерируется через `npm run auth`):
```json
{
  "token": "...",
  "cookie": "...",
  "hif_dliq": "",
  "hif_leim": "",
  "wasmUrl": "https://fe-static.deepseek.com/chat/static/sha3_wasm_bg.7b9ca65ddd.wasm",
  "baseUrl": "https://chat.deepseek.com"
}
```

### Hermes Agent

```yaml
model:
  default: deepseek-chat
  provider: custom
  base_url: http://127.0.0.1:9655/v1
```

### Claude Code

```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:9655"
export ANTHROPIC_AUTH_TOKEN="***"
export CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1
claude --model deepseek-chat
```

---

## 7. Запуск в WSL

```bash
# Авторизация (интерактивная)
CHROME_PATH=/snap/bin/chromium npm run auth

# Запуск сервера (headless)
NON_INTERACTIVE=1 npm start

# Проверка
curl http://localhost:9655/v1/models
```

Подробности — в [docs/wsl-setup.md](wsl-setup.md).

---

## 8. Коды ошибок

| HTTP Code | Type | Meaning |
|-----------|------|---------|
| 200 | OK | Успешный ответ |
| 404 | Not found | Неверный endpoint |
| 500 | server_error | Внутренняя ошибка прокси |
| 502 | empty_response | DeepSeek вернул пустой контент |

---

## 9. Известные ограничения

| Проблема | Причина | Влияние |
|----------|---------|---------|
| Пустые ответы на msg 17-34 | Нестабильность DeepSeek web-сессии | Прерывание разговора |
| Tool calling через текст | DeepSeek Web API не поддерживает нативно | LLM может генерировать некорректные tool calls |
| Время ответа 3-17с | PoW + сеть до DeepSeek | Медленнее официального API |
| TTL сессии ~2ч | DeepSeek web browser timeout | Периодические сбросы сессий |
| Credentials истекают | Browser tokens/cookies меняются | Нужна повторная авторизация |
