"""Example: run HTTP Request Sender via Apify Client (Python).

Actor: https://apify.com/chris_elder/http-request-sender

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
run = client.actor("chris_elder/http-request-sender").call(run_input=INPUT)
items = list(client.dataset(run["defaultDatasetId"]).iterate_items())

print("Run:", run["id"], run["status"])
print("Items:", len(items))
print(items[:3])
