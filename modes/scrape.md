# Mode: scrape — Chrome-Based Job Search Scraper

Navigates a job search URL in the user's real browser (via Claude in Chrome), extracts all job listings across multiple pages, pre-screens against hard exclusions, and queues passing jobs into pipeline.md for full evaluation.

**Requires:** Chrome open with Claude in Chrome extension active. User must be logged into the job board.

**Usage:** `/career-ops scrape {search URL}`

---

## Step 0 — Setup

Read exclusion rules from `C:\Users\patri\.claude\skills\email-manager\config.md`.
Read `data/ingest-log.tsv` and `data/applications.md` to build the dedup set (known URLs).
Read `data/pipeline.md` to avoid re-queuing already-queued jobs.

Confirm Chrome is connected. If Claude in Chrome tools are unavailable, tell the user to open Chrome with the extension active and retry.

Ask the user (or infer from the URL):
- **How many pages** to scrape? Default: 10. Max recommended: 50.
- The URL provided is the starting search URL with all filters already applied.

---

## Step 1 — Detect Board

Identify the job board from the URL:

| URL pattern | Board | Notes |
|-------------|-------|-------|
| `linkedin.com/jobs` | LinkedIn | 25 results/page, `start=` pagination |
| `indeed.com` | Indeed | 15 results/page, `start=` pagination |
| `glassdoor.com/Job` | Glassdoor | Click-based pagination |
| `ziprecruiter.com` | ZipRecruiter | `page=` pagination |
| `handshake.com` | Handshake | Scroll-based |
| Other | Generic | Use JS extraction fallback |

---

## Step 2 — Scrape Pages

For each page up to the requested page count:

### 2a — Navigate

**LinkedIn:** Build paginated URL by adding/incrementing `start=` parameter:
- Page 1: use URL as-is
- Page 2: add `&start=25`
- Page 3: `&start=50`
- Page N: `&start={(N-1)*25}`

**Indeed:** Increment `start=` by 15 per page.

**ZipRecruiter:** Increment `page=` by 1.

**Glassdoor / Generic:** Navigate to URL for page 1, then click the "Next" button for subsequent pages.

Navigate using Claude in Chrome `navigate` tool.

### 2b — Wait for results

After navigation, pause briefly (1–2 seconds) for the page to load. Then extract jobs.

### 2c — Extract job listings

Run this JavaScript via the `javascript_tool` to extract jobs from the current page. Adapt selectors per board:

**LinkedIn:**
```javascript
const jobs = [];
document.querySelectorAll('a[href*="/jobs/view/"]').forEach(a => {
  const url = a.href.split('?')[0];
  if (!url.includes('/jobs/view/')) return;
  const card = a.closest('li, .job-card-container');
  const title = (
    a.querySelector('[class*="title"]')?.textContent ||
    a.textContent
  ).trim();
  const company = card?.querySelector('[class*="subtitle"], [class*="company"]')?.textContent.trim() || '';
  const location = card?.querySelector('[class*="location"]')?.textContent.trim() || '';
  if (title && url) jobs.push({ url, title, company, location });
});
return JSON.stringify([...new Map(jobs.map(j => [j.url, j])).values()]);
```

**Indeed:**
```javascript
const jobs = [];
document.querySelectorAll('a[id^="job_"], a[href*="/rc/clk"], a[href*="indeed.com/pagead"], .jobTitle a').forEach(a => {
  const url = a.href?.split('?')[0];
  const card = a.closest('[class*="job"], [class*="result"], li');
  const title = (a.querySelector('[class*="title"]')?.textContent || a.textContent).trim();
  const company = card?.querySelector('[class*="company"], [data-testid*="company"]')?.textContent.trim() || '';
  const location = card?.querySelector('[class*="location"]')?.textContent.trim() || '';
  if (title && url && url.startsWith('http')) jobs.push({ url, title, company, location });
});
return JSON.stringify([...new Map(jobs.map(j => [j.url, j])).values()]);
```

**Generic fallback (any board):**
```javascript
const jobs = [];
const seen = new Set();
document.querySelectorAll('a[href]').forEach(a => {
  const href = a.href;
  if (!href || seen.has(href)) return;
  const text = a.textContent.trim();
  if (text.length < 5 || text.length > 150) return;
  // Filter to likely job title links (near a company name or location)
  const parent = a.closest('li, article, div[class*="job"], div[class*="card"], div[class*="result"]');
  if (!parent) return;
  seen.add(href);
  jobs.push({ url: href, title: text, company: '', location: '' });
});
return JSON.stringify(jobs.slice(0, 100));
```

### 2d — Check for end of results

Stop paginating if:
- The extracted jobs list is empty
- The page contains "no results", "no jobs found", or similar
- You've reached the requested page limit

### 2e — Dedup

For each extracted job:
- Normalize the URL (strip tracking params: `?trk=`, `?trackingId=`, `?refId=`, `?utm_`, `?currentJobId=`, etc.)
- Check against the known URLs set loaded in Step 0
- If already known: skip
- If new: add to collection

---

## Step 3 — Fast Batch Pre-Screen

Once all pages are scraped, pre-screen in batches of 50.

For each job, using title + company only (no JD fetch):

**SKIP if title clearly matches any of these:**
- Commission, OTE, quota, uncapped earnings
- MBA required, JD required, PhD required (hard requirement — not "preferred")
- Intern, Internship, Part-time, Contract, Temp, Freelance
- Sales Representative, Account Executive, SDR, BDR
- Financial Advisor (commission-based), Insurance Agent, Loan Officer
- Recruiter, Staffing, Talent Acquisition (as primary role)
- Wealth Management + financial planning (likely commission advisory)

**When in doubt: PASS.** Full A-G evaluation catches edge cases.

---

## Step 4 — Write Results

**Passing jobs → `data/pipeline.md`:**
```
- {url} — {company}: {title} (via scrape {board}, {YYYY-MM-DD})
```

**All jobs → `data/ingest-log.tsv`:**
```
{url}\t{title}\t{company}\t{board}\t{YYYY-MM-DD}\t{PASS or SKIP: reason}
```

---

## Step 5 — Report

```
Scrape — {board} — {YYYY-MM-DD}

Pages scraped:    {n}
Jobs found:       {n}
Duplicates:       {n} (already seen)
New jobs:         {n}

Pre-screen:
  Passed:         {n} → queued in pipeline.md
  Skipped:        {n}
    Commission:         {n}
    Contract/PT:        {n}
    Sales-primary:      {n}
    Other:              {n}

Run /career-ops pipeline to evaluate queued jobs.
```

---

## URL cleaning rules

Strip these tracking parameters before storing any URL:
- `trk`, `trackingId`, `refId`, `originToLandingJobPostings`, `currentJobId`
- `utm_source`, `utm_medium`, `utm_campaign`
- `eBP`, `geoId`, `origin`, `sortBy`, `f_E`, `f_WT`, `f_TPR`, `f_SB2`

LinkedIn job URLs should resolve to: `https://www.linkedin.com/jobs/view/{jobId}`

---

## Notes

- This mode uses the user's live authenticated browser session — no extra login needed.
- Chrome must be open and the Claude in Chrome extension active.
- LinkedIn shows 25 results per page. 10 pages = ~250 jobs scraped.
- LinkedIn may throttle after many rapid page navigations — the mode pauses between pages.
- For very large scrapes (50+ pages), run in multiple sessions to avoid detection.
- Scraped URLs are logged to `ingest-log.tsv` permanently — re-running the same search won't re-queue the same jobs.
