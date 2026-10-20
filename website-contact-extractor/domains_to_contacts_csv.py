"""Domain list -> contacts CSV (public emails, phones, social links), optionally email-validated.

Uses Apify Store Actors (pay-per-result; review current pricing first):
  - Contact Details Scraper           https://apify.com/chris_elder/website-contact-extractor
  - Bulk Email & Phone Validator      https://apify.com/chris_elder/dataset-dedupe-enrich   (only with --validate)

    pip install apify-client
    export APIFY_TOKEN=...   # https://console.apify.com/settings/integrations
    python domains_to_contacts_csv.py domains.txt                 # -> contacts.csv
    python domains_to_contacts_csv.py domains.txt --validate      # + MX / disposable / role checks

domains.txt: one domain or URL per line (lines starting with # are ignored).
Only collect and use business contact data lawfully (GDPR, PECR, CAN-SPAM).
"""
import argparse
import csv
import os
import sys
from pathlib import Path

from apify_client import ApifyClient

SOCIALS = ["linkedin", "twitter", "facebook", "instagram", "youtube", "tiktok", "github"]


def call(client, actor_id, run_input):
    run = client.actor(actor_id).call(run_input=run_input)
    run = run if isinstance(run, dict) else run.model_dump(by_alias=True)
    if run.get("status") != "SUCCEEDED":
        sys.exit(f"{actor_id} run {run.get('id')} finished with status {run.get('status')}")
    items = client.dataset(run["defaultDatasetId"]).list_items(clean=True).items
    return run, [i if isinstance(i, dict) else dict(i) for i in items]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("domains", help="Text file, one domain per line")
    ap.add_argument("--out", default="contacts.csv")
    ap.add_argument("--max-pages", type=int, default=4, help="Pages per site: homepage + contact/about pages")
    ap.add_argument("--validate", action="store_true", help="Also check emails (syntax, MX, disposable, role)")
    args = ap.parse_args()

    domains = [l.strip() for l in Path(args.domains).read_text().splitlines() if l.strip() and not l.startswith("#")]
    if not domains:
        sys.exit("No domains in file.")
    client = ApifyClient(os.environ["APIFY_TOKEN"])

    run, rows = call(client, "chris_elder/website-contact-extractor",
                     {"websites": domains, "maxPagesPerSite": args.max_pages})
    print(f"Contact Details Scraper run {run['id']}: {len(rows)} websites")

    checks = {}
    if args.validate:
        # Feed the scraper's dataset straight in; the validator auto-detects website / emails / phones.
        vrun, cleaned = call(client, "chris_elder/dataset-dedupe-enrich",
                             {"datasetId": run["defaultDatasetId"], "checkMx": True, "checkWebsites": False})
        for c in cleaned:
            for d in c.get("emailDetails") or []:
                checks[d["email"].lower()] = d["status"] + (" (role)" if d.get("role") else "")
        print(f"Validator run {vrun['id']}: {len(checks)} emails checked")

    fields = ["website", "emails", "email_checks", "phones", *SOCIALS, "pages_checked", "error"]
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            emails = r.get("emails") or []
            social = r.get("social") or {}
            w.writerow({
                "website": r.get("website"),
                "emails": "; ".join(emails),
                "email_checks": "; ".join(f"{e}={checks.get(e.lower(), 'not checked')}" for e in emails) if args.validate else "",
                "phones": "; ".join(r.get("phones") or []),
                **{s: social.get(s, "") for s in SOCIALS},
                "pages_checked": len(r.get("pagesChecked") or []),
                "error": r.get("error", ""),
            })
    found = sum(1 for r in rows if r.get("emails"))
    print(f"Wrote {args.out}: {len(rows)} rows, {found} with at least one public email")


if __name__ == "__main__":
    main()
