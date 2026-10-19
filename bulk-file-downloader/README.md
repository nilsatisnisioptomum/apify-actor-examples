# Bulk File Downloader

Download public file or image URLs into run storage, with an optional ZIP. Reuse an existing scraper's dataset without running that scraper again.

**Live Actor:** https://apify.com/chris_elder/bulk-file-downloader

Apify runs are billable. Review the [current pricing](https://apify.com/chris_elder/bulk-file-downloader/pricing), including the Actor-start charge, before starting. An unsuccessful download does not incur a successful-download event, but a failed run is not necessarily free. A free Apify account does not mean unlimited free runs.

## Prepare input from a local image CSV

If your image links are in a spreadsheet on your computer, there is no need to publish that CSV or upload it for preparation. Export it as **UTF-8 CSV**, with a header row and one complete HTTP/HTTPS image URL per cell. This Node.js 20+ recipe uses no packages, token, API or network access.

From the repository root, preview your own file:

```sh
node bulk-file-downloader/recipes/prepare_local_csv.js products.csv
```

Preview shows the selected headers, counts and record-number diagnostics; it creates no file and does not print source URLs. A single recognized image-link header and SKU header are selected automatically. If several match, choose the exact header names explicitly. You can also choose another column as the filename stem:

```sh
node bulk-file-downloader/recipes/prepare_local_csv.js products.csv \
  --url-column "Image Src" --name-column "Variant SKU"
```

After checking the preview, explicitly save the Actor input locally:

```sh
node bulk-file-downloader/recipes/prepare_local_csv.js products.csv \
  --url-column "Image Src" --name-column "Variant SKU" \
  --output actor-input.json
```

The original CSV is unchanged. The recipe refuses an existing destination, including the source CSV, and refuses to save a partial plan if any nonblank record has a missing or invalid image URL. Correct those records and preview again. Limits are **2 MiB, 10,000 data records, 50 columns and 1,000 image jobs**; larger input is rejected rather than truncated. Blank records are counted and ignored.

Names are cleaned into unique, extensionless stems; leading-zero SKUs are preserved, and the downloader adds the actual image extension. Without a recognized or explicitly selected name column, files are numbered. Repeated image URLs are kept for separate product rows, with `dedupe: false` in the input. URL encoding and signed query strings are preserved. URL checks cover syntax and literal local/private addresses only: they do not resolve DNS, fetch links, verify reachability or establish that the response is an image. Lists of URLs are not split.

Open the [Bulk File Downloader on Apify](https://apify.com/chris_elder/bulk-file-downloader), then paste the saved JSON into its JSON input view. **Writing the local JSON does not contact Apify or start a run.** The JSON contains your image URLs and filenames, including any signed URL query strings; keep it private. Pasting or submitting it in Apify shares the contained URLs and filenames with Apify. Review the current pricing, Actor-start charge and **Max cost per run** before manually starting. `maxFiles` is a file-count limit, not a spending limit. Preparation itself makes no Apify requests or charges.

## First ZIP from an existing scraper dataset

Requires **Node.js 20 or newer**, with no package install. From the repository root, preview the input:

```sh
node bulk-file-downloader/recipes/download_from_scraper_dataset.js YOUR_DATASET_ID
```

Preview makes no API calls, needs no token and creates no output file. Use the scraper's **Dataset ID** (`defaultDatasetId`), not its Run ID or a URL. The defaults select an `images` URL/list field, a `sku` filename field and at most 100 images. Adapt the field names and file limit to your dataset:

```sh
node bulk-file-downloader/recipes/download_from_scraper_dataset.js YOUR_DATASET_ID \
  --url-field "Image Src" --name-field "Variant SKU" --max-files 20 \
  --output product-images.zip
```

These are example column names, not a requirement. Use the exact fields in your own scraper dataset; nested fields such as `product.images` are supported.

After reviewing the preview and pricing, configure `APIFY_TOKEN` in your local environment from your existing [Apify Integrations](https://console.apify.com/account/integrations). Keep it out of source files, URLs, screenshots and command history. To deliberately start a billable run, add **both** run flags:

```sh
node bulk-file-downloader/recipes/download_from_scraper_dataset.js YOUR_DATASET_ID \
  --url-field "Image Src" --name-field "Variant SKU" --max-files 20 \
  --output product-images.zip --run --max-charge-usd 0.10
```

Choose an appropriate USD amount. The recipe passes it as Apify's `maxTotalChargeUsd` run limit. A low limit can stop the run before all images are ready; `maxFiles` is a file limit, not a spending limit. Actor-start charges can still apply if downloads fail, and storage or transfer use counts against your Apify allowances.

The recipe starts at most one run, waits for success with bounded requests and backoff, then downloads `OUTPUT.zip` with an Authorization header and saves it on your computer. It refuses an existing destination **before** starting a paid run, never overwrites it, rejects empty/non-ZIP responses and removes incomplete downloads. The local download limit is 512 MiB; use Console for larger archives. ZIP detection checks the file signature, not every archived file's integrity.

If an API request or run fails, inspect the **existing run** in Console before retrying. The recipe never automatically retries a billable start request; a lost response can leave a run active even when no run ID was returned.

| Symptom | Check |
| --- | --- |
| Empty ZIP or missing images | Dataset ID, exact URL field, source links and `onlyImages` filter |
| HTTP 401/403 | Token permissions and access to the source dataset |
| Failed or timed-out run | Existing run log, source-site restrictions and charge cap |
| Destination already exists | Choose another `--output`; the old file is preserved |

## Files and other API examples

| File | Purpose |
| --- | --- |
| `input.example.json` | Sample Actor input |
| `output.shape.json` | Typical dataset item shape |
| `sample-run.trimmed.json` | Trimmed earlier real-run sample |
| `recipes/prepare_local_csv.js` | Node.js 20+: offline CSV preview and explicit local Actor input JSON saving |
| `recipes/csv-core.js` | Pure local CSV parsing, URL checks and image-job planning; no network or Actor execution |
| `recipes/download_from_scraper_dataset.js` | Node.js 20+: safe preview, deliberate capped run and authenticated ZIP saving |
| `recipes/download_images_to_zip.py` | Python URL-list recipe; refuses an existing `files.zip` before starting a billable run |
| `run.js` | Basic Node.js `apify-client` API snippet |
| `run.py` | Basic Python `apify-client` API snippet |
| `run.sh` | Basic REST API snippet using curl and jq |

The Python URL-list recipe also starts a billable run when executed; it has no preview or spending cap. It reserves `files.zip` before contacting Apify and refuses existing files or symlinks. A failed start or download removes only the newly created partial file. ZIP downloads are streamed with a 512 MiB limit and a 75-second network-operation timeout; validation checks the ZIP signature, not every archive member. Inspect the existing run in Console before retrying a failure, because a run may already have incurred charges.

The basic API snippets start billable runs immediately when executed; they do not provide this Node recipe's explicit run/cap gate or local ZIP-saving workflow. Review their input and current pricing before use. Their existing code is unchanged by this recipe repair.

## Offline verification

From the repository root:

```sh
node --test bulk-file-downloader/test/*.test.mjs
python3 -m unittest discover -s bulk-file-downloader/test -p 'test_python_download.py'
```

Tests use fake API responses and temporary files. They do not start Actors, use real account tokens or make network requests. No dependency install is required.

### Planner provenance and licence

GPT Shop Ltd copied `recipes/csv-core.js` byte-for-byte from its existing local image planner, revision `b5ad62341f4f42f39f76773dc10a6eac62ef6101`, source path `sites/gptshop-company/site/image-download-plan/csv-core.js`. Its SHA-256 is `3141a7841dad86aa74e4117bfb12d4286f5b1fda2021d3e4dc53f818cb74a16e`. The 35 core regression tests are copied with their import path changed only. GPT Shop Ltd publishes this engine, adapter and tests under this repository's [MIT licence](../LICENSE).

Store profile: https://apify.com/chris_elder
