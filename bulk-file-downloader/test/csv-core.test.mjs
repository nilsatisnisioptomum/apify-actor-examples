import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CsvError, MAX_FILE_BYTES, MAX_RECORDS, MAX_COLUMNS, MAX_JOBS,
  MAX_FILENAME_LENGTH, parseCsv, suggestColumns, checkImageUrl,
  planImages, imageJobCsv,
} from '../recipes/csv-core.js';

// A planner test must never reach a real site, start a run or use an account.
globalThis.fetch = () => { throw new Error('Unexpected network access in offline planner tests'); };

const simple = text => parseCsv(`SKU,URL,Handle\n${text}`);
const plan = (text, options = {}) => planImages(simple(text), { urlColumn: 1, skuColumn: 0, handleColumn: 2, ...options });
const errorCode = (fn, code) => assert.throws(fn, error => error instanceof CsvError && error.code === code && !/[<>]/.test(error.message));

test('BOM, CRLF, escaped quotes and embedded newlines retain indexed values', () => {
  const parsed = parseCsv('\uFEFFSKU,Image URL,Title\r\n001,"https://cdn.example.org/a.jpg?size=2,3","A ""quoted""\r\ntitle"\r\n');
  assert.equal(parsed.delimiter, ',');
  assert.deepEqual(parsed.headers, ['SKU', 'Image URL', 'Title']);
  assert.deepEqual(parsed.records, [{ recordNumber: 2, cells: ['001', 'https://cdn.example.org/a.jpg?size=2,3', 'A "quoted"\r\ntitle'] }]);
});

for (const delimiter of [';', '\t']) {
  test(`detects ${delimiter === ';' ? 'semicolon' : 'tab'} outside quoted header cells`, () => {
    const parsed = parseCsv(`SKU${delimiter}"Image URL"${delimiter}"Name, with comma"\n0001${delimiter}https://example.org/image.png${delimiter}Item`);
    assert.equal(parsed.delimiter, delimiter);
    assert.equal(parsed.records[0].cells[0], '0001');
    assert.equal(parsed.records[0].cells[2], 'Item');
  });
}

test('blank records are counted and logical record numbers survive quoted line breaks', () => {
  const parsed = parseCsv('SKU,URL,Title\n1,https://example.org/a,"two\nlines"\n\n2,https://example.org/b,last\n,,\n');
  assert.deepEqual(parsed.records.map(row => row.recordNumber), [2, 4]);
  assert.equal(parsed.skippedBlankRecords, 2);
});

test('prototype-like header names cannot overwrite or change indexed data', () => {
  const parsed = parseCsv('__proto__,constructor,URL\n001,second,https://example.org/image');
  assert.deepEqual(parsed.records[0].cells, ['001', 'second', 'https://example.org/image']);
  assert.equal(planImages(parsed, { urlColumn: 2, skuColumn: 0 }).jobs[0].fileName, '001');
  assert.equal(Object.prototype.polluted, undefined);
});

test('duplicate and Unicode-equivalent headers block ambiguous data', () => {
  for (const source of ['A,A (2),A\nx,y,z', 'SKU, sku \na,b', 'ＳＫＵ,SKU\na,b']) {
    errorCode(() => parseCsv(source), 'DUPLICATE_HEADER');
  }
});

test('unclosed quoted field fails without returning a partial plan', () => {
  errorCode(() => parseCsv('SKU,URL\n1,"https://example.org/a'), 'UNCLOSED_QUOTE');
});

test('text after a quoted field is rejected rather than silently joining the URL', () => {
  errorCode(() => parseCsv('SKU,URL\n1,"https://example.org/a"junk'), 'MALFORMED_QUOTE');
});

test('quote inside an unquoted field and space before an opening quote are rejected', () => {
  for (const value of ['ab"cd', ' "quoted"']) errorCode(() => parseCsv(`SKU,URL\n1,${value}`), 'MALFORMED_QUOTE');
});

test('extra or missing fields block export and identify the logical record', () => {
  for (const row of ['1,https://example.org/a,discarded', '1']) {
    assert.throws(() => parseCsv(`SKU,URL\n${row}`), error => error.code === 'FIELD_COUNT' && error.recordNumber === 2);
  }
});

