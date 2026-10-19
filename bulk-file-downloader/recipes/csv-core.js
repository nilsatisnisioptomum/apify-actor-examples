/**
 * Local-only product-image planning. The tokenizer follows the existing
 * csv-chart-previewer/csv.js approach, with strict quoting and indexed cells
 * so malformed exports and duplicate object keys cannot lose product data.
 * This module never fetches URLs, starts an Actor, or persists customer data.
 */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_RECORDS = 10000;
export const MAX_COLUMNS = 50;
export const MAX_JOBS = 1000;
export const MAX_URL_LENGTH = 8192;
export const MAX_FILENAME_LENGTH = 80;

export class CsvError extends Error {
  constructor(code, message, recordNumber) {
    super(message);
    this.name = 'CsvError';
    this.code = code;
    if (recordNumber !== undefined) this.recordNumber = recordNumber;
  }
}

function fail(code, message, recordNumber) {
  throw new CsvError(code, message, recordNumber);
}

function headerKey(value) {
  return value.trim().normalize('NFKC').toLowerCase();
}

function detectDelimiter(text) {
  const counts = new Map([[',', 0], [';', 0], ['\t', 0]]);
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (char === '\r' || char === '\n') break;
      if (counts.has(char)) counts.set(char, counts.get(char) + 1);
    }
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] && sorted[0][1] === sorted[1][1]) {
    fail('AMBIGUOUS_DELIMITER', 'The header has ambiguous separators. Export it as a comma, semicolon or tab-separated file.');
  }
  return sorted[0][1] ? sorted[0][0] : ',';
}

/** Parse logical CSV records; recordNumber includes the header as record 1. */
export function parseCsv(text) {
  if (typeof text !== 'string') fail('INVALID_INPUT', 'Choose a CSV or TSV text file.');
  if (new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES) {
    fail('FILE_TOO_LARGE', 'The file is larger than 2 MiB. Split it into smaller CSV files.');
  }
  const clean = text.replace(/^\uFEFF/, '');
  if (!clean.length) fail('EMPTY_FILE', 'The file is empty. Include a header and at least one product row.');
  if (/[\u0000\ufffd]/.test(clean)) {
    fail('TEXT_ENCODING', 'The file contains unreadable characters. Save or export it as UTF-8 CSV before continuing.');
  }
  const delimiter = detectDelimiter(clean);
  const rawRecords = [];
  let cells = [], cell = '', state = 'start';
  let recordNumber = 1;
  const endCell = () => {
    cells.push(cell);
    if (cells.length > MAX_COLUMNS) fail('TOO_MANY_COLUMNS', 'The file has more than 50 columns. Keep only the columns you need.', recordNumber);
    cell = '';
    state = 'start';
  };
  const endRecord = () => {
    endCell();
    rawRecords.push({ recordNumber, cells });
    if (rawRecords.length > MAX_RECORDS + 1) {
      fail('TOO_MANY_RECORDS', 'The file has more than 10,000 data records. Split it into smaller files.', recordNumber);
    }
    recordNumber++;
    cells = [];
  };
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (state === 'quoted') {
      if (char === '"') {
        if (clean[i + 1] === '"') { cell += '"'; i++; }
        else state = 'afterQuote';
      } else cell += char;
      continue;
    }
    if (char === delimiter) { endCell(); continue; }
    if (char === '\r' || char === '\n') {
      endRecord();
      if (char === '\r' && clean[i + 1] === '\n') i++;
      continue;
    }
    if (state === 'afterQuote') {
      fail('MALFORMED_QUOTE', 'A quoted field has text after its closing quote. Correct the CSV before continuing.', recordNumber);
    }
    if (char === '"') {
      if (state !== 'start') fail('MALFORMED_QUOTE', 'A quote appears inside an unquoted field. Correct the CSV before continuing.', recordNumber);
      state = 'quoted';
    } else { cell += char; state = 'unquoted'; }
  }
  if (state === 'quoted') fail('UNCLOSED_QUOTE', 'The file ends inside a quoted field. Close the quote before continuing.', recordNumber);
  if (cell.length || cells.length || state !== 'start') endRecord();
  if (!rawRecords.length) fail('EMPTY_FILE', 'The file is empty. Include a header and at least one product row.');
  const headers = rawRecords.shift().cells.map(value => value.trim());
  const seen = new Set();
  for (const name of headers) {
    if (!name) fail('EMPTY_HEADER', 'Each column needs a header. Name the empty header before continuing.', 1);
    const key = headerKey(name);
    if (seen.has(key)) fail('DUPLICATE_HEADER', 'Two columns have the same header. Give them distinct names before continuing.', 1);
    seen.add(key);
  }
  const records = [];
  let skippedBlankRecords = 0;
  for (const record of rawRecords) {
    if (record.cells.every(value => value.trim() === '')) { skippedBlankRecords++; continue; }
    if (record.cells.length !== headers.length) {
      fail('FIELD_COUNT', `Record ${record.recordNumber} has ${record.cells.length} fields; the header has ${headers.length}. Correct the row before continuing.`, record.recordNumber);
    }
    records.push(record);
  }
  return { headers, records, delimiter, skippedBlankRecords };
}

