import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { assertPrivateCorpusOutput } from '../../e2e/privateCorpusOutput';

describe('private corpus artifact containment', () => {
  const root = process.cwd();
  it.each([undefined, root, join(root, 'test-results'), join(root, '..private-results')])('rejects missing or in-repository output: %s', output => {
    expect(() => assertPrivateCorpusOutput(root, output)).toThrow(/outside the repository/);
  });
  it('permits a true parent or sibling directory', () => {
    expect(() => assertPrivateCorpusOutput(root, dirname(root))).not.toThrow();
    expect(() => assertPrivateCorpusOutput(root, join(dirname(root), 'private-evidence'))).not.toThrow();
  });
});
