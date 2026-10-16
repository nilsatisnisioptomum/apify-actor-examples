# Bulk File Downloader

Download many file/image URLs into Key-Value store (optional ZIP). Paying users: priority example.

**Live Actor:** https://apify.com/chris_elder/bulk-file-downloader

## Files

| File | Purpose |
|------|---------|
| `input.example.json` | Sample Actor input |
| `output.shape.json` | Typical dataset item shape |
| `sample-run.trimmed.json` | Trimmed real-run sample (when available) |
| `run.js` | Node.js (apify-client) |
| `run.py` | Python (apify-client) |
| `run.sh` | REST API via curl |

## Quick start

```bash
export APIFY_TOKEN=your_token   # from https://console.apify.com/account/integrations
# Node
npm i apify-client && node run.js
# or Python
pip install apify-client && python run.py
# or REST
./run.sh
```

Store profile: https://apify.com/chris_elder

## Recipes (tested 2026-10-16)

- [`recipes/download_images_to_zip.py`](recipes/download_images_to_zip.py) – text file of URLs → `files.zip` on your disk (Python, works with apify-client v1 and v2).
- [`recipes/download_from_scraper_dataset.js`](recipes/download_from_scraper_dataset.js) – every product image from a previous scraper run's dataset → one ZIP named by SKU (Node).

Tip: pass the scraper run's **Dataset ID** (`defaultDatasetId`), not the run ID.