const COLUMN_ALIASES = {
  url: new Set(['url', 'image url', 'image src', 'product image url', 'variant image url']),
  sku: new Set(['sku', 'variant sku']),
  handle: new Set(['handle', 'url handle', 'product handle']),
};

/** Suggestions only: callers require the user to confirm zero-based indices. */
export function suggestColumns(headers) {
  const result = { url: [], sku: [], handle: [] };
  headers.forEach((name, index) => {
    const key = headerKey(name).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    for (const kind of Object.keys(result)) if (COLUMN_ALIASES[kind].has(key)) result[kind].push(index);
  });
  return result;
}

function privateIpv4(host) {
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b, c] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113);
}

function privateIpv6(host) {
  const value = host.slice(1, -1);
  const halves = value.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const parts = halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  const words = parts.map(part => Number.parseInt(part, 16));
  if (words.length !== 8 || words.some(value => !Number.isFinite(value))) return true;
  if ((words[0] & 0xfe00) === 0xfc00 || (words[0] & 0xffc0) === 0xfe80 || (words[0] & 0xffc0) === 0xfec0 || (words[0] & 0xff00) === 0xff00) return true;
  if (words[0] === 0x2001 && words[1] === 0x0db8) return true;
  if (words.slice(0, 6).every(word => word === 0)) return true;
  if (words.slice(0, 5).every(word => word === 0) && words[5] === 0xffff) {
    return privateIpv4(`${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`);
  }
  return false;
}

/** Syntax/literal-host checks only. No DNS, reachability or image verification. */
export function checkImageUrl(value) {
  const url = value.trim();
  if (!url) return { ok: false, code: 'MISSING_URL', message: 'No image URL in this record.' };
  if (url.length > MAX_URL_LENGTH) return { ok: false, code: 'INVALID_URL', message: 'The URL exceeds 8,192 characters.' };
  if (!/^https?:\/\//i.test(url) || /[\u0000-\u0020\u007f-\u009f\u200b\u2028-\u202e\u2066-\u2069\ufeff<>"\\]/.test(url) || /%(?![\da-f]{2})/i.test(url)) {
    return { ok: false, code: 'INVALID_URL', message: 'Use one complete HTTP or HTTPS image URL per cell.' };
  }
  let parsed;
  try { parsed = new URL(url); }
  catch { return { ok: false, code: 'INVALID_URL', message: 'The image URL is not a valid HTTP or HTTPS URL.' }; }
  if (parsed.username || parsed.password) return { ok: false, code: 'INVALID_URL', message: 'URLs containing a username or password are not supported.' };
  const host = parsed.hostname.toLowerCase().replace(/\.+$/, '');
  if (!host || host === 'localhost' || /\.(?:localhost|local|internal|lan|home)$/.test(host) ||
    (host.startsWith('[') ? privateIpv6(host) : privateIpv4(host) || !host.includes('.'))) {
    return { ok: false, code: 'INVALID_URL', message: 'Use a public URL, not a local or private address.' };
  }
  // Keep the supplied encoding, path, query order and fragment byte-for-byte.
  return { ok: true, url };
}

function filenameStem(value, fallback) {
  let stem = value.normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b\u202a-\u202e\u2066-\u2069\ufeff/\\?%*:|"<>.]/g, '_')
    .replace(/\s+/g, ' ').trim().replace(/^[_ ]+|[_ ]+$/g, '');
  if (!stem) stem = fallback;
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) stem = `image-${stem}`;
  return Array.from(stem).slice(0, MAX_FILENAME_LENGTH).join('');
}

