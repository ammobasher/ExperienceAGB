import type { EnsembleTrace } from './profileTrace';
import { parseUniqueJSON } from './strictJson';

export const MAPPING_SCHEMA = 'experience-agb-propensity-mapping-v1';
export const MAPPING_LIMITS = { bytes: 256 * 1024, bins: 1000 } as const;
export interface MappingBinding { sourceSha256?: string; exportTag: string; exportUpdateTime: string | null }
export interface MappingBin {
  lower: number | null; upper: number | null; propensity: number;
  positives: number | null; negatives: number | null;
}
export interface PropensityMapping {
  sourceSha256: string; exportTag: string; exportUpdateTime: string | null;
  inputDomain: 'raw-score' | 'sigmoid-preview';
  method: 'exported-values' | 'smoothed-bin-counts';
  context: { modelId: string; action: string; channel: string; direction: string };
  provenance: { reference: string; platformVersion: string; capturedAt: string };
  bins: MappingBin[];
}
export class MappingError extends Error {}

function fail(path: string, message: string): never { throw new MappingError(`${path}: ${message}`); }
function record(value: unknown, path: string, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail(path, 'Expected an object.');
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(path, `Unsupported field "${key}". Nothing was inferred or ignored.`);
  return value as Record<string, unknown>;
}
function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 512) return fail(path, 'Supply nonempty text of at most 512 characters.');
  return value;
}
function count(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return fail(path, 'Expected a nonnegative safe integer; weighted/fractional counts are unsupported.');
  return value;
}
function bound(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(path, 'Expected a finite number or explicit null for an unbounded tail.');
  return value;
}
export function mappingMatches(mapping: Pick<PropensityMapping, 'sourceSha256' | 'exportTag' | 'exportUpdateTime'>, binding: MappingBinding) {
  return !!binding.sourceSha256 && mapping.sourceSha256 === binding.sourceSha256.toLowerCase()
    && mapping.exportTag === binding.exportTag && mapping.exportUpdateTime === binding.exportUpdateTime;
}

export function parsePropensityMapping(input: string, binding: MappingBinding): PropensityMapping {
  if (new TextEncoder().encode(input).byteLength > MAPPING_LIMITS.bytes) fail('$file', 'Companion exceeds the 256 KiB limit.');
  let value: unknown;
  try { value = parseUniqueJSON(input); }
  catch (cause) {
    if (cause instanceof SyntaxError) fail('$', 'Invalid JSON.');
    if (cause instanceof Error && cause.message.startsWith('Duplicate object keys')) fail('$', cause.message);
    throw cause;
  }
  const root = record(value, '$', ['schema', 'sourceSha256', 'exportTag', 'exportUpdateTime', 'inputDomain', 'method', 'context', 'provenance', 'bins']);
  if (root.schema !== MAPPING_SCHEMA) fail('$.schema', `Expected "${MAPPING_SCHEMA}". This is a companion format, not a native Pega export.`);
  const sourceSha256 = text(root.sourceSha256, '$.sourceSha256').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sourceSha256)) fail('$.sourceSha256', 'Expected the exact model-file SHA-256.');
  const exportTag = text(root.exportTag, '$.exportTag');
  const exportUpdateTime = root.exportUpdateTime === null ? null : text(root.exportUpdateTime, '$.exportUpdateTime');
  if (!mappingMatches({ sourceSha256, exportTag, exportUpdateTime }, binding)) fail('$.sourceSha256', 'Model hash, export tag or export update time does not match this open file. Reopen the matching model; do not edit identifiers to force a match.');
  const inputDomain = root.inputDomain;
  if (inputDomain !== 'raw-score' && inputDomain !== 'sigmoid-preview') fail('$.inputDomain', 'Explicitly choose raw-score or sigmoid-preview based on the source mapping. No domain is guessed.');
  const method = root.method;
  if (method !== 'exported-values' && method !== 'smoothed-bin-counts') fail('$.method', 'Choose exported-values or smoothed-bin-counts. No Platt fit or PAVA pooling is performed here.');
  const context = record(root.context, '$.context', ['modelId', 'action', 'channel', 'direction']);
  const provenance = record(root.provenance, '$.provenance', ['reference', 'platformVersion', 'capturedAt']);
  const capturedAt = text(provenance.capturedAt, '$.provenance.capturedAt'), parsedTime = new Date(capturedAt);
  if (!Number.isFinite(parsedTime.getTime()) || parsedTime.toISOString() !== capturedAt) fail('$.provenance.capturedAt', 'Expected an exact UTC timestamp: YYYY-MM-DDTHH:mm:ss.sssZ.');
  if (!Array.isArray(root.bins) || !root.bins.length || root.bins.length > MAPPING_LIMITS.bins) fail('$.bins', 'Supply between 1 and 1000 already ordered, pooled intervals.');
  const rawBins = root.bins;
  const bins: MappingBin[] = rawBins.map((value: unknown, index: number) => {
    const path = `$.bins[${index}]`, row = record(value, path, ['lower', 'upper', 'propensity', 'positives', 'negatives']);
    const lower = bound(row.lower, `${path}.lower`), upper = bound(row.upper, `${path}.upper`);
    if (lower === null && index !== 0 || upper === null && index !== rawBins.length - 1) fail(path, 'Only the first lower bound or last upper bound can be unbounded.');
    if (lower !== null && upper !== null && lower >= upper) fail(path, 'The lower bound must be less than the upper bound.');
    if (inputDomain === 'sigmoid-preview' && (lower === null || upper === null || lower < 0 || upper > 1)) fail(path, 'Sigmoid-domain interval bounds must be finite and within 0–1.');
    let positives: number | null = null, negatives: number | null = null;
    if (method === 'smoothed-bin-counts' || row.positives !== undefined || row.negatives !== undefined) {
      positives = count(row.positives, `${path}.positives`); negatives = count(row.negatives, `${path}.negatives`);
      if (!Number.isSafeInteger(positives + negatives) || positives + negatives >= Number.MAX_SAFE_INTEGER) fail(path, 'The combined count plus one must remain a safe integer.');
    }
    let propensity: number;
    if (method === 'smoothed-bin-counts') {
      if (row.propensity !== undefined) fail(path, 'Omit propensity when using smoothed-bin-counts; the explicit count formula supplies it.');
      propensity = (positives! + .5) / (1 + positives! + negatives!);
    } else {
      if (typeof row.propensity !== 'number' || !Number.isFinite(row.propensity) || row.propensity < 0 || row.propensity > 1) fail(`${path}.propensity`, 'Expected an explicit probability between 0 and 1.');
      propensity = row.propensity;
    }
    return { lower, upper, propensity, positives, negatives };
  });
  for (let index = 1; index < bins.length; index++) {
    if (bins[index].lower !== bins[index - 1].upper) fail(`$.bins[${index}]`, 'Intervals must be ordered and exactly contiguous, without gaps or overlaps.');
    if (bins[index].propensity < bins[index - 1].propensity) fail(`$.bins[${index}]`, 'Propensities decrease. Supply authoritative monotonic mapped values or correctly pooled/smoothed bins; no automatic repair is applied.');
  }
  return {
    sourceSha256, exportTag, exportUpdateTime, inputDomain, method, bins,
    context: { modelId: text(context.modelId, '$.context.modelId'), action: text(context.action, '$.context.action'), channel: text(context.channel, '$.context.channel'), direction: text(context.direction, '$.context.direction') },
    provenance: { reference: text(provenance.reference, '$.provenance.reference'), platformVersion: text(provenance.platformVersion, '$.provenance.platformVersion'), capturedAt },
  };
}

