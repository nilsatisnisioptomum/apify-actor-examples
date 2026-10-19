import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, prepareCsv } from '../recipes/prepare_local_csv.js';
import { MAX_FILE_BYTES } from '../recipes/csv-core.js';

globalThis.fetch = () => { throw new Error('Unexpected network access in offline CSV tests'); };
const cli = fileURLToPath(new URL('../recipes/prepare_local_csv.js', import.meta.url));
const guard = 'data:text/javascript,' + encodeURIComponent(`
  const forbid = () => { throw new Error('Network forbidden in local CSV CLI test'); };
  globalThis.fetch = forbid;
  for (const name of ['node:http', 'node:https']) {
    const module = await import(name); module.default.request = forbid; module.default.get = forbid;
  }
  const net = await import('node:net'); net.default.connect = forbid; net.default.createConnection = forbid;
  const tls = await import('node:tls'); tls.default.connect = forbid;
`);
function command(args, cwd) {
  return spawnSync(process.execPath, ['--import', guard, cli, ...args], {
    cwd, env: { ...process.env, APIFY_TOKEN: '' }, encoding: 'utf8', timeout: 5000,
  });
}
async function setup(t, text = 'SKU,Image URL\n001,https://cdn.example.org/image.svg\n') {
  const dir = await mkdtemp(join(tmpdir(), 'local-csv-input-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, 'products.csv');
  await writeFile(input, text);
  return { dir, input, output: join(dir, 'actor-input.json') };
}

test('actual CLI preview reads a local file without a token, network or output', async t => {
  const { dir, input } = await setup(t);
  const result = command([input], dir);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /Preview only; no file created, API calls or Actor run/);
  assert.match(result.stdout, /"planned": 1/);
  assert(!result.stdout.includes('https://cdn.example.org'), 'preview need not expose source URLs in terminal output');
  assert.deepEqual(await readdir(dir), ['products.csv']);
});

test('actual CLI exports exact signed URLs, leading-zero SKUs and shared-image jobs', async t => {
  const url = 'HTTPS://CDN.Example.org/img%2fA.svg?sig=a%2Fb%2B%3D&width=1,2#part';
  const { dir, input, output } = await setup(t, `SKU,Image URL\n001,"${url}"\n002,"${url}"\n`);
  const original = await readFile(input);
  const result = command([input, '--output', output], dir);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /Saved local Actor input only; no API calls or Actor run/);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), {
    urls: [{ url, fileName: '001' }, { url, fileName: '002' }],
    maxFiles: 2, createZip: true, onlyImages: true, dedupe: false,
  });
  assert.deepEqual(await readFile(input), original);
  if (process.platform !== 'win32') assert.equal((await stat(output)).mode & 0o777, 0o600);
});

test('ambiguous image and filename mappings require an explicit exact header', async t => {
  const { dir, input, output } = await setup(t, 'SKU,Variant SKU,Image URL,Variant image URL\n001,002,https://example.org/a,https://example.org/b\n');
  await assert.rejects(prepareCsv({ input, output }), /Choose --url-column explicitly/);
  await assert.rejects(prepareCsv({ input, output, urlColumn: 'Variant image URL' }), /Choose --name-column explicitly/);
  await assert.rejects(prepareCsv({ input, output, urlColumn: 'not a header' }), /Unknown image-link header/);
  assert.deepEqual(await readdir(dir), ['products.csv']);
  const result = command([input, '--url-column', 'Variant image URL', '--name-column', 'Variant SKU', '--output', output], dir);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')).urls, [{ url: 'https://example.org/b', fileName: '002' }]);
});

test('unrecognized headers can be selected explicitly and absent names use numbering', async t => {
  const { input, output } = await setup(t, 'Picture,Title\nhttps://example.org/a,Sample\n');
  await assert.rejects(prepareCsv({ input }), /Choose --url-column explicitly/);
  const result = await prepareCsv({ input, output, urlColumn: 'Picture' });
  assert.equal(result.columns.filename, null);
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')).urls, [{ url: 'https://example.org/a', fileName: 'image-0001' }]);
});

test('preview diagnoses skipped records but export fails closed without a partial file', async t => {
  const { dir, input, output } = await setup(t, 'SKU,URL\n001,https://example.org/a\n002,\n003,not-a-url\n');
  const preview = await prepareCsv({ input });
  assert.deepEqual([preview.summary.planned, preview.summary.missing, preview.summary.invalid], [1, 1, 1]);
  assert.deepEqual(preview.diagnostics.map(issue => [issue.recordNumber, issue.code]), [[3, 'MISSING_URL'], [4, 'INVALID_URL']]);
  const result = command([input, '--output', output], dir);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /"recordNumber": 3/);
  assert.match(result.stderr, /partial plans are not saved/);
  assert.deepEqual(await readdir(dir), ['products.csv']);
});

test('zero jobs, malformed CSV, invalid UTF-8 and oversized input never create output', async t => {
  const { dir, input, output } = await setup(t);
  for (const text of ['SKU,URL\n', 'SKU,URL\n1,"unclosed', Buffer.from([0xff, 0xfe, 0x61]), Buffer.alloc(MAX_FILE_BYTES + 1, 0x61)]) {
    await writeFile(input, text);
    await assert.rejects(prepareCsv({ input, output }));
    assert.deepEqual(await readdir(dir), ['products.csv']);
  }
  await assert.rejects(prepareCsv({ input: dir, output }), /regular local file/);
});

test('existing output and an input/output path collision are never overwritten', async t => {
  const { input, output } = await setup(t);
  await writeFile(output, 'keep the old output');
  await assert.rejects(prepareCsv({ input, output }), { code: 'EEXIST' });
  assert.equal(await readFile(output, 'utf8'), 'keep the old output');
  const original = await readFile(input);
  await assert.rejects(prepareCsv({ input, output: input }), { code: 'EEXIST' });
  assert.deepEqual(await readFile(input), original);
});

test('CLI refuses paid-run/token options and repeated or missing arguments', () => {
  for (const args of [[], ['--run'], ['input.csv', '--run'], ['input.csv', '--token', 'fake'], ['input.csv', 'constructor', 'fake'], ['input.csv', '__proto__', 'fake'], ['input.csv', '--output'], ['input.csv', '--url-column', 'URL', '--url-column', 'Image URL']]) {
    assert.throws(() => parseArgs(args));
  }
  assert.deepEqual(parseArgs(['input.csv', '--url-column', 'Image URL', '--name-column', 'SKU', '--output', 'input.json']), {
    input: 'input.csv', urlColumn: 'Image URL', nameColumn: 'SKU', output: 'input.json',
  });
  const result = command(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No token, API call/);
});
