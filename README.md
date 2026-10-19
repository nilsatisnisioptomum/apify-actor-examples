# Apify Actor Examples (GPT Shop Ltd)
Free, runnable examples for [GPT Shop Ltd’s Apify Store Actors](https://apify.com/chris_elder).
Use these snippets to call Actors from **Node.js**, **Python**, or the **REST API**.

## Start with your image links

- **[Local CSV → Actor input JSON](./bulk-file-downloader/#prepare-input-from-a-local-image-csv):** prepare and preview a CSV on your computer, then explicitly save JSON. Requires Node.js 20+ with no package install. No Apify account or token is needed; it does not upload your CSV or start an Actor.
- **[Existing scraper dataset → ZIP](./bulk-file-downloader/#first-zip-from-an-existing-scraper-dataset):** preview locally with Node.js 20+ and no token or API call. Deliberately starting a capped billable run and saving its ZIP requires your Apify account and token.

## Actors with full examples
- **[Bulk File Downloader](./bulk-file-downloader/)** → https://apify.com/chris_elder/bulk-file-downloader: Download many file/image URLs into Key-Value store (optional ZIP).
- **[Dataset Transformer](./dataset-transformer/)** → https://apify.com/chris_elder/dataset-transformer: Filter, dedupe, flatten, rename, sort tabular JSON; optional CSV export.
- **[Sitemap URL Extractor](./sitemap-url-extractor/)** → https://apify.com/chris_elder/sitemap-url-extractor: Extract every URL from a site’s XML sitemaps (robots.txt auto-discovery).
- **[HTTP Request Sender](./http-request-sender/)** → https://apify.com/chris_elder/http-request-sender: Send single or bulk HTTP requests (GET/POST/…) with structured responses.
- **[Broken Link Checker](./broken-link-checker/)** → https://apify.com/chris_elder/broken-link-checker: Crawl pages and report broken, redirected, and blocked links.

## All live Actors on the store
- https://apify.com/chris_elder/bulk-file-downloader
- https://apify.com/chris_elder/dataset-transformer
- https://apify.com/chris_elder/sitemap-url-extractor
- https://apify.com/chris_elder/pdf-to-markdown
- https://apify.com/chris_elder/lighthouse-batch-auditor
- https://apify.com/chris_elder/broken-link-checker
- https://apify.com/chris_elder/http-request-sender
- https://apify.com/chris_elder/rss-feed-reader
- https://apify.com/chris_elder/on-page-seo-audit
- https://apify.com/chris_elder/bulk-whois-domain-lookup
- https://apify.com/chris_elder/image-to-text-ocr
- https://apify.com/chris_elder/itunes-app-store-search
- https://apify.com/chris_elder/multi-ats-jobs-api

## Requirements

- **Bulk CSV preparation and dataset recipe:** Node.js 20+ with no package install. Local CSV preparation and the dataset recipe's preview need no Apify account or token.
- **Executing Actors through the API:** an [Apify](https://apify.com) account and an API token from [Integrations](https://console.apify.com/account/integrations) (`APIFY_TOKEN`). Keep the token in your local environment, not in source files or URLs.
- **Other examples:** use the runtime and dependencies described in the selected folder.

## Honest notes

- Examples use public demo URLs (httpbin, example.com, crawlee.dev, W3C sample PDF). Only download or scrape content you have the right to use.
- Actor execution can incur charges even when files fail or are filtered. Review each Actor’s current Store pricing, including any Actor-start charge, before running. Offline preparation and preview do not start Actors.
- This repository contains **examples only**, not the Actor source.

## License

MIT: see [LICENSE](./LICENSE).

## AI-assisted development

Parts of this repository were prepared with AI assistance; all examples were checked against live Actor inputs/outputs for GPT Shop Ltd’s Store listings.


## Workday + Greenhouse jobs

[`multi-ats-jobs-api/`](multi-ats-jobs-api/): a tested Python recipe and real sample CSV (Workday + Greenhouse → one CSV). The Actor also covers Lever, Ashby, SmartRecruiters, Recruitee and Workable.
