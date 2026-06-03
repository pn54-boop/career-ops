# Mode: ingest — Bulk Job Ingestion + Fast Pre-Screen

Pulls job listings from RSS feeds and Indeed MCP, deduplicates, applies fast batch pre-screen, and queues passing jobs into pipeline.md for full evaluation.

**Run order:** Step 1 (RSS) → Step 2 (Indeed MCP) → Step 3 (pre-screen) → Step 4 (queue)

---

## Step 1 — RSS Feed Ingestion

Run the RSS fetcher script:

```bash
node ingest.mjs
```

This fetches all enabled boards (Indeed, ZipRecruiter, SimplyHired) for all enabled search queries in `config/search-queries.yml`. New jobs are written to `data/ingest-queue.tsv`.

If the script fails or returns 0 new jobs, continue to Step 2 regardless.

---

## Step 2 — Indeed MCP Search

Use the Indeed MCP `search_jobs` tool to run supplementary searches for each enabled query in `config/search-queries.yml`. This catches jobs that may not appear in RSS feeds.

For each enabled query, call Indeed MCP search with:
- Keywords: the query's `terms` field
- Location: the query's `location` field
- Date range: last 7 days

For each result returned:
- Deduplicate against `data/ingest-queue.tsv` (check URL) and `data/ingest-log.tsv`
- If new: append to `data/ingest-queue.tsv` using the same TSV format:
  `{url}\t{title}\t{company}\t{location}\t{snippet}\tindeed_mcp\t{query_label}\t{today}`

---

## Step 3 — Fast Batch Pre-Screen

Read `data/ingest-queue.tsv`. Read exclusion rules from `C:\Users\patri\.claude\skills\email-manager\config.md`.

**Do NOT fetch the full JD for any listing.** Use only title + company + snippet from the queue.

Process in batches of 50. For each batch, evaluate all 50 jobs in a single pass:

For each job, output one of:
- `PASS` — no hard exclusion triggered
- `SKIP: {reason}` — hard exclusion triggered

**Hard exclusion rules (same as email-manager):**
- Title contains: commission, OTE, quota, 100% commission, uncapped earnings
- Title/snippet requires: MBA required, JD required, PhD required, CFA required, master's required (not "preferred")
- Title/snippet requires non-English language (not "a plus")
- Title indicates: Intern, Internship, Part-time, Contract, Temp, Freelance, 1099
- Title is primarily: Sales Representative, Account Executive, SDR, BDR, Financial Advisor, Insurance Agent, Loan Officer
- **Additional finance-specific exclusions:**
  - "Wealth Management" + "financial planning" (likely commission advisory)
  - "Insurance" as primary function
  - "Mortgage" originator/broker roles
  - "Staffing" or "Recruiting" roles where Patrick would be the recruiter

**When in doubt: PASS.** The full A-G evaluation catches edge cases.

---

## Step 4 — Queue Passing Jobs

For each PASS job, append to `data/pipeline.md`:
```
- {url} — {company}: {title} (via ingest, {today})
```

For ALL jobs (PASS and SKIP), append to `data/ingest-log.tsv`:
```
{url}\t{title}\t{company}\t{board}\t{today}\t{PASS or SKIP: reason}
```

Clear `data/ingest-queue.tsv` back to header-only after processing (jobs are now in the log).

---

## Step 5 — Report

Output a summary:

```
Ingest — {YYYY-MM-DD}

RSS feeds:      {n} jobs fetched
Indeed MCP:     {n} jobs fetched
Total new:      {n} (after dedup)

Pre-screen results:
  Passed:       {n}
  Skipped:      {n}
    Commission/OTE:     {n}
    Degree required:    {n}
    Contract/part-time: {n}
    Sales-primary:      {n}
    Other:              {n}

Jobs queued → run /career-ops pipeline to evaluate.
```

---

## Notes

- `data/ingest-log.tsv` is the master dedup log. Jobs already in this file are never re-queued.
- `data/applications.md` is also checked for dedup — evaluated jobs are never re-ingested.
- LinkedIn is handled separately via email-manager (job alert emails, processed daily at 8am).
- To add new search queries or boards: edit `config/search-queries.yml`.
- To run RSS only (skip Indeed MCP): `node ingest.mjs` then skip Step 2.
