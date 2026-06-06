#!/usr/bin/env node
const BASE = process.env.BASE_URL || 'http://127.0.0.1:9665';
const MODEL = process.env.MODEL || 'deepseek-chat';

async function post(path, body, timeoutMs = 120000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`timeout ${timeoutMs}ms`)), timeoutMs);
  try {
    const resp = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await resp.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: resp.status, ok: resp.ok, text, json };
  } finally { clearTimeout(timer); }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function summarizeText(s) { return String(s || '').replace(/\s+/g, ' ').slice(0, 160); }

const tools = [{
  type: 'function',
  function: {
    name: 'get_current_time',
    description: 'Return current local time for a timezone. Use this whenever the user asks about current time.',
    parameters: { type: 'object', properties: { timezone: { type: 'string' } }, required: ['timezone'] }
  }
}];

const anthropicTools = [{
  name: 'get_current_time',
  description: 'Return current local time for a timezone. Use this whenever the user asks about current time.',
  input_schema: { type: 'object', properties: { timezone: { type: 'string' } }, required: ['timezone'] }
}];

const responsesTools = [{
  type: 'function',
  name: 'get_current_time',
  description: 'Return current local time for a timezone. Use this whenever the user asks about current time.',
  parameters: { type: 'object', properties: { timezone: { type: 'string' } }, required: ['timezone'] }
}];

const tests = [];
function test(name, fn) { tests.push({name, fn}); }

test('1 chat/completions plain', async () => {
  const r = await post('/v1/chat/completions', { model: MODEL, user: `smoke-chat-${Date.now()}`, messages: [{ role: 'user', content: 'Reply exactly: OK_CHAT' }], stream: false });
  assert(r.ok, `HTTP ${r.status}: ${r.text}`);
  const content = r.json?.choices?.[0]?.message?.content || '';
  assert(/OK_CHAT/i.test(content), `unexpected content: ${content}`);
  return summarizeText(content);
});

test('2 /v1/messages plain', async () => {
  const r = await post('/v1/messages', { model: MODEL, max_tokens: 64, metadata: { user_id: `smoke-msg-${Date.now()}` }, messages: [{ role: 'user', content: 'Reply exactly: OK_MESSAGES' }], stream: false });
  assert(r.ok, `HTTP ${r.status}: ${r.text}`);
  const text = (r.json?.content || []).map(b => b.text || '').join('');
  assert(/OK_MESSAGES/i.test(text), `unexpected content: ${text}`);
  return summarizeText(text);
});

test('3 /v1/responses plain', async () => {
  const r = await post('/v1/responses', { model: MODEL, user: `smoke-resp-${Date.now()}`, input: 'Reply exactly: OK_RESPONSES', stream: false });
  assert(r.ok, `HTTP ${r.status}: ${r.text}`);
  assert(/OK_RESPONSES/i.test(r.json?.output_text || ''), `unexpected output_text: ${r.json?.output_text}`);
  return summarizeText(r.json.output_text);
});

test('4 OpenAI tool calling parse', async () => {
  const r = await post('/v1/chat/completions', { model: MODEL, user: `smoke-tool-oai-${Date.now()}`, messages: [{ role: 'user', content: 'What time is it in UTC? Use the available tool. Output only the tool request.' }], tools, tool_choice: 'auto', stream: false }, 180000);
  assert(r.ok, `HTTP ${r.status}: ${r.text}`);
  const tc = r.json?.choices?.[0]?.message?.tool_calls?.[0];
  assert(tc?.function?.name === 'get_current_time', `no/incorrect tool_call: ${r.text}`);
  return `${tc.function.name} ${tc.function.arguments}`;
});

test('5 Anthropic tool calling parse', async () => {
  const r = await post('/v1/messages', { model: MODEL, max_tokens: 128, metadata: { user_id: `smoke-tool-anth-${Date.now()}` }, messages: [{ role: 'user', content: 'What time is it in UTC? Use the available tool. Output only the tool request.' }], tools: anthropicTools, stream: false }, 180000);
  assert(r.ok, `HTTP ${r.status}: ${r.text}`);
  const block = (r.json?.content || []).find(b => b.type === 'tool_use');
  assert(block?.name === 'get_current_time', `no/incorrect tool_use: ${r.text}`);
  return `${block.name} ${JSON.stringify(block.input)}`;
});

test('6 Responses tool calling parse', async () => {
  const r = await post('/v1/responses', { model: MODEL, user: `smoke-tool-resp-${Date.now()}`, input: 'What time is it in UTC? Use the available tool. Output only the tool request.', tools: responsesTools, stream: false }, 180000);
  assert(r.ok, `HTTP ${r.status}: ${r.text}`);
  const item = (r.json?.output || []).find(o => o.type === 'function_call');
  assert(item?.name === 'get_current_time', `no/incorrect function_call: ${r.text}`);
  return `${item.name} ${item.arguments}`;
});

let failed = 0;
for (const t of tests) {
  const start = Date.now();
  try {
    const details = await t.fn();
    console.log(`PASS ${t.name} (${Date.now()-start}ms): ${details}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${t.name}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
