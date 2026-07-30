import { describe, expect, it } from 'vitest';
import { protectMarkdown, reassemble } from './format-guard';

describe('format guard', () => {
  it('keeps protected technical literals byte-for-byte when translations return', () => {
    const source = '请检查 `npm run build`，并访问 https://example.com/docs。路径在 C:\\work\\app。';
    const document = protectMarkdown(source);
    const result = reassemble(document, document.segments.map((segment) => ({
      id: segment.id,
      text: `[${segment.text}]`
    })));

    expect(result).toContain('`npm run build`');
    expect(result).toContain('https://example.com/docs');
    expect(result).toContain('C:\\work\\app');
  });

  it('preserves whitespace-only fragments during reassembly', () => {
    const source = '  `npm run build`  ';
    const document = protectMarkdown(source);
    const result = reassemble(document, document.segments.map((segment) => ({
      id: segment.id,
      text: segment.text
    })));

    expect(result).toBe(source);
  });

  it('rejects incomplete provider results', () => {
    const document = protectMarkdown('翻译这句话。');
    expect(() => reassemble(document, [])).toThrow('分段不完整');
  });
});
