"""Clean and validate a local lead/contact CSV: dedupe, email syntax + MX, disposable/role flags,
E.164 phones, website check and a 0-100 quality score.

Uses the Apify Store Actor "Bulk Email & Phone Validator" (pay-per-result; duplicates merged are free;
review current pricing first): https://apify.com/chris_elder/dataset-dedupe-enrich

    pip install apify-client
    export APIFY_TOKEN=...   # https://console.apify.com/settings/integrations
    python clean_leads_csv.py leads.example.csv --country GB          # -> leads.cleaned.csv
    python clean_leads_csv.py leads.csv --country US --min-score 50   # keep only usable rows

The CSV is read locally and sent as Actor input (keep it under ~10,000 rows this way; for bigger
files host the CSV and use the Actor's csvUrl input). Column names are auto-detected
(email/emails, phone/mobile, website/domain, company/name, address).
This is validation, not SMTP mailbox verification: it never probes inboxes.
"""
import argparse
import csv
import os
import sys
from pathlib import Path

from apify_client import ApifyClient

COLUMNS = ["name", "primaryEmail", "primaryEmailStatus", "primaryEmailIsRole", "phone", "phoneType",
           "invalidPhones", "website", "websiteAlive", "leadQuality", "leadQualityLabel", "issues", "duplicatesMerged"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_file")
    ap.add_argument("--country", default="GB", help="Default country for phones without +code (ISO, e.g. US, GB)")
    ap.add_argument("--min-score", type=int, default=0, help="Drop rows scoring below this (0-100)")
    ap.add_argument("--no-website-check", action="store_true")
    ap.add_argument("--out", help="Output CSV (default <input>.cleaned.csv)")
    args = ap.parse_args()

    src = Path(args.csv_file)
    with src.open(newline="", encoding="utf-8-sig") as f:
        rows = [r for r in csv.DictReader(f)]
    if not rows:
        sys.exit("CSV has no data rows.")

    client = ApifyClient(os.environ["APIFY_TOKEN"])
    run = client.actor("chris_elder/dataset-dedupe-enrich").call(run_input={
        "items": rows,
        "defaultCountry": args.country,
        "checkMx": True,
        "checkWebsites": not args.no_website_check,
        "minLeadQuality": args.min_score,
    })
    run = run if isinstance(run, dict) else run.model_dump(by_alias=True)
    if run.get("status") != "SUCCEEDED":
        sys.exit(f"Run {run.get('id')} finished with status {run.get('status')}")
    items = [i if isinstance(i, dict) else dict(i) for i in
             client.dataset(run["defaultDatasetId"]).list_items(clean=True).items]
    errors = [i for i in items if i.get("type") == "input-error"]
    if errors:
        sys.exit(errors[0].get("message"))

    out = Path(args.out or src.with_suffix(".cleaned.csv"))
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS, extrasaction="ignore")
        w.writeheader()
        for i in sorted(items, key=lambda x: -(x.get("leadQuality") or 0)):
            w.writerow({k: "; ".join(map(str, v)) if isinstance(v, list) else v for k, v in i.items()})
    print(f"Run {run['id']}: {len(rows)} rows in -> {len(items)} rows out ({len(rows) - len(items)} merged or dropped, not charged)")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
