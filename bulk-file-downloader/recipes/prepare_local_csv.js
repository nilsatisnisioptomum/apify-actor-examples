// Local UTF-8 CSV -> Actor input JSON. Node 20+, no packages or network access.
// Preview: node bulk-file-downloader/recipes/prepare_local_csv.js products.csv
import { open, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MAX_FILE_BYTES, parseCsv, suggestColumns, planImages } from './csv-core.js';

export const HELP = `Prepare local product-image CSV input. Node.js 20+, no packages.
Usage: node bulk-file-downloader/recipes/prepare_local_csv.js INPUT.csv [options]
  --url-column HEADER   Exact image-link header (required if detection is ambiguous)
  --name-column HEADER  Exact filename/SKU header (otherwise one SKU alias, or numbering)
  --output FILE.json    Explicitly save input; refuses an existing destination
  --help               Show this help

Without --output, preview only: no file is created. No token, API call, image
download or Actor run is performed. Maximum 2 MiB, 10,000 records, 50 columns
and 1,000 image jobs. Missing/invalid URLs block writing; correct the CSV first.
URL checks do not establish reachability or verify images. Submitting this JSON
to Apify shares its URLs/filenames; starting the Actor can incur charges.
Review current pricing, the start charge and Max cost per run on Apify first.`;

export function parseArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  if (!args[0] || args[0].startsWith('--')) throw new Error('Provide a local CSV path. Use --help for options.');
  const options = { input: args[0] };
  const flags = { '--url-column': 'urlColumn', '--name-column': 'nameColumn', '--output': 'output' };
  for (let i = 1; i < args.length; i++) {
    const flag = args[i], name = Object.hasOwn(flags, flag) ? flags[flag] : null, value = args[i + 1];
    if (!name || !value || value.startsWith('--') || options[name] !== undefined) {
      throw new Error(`Unknown, repeated or incomplete option: ${JSON.stringify(flag)}. Use --help for options.`);
    }
    options[name] = value;
    i++;
  }
  return options;
}

async function readLocalCsv(path) {
  // Non-blocking open lets us reject a FIFO/device instead of waiting for input.
  const file = await open(path, constants.O_RDONLY | (constants.O_NONBLOCK || 0));
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new Error('Input must be a regular local file.');
    if (stat.size > MAX_FILE_BYTES) throw new Error('The file is larger than 2 MiB. Split it into smaller CSV files.');
    // Read at most the limit plus one byte, even if the file grows after stat().
    const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
    let bytes = 0;
    while (bytes < buffer.length) {
      const { bytesRead } = await file.read(buffer, bytes, buffer.length - bytes, bytes);
      if (!bytesRead) break;
      bytes += bytesRead;
    }
    if (bytes > MAX_FILE_BYTES) throw new Error('The file is larger than 2 MiB. Split it into smaller CSV files.');
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytes)); }
    catch { throw new Error('The file is not valid UTF-8. Export it as UTF-8 CSV before continuing.'); }
  } finally {
    await file.close();
  }
}

function selectColumn(headers, explicit, candidates, kind, required) {
  if (explicit !== undefined) {
    const index = headers.indexOf(explicit);
    if (index < 0) throw new Error(`Unknown ${kind} header ${JSON.stringify(explicit)}. Available headers: ${JSON.stringify(headers)}.`);
    return index;
  }
  if (candidates.length === 1) return candidates[0];
  if (!candidates.length && !required) return null;
  const flag = kind === 'image-link' ? '--url-column' : '--name-column';
  throw new Error(`Choose ${flag} explicitly; ${candidates.length ? 'more than one matching header was found' : 'no matching header was found'}. Available headers: ${JSON.stringify(headers)}.`);
}

export async function prepareCsv(options) {
  const parsed = parseCsv(await readLocalCsv(options.input));
  const suggestions = suggestColumns(parsed.headers);
  const urlColumn = selectColumn(parsed.headers, options.urlColumn, suggestions.url, 'image-link', true);
  const skuColumn = selectColumn(parsed.headers, options.nameColumn, suggestions.sku, 'filename', false);
  const plan = planImages(parsed, { urlColumn, skuColumn });
  const preview = {
    mode: options.output ? 'write requested' : 'preview',
    columns: { image: parsed.headers[urlColumn], filename: skuColumn === null ? null : parsed.headers[skuColumn] },
    summary: plan.summary,
    diagnostics: plan.issues,
  };
  if (!options.output) return preview;
  if (!plan.jobs.length || plan.summary.missing || plan.summary.invalid) {
    const error = new Error('No output written. Correct all missing/invalid image URLs before exporting; partial plans are not saved.');
    error.preview = preview;
    throw error;
  }
  // Exclusive creation protects both existing output and an input/output collision.
  // The file contains source URLs, including any signed query strings.
  const file = await open(options.output, 'wx', 0o600);
  let complete = false;
  try {
    await file.writeFile(JSON.stringify(plan.actorInput, null, 2) + '\n', 'utf8');
    await file.close();
    complete = true;
  } finally {
    if (!complete) {
      await file.close().catch(() => {});
      await unlink(options.output).catch(() => {});
    }
  }
  return { ...preview, mode: 'saved local JSON', output: options.output };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(HELP);
    else {
      const result = await prepareCsv(options);
      console.log(JSON.stringify(result, null, 2));
      console.log(options.output ? 'Saved local Actor input only; no API calls or Actor run.' : 'Preview only; no file created, API calls or Actor run. Add --output FILE.json to save locally.');
      console.log('Review Apify pricing, the start charge and Max cost per run before manually submitting and starting a run.');
    }
  } catch (error) {
    if (error.preview) console.error(JSON.stringify(error.preview, null, 2));
    console.error(error.code === 'EEXIST' ? 'Destination already exists; no file was overwritten. Choose another --output path.' : error.message);
    process.exitCode = 1;
  }
}
