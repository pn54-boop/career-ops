#!/usr/bin/env node

/**
 * ingest.mjs — Bulk job ingestion via Adzuna API.
 *
 * Queries Adzuna (aggregates Indeed, ZipRecruiter, LinkedIn, Glassdoor, etc.)
 * for each search query in config/search-queries.yml. Deduplicates against
 * ingest-log.tsv and applications.md. Writes new candidates to
 * data/ingest-queue.tsv for pre-screening by /career-ops ingest.
 *
 * Requires: ADZUNA_APP_ID and ADZUNA_APP_KEY in .env
 * Get a free key at: https://developer.adzuna.com
 *
 * Usage:
 *   node ingest.mjs                  # run all enabled queries
 *   node ingest.mjs --dry-run        # preview without writing files
 *   node ingest.mjs --query "M&A"    # run only queries matching label
 *   node ingest.mjs --days 3         # override days-back window (default 7)
 *   node ingest.mjs --pages 3        # results pages per query (default 2, max=50/page)
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import yaml from 'js-yaml';
import 'dotenv/config';

// ── Config ───────────────────────────────────────────────────────────

const QUERIES_PATH  = 'config/search-queries.yml';
const QUEUE_PATH    = 'data/ingest-queue.tsv';
const LOG_PATH      = 'data/ingest-log.tsv';
const APPLICATIONS  = 'data/applications.md';

const QUEUE_HEADER  = 'url\ttitle\tcompany\tlocation\tsnippet\tboard\tquery_label\tdate_found';
const LOG_HEADER    = 'url\ttitle\tcompany\tboard\tdate_found\tstatus';

const ADZUNA_BASE   = 'https://api.adzuna.com/v1/api/jobs/us/search';
const RESULTS_PER_PAGE = 50; // Adzuna max

mkdirSync('data', { recursive: true });

// ── Args ─────────────────────────────────────────────────────────────

const args         = process.argv.slice(2);
const DRY_RUN      = args.includes('--dry-run');
const DAYS_BACK    = parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1]  || '7');
const PAGES        = parseInt(args.find(a => a.startsWith('--pages='))?.split('=')[1] || '2');
const FILTER_QUERY = args.find((a, i) => args[i - 1] === '--query');

// ── Credentials ──────────────────────────────────────────────────────

const APP_ID  = process.env.ADZUNA_APP_ID;
const APP_KEY = process.env.ADZUNA_APP_KEY;

if (!APP_ID || !APP_KEY) {
  console.error('❌ Missing Adzuna credentials.');
  console.error('   Add ADZUNA_APP_ID and ADZUNA_APP_KEY to your .env file.');
  console.error('   Get a free key at: https://developer.adzuna.com');
  process.exit(1);
}

// ── Load config ──────────────────────────────────────────────────────

const config  = yaml.load(readFileSync(QUERIES_PATH, 'utf8'));
const queries = config.queries.filter(q => q.enabled !== false);

// ── Dedup ────────────────────────────────────────────────────────────

function loadKnownUrls() {
  const known = new Set();

  if (existsSync(LOG_PATH)) {
    readFileSync(LOG_PATH, 'utf8').split('\n').slice(1).forEach(line => {
      const url = line.split('\t')[0]?.trim();
      if (url) known.add(normalizeUrl(url));
    });
  }

  if (existsSync(QUEUE_PATH)) {
    readFileSync(QUEUE_PATH, 'utf8').split('\n').slice(1).forEach(line => {
      const url = line.split('\t')[0]?.trim();
      if (url) known.add(normalizeUrl(url));
    });
  }

  if (existsSync(APPLICATIONS)) {
    const content = readFileSync(APPLICATIONS, 'utf8');
    (content.match(/https?:\/\/[^\s\)]+/g) || []).forEach(url => known.add(normalizeUrl(url)));
  }

  return known;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

// ── Adzuna API ───────────────────────────────────────────────────────

async function fetchAdzunaPage(terms, page, daysBack) {
  const params = new URLSearchParams({
    app_id:          APP_ID,
    app_key:         APP_KEY,
    what:            terms,
    where:           'United States',
    distance:        '25',
    max_days_old:    String(daysBack),
    results_per_page: String(RESULTS_PER_PAGE),
    sort_by:         'date',
    content_type:    'application/json',
  });

  const url = `${ADZUNA_BASE}/${page}?${params}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

    if (res.status === 401) {
      console.error('\n❌ Adzuna authentication failed — check your APP_ID and APP_KEY in .env');
      process.exit(1);
    }
    if (res.status === 429) {
      console.log(' (rate limited, pausing 5s...)');
      await new Promise(r => setTimeout(r, 5000));
      return null;
    }
    if (!res.ok) return null;

    const data = await res.json();
    return data.results || [];
  } catch (err) {
    return null;
  }
}

function parseAdzunaJob(job, queryLabel) {
  const url     = job.redirect_url || '';
  const title   = job.title || '';
  const company = job.company?.display_name || '';
  const location= job.location?.display_name || '';
  const snippet = (job.description || '').replace(/\s+/g, ' ').slice(0, 200);

  return { url, title, company, location, snippet, board: 'adzuna', query_label: queryLabel };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 career-ops ingest — Adzuna${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`   Queries: ${queries.length} | Pages: ${PAGES} | Days back: ${DAYS_BACK}`);
  console.log(`   Max results: ~${queries.length * PAGES * RESULTS_PER_PAGE}\n`);

  const known   = loadKnownUrls();
  const today   = new Date().toISOString().slice(0, 10);
  const newJobs = [];
  const stats   = { fetched: 0, duplicate: 0, new: 0, errors: 0 };

  if (!DRY_RUN) {
    if (!existsSync(QUEUE_PATH)) writeFileSync(QUEUE_PATH, QUEUE_HEADER + '\n');
    if (!existsSync(LOG_PATH))   writeFileSync(LOG_PATH,   LOG_HEADER   + '\n');
  }

  const activeQueries = queries.filter(q =>
    !FILTER_QUERY || q.label.toLowerCase().includes(FILTER_QUERY.toLowerCase())
  );

  for (const query of activeQueries) {
    let queryNew = 0;
    let queryFetched = 0;
    process.stdout.write(`  ${query.label} ... `);

    for (let page = 1; page <= PAGES; page++) {
      const results = await fetchAdzunaPage(query.terms, page, DAYS_BACK);

      if (!results) {
        stats.errors++;
        break;
      }

      if (results.length === 0) break; // No more results

      queryFetched += results.length;
      stats.fetched += results.length;

      for (const job of results) {
        const parsed = parseAdzunaJob(job, query.label);
        if (!parsed.url) continue;

        const norm = normalizeUrl(parsed.url);
        if (known.has(norm)) {
          stats.duplicate++;
          continue;
        }
        known.add(norm);
        stats.new++;
        queryNew++;
        newJobs.push({ ...parsed, date: today });
      }

      // Polite delay between pages
      if (page < PAGES) await new Promise(r => setTimeout(r, 500));
    }

    console.log(`${queryFetched} fetched, ${queryNew} new`);
  }

  console.log(`\n📊 Results:`);
  console.log(`   Fetched:    ${stats.fetched}`);
  console.log(`   Duplicates: ${stats.duplicate}`);
  console.log(`   New:        ${stats.new}`);
  if (stats.errors) console.log(`   Errors:     ${stats.errors}`);

  if (newJobs.length === 0) {
    console.log('\n✅ No new jobs found.');
    return;
  }

  if (DRY_RUN) {
    console.log(`\n🔍 Dry run — would queue ${newJobs.length} jobs:`);
    newJobs.slice(0, 15).forEach(j =>
      console.log(`   ${j.title} @ ${j.company || 'unknown'} — ${j.location}`)
    );
    if (newJobs.length > 15) console.log(`   ... and ${newJobs.length - 15} more`);
    return;
  }

  // Write to queue TSV
  const lines = newJobs.map(j =>
    [j.url, j.title, j.company, j.location, j.snippet.replace(/\t|\n/g, ' '), j.board, j.query_label, j.date]
      .map(v => (v || '').replace(/\n/g, ' '))
      .join('\t')
  );
  appendFileSync(QUEUE_PATH, lines.join('\n') + '\n');

  console.log(`\n✅ ${newJobs.length} new jobs written to ${QUEUE_PATH}`);
  console.log(`   Run /career-ops ingest to pre-screen and queue for evaluation.\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
