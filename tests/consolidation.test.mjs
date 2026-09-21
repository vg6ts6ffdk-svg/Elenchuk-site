import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { publicFiles, servicePages } from '../public-files.mjs';

test('source pages use approved RU/EN masters without relying on build-time replacement', () => {
  let checked = 0;
  for (const file of servicePages) {
    const html = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    if (!html.includes('site-header')) continue;
    const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0] || '';
    const footer = html.match(/<footer\b[\s\S]*?<\/footer>/)?.[0] || '';
    assert.match(header, /src="assets\/brand\/rosin-wordmark\.svg"/, file);
    assert.match(footer, /src="assets\/brand\/roseen-wordmark\.svg"/, file);
    assert.doesNotMatch(header + footer, /logo-approved\.svg|brand-wordmark/, file);
    assert.match(html, /rel="icon"[^>]*href="favicon\.svg"/, file);
    checked++;
  }
  assert.equal(checked, 15);
});

test('consolidated CC1 experiments and retired templates are not public assets', () => {
  for (const file of ['prototypes/cc1-exploded-scroll.html', 'prototypes/cc1-exploded-scroll.js', 'prototypes/cc1-exploded-scroll-v2.html', 'prototypes/cc1-exploded-scroll-v2.js']) {
    assert.ok(fs.existsSync(new URL('../' + file, import.meta.url)), file);
    assert.ok(!publicFiles.includes(file), file);
  }
  assert.ok(!fs.existsSync(new URL('../page-template.html', import.meta.url)));
});