function uniqueFilename(base, used) {
  let result = base, suffix = 1;
  const key = value => value.normalize('NFKC').toLowerCase();
  while (used.has(key(result))) {
    const tail = `-${++suffix}`;
    result = Array.from(base).slice(0, MAX_FILENAME_LENGTH - tail.length).join('') + tail;
  }
  used.add(key(result));
  return result;
}

function csvCell(value) {
  let text = String(value ?? '');
  // CSV quoting alone does not stop spreadsheet formula execution.
  if (/^[\s\u0000-\u001f\u007f-\u009f]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function imageJobCsv(jobs) {
  const rows = [['source_record', 'url', 'file_name', 'sku', 'handle'], ...jobs.map(job => [job.recordNumber, job.url, job.fileName, job.sku, job.handle])];
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** No actor run is performed; maxFiles is a file-count limit, not a spend cap. */
export function planImages(parsed, options = {}) {
  if (!parsed || !Array.isArray(parsed.headers) || !Array.isArray(parsed.records)) fail('INVALID_INPUT', 'Parse a CSV file before making a plan.');
  const { urlColumn, skuColumn = null, handleColumn = null, dedupe = false } = options;
  const columns = [urlColumn, skuColumn, handleColumn];
  if (!Number.isInteger(urlColumn) || columns.some(index => index !== null && (!Number.isInteger(index) || index < 0 || index >= parsed.headers.length))) {
    fail('INVALID_COLUMN', 'Choose an image URL column and valid optional filename columns.');
  }
  const selected = columns.filter(index => index !== null);
  if (new Set(selected).size !== selected.length) fail('COLUMN_CONFLICT', 'Choose different columns for the image URL, SKU and handle.');
  if (typeof dedupe !== 'boolean') fail('INVALID_POLICY', 'Choose whether to keep or remove repeated URLs.');
  const jobs = [], issues = [], seenUrls = new Set(), usedNames = new Set();
  const summary = { records: parsed.records.length, planned: 0, missing: 0, invalid: 0, duplicatesSkipped: 0, sharedUrls: 0, renamed: 0, blankRecords: parsed.skippedBlankRecords || 0 };
  for (const record of parsed.records) {
    const check = checkImageUrl(record.cells[urlColumn]);
    if (!check.ok) {
      summary[check.code === 'MISSING_URL' ? 'missing' : 'invalid']++;
      issues.push({ recordNumber: record.recordNumber, code: check.code, message: check.message });
      continue;
    }
    // Match the Actor's explicit dedupe convention, without touching queries.
    const urlKey = check.url.split('#')[0];
    if (seenUrls.has(urlKey)) {
      summary.sharedUrls++;
      if (dedupe) {
        summary.duplicatesSkipped++;
        issues.push({ recordNumber: record.recordNumber, code: 'DUPLICATE_SKIPPED', message: 'Repeated URL removed by your deduplication choice.' });
        continue;
      }
      issues.push({ recordNumber: record.recordNumber, code: 'SHARED_URL', message: 'Shared URL kept as a separate image job for this record.' });
    }
    seenUrls.add(urlKey);
    if (jobs.length >= MAX_JOBS) fail('TOO_MANY_JOBS', 'The plan has more than 1,000 image jobs. Split the CSV before exporting.');
    const sku = skuColumn === null ? '' : record.cells[skuColumn];
    const handle = handleColumn === null ? '' : record.cells[handleColumn];
    const base = filenameStem(sku.trim() || handle.trim(), `image-${String(jobs.length + 1).padStart(4, '0')}`);
    const fileName = uniqueFilename(base, usedNames);
    if (fileName !== base) summary.renamed++;
    jobs.push({ recordNumber: record.recordNumber, url: check.url, fileName, sku, handle });
  }
  summary.planned = jobs.length;
  const actorInput = jobs.length ? {
    urls: jobs.map(({ url, fileName }) => ({ url, fileName })),
    maxFiles: jobs.length,
    createZip: true,
    onlyImages: true,
    dedupe: false,
  } : null;
  return { jobs, issues, summary, actorInput, jobCsv: imageJobCsv(jobs) };
}
