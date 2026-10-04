/** Bounded, read-only catalogue import. Output is a draft snapshot outside the public tree.
 * node scripts/import-insales.mjs --mapping /private/mapping.json --output /private/drafts.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InSalesError } from '../commerce/insales.mjs';
import { loadInSalesDrafts } from '../commerce/insales-catalog.mjs';
import { categories } from '../storefront/settings.mjs';

export async function importInSalesDrafts({ mappingPath, outputPath, reader: suppliedReader } = {}) {
  if (typeof mappingPath !== 'string' || typeof outputPath !== 'string') throw new TypeError('Mapping and output paths are required');
  const output = path.resolve(outputPath), root = fileURLToPath(new URL('../', import.meta.url));
  // Refuse the git/site tree entirely, even its current private folders, so future allowlist
  // edits cannot accidentally publish source records or overwrite the live catalogue.
  const parent = await fs.realpath(path.dirname(output));
  const relative = path.relative(await fs.realpath(root), parent);
  if (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)) throw new TypeError('Output must be outside the website repository');
  const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));
  const result = await loadInSalesDrafts({ mapping, allowedCategories: categories.map(c => c.id), reader: suppliedReader });
  if (!result.ok) return { ok: false, summary: result.summary, errors: result.errors, published: false, checkoutEnabled: false };
  await fs.writeFile(path.join(parent, path.basename(output)), JSON.stringify(result.catalog, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  return { ok: true, summary: result.summary, published: false, checkoutEnabled: false };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--mapping' || args[2] !== '--output') throw new TypeError('Usage: --mapping PRIVATE_MAPPING_JSON --output PRIVATE_DRAFT_JSON');
  const result = await importInSalesDrafts({ mappingPath: args[1], outputPath: args[3] });
  (result.ok ? process.stdout : process.stderr).write(JSON.stringify(result) + '\n');
  if (!result.ok) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Never print a provider response, transport stack, source URL, or credentials.
    const message = error instanceof InSalesError || error instanceof TypeError ? error.message : 'Import could not finish; no live catalogue was changed.';
    process.stderr.write(message + '\n'); process.exitCode = 1;
  });
}
