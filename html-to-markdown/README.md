# Website / sitemap → Markdown files for LLM & RAG

Turn a documentation site, help centre or blog into one Markdown file per page, ready for chunking and embedding.

**Live Actors used**
- [URL to Markdown](https://apify.com/chris_elder/html-to-markdown) (`chris_elder/html-to-markdown`): converts each page to GitHub-flavoured Markdown
- [Sitemap URL Extractor](https://apify.com/chris_elder/sitemap-url-extractor) (`chris_elder/sitemap-url-extractor`): finds the page URLs (only with `--sitemap`)

## Files

| File | Purpose |
|------|---------|
| `site_to_markdown_files.py` | Sitemap or URL list → `./markdown/*.md` with YAML front matter + `_index.json` |
| `sample-output-2026-10-20/` | Real output from the command below (index + first 40 lines of one page) |

## Quick start

```bash
pip install apify-client
export APIFY_TOKEN=your_token   # https://console.apify.com/settings/integrations

# 4 Crawlee guide pages, filtered inside the sitemap Actor so you only pay for kept URLs
python site_to_markdown_files.py --sitemap crawlee.dev --match /docs/guides/ --max 4

# or your own list
python site_to_markdown_files.py --urls urls.txt --max 50
```

Real run on 20 Oct 2026: the sitemap step returned 4 URLs and the conversion step wrote 4 files (4.7k–11.7k characters each), 0 failures.

```
Sitemap URL Extractor run Zhm6dTusQTX6aKaxe: 4 URLs found
URL to Markdown run oRdlE5CfUDpOc7V7Q: wrote 4 files to markdown/, 0 failed (not charged)
```

## Honest notes

- Both Actors are pay-per-result. At the time of writing that is about $0.50 per 1,000 sitemap URLs and $1 per 1,000 converted pages on the Apify Free plan, plus a tiny start fee per run; check the Store pages for current prices. `--dry-run` still runs the (cheap) sitemap step.
- Conversion reads server-rendered HTML; JavaScript-only pages may come back nearly empty. Pages without `<article>`/`<main>` can include some navigation text, and inline code inside lists is sometimes run together (see the sample).
- Only convert content you have the right to use.
