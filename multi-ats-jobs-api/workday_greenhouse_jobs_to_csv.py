"""Pull open jobs from Workday and Greenhouse (plus Lever / Ashby) career sites into one CSV,
using the Apify Actor chris_elder/multi-ats-jobs-api (one schema for every ATS).
Store page: https://apify.com/chris_elder/multi-ats-jobs-api

    pip install apify-client
    export APIFY_TOKEN=...      # https://console.apify.com/settings/integrations
    python workday_greenhouse_jobs_to_csv.py
"""
import csv, os
from apify_client import ApifyClient

run_input = {
    "companies": [
        "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite",  # any *.myworkdayjobs.com URL
        {"ats": "greenhouse", "board": "stripe"},                          # boards.greenhouse.io/<board>
        {"ats": "greenhouse", "board": "airbnb"},
        # {"ats": "lever", "board": "spotify"}, {"ats": "ashby", "board": "notion"},
    ],
    "keywordFilter": ["data engineer", "data scientist", "machine learning"],
    "maxJobsPerCompany": 25,
    "maxJobsTotal": 75,
    # "remoteOnly": True, "includeDescription": True,
}

client = ApifyClient(os.environ["APIFY_TOKEN"])
run = client.actor("chris_elder/multi-ats-jobs-api").call(run_input=run_input)
dataset_id = getattr(run, "default_dataset_id", None) or run["defaultDatasetId"]  # apify-client v2 / v1

cols = ["ats", "company", "title", "location", "isRemote", "department", "postedAt", "postedText", "applyUrl"]
with open("jobs.csv", "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    n = 0
    for job in client.dataset(dataset_id).iterate_items():
        w.writerow(job); n += 1
print(f"Wrote {n} jobs to jobs.csv")
