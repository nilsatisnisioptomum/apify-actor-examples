# Workday + Greenhouse jobs to CSV (Apify `chris_elder/multi-ats-jobs-api`)

One schema for 7 ATS: Workday, Greenhouse, Lever, Ashby, SmartRecruiters, Recruitee and Workable career sites. Good for job boards, recruiting dashboards and hiring-signal monitoring.
Store page: https://apify.com/chris_elder/multi-ats-jobs-api

- [`workday_greenhouse_jobs_to_csv.py`](workday_greenhouse_jobs_to_csv.py): NVIDIA (Workday) + Stripe and Airbnb (Greenhouse), filtered to data/ML roles → `jobs.csv`
- [`sample-output-2026-10-16.csv`](sample-output-2026-10-16.csv): the real output of that script on 16 Oct 2026 (Apify run `MqmROLIuKQSJsFDFm`: 40 jobs, 0 board errors)

Input formats for `companies`: a careers URL (`*.myworkdayjobs.com/...`, `boards.greenhouse.io/x`, `jobs.lever.co/x`, `jobs.ashbyhq.com/x`) or `{"ats": "greenhouse", "board": "stripe"}`.
Cost: $1 per 1,000 jobs on the Apify Free plan, from $0.60 per 1,000 on higher plans ($1.50 / from $1.00 from 26 Oct 2026); see the Store page for current pricing. Boards that error are not charged.
