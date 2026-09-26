/**
 * Minimal browser clients for the supported model providers. Requests go straight
 * from the browser to the provider (or to a local Ollama / LM Studio server);
 * API keys are kept in this browser's localStorage only.
 */
import { storageKey } from '../model/storageKey';

export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'lmstudio';

export interface ProviderInfo {
  label: string;
  needsKey: boolean;
  defaultModel: string;
  defaultBaseUrl: string;
  keyUrl?: string;
  help: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    label: 'Claude (Anthropic)',
    needsKey: true,
    defaultModel: 'claude-sonnet-5',
    defaultBaseUrl: 'https://api.anthropic.com',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    help: 'Uses the Messages API directly from your browser.',
  },
  openai: {
    label: 'ChatGPT (OpenAI)',
    needsKey: true,
    defaultModel: 'gpt-5',
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    help: 'Uses the Chat Completions API in JSON mode.',
  },
  gemini: {
    label: 'Gemini (Google)',
    needsKey: true,
    defaultModel: 'gemini-2.5-flash',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyUrl: 'https://aistudio.google.com/apikey',
    help: 'Uses generateContent with a JSON response type.',
  },
  ollama: {
    label: 'Ollama (local)',
    needsKey: false,
    defaultModel: 'llama3.1',
    defaultBaseUrl: 'http://localhost:11434',
    help: 'Runs on your machine. Allow this page to call it by starting Ollama with OLLAMA_ORIGINS=* (e.g. `OLLAMA_ORIGINS=* ollama serve`). Larger models (≥ 14B) follow the part format far better.',
  },
  lmstudio: {
    label: 'LM Studio (local)',
    needsKey: false,
    defaultModel: '',
    defaultBaseUrl: 'http://localhost:1234/v1',
    help: 'In LM Studio open the Developer tab, load a model, start the server and turn on “Enable CORS”. Leave the model empty to use whichever model is loaded.',
  },
};

export interface AiSettings {
  provider: ProviderId;
  models: Partial<Record<ProviderId, string>>;
  keys: Partial<Record<ProviderId, string>>;
  baseUrls: Partial<Record<ProviderId, string>>;
}

const KEY = storageKey('ai');

export function loadSettings(): AiSettings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { provider: s.provider in PROVIDERS ? s.provider : 'anthropic', models: s.models ?? {}, keys: s.keys ?? {}, baseUrls: s.baseUrls ?? {} };
  } catch {
    return { provider: 'anthropic', models: {}, keys: {}, baseUrls: {} };
  }
}

export function saveSettings(s: AiSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

export const modelOf = (s: AiSettings) => s.models[s.provider] ?? PROVIDERS[s.provider].defaultModel;
export const baseOf = (s: AiSettings) => (s.baseUrls[s.provider] || PROVIDERS[s.provider].defaultBaseUrl).replace(/\/+$/, '');
const keyOf = (s: AiSettings) => (s.keys[s.provider] ?? '').trim();

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ProviderError extends Error {}

async function call(url: string, init: RequestInit, s: AiSettings): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    const info = PROVIDERS[s.provider];
    if (!info.needsKey) throw new ProviderError(`Couldn't reach ${info.label} at ${baseOf(s)}. Is it running, and does it allow browser requests (CORS)? ${info.help}`);
    throw new ProviderError(`Network error talking to ${info.label}. Check your connection.`);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const msg = data?.error?.message ?? data?.error ?? data?.message ?? text.slice(0, 300) ?? res.statusText;
    if (res.status === 401 || res.status === 403) throw new ProviderError(`${PROVIDERS[s.provider].label} rejected the API key (${res.status}): ${msg}`);
    if (res.status === 404) throw new ProviderError(`Model or endpoint not found (${res.status}): ${msg}. Try “Load models”.`);
    throw new ProviderError(`${PROVIDERS[s.provider].label} error ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }
  return data;
}

function requireKey(s: AiSettings) {
  if (PROVIDERS[s.provider].needsKey && !keyOf(s)) throw new ProviderError(`Add your ${PROVIDERS[s.provider].label} API key in the settings above.`);
}

/** One chat completion; returns the model's text. */
export async function complete(s: AiSettings, system: string, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  requireKey(s);
  const base = baseOf(s);
  const model = modelOf(s);
  const json = { 'content-type': 'application/json' };
  switch (s.provider) {
    case 'anthropic': {
      const data = await call(`${base}/v1/messages`, {
        method: 'POST',
        signal,
        headers: { ...json, 'x-api-key': keyOf(s), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model, max_tokens: 16000, system, messages }),
      }, s);
      return (data?.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    }
    case 'openai':
    case 'lmstudio': {
      const body: Record<string, unknown> = { messages: [{ role: 'system', content: system }, ...messages] };
      if (model) body.model = model;
      if (s.provider === 'openai') body.response_format = { type: 'json_object' };
      const headers: Record<string, string> = { ...json };
      if (keyOf(s)) headers.authorization = `Bearer ${keyOf(s)}`;
      const data = await call(`${base}/chat/completions`, { method: 'POST', signal, headers, body: JSON.stringify(body) }, s);
      return data?.choices?.[0]?.message?.content ?? '';
    }
    case 'gemini': {
      const data = await call(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        signal,
        headers: { ...json, 'x-goog-api-key': keyOf(s) },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        }),
      }, s);
      return (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
    }
    case 'ollama': {
      const data = await call(`${base}/api/chat`, {
        method: 'POST',
        signal,
        headers: json,
        body: JSON.stringify({ model, stream: false, format: 'json', options: { temperature: 0.3, num_ctx: 16384 }, messages: [{ role: 'system', content: system }, ...messages] }),
      }, s);
      return data?.message?.content ?? '';
    }
  }
}

/** Model ids the provider offers (or has installed, for local servers). */
export async function listModels(s: AiSettings): Promise<string[]> {
  requireKey(s);
  const base = baseOf(s);
  switch (s.provider) {
    case 'anthropic': {
      const data = await call(`${base}/v1/models?limit=100`, { headers: { 'x-api-key': keyOf(s), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } }, s);
      return (data?.data ?? []).map((m: any) => m.id);
    }
    case 'openai':
    case 'lmstudio': {
      const headers: Record<string, string> = {};
      if (keyOf(s)) headers.authorization = `Bearer ${keyOf(s)}`;
      const data = await call(`${base}/models`, { headers }, s);
      const ids: string[] = (data?.data ?? []).map((m: any) => m.id);
      return s.provider === 'openai' ? ids.filter((id) => /^(gpt|o\d|chatgpt)/.test(id)).sort().reverse() : ids;
    }
    case 'gemini': {
      const data = await call(`${base}/models?pageSize=200`, { headers: { 'x-goog-api-key': keyOf(s) } }, s);
      return (data?.models ?? [])
        .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m: any) => String(m.name).replace(/^models\//, ''));
    }
    case 'ollama': {
      const data = await call(`${base}/api/tags`, {}, s);
      return (data?.models ?? []).map((m: any) => m.name);
    }
  }
}
