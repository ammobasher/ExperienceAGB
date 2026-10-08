import { describe, expect, it } from 'vitest';
import { parseSplit } from './split';

describe('fail-closed split grammar', () => {
  it.each([
    'Channel in ["Web,Store]',
    'Channel in ["Web\']',
    'Channel in [Web,]',
    'Channel in [,Web]',
    'Channel in ["Web"extra]',
    'Channel in ["a\\q"]',
    'Channel in [""]',
    'Age >= 35',
    'Age < 1e999',
  ])('rejects ambiguous or unsupported syntax: %s', (raw) => {
    expect(parseSplit(raw).operator).toBe('unknown');
  });

  it('decodes quoted escapes and preserves quoted category identity', () => {
    expect(parseSplit('Channel in [" Web ", "a\\"b", "x,y", \'Store\']')).toMatchObject({
      operator: 'in',
      categories: [' Web ', 'a"b', 'x,y', 'Store'],
    });
  });

  it.each(['Age < 35', 'Age<-3.5e2', 'Age < +.5'])('supports finite numeric thresholds: %s', (raw) => {
    expect(parseSplit(raw).operator).toBe('lt');
  });

  it('supports explicit missing and categorical brackets and braces', () => {
    expect(parseSplit('Age is Missing').operator).toBe('missing');
    expect(parseSplit('Channel in {Web, Store}').categories).toEqual(['Web', 'Store']);
  });
});
