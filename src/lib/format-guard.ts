export type Segment = {
  id: string;
  text: string;
};

type ProtectedPart = { type: 'protected'; text: string };
type TranslatablePart = { type: 'segment'; id: string; text: string };
export type ProtectedDocument = {
  parts: Array<ProtectedPart | TranslatablePart>;
  segments: Segment[];
};

const protectedToken = /(`[^`\n]+`|https?:\/\/[^\s)\]>]+|\$[^$\n]+\$|(?:[A-Za-z]:\\|~\/|\/)[\w./\\-]+|\$[A-Z_][A-Z0-9_]*)/g;

function splitInline(line: string, nextId: () => string): Array<ProtectedPart | TranslatablePart> {
  const parts: Array<ProtectedPart | TranslatablePart> = [];
  const appendText = (text: string) => {
    if (!text) return;
    parts.push(/\S/.test(text)
      ? { type: 'segment', id: nextId(), text }
      : { type: 'protected', text });
  };
  let cursor = 0;
  for (const match of line.matchAll(protectedToken)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      appendText(line.slice(cursor, index));
    }
    parts.push({ type: 'protected', text: match[0] });
    cursor = index + match[0].length;
  }
  if (cursor < line.length) {
    appendText(line.slice(cursor));
  }
  if (parts.length === 0 && line.length > 0) {
    appendText(line);
  }
  return parts;
}

/**
 * A deliberately conservative first-stage protector. Tokens it cannot classify
 * stay untouched once the native format guard takes ownership of the request.
 */
export function protectMarkdown(input: string): ProtectedDocument {
  const parts: Array<ProtectedPart | TranslatablePart> = [];
  let index = 1;
  const nextId = () => `s_${String(index++).padStart(4, '0')}`;
  const lines = input.split(/(\r?\n)/);
  let inFence = false;

  for (const line of lines) {
    if (line === '\n' || line === '\r\n') {
      parts.push({ type: 'protected', text: line });
      continue;
    }
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      parts.push({ type: 'protected', text: line });
      continue;
    }
    if (inFence || /^\s{4}/.test(line) || /^\s*(?:at |Caused by:|\w+Error:)/.test(line)) {
      parts.push({ type: 'protected', text: line });
      continue;
    }
    parts.push(...splitInline(line, nextId));
  }

  return {
    parts,
    segments: parts.filter((part): part is TranslatablePart => part.type === 'segment' && /\S/.test(part.text))
      .map(({ id, text }) => ({ id, text }))
  };
}

export function reassemble(document: ProtectedDocument, translations: Segment[]): string {
  const expectedIds = document.segments.map((segment) => segment.id);
  const received = new Map(translations.map((segment) => [segment.id, segment.text]));
  if (received.size !== expectedIds.length || expectedIds.some((id) => !received.has(id))) {
    throw new Error('翻译服务返回的分段不完整，已阻止输出。');
  }
  return document.parts.map((part) => part.type === 'protected' ? part.text : received.get(part.id) ?? '').join('');
}
