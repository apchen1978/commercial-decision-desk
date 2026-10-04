// Test the actual UI formatter in isolation; no Decision Core or fixture mutation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const start = app.indexOf('function contextQuantityDisplay(');
const end = app.indexOf('\nfunction contextStatus(', start);
assert.ok(start >= 0 && end > start, 'actual UI formatter found');
const source = app.slice(start, end);
const format = (language, qty, unit) => runInNewContext(`${source}\ncontextQuantityDisplay(qty, unit)`, {
  language, qty, unit,
  tx: key => key === 'context.unknown' ? 'UNKNOWN' : 'unit UNKNOWN',
});
let checks = 0;
const check = (actual, expected, label) => { assert.equal(actual, expected, label); checks++; };
check(format('zh-TW', 12000, 'metres'), '12,000 米', 'Traditional Chinese quantity');
check(format('en', 12000, 'metres'), '12,000 metres', 'English quantity');
check(format('zh-TW', '12000', 'metres'), '12,000 米', 'numeric input string');
check(format('en', 12345.5, 'units'), '12,345.5 units', 'fractional quantity preserved');
check(format('zh-TW', 12000, '組'), '12,000 組', 'other unit preserved');
check(format('en', 0, 'metres'), '0 metres', 'zero not confused with missing');
check(format('en', 12000, ''), '12,000 (unit UNKNOWN)', 'missing unit stays UNKNOWN');
check(format('en', '', 'metres'), 'UNKNOWN', 'unit alone does not invent quantity');
check(format('en', null, null), 'UNKNOWN', 'missing quantity');
check(format('en', 'UNKNOWN', 'metres'), 'UNKNOWN metres', 'nonnumeric value not coerced');
console.log(`Quantity display tests: ${checks}/${checks} PASS`);
