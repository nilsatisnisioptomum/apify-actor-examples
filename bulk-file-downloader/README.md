# Bulk File Downloader

Download public file or image URLs into run storage, with an optional ZIP. Reuse an existing scraper's dataset without running that scraper again.

**Live Actor:** https://apify.com/chris_elder/bulk-file-downloader

Apify runs are billable. Review the [current pricing](https://apify.com/chris_elder/bulk-file-downloader/pricing), including the Actor-start charge, before starting. An unsuccessful download does not incur a successful-download event, but a failed run is not necessarily free. A free Apify account does not mean unlimited free runs.

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
| `recipes/download_from_scraper_dataset.js` | Node.js 20+: safe preview, deliberate capped run and authenticated ZIP saving |
| `recipes/download_images_to_zip.py` | Python URL-list recipe; starts a billable run immediately and writes `files.zip` |
| `run.js` | Basic Node.js `apify-client` API snippet |
| `run.py` | Basic Python `apify-client` API snippet |
| `run.sh` | Basic REST API snippet using curl and jq |

The basic API snippets start billable runs immediately when executed; they do not provide this Node recipe's explicit run/cap gate or local ZIP-saving workflow. Review their input and current pricing before use. Their existing code is unchanged by this recipe repair.

## Offline verification

From the repository root:

```sh
node --test bulk-file-downloader/test/download.test.mjs
```

Tests use fake API responses and temporary files. They do not start Actors, use real account tokens or make network requests. No dependency install is required.

Store profile: https://apify.com/chris_elder
