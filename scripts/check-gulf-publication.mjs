// Read-only release check: local CDD, TPN, static demo, portfolio copy and assets.
// node scripts/check-gulf-publication.mjs <TPN root> <demo root> <portfolio root>
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

assert.equal(process.argv.length, 5, 'Provide exactly three inspected local roots.');
const [tpn, demo, portfolio] = process.argv.slice(2).map(p => resolve(p));
const cdd = fileURLToPath(new URL('../', import.meta.url));
const read = (root, file) => readFileSync(resolve(root, file), 'utf8');
const json = (root, file) => JSON.parse(read(root, file));
const norm = text => text.replace(/\r\n/g, '\n');
let checks = 0;
const equal = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
const near = (a, b, message) => ok(Number.isFinite(a) && Math.abs(a - b) < 1e-7, message);

const run = spawnSync(process.execPath, [resolve(cdd, 'scripts/check-gulf-baseline.mjs'), tpn, '--check-runtime'], { encoding: 'utf8' });
assert.equal(run.status, 0, run.stderr || run.stdout);
const calculation = JSON.parse(run.stdout);
const baseline = json(cdd, 'cases/gulf-hospitality-baseline.json');
const marginPage = read(cdd, 'margin.html');
for (const [id, value] of Object.entries({ 'in-revenue': '144000', 'in-direct': '79200', 'in-trade': '12600', 'in-deal': '10800', 'in-contingency': '5400', 'in-min': '28800' })) {
  ok(marginPage.split('\n').some(line => line.includes(`id="${id}"`) && line.includes(`placeholder="如 ${value}`)), `margin input example matches baseline: ${id}`);
}
equal(calculation.result, 'PASS', 'canonical/runtime calculation passes');
equal(json(demo, 'cases/gulf-hospitality-baseline.json'), baseline, 'demo canonical data parity');
for (const file of ['index.html', 'navigator.js', 'landed.js', 'cases.js', 'pack.js', 'i18n.js', 'styles.css', 'cases/gulf-hospitality-baseline.json', 'cases/gulf-hospitality-baseline.js']) {
  equal(norm(read(tpn, file)), norm(read(demo, file)), `static demo runtime parity: ${file}`);
}

const manifest = json(portfolio, 'public/images/gulf-hospitality-case-manifest.json');
equal(manifest.caseBaseline, calculation.baseline, 'publication version');
equal([manifest.quantity, manifest.pricePerUnitUsd, manifest.incoterm, manifest.revenueUsd], [baseline.quantity, baseline.pricePerUnitUsd, baseline.incoterm, calculation.economics.revenue], 'publication input/revenue');
equal(manifest.costsUsd, { goods: calculation.economics.directCost, tradeLogistics: calculation.economics.tradeCost, dealSpecific: calculation.economics.dealSpecificCost, contingency: calculation.economics.contingency }, 'publication cost totals');
for (const [field, actual] of Object.entries({ beforeFunding: calculation.beforeFundingContribution, funding: calculation.fundingCost, afterFunding: calculation.afterFundingContribution, minimum: calculation.economics.minimumNetContribution, headroom: calculation.headroom, sellerBorneImportDutyNet: calculation.sellerBorneImportDuty.net })) {
  near(manifest.resultsUsd[field], actual, `publication computed result: ${field}`);
}
near(manifest.concessionLimitPct, calculation.concessionLimitPct, 'publication concession result');
ok(calculation.concession3Pct.headroom > 0 && calculation.concession3Pct.headroom < 25, '3% is approximate, not the exact floor');
ok(calculation.sellerBorneImportDuty.belowMinimum, 'seller import duty crosses the minimum');

for (const [file, metadata] of Object.entries(manifest.assets)) {
  const bytes = readFileSync(resolve(portfolio, 'public/images', file));
  equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256, `reviewed asset fingerprint: ${file}`);
  if (file.endsWith('.png')) {
    equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `PNG signature: ${file}`);
    equal([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], [metadata.width, metadata.height], `PNG dimensions: ${file}`);
  } else {
    const svg = bytes.toString('utf8');
    ok(svg.includes('144,000') && svg.includes('36,000'), `SVG revenue and pre-funding contribution: ${file}`);
    ok(!/480,000|120,000/.test(svg), `no old Gulf values in SVG: ${file}`);
  }
}

const oneDeal = read(portfolio, 'src/components/OneDeal.jsx');
ok(oneDeal.includes('讓價約 3% 即到最低要求') && oneDeal.includes('about 3%'), 'bilingual approximate concession wording');
for (const amount of ['144,000', '36,000', '33,144', '28,800', '4,344']) ok(oneDeal.includes(amount), `OneDeal displayed amount ${amount}`);
const i18n = read(portfolio, 'src/i18n.jsx');
ok(i18n.includes('144,000 USD') && i18n.includes('USD 144,000') && i18n.includes('36,000 USD') && i18n.includes('USD 36,000'), 'bilingual snapshot labels');
const works = read(portfolio, 'src/data/works.js');
ok(works.includes('讓價約 3% 即到最低要求') && works.includes('about 3%'), 'work card concession wording');
ok(works.includes('33,144') && works.includes('USD 36,000'), 'work card funded/pre-funding amounts');
for (const [file, text] of [['OneDeal.jsx', oneDeal], ['i18n.jsx', i18n], ['works.js', works]]) {
  ok(!/480,000|110,480|31,574|48 萬美元|12 萬美元資金成本前/.test(text), `no retired Gulf display amounts in scoped file: ${file}`);
}
const tpnCopy = read(tpn, 'i18n.js');
ok(tpnCopy.includes('not a full DDP quote') && tpnCopy.includes('淨貢獻會低於最低要求'), 'duty switch remains a limited sensitivity, not a full DDP quote');

console.log(JSON.stringify({ result: 'PASS', checks, canonicalRuntimeChecks: calculation.checks, baseline: calculation.baseline, scope: 'LOCAL_ONLY_NO_PUBLICATION', visualReviewRequiredSeparately: true }, null, 2));
