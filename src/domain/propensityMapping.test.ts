import { describe, expect, it } from 'vitest';
import { MAPPING_LIMITS, MAPPING_SCHEMA, MappingError, mappingInterval, mappingTemplate, mapPropensity, parsePropensityMapping } from './propensityMapping';

const binding = { sourceSha256: 'a'.repeat(64), exportTag: '2', exportUpdateTime: null };
function companion() {
  return {
    schema: MAPPING_SCHEMA, ...binding, inputDomain: 'raw-score', method: 'exported-values',
    context: { modelId: 'demo', action: 'example', channel: 'Web', direction: 'Inbound' },
    provenance: { reference: 'Synthetic test only', platformVersion: 'test', capturedAt: '2024-01-01T00:00:00.000Z' },
    bins: [{ lower: -1, upper: 0, propensity: .1 }, { lower: 0, upper: 1, propensity: .8 }],
  };
}
const trace = { complete: true, rawScore: 0, propensity: .5 };
const parse = (value: unknown) => parsePropensityMapping(JSON.stringify(value), binding);

describe('companion mapping', () => {
  it('uses explicit mapped values unchanged and treats internal boundaries as belonging to the next interval', () => {
    const mapping = parse(companion());
    expect(mapPropensity(mapping, binding, true, trace)).toMatchObject({ available: true, index: 1, input: 0, bin: { propensity: .8, positives: null } });
    expect(mapPropensity(mapping, binding, true, { ...trace, rawScore: -1 })).toMatchObject({ available: true, index: 0 });
    expect(mapPropensity(mapping, binding, true, { ...trace, rawScore: 1 })).toMatchObject({ available: true, index: 1 });
    expect(mapPropensity(mapping, binding, true, { ...trace, rawScore: 1.000001 })).toMatchObject({ available: false, reason: expect.stringMatching(/outside/) });
  });
  it('chooses only the declared domain instead of automatically converting raw score or applying sigmoid twice', () => {
    const mapping = parse({ ...companion(), inputDomain: 'sigmoid-preview', bins: [{ lower: 0, upper: .5, propensity: .1 }, { lower: .5, upper: 1, propensity: .7 }] });
    expect(mapPropensity(mapping, binding, true, { ...trace, rawScore: -100, propensity: .6 })).toMatchObject({ available: true, input: .6, bin: { propensity: .7 } });
  });
  it('supports explicit unbounded raw-score tails without inventing outside-range values', () => {
    const mapping = parse({ ...companion(), bins: [{ lower: null, upper: 0, propensity: 0 }, { lower: 0, upper: null, propensity: 1 }] });
    expect(mapPropensity(mapping, binding, true, { ...trace, rawScore: -Number.MAX_VALUE })).toMatchObject({ available: true, index: 0 });
    expect(mapPropensity(mapping, binding, true, { ...trace, rawScore: Number.MAX_VALUE })).toMatchObject({ available: true, index: 1 });
    expect(mappingInterval(mapping.bins[0], false)).toBe('(−∞, 0)');
    expect(mappingInterval(mapping.bins[1], true)).toBe('[0, +∞)');
  });
  it('computes only the explicitly chosen smoothed-count method, including empty-bin neutrality', () => {
    const mapping = parse({ ...companion(), method: 'smoothed-bin-counts', bins: [{ lower: -1, upper: 0, positives: 28, negatives: 370 }, { lower: 0, upper: 1, positives: 0, negatives: 0 }] });
    expect(mapping.bins[0].propensity).toBe(28.5 / 399);
    expect(mapping.bins[1].propensity).toBe(.5);
  });
  it('retains supplied values even when accompanying counts would produce a different smoothed result', () => {
    const mapping = parse({ ...companion(), bins: [{ lower: null, upper: null, propensity: .1234567890123, positives: 28, negatives: 370 }] });
    expect(mapping.bins[0].propensity).toBe(.1234567890123);
  });
  it.each([
    [undefined, binding, true, trace, /Classifier mapping required/],
    [parse(companion()), binding, false, trace, /Confirm/],
    [parse(companion()), { ...binding, sourceSha256: 'b'.repeat(64) }, true, trace, /no longer matches/],
    [parse(companion()), binding, true, { ...trace, complete: false }, /complete, finite/],
    [parse(companion()), binding, true, { ...trace, rawScore: Infinity }, /complete, finite/],
    [parse(companion()), binding, true, { ...trace, rawScore: undefined }, /complete, finite/],
  ] as const)('withholds unavailable input case %#', (mapping, model, confirmed, input, reason) => {
    expect(mapPropensity(mapping, model, confirmed, input)).toMatchObject({ available: false, reason: expect.stringMatching(reason) });
  });
  it.each([
    ['wrong schema', { schema: 'pega-native' }],
    ['unknown field', { unexpected: true }],
    ['wrong hash', { sourceSha256: 'b'.repeat(64) }],
    ['malformed hash', { sourceSha256: 'not-a-hash' }],
    ['wrong export tag', { exportTag: 'other' }],
    ['wrong snapshot', { exportUpdateTime: '2024-01-01T00:00:00.000Z' }],
    ['missing domain', { inputDomain: '' }],
    ['unknown method', { method: 'platt' }],
    ['empty bins', { bins: [] }],
    ['too many bins', { bins: Array.from({ length: MAPPING_LIMITS.bins + 1 }, () => ({ lower: 0, upper: 1, propensity: .1 })) }],
    ['empty context', { context: { modelId: '', action: 'x', channel: 'Web', direction: 'Inbound' } }],
    ['invalid capture time', { provenance: { reference: 'test', platformVersion: 'test', capturedAt: '2024-02-30T00:00:00.000Z' } }],
    ['zero-width bin', { bins: [{ lower: 1, upper: 1, propensity: .1 }] }],
    ['invalid probability', { bins: [{ lower: null, upper: null, propensity: 1.01 }] }],
    ['overlap', { bins: [{ lower: -1, upper: .5, propensity: .1 }, { lower: 0, upper: 1, propensity: .8 }] }],
    ['gap', { bins: [{ lower: -1, upper: 0, propensity: .1 }, { lower: .1, upper: 1, propensity: .8 }] }],
    ['descending probabilities', { bins: [{ lower: -1, upper: 0, propensity: .8 }, { lower: 0, upper: 1, propensity: .1 }] }],
    ['interior unbounded tail', { bins: [{ lower: -1, upper: null, propensity: .1 }, { lower: 0, upper: 1, propensity: .8 }] }],
    ['unbounded sigmoid interval', { inputDomain: 'sigmoid-preview', bins: [{ lower: null, upper: 1, propensity: .1 }] }],
    ['sigmoid domain outside 0-1', { inputDomain: 'sigmoid-preview', bins: [{ lower: -1, upper: 1, propensity: .1 }] }],
    ['fractional counts', { bins: [{ lower: 0, upper: 1, propensity: .1, positives: .5, negatives: 10 }] }],
    ['partial counts', { bins: [{ lower: 0, upper: 1, propensity: .1, positives: 1 }] }],
    ['unsafe combined count', { bins: [{ lower: 0, upper: 1, propensity: .1, positives: Number.MAX_SAFE_INTEGER, negatives: 1 }] }],
    ['missing smoothed counts', { method: 'smoothed-bin-counts', bins: [{ lower: 0, upper: 1 }] }],
    ['ambiguous method operands', { method: 'smoothed-bin-counts', bins: [{ lower: 0, upper: 1, propensity: .1, positives: 1, negatives: 10 }] }],
    ['smoothing breaks monotonicity', { method: 'smoothed-bin-counts', bins: [{ lower: 0, upper: 1, positives: 2, negatives: 19 }, { lower: 1, upper: 2, positives: 9, negatives: 77 }] }],
  ])('rejects %s instead of silently repairing or inferring it', (_label, changes) => {
    expect(() => parse({ ...companion(), ...changes })).toThrow(MappingError);
  });
  it('rejects duplicate keys, nonfinite numbers, missing fingerprints and oversized text', () => {
    expect(() => parsePropensityMapping('{"schema":1,"sch\\u0065ma":2}', binding)).toThrow(/Duplicate/);
    expect(() => parsePropensityMapping(JSON.stringify(companion()).replace('"lower":-1', '"lower":-1e999'), binding)).toThrow(/finite/);
    expect(() => parsePropensityMapping('{', binding)).toThrow(/Invalid JSON/);
    expect(() => parsePropensityMapping(JSON.stringify(companion()), { ...binding, sourceSha256: undefined })).toThrow(/does not match/);
    expect(() => parsePropensityMapping(' '.repeat(MAPPING_LIMITS.bytes + 1), binding)).toThrow(/256 KiB/);
  });
  it('prepares a fingerprinted template with deliberately empty domain, context and bins', () => {
    const template = mappingTemplate(binding);
    expect(template).toMatchObject({ ...binding, schema: MAPPING_SCHEMA, inputDomain: '', method: '', bins: [] });
    expect(() => parse(template)).toThrow(/Explicitly choose/);
  });
});
