import { resolve, relative, isAbsolute, sep } from 'node:path';

export function assertPrivateCorpusOutput(repositoryRoot: string, output?: string): void {
  const outputRelative = output ? relative(resolve(repositoryRoot), resolve(output)) : '';
  if (!output || (!isAbsolute(outputRelative) && outputRelative !== '..' && !outputRelative.startsWith(`..${sep}`))) {
    throw new Error('Private corpus runs require E2E_OUTPUT_DIR outside the repository.');
  }
}