test('empty file, empty header and ambiguous separators have clear bounded errors', () => {
  errorCode(() => parseCsv(''), 'EMPTY_FILE');
  errorCode(() => parseCsv('SKU,,URL\n1,x,y'), 'EMPTY_HEADER');
  errorCode(() => parseCsv('SKU;URL,Title\n1;x,y'), 'AMBIGUOUS_DELIMITER');
});

test('UTF-16-looking NULs and replacement characters require a UTF-8 export', () => {
  for (const text of ['S\u0000K\u0000U\u0000,\u0000U\u0000R\u0000L', 'SKU,URL\n\ufffd,https://example.org/a']) {
    errorCode(() => parseCsv(text), 'TEXT_ENCODING');
  }
});

test('UTF-8 file byte limit rejects multibyte input rather than counting code units', () => {
  const source = `SKU,URL\n${'é'.repeat(MAX_FILE_BYTES / 2)},https://example.org/a`;
  assert(source.length < MAX_FILE_BYTES);
  errorCode(() => parseCsv(source), 'FILE_TOO_LARGE');
});

test('exact file byte limit is accepted with a valid one-column record', () => {
  const source = `SKU\n${'x'.repeat(MAX_FILE_BYTES - 4)}`;
  assert.equal(new TextEncoder().encode(source).byteLength, MAX_FILE_BYTES);
  assert.equal(parseCsv(source).records.length, 1);
});

test('record bound includes blank data records and never truncates', () => {
  const exact = parseCsv(`SKU\n${'\n'.repeat(MAX_RECORDS)}`);
  assert.equal(exact.skippedBlankRecords, MAX_RECORDS);
  errorCode(() => parseCsv(`SKU\n${'\n'.repeat(MAX_RECORDS + 1)}`), 'TOO_MANY_RECORDS');
});

test('column bound rejects the 51st column', () => {
  assert.equal(parseCsv(Array.from({ length: MAX_COLUMNS }, (_, i) => `C${i}`).join(',')).headers.length, MAX_COLUMNS);
  errorCode(() => parseCsv(Array.from({ length: MAX_COLUMNS + 1 }, (_, i) => `C${i}`).join(',')), 'TOO_MANY_COLUMNS');
});

test('Shopify current and legacy aliases return all candidates without guessing', () => {
  const headers = ['Product image URL', 'Variant image URL', 'SKU', 'URL handle', 'Image Src', 'Variant SKU', 'Handle', 'URL'];
  assert.deepEqual(suggestColumns(headers), { url: [0, 1, 4, 7], sku: [2, 5], handle: [3, 6] });
  assert.deepEqual(suggestColumns(['not an image', 'price']), { url: [], sku: [], handle: [] });
});

test('column indices require explicit selection and distinct valid fields', () => {
  const parsed = simple('1,https://example.org/a,item');
  errorCode(() => planImages(parsed), 'INVALID_COLUMN');
  errorCode(() => planImages(parsed, { urlColumn: 5 }), 'INVALID_COLUMN');
  errorCode(() => planImages(parsed, { urlColumn: '1' }), 'INVALID_COLUMN');
  errorCode(() => planImages(parsed, { urlColumn: 1, skuColumn: 1 }), 'COLUMN_CONFLICT');
  errorCode(() => planImages(parsed, { urlColumn: 1, dedupe: 'yes' }), 'INVALID_POLICY');
});

test('valid Actor input uses the downloaded schema and preserves product mapping', () => {
  const output = plan('001,https://cdn.example.org/a.png,first\n002,https://cdn.example.org/a.png,second');
  assert.deepEqual(JSON.parse(JSON.stringify(output.actorInput)), {
    urls: [{ url: 'https://cdn.example.org/a.png', fileName: '001' }, { url: 'https://cdn.example.org/a.png', fileName: '002' }],
    maxFiles: 2, createZip: true, onlyImages: true, dedupe: false,
  });
  assert.deepEqual(Object.keys(output.actorInput).sort(), ['createZip', 'dedupe', 'maxFiles', 'onlyImages', 'urls']);
  for (const forbidden of ['csvUrl', 'datasetId', 'token', 'maxTotalChargeUsd', 'headers']) assert(!(forbidden in output.actorInput));
});

