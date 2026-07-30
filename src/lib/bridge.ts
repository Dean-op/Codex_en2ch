import { protectMarkdown, reassemble, type Segment } from './format-guard';

export type TranslationConfig = {
  baseUrl: string;
  model: string;
  timeoutSeconds: number;
};

export type TranslationDirection = 'zh-en' | 'en-zh';

type TauriWindow = Window & {
  __TAURI__?: {
    core?: { invoke: <T>(command: string, payload?: Record<string, unknown>) => Promise<T> };
  };
};

function endpoint(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  return `${normalized.endsWith('/v1') ? normalized : `${normalized}/v1`}/chat/completions`;
}

function parseContent(content: string): Segment[] {
  const json = content.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(json) as { segments?: Segment[] } | Segment[];
  const segments = Array.isArray(parsed) ? parsed : parsed.segments;
  if (!Array.isArray(segments) || !segments.every((segment) => typeof segment.id === 'string' && typeof segment.text === 'string')) {
    throw new Error('翻译服务返回格式无效。');
  }
  return segments;
}

async function callCompatibleApi(
  segments: Segment[],
  direction: TranslationDirection,
  config: TranslationConfig,
  apiKey: string
): Promise<Segment[]> {
  const [sourceLanguage, targetLanguage] = direction === 'zh-en' ? ['Chinese', 'English'] : ['English', 'Chinese'];
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), config.timeoutSeconds * 1000);

  try {
    const response = await fetch(endpoint(config.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are a faithful technical translator. Return JSON only: {"segments":[{"id":"...","text":"..."}]}. Preserve each id exactly. Do not add, remove, summarize, optimize, or explain.'
          },
          {
            role: 'user',
            content: JSON.stringify({ source_language: sourceLanguage, target_language: targetLanguage, segments })
          }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`翻译服务请求失败（${response.status}）。`);
    }
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('翻译服务没有返回内容。');
    return parseContent(content);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('翻译请求超时。');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function translate(
  source: string,
  direction: TranslationDirection,
  config: TranslationConfig,
  apiKey: string
): Promise<string> {
  const document = protectMarkdown(source);
  if (document.segments.length === 0) return source;

  const native = (window as TauriWindow).__TAURI__?.core?.invoke;
  const translations = native
    ? await native<Segment[]>('translate_segments', { segments: document.segments, direction, config })
    : await callCompatibleApi(document.segments, direction, config, apiKey);

  return reassemble(document, translations);
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export async function readClipboardText(): Promise<string> {
  return navigator.clipboard.readText();
}
