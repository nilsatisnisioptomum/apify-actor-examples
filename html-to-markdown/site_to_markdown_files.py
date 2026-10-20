"""Turn a website (via its sitemap) or a URL list into one Markdown file per page.

Good for feeding documentation, help centres or blogs into an LLM / RAG pipeline.

Uses two Apify Store Actors (both pay-per-result; review current pricing first):
  - Sitemap URL Extractor  https://apify.com/chris_elder/sitemap-url-extractor   (only with --sitemap)
  - URL to Markdown        https://apify.com/chris_elder/html-to-markdown

    pip install apify-client
    export APIFY_TOKEN=...   # https://console.apify.com/settings/integrations
    python site_to_markdown_files.py --sitemap crawlee.dev --match /docs/ --max 20
    python site_to_markdown_files.py --urls urls.txt          # one URL per line

Writes ./markdown/<slug>.md with a small YAML front-matter block (title, source,
characters) and ./markdown/_index.json. Pages that fail are listed and are not
charged by the Actor. Use --dry-run to see the URL list without converting.
"""
import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

from apify_client import ApifyClient


def run_and_get_items(client, actor_id, run_input):
    run = client.actor(actor_id).call(run_input=run_input)
    run = run if isinstance(run, dict) else run.model_dump(by_alias=True)
    if run.get("status") != "SUCCEEDED":
        sys.exit(f"{actor_id} run {run.get('id')} finished with status {run.get('status')}")
    items = client.dataset(run["defaultDatasetId"]).list_items(clean=True).items
    return run["id"], [i if isinstance(i, dict) else dict(i) for i in items]


def slugify(url):
    p = urlparse(url)
    path = re.sub(r"[^A-Za-z0-9]+", "-", (p.netloc + p.path).strip("/")).strip("-").lower()
    return (path or "index")[:120]


def yaml_str(value):
    return json.dumps(value or "", ensure_ascii=False)  # JSON strings are valid YAML scalars


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--sitemap", help="Domain or URL whose sitemap(s) to read, e.g. crawlee.dev")
    src.add_argument("--urls", help="Text file with one page URL per line")
    ap.add_argument("--match", help="Only keep URLs containing this text (e.g. /docs/)")
    ap.add_argument("--max", type=int, default=25, help="Max pages to convert (default 25)")
    ap.add_argument("--out", default="markdown", help="Output folder (default ./markdown)")
    ap.add_argument("--dry-run", action="store_true", help="List URLs only; do not convert")
    args = ap.parse_args()

    client = ApifyClient(os.environ["APIFY_TOKEN"])

    if args.sitemap:
        start = args.sitemap if args.sitemap.startswith("http") else f"https://{args.sitemap}"
        sitemap_input = {"startUrls": [{"url": start}], "maxUrls": args.max, "sameHostOnly": True}
        if args.match:  # filter inside the Actor so you only pay for URLs you keep
            sitemap_input["includeUrlPatterns"] = [re.escape(args.match)]
        run_id, rows = run_and_get_items(client, "chris_elder/sitemap-url-extractor", sitemap_input)
        urls = [r["url"] for r in rows if r.get("url")]
        print(f"Sitemap URL Extractor run {run_id}: {len(urls)} URLs found")
    else:
        urls = [l.strip() for l in Path(args.urls).read_text().splitlines() if l.strip() and not l.startswith("#")]

    if args.match:
        urls = [u for u in urls if args.match in u]
    urls = list(dict.fromkeys(urls))[: args.max]
    if not urls:
        sys.exit("No URLs to convert (check --match).")
    if args.dry_run:
        print("\n".join(urls))
        return

    run_id, pages = run_and_get_items(client, "chris_elder/html-to-markdown",
                                      {"urls": urls, "includeMetadata": True, "maxConcurrency": 5})
    out = Path(args.out)
    out.mkdir(exist_ok=True)
    index, failed = [], []
    for page in pages:
        if not page.get("ok"):
            failed.append((page.get("url"), page.get("error")))
            continue
        name = slugify(page.get("finalUrl") or page["url"]) + ".md"
        front = (f"---\ntitle: {yaml_str(page.get('title'))}\nsource: {yaml_str(page['url'])}\n"
                 f"characters: {page.get('markdownChars', 0)}\n---\n\n")
        (out / name).write_text(front + page["markdown"], encoding="utf-8")
        index.append({"file": name, "url": page["url"], "title": page.get("title"), "chars": page.get("markdownChars")})
    (out / "_index.json").write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"URL to Markdown run {run_id}: wrote {len(index)} files to {out}/, {len(failed)} failed (not charged)")
    for url, err in failed:
        print(f"  failed: {url} ({err})")


if __name__ == "__main__":
    main()
