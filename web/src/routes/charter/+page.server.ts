import type { PageServerLoad } from './$types';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { marked } from 'marked';

export const load: PageServerLoad = async () => {
  try {
    const candidatePaths = [
      resolve(process.cwd(), '../docs/CHARTER.md'),
      resolve(process.cwd(), 'docs/CHARTER.md'),
      resolve(process.cwd(), '../../docs/CHARTER.md'),
    ];

    const foundPath = candidatePaths.find((p) => existsSync(p));
    if (foundPath) {
      const charterMd = readFileSync(foundPath, 'utf8');
      const charterHtml = await marked(charterMd);
      return { charterHtml };
    }
    return { charterHtml: '<p>The Pan-African Charter is available at /docs/CHARTER.md.</p>' };
  } catch {
    return { charterHtml: '<p>Charter loading…</p>' };
  }
};
