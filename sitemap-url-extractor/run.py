"""Example: run Sitemap URL Extractor via Apify Client (Python).

Actor: https://apify.com/chris_elder/sitemap-url-extractor

  pip install apify-client
  export APIFY_TOKEN=your_token
  python run.py
"""
import json
import os
from pathlib import Path

from apify_client import ApifyClient

INPUT = json.loads(Path(__file__).with_name("input.example.json").read_text())

client = ApifyClient(os.environ["APIFY_TOKEN"])
run = client.actor("chris_elder/sitemap-url-extractor").call(run_input=INPUT)
items = list(client.dataset(run["defaultDatasetId"]).iterate_items())

print("Run:", run["id"], run["status"])
print("Items:", len(items))
print(items[:3])