test('invalid schemes, credentials, multiple whitespace-separated URLs and controls are rejected', () => {
  const bad = [
    'javascript:alert(1)', 'data:image/png;base64,AAAA', 'file:///tmp/a.png', 'ftp://example.org/a',
    'https://user:password@example.org/a', 'https://user@example.org/a',
    'https://example.org/a https://example.org/b', 'https://example.org/a\nb',
    'https://example.org\\a', 'https://example.org/a%zz', 'https://example.org/<script>',
    'https://example.org/\u0085x', 'https://example.org/a?sig=\u202ex',
    `https://example.org/${'x'.repeat(8192)}`,
  ];
  for (const url of bad) assert.equal(checkImageUrl(url).ok, false, url);
});

test('local/private literal hosts include numeric disguises and mapped IPv6', () => {
  for (const host of ['localhost', 'localhost.', 'localhost..', 'a.localhost', 'printer.local', 'intranet', '10.0.0.1', '127.0.0.1', '2130706433', '0x7f000001', '0177.0.0.1', '192.168.1.2', '172.16.2.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '[::1]', '[::]', '[fc00::1]', '[fe80::1]', '[fec0::1]', '[::ffff:127.0.0.1]']) {
    assert.equal(checkImageUrl(`http://${host}/image`).ok, false, host);
  }
});

test('public HTTP/HTTPS names and public literal IPs pass syntax checks only', () => {
  for (const url of ['https://cdn.example.org/a', 'HTTP://example.org:8080/a', 'https://8.8.8.8/a', 'https://[2001:4860:4860::8888]/a']) {
    assert.deepEqual(checkImageUrl(url), { ok: true, url });
  }
});

test('signed queries, URL case, percent encoding, commas and fragments are never rewritten', () => {
  const url = 'HTTPS://CDN.Example.org/Img%2fA.png?sig=a%2Fb%2B%3D&width=100,200&next=https%3A%2F%2Fexample.org#part';
  const output = plan(`001,"${url}",item`);
  assert.equal(output.jobs[0].url, url);
  assert.equal(output.actorInput.urls[0].url, url);
  assert.equal(output.summary.planned, 1);
});

test('legal URL commas are never treated as a multi-image list or rewritten', () => {
  for (const url of ['https://one.example/a.jpg,https://two.example/b.jpg', 'https://cdn.example.org/a?images=https://one.example/a,https://two.example/b']) {
    assert.deepEqual(checkImageUrl(url), { ok: true, url });
    const output = plan(`001,"${url}",item`);
    assert.equal(output.actorInput.urls[0].url, url);
    assert.equal(output.jobs.length, 1);
  }
});

test('missing and invalid image records remain in original data and reconcile counts', () => {
  const parsed = simple('001,,one\n002,not-a-url,two\n003,https://example.org/a,three');
  const before = structuredClone(parsed);
  const output = planImages(parsed, { urlColumn: 1, skuColumn: 0 });
  assert.deepEqual(parsed, before);
  assert.deepEqual(output.issues.map(issue => [issue.recordNumber, issue.code]), [[2, 'MISSING_URL'], [3, 'INVALID_URL']]);
  assert.equal(output.summary.records, output.summary.planned + output.summary.missing + output.summary.invalid + output.summary.duplicatesSkipped);
  assert.equal(output.summary.planned, 1);
});

test('shared URLs and fragment variants are kept by default for separate SKUs', () => {
  const output = plan('001,https://example.org/a#first,one\n002,https://example.org/a#second,two');
  assert.equal(output.jobs.length, 2);
  assert.equal(output.summary.sharedUrls, 1);
  assert.equal(output.summary.duplicatesSkipped, 0);
  assert.equal(output.issues[0].code, 'SHARED_URL');
  assert.equal(output.actorInput.dedupe, false);
  assert.deepEqual(output.jobs.map(job => job.fileName), ['001', '002']);
});

test('explicit dedupe retains the first record, ignores fragments and keeps query variants', () => {
  const output = plan('001,https://example.org/a#first,one\n002,https://example.org/a#second,two\n003,https://example.org/a?v=2,three', { dedupe: true });
  assert.equal(output.summary.duplicatesSkipped, 1);
  assert.deepEqual(output.jobs.map(job => job.recordNumber), [2, 4]);
  assert.equal(output.actorInput.maxFiles, 2);
  assert.equal(output.actorInput.dedupe, false);
});

test('repeated SKU image rows, missing SKU handles and automatic names are deterministic', () => {
  const output = plan('SKU,https://example.org/a,one\nsku,https://example.org/b,two\n,https://example.org/c,my-handle\n,https://example.org/d,');
  assert.deepEqual(output.jobs.map(job => job.fileName), ['SKU', 'sku-2', 'my-handle', 'image-0004']);
  assert.equal(output.summary.renamed, 1);
});

test('natural suffix collisions cannot overwrite another filename', () => {
  const output = plan('A,https://example.org/a,\na-2,https://example.org/b,\nA,https://example.org/c,\na,https://example.org/d,');
  assert.deepEqual(output.jobs.map(job => job.fileName), ['A', 'a-2', 'A-3', 'a-4']);
  assert.equal(new Set(output.jobs.map(job => job.fileName.toLowerCase())).size, 4);
});

test('filename stems reject paths, controls, reserved Windows names and guessed extensions', () => {
  const parsed = simple('"../../bad\\path\u0001:name.jpg",https://example.org/a,\nCON,https://example.org/b,\n"💡'.concat('x'.repeat(150), '",https://example.org/c,'));
  const jobs = planImages(parsed, { urlColumn: 1, skuColumn: 0 }).jobs;
  assert(jobs[0].fileName.includes('name_jpg'));
  assert(!/[.\u0000-\u001f/\\?%*:|"<>]/.test(jobs[0].fileName));
  assert.equal(jobs[1].fileName, 'image-CON');
  for (const job of jobs) assert(Array.from(job.fileName).length <= MAX_FILENAME_LENGTH);
  assert(!jobs[2].fileName.includes('\ufffd'));
});

test('bidirectional and zero-width controls cannot spoof filenames or mutate original SKU data', () => {
  const sku = 'product\u202eexe\u202c\u2066.jpg\u2069\u200b\ufeff';
  const parsed = simple(`"${sku}",https://example.org/a,`);
  const before = structuredClone(parsed);
  const output = planImages(parsed, { urlColumn: 1, skuColumn: 0 });
  assert(!/[\u202a-\u202e\u2066-\u2069\u200b\ufeff]/.test(output.actorInput.urls[0].fileName));
  assert.equal(output.jobs[0].sku, sku);
  assert.deepEqual(parsed, before);
});

test('job CSV quotes fields and neutralizes human spreadsheet formulas without changing Actor values', () => {
  const output = plan('"=HYPERLINK(""https://evil.example"",""x"")",https://example.org/a,"@SUM(1,2)"\n"\t+1",https://example.org/b,"multi\nline"');
  const csv = parseCsv(output.jobCsv);
  assert.equal(csv.records[0].cells[3], '\'=HYPERLINK("https://evil.example","x")');
  assert.equal(csv.records[0].cells[4], "'@SUM(1,2)");
  assert.equal(csv.records[1].cells[3], "'\t+1");
  assert.equal(csv.records[1].cells[4], 'multi\nline');
  assert.equal(output.jobs[0].sku, '=HYPERLINK("https://evil.example","x")');
  assert.equal(output.actorInput.urls[0].fileName.startsWith("'"), false);
  assert.equal(csv.headers[0], 'source_record');
});

test('HTML-looking product values stay plain data and do not become markup templates', () => {
  const output = plan('"<img src=x onerror=alert(1)>",https://example.org/a,"<script>bad()</script>"');
  assert.equal(output.jobs[0].sku, '<img src=x onerror=alert(1)>');
  assert.equal(parseCsv(output.jobCsv).records[0].cells[4], '<script>bad()</script>');
  assert(!/[<>]/.test(output.actorInput.urls[0].fileName));
});

test('zero valid images produce no runnable Actor input', () => {
  const output = plan('001,,one\n002,no,two');
  assert.equal(output.actorInput, null);
  assert.equal(output.jobs.length, 0);
  assert.equal(parseCsv(output.jobCsv).records.length, 0);
  assert.equal(imageJobCsv([]), '"source_record","url","file_name","sku","handle"\r\n');
});

test('1,000 accepted jobs are allowed and the 1,001st blocks rather than silently capping', () => {
  const rows = Array.from({ length: MAX_JOBS }, (_, index) => `${String(index).padStart(4, '0')},https://example.org/${index},`);
  const exact = plan(rows.join('\n'));
  assert.equal(exact.jobs.length, 1000);
  assert.equal(exact.actorInput.maxFiles, 1000);
  assert(MAX_JOBS <= 5000, 'the Actor schema maxFiles maximum is 5,000');
  errorCode(() => plan([...rows, 'extra,https://example.org/extra,'].join('\n')), 'TOO_MANY_JOBS');
});