export type MappedPropensity = { available: true; input: number; index: number; bin: MappingBin } | { available: false; reason: string };
export function mapPropensity(mapping: PropensityMapping | undefined, binding: MappingBinding, confirmed: boolean, trace: Pick<EnsembleTrace, 'complete' | 'rawScore' | 'propensity'>): MappedPropensity {
  if (!mapping) return { available: false, reason: 'Pega-mapped propensity unavailable—Classifier mapping required.' };
  if (!mappingMatches(mapping, binding)) return { available: false, reason: 'The companion no longer matches the open model. Import the matching mapping.' };
  if (!confirmed) return { available: false, reason: 'Confirm the mapping context, snapshot and input domain before applying it.' };
  const input = mapping.inputDomain === 'raw-score' ? trace.rawScore : trace.propensity;
  if (!trace.complete || input === undefined || !Number.isFinite(input)) return { available: false, reason: 'A complete, finite ensemble route is required. Resolve the profile inputs above.' };
  const index = mapping.bins.findIndex((bin, index) => (bin.lower === null || input >= bin.lower)
    && (bin.upper === null || input < bin.upper || index === mapping.bins.length - 1 && input === bin.upper));
  if (index < 0) return { available: false, reason: 'The profile score is outside the supplied intervals. No clipping, extrapolation or fallback was applied.' };
  return { available: true, input, index, bin: mapping.bins[index] };
}

export function mappingInterval(bin: MappingBin, last: boolean) {
  return `${bin.lower === null ? '(' : '['}${bin.lower ?? '−∞'}, ${bin.upper ?? '+∞'}${last && bin.upper !== null ? ']' : ')'}`;
}
export function mappingTemplate(binding: MappingBinding) {
  return {
    schema: MAPPING_SCHEMA, sourceSha256: binding.sourceSha256, exportTag: binding.exportTag, exportUpdateTime: binding.exportUpdateTime,
    inputDomain: '', method: '', context: { modelId: '', action: '', channel: '', direction: '' },
    provenance: { reference: '', platformVersion: '', capturedAt: '' }, bins: [],
  };
}
