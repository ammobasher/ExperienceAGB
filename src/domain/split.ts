export type SplitOperator = 'lt' | 'in' | 'missing' | 'unknown';

export interface ParsedSplit {
  raw: string;
  feature: string;
  operator: SplitOperator;
  threshold?: number;
  categories?: string[];
  error?: string;
}

const NUMBER_LITERAL = '[+-]?(?:(?:\\d+\\.?\\d*)|(?:\\.\\d+))(?:[eE][+-]?\\d+)?';
const NUMERIC_SPLIT = new RegExp(`^(.+?)\\s*<\\s*(${NUMBER_LITERAL})$`);
export const DECIMAL_VALUE = new RegExp(`^${NUMBER_LITERAL}$`);
export const MAX_CATEGORIES_PER_SPLIT = 4096;

export function parseSplit(raw: string): ParsedSplit {
  const value = raw.trim();
  const missingMatch = value.match(/^(.+?)\s+is\s+Missing$/i);
  if (missingMatch) return { raw, feature: missingMatch[1].trim(), operator: 'missing' };
  const numericMatch = value.match(NUMERIC_SPLIT);
  if (numericMatch && Number.isFinite(Number(numericMatch[2]))) {
    return { raw, feature: numericMatch[1].trim(), operator: 'lt', threshold: Number(numericMatch[2]) };
  }
  const categoryMatch = value.match(/^(.+?)\s+in\s*(?:\{([\s\S]*)\}|\[([\s\S]*)\])$/i);
  if (categoryMatch) {
    const categories = parseCategories(categoryMatch[2] ?? categoryMatch[3] ?? '');
    if (categories) return { raw, feature: categoryMatch[1].trim(), operator: 'in', categories };
  }
  return {
    raw,
    feature: value.split(/\s*(?:<=|>=|==|!=|<|>)|\s+(?:in|is)\s+/i)[0]?.trim() || value,
    operator: 'unknown',
    error: `Unsupported or malformed condition. Use a finite numeric < threshold, a nonempty in [categories] or in {categories} list (at most ${MAX_CATEGORIES_PER_SPLIT} entries), or is Missing.`,
  };
}

function parseCategories(raw: string): string[] | undefined {
  const values: string[] = [];
  let index = 0;
  while (index < raw.length) {
    while (/\s/.test(raw[index] ?? '') && index < raw.length) index += 1;
    let value = '';
    const quote = raw[index] === '"' || raw[index] === "'" ? raw[index++] : undefined;
    if (quote) {
      let closed = false;
      while (index < raw.length) {
        const character = raw[index++];
        if (character === quote) { closed = true; break; }
        if (character === '\\') {
          const escaped = raw[index++];
          const escapes: Record<string, string> = { '"': '"', "'": "'", '\\': '\\', '/': '/', n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' };
          if (escaped === 'u') {
            const hex = raw.slice(index, index + 4);
            if (!/^[0-9a-f]{4}$/i.test(hex)) return undefined;
            value += String.fromCharCode(parseInt(hex, 16));
            index += 4;
          } else if (escaped in escapes) value += escapes[escaped];
          else return undefined;
        } else {
          if (character.charCodeAt(0) < 32) return undefined;
          value += character;
        }
      }
      if (!closed) return undefined;
      while (index < raw.length && /\s/.test(raw[index])) index += 1;
      if (index < raw.length && raw[index] !== ',') return undefined;
    } else {
      const start = index;
      while (index < raw.length && raw[index] !== ',') index += 1;
      value = raw.slice(start, index).trim();
      if (/["'\\[\]{}]/.test(value)) return undefined;
    }
    if (!value.length) return undefined;
    values.push(value);
    if (values.length > MAX_CATEGORIES_PER_SPLIT) return undefined;
    if (index === raw.length) break;
    index += 1;
    if (raw.slice(index).trim() === '') return undefined;
  }
  return values.length ? values : undefined;
}
