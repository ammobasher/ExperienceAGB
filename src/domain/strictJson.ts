/** Native parsing plus an iterative key scan: JSON.parse alone silently keeps duplicate keys. */
export function parseUniqueJSON(text: string): unknown {
  const value: unknown = JSON.parse(text);
  const stack: Array<Set<string> | null> = [];
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (character === '{') stack.push(new Set());
    else if (character === '[') stack.push(null);
    else if (character === '}' || character === ']') stack.pop();
    else if (character === '"') {
      const start = index++;
      let escaped = false;
      while (index < text.length && text[index] !== '"') {
        if (text[index] === '\\') { escaped = true; index++; }
        index++;
      }
      let next = index + 1;
      while (/\s/.test(text[next] ?? '') && next < text.length) next++;
      if (text[next] === ':') {
        const key: string = escaped ? JSON.parse(text.slice(start, index + 1)) : text.slice(start + 1, index);
        const keys = stack.at(-1);
        if (keys?.has(key)) throw new Error('Duplicate object keys are not allowed. Remove the ambiguous repeated key and retry.');
        keys?.add(key);
      }
    }
  }
  return value;
}
