# Domain list → contacts CSV (emails, phones, socials), optionally email-validated

**Live Actors used**
- [Contact Details Scraper](https://apify.com/chris_elder/website-contact-extractor) (`chris_elder/website-contact-extractor`): reads each site's homepage plus contact/about pages
- [Bulk Email & Phone Validator](https://apify.com/chris_elder/dataset-dedupe-enrich) (`chris_elder/dataset-dedupe-enrich`): syntax + MX + disposable/role checks (only with `--validate`)

## Files

| File | Purpose |
|------|---------|
| `domains_to_contacts_csv.py` | `domains.txt` → `contacts.csv` (one row per website) |
| `domains.example.txt` | 4 sample domains (one deliberately unreachable) |
| `sample-contacts-2026-10-20.csv` | Real output of the command below |

## Quick start

```bash
pip install apify-client
export APIFY_TOKEN=your_token   # https://console.apify.com/settings/integrations
python domains_to_contacts_csv.py domains.example.txt --validate
```

Real run on 20 Oct 2026 (runs `Mh4tGn4tMDPAEb340` and `0TLgFwtxCrlB7kywa`): 4 websites in, 3 with at least one public email, 4 emails checked (3 `valid-mx`, 1 `no-mx-a-record`); the unreachable domain got an error row and was not charged.

The validator is fed the scraper's dataset ID directly, so nothing is downloaded and re-uploaded in between.

## Honest notes

- The scraper only finds contacts that sites publish in their HTML (`mailto:`, page text, `tel:` links, social links). Many sites publish none, and that's what you'll see.
- Validation is syntax + DNS (MX) + disposable/role flags. It does **not** probe mailboxes over SMTP.
- Pay-per-result: about $2 per 1,000 websites and $0.60 per 1,000 validated rows on the Free plan at the time of writing; check the Store pages for current prices.
- Use business contact data lawfully (GDPR, PECR, CAN-SPAM); don't send unsolicited bulk email.
