# Clean and validate a lead CSV (dedupe, email MX, phones, score)

**Live Actor:** [Bulk Email & Phone Validator](https://apify.com/chris_elder/dataset-dedupe-enrich) (`chris_elder/dataset-dedupe-enrich`)

## Files

| File | Purpose |
|------|---------|
| `clean_leads_csv.py` | Local CSV → Actor → `<name>.cleaned.csv`, sorted by quality score |
| `leads.example.csv` | 5 messy rows: a duplicate, a disposable address, a domain with no mail server, a `mailto:` prefix and a stray space |
| `sample-cleaned-2026-10-20.csv` | Real output of the command below |

## Quick start

```bash
pip install apify-client
export APIFY_TOKEN=your_token   # https://console.apify.com/settings/integrations
python clean_leads_csv.py leads.example.csv --country GB
```

Real run on 20 Oct 2026 (run `k1QQqb0hGTPhaQhe2`): 5 rows in → 4 rows out (the duplicate Apify row was merged and not charged).

| Row | Result |
|---|---|
| Apify | `hello@apify.com` valid-mx (role address), website alive, score 65 |
| GOV.UK | `mailto:` stripped, `sales @gov.uk` repaired, phone → `+442079460000`, domain has no MX (A record only), score 55 |
| Throwaway Ltd | disposable email, invalid phone, score 5 |
| No Mail Co | domain has no mail server and the website doesn't resolve, score 5 |

## Honest notes

- Validation, not verification: syntax, DNS MX records, disposable/role/free-mail lists. It never probes inboxes over SMTP.
- Rows are sent as Actor input, which suits files up to roughly 10,000 rows; for bigger files host the CSV and use the Actor's `csvUrl` input, or pass an Apify `datasetId`.
- Pay-per-result: about $0.60 per 1,000 cleaned rows on the Free plan at the time of writing (duplicates free); check the Store page for current prices.
