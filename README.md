# Apify Actor Examples (GPT Shop Ltd)
Free, runnable examples for [GPT Shop Ltd’s Apify Store Actors](https://apify.com/chris_elder).
Use these snippets to call Actors from **Node.js**, **Python**, or the **REST API**.



## Actors with full examples
- **[Bulk File Downloader](./bulk-file-downloader/)** → https://apify.com/chris_elder/bulk-file-downloader — Download many file/image URLs into Key-Value store (optional ZIP). Paying users: priority example.
- **[Dataset Transformer](./dataset-transformer/)** → https://apify.com/chris_elder/dataset-transformer — Filter, dedupe, flatten, rename, sort tabular JSON; optional CSV export.
- **[Sitemap URL Extractor](./sitemap-url-extractor/)** → https://apify.com/chris_elder/sitemap-url-extractor — Extract every URL from a site’s XML sitemaps (robots.txt auto-discovery).
- **[HTTP Request Sender](./http-request-sender/)** → https://apify.com/chris_elder/http-request-sender — Send single or bulk HTTP requests (GET/POST/…) with structured responses.
- **[Broken Link Checker](./broken-link-checker/)** → https://apify.com/chris_elder/broken-link-checker — Crawl pages and report broken, redirected, and blocked links.

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

1. Free [Apify](https://apify.com) account
2. API token from [Integrations](https://console.apify.com/account/integrations) (`APIFY_TOKEN`)
3. Node 18+, Python 3.9+, or curl + jq

## Honest notes

- Examples use public demo URLs (httpbin, example.com, crawlee.dev, W3C sample PDF). Only download or scrape content you have the right to use.
- Failed / filtered results on these Actors are typically not charged; see each Actor’s Store page for current pricing.
- This repository contains **examples only**, not the Actor source.

## License

MIT: see [LICENSE](./LICENSE).

## AI-assisted development

Parts of this repository were prepared with AI assistance; all examples were checked against live Actor inputs/outputs for GPT Shop Ltd’s Store listings.


## Workday + Greenhouse jobs

[`multi-ats-jobs-api/`](multi-ats-jobs-api/): a tested Python recipe and real sample CSV (Workday + Greenhouse → one CSV). The Actor also covers Lever, Ashby, SmartRecruiters, Recruitee and Workable.
