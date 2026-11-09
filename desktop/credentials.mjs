import { parseUniqueJSON } from '../src/domain/strictJson.ts';
import { open } from 'node:fs/promises';

export const MAX_CREDENTIAL_BYTES = 4096;
export async function readDesktopCredentials(path) {
  const file = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(MAX_CREDENTIAL_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = await file.read(buffer, length, buffer.length - length, null);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length > MAX_CREDENTIAL_BYTES) throw new Error('Credential file exceeds 4 KiB.');
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length)); }
    catch { throw new Error('Credential file must be valid JSON without duplicate keys.'); }
    return parseDesktopCredentials(text);
  } finally { await file.close(); }
}
export function parseDesktopCredentials(text) {
  if (Buffer.byteLength(text, 'utf8') > MAX_CREDENTIAL_BYTES) throw new Error('Credential file exceeds 4 KiB.');
  let value;
  try { value = parseUniqueJSON(text); }
  catch { throw new Error('Credential file must be valid JSON without duplicate keys.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !['copilotToken', 'anthropicApiKey'].includes(key))) {
    throw new Error('Credential file supports only copilotToken and anthropicApiKey.');
  }
  for (const key of ['copilotToken', 'anthropicApiKey']) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || !value[key].trim()
      || value[key] !== value[key].trim() || /[\r\n\0]/.test(value[key]) || value[key].length > 512)) {
      throw new Error('Supplied credentials must be nonempty strings of at most 512 characters, without surrounding whitespace or line breaks.');
    }
  }
  if (!value.copilotToken && !value.anthropicApiKey) throw new Error('Supply at least one explicit provider credential.');
  return { copilotToken: value.copilotToken ?? '', apiKey: value.anthropicApiKey ?? '' };
}
