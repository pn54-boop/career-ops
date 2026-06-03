#!/usr/bin/env node

/**
 * ingest.mjs — Bulk job ingestion from RSS feeds.
 *
 * Fetches job listings from Indeed, ZipRecruiter, and SimplyHired RSS feeds
 * for each configured search query. Deduplicates against ingest-log.tsv and
 * applications.md. Writes new candidates to data/ingest-queue.tsv.
 *
 * Usage:
 *   node ingest.mjs                  # run all enabled queries + boards
 *   node ingest.mjs --dry-run        # preview without writing files
 *   node ingest.mjs --query "M&A"    # run only queries matching label
 *   node ingest.mjs --board indeed   # run only one board
 *   node ingest.mjs --days 3         # override days-back window
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import yaml from 'js-yaml';

// ── Config ───────────────────────────────────────────────────────────

const QUERIES_PATH    = 'config/search-queries.yml';
const QUEUE_PATH      = 'data/ingest-queue.tsv';
const LOG_PATH        = 'data/ingest-log.tsv';
const APPLICATIONS    = 'data/applications.md';
const PIPELINE_PATH   = 'data/pipeline.md';

const QUEUE_HEADER = 'url\ttitle\tcompany\tlocation\tsnippet\tboard\tquery_label\tdate_found';
const LOG_HEADER   = 'url\ttitle\tcompany\tboard\tdate_found\tstatus';

mkdirSync('data', { recursive: true });

// ── Args ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN     = args.includes('--dry-run');
const DAYS_BACK   = parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1] || '7');
const FILTER_QUERY = args.find((a, i) => args[i - 1] === '--query');
const FILTER_BOARD = args.find((a, i) => args[i - 1] === '--board')?.toLowerCase();

// ── Load config ──────────────────────────────────────────────────────

const config = yaml.load(readFileSync(QUERIES_PATH, 'utf8'));
const queries = config.queries.filter(q => q.enabled !== false);
const boards  = config.boards;

// ── Load known URLs (dedup) ──────────────────────────────────────────

function loadKnownUrls() {
  const known = new Set();

  // From ingest log
  if (existsSync(LOG_PATH)) {
    readFileSync(LOG_PATH, 'utf8').split('\n').slice(1).forEach(line => {
      const url = line.split('\t')[0]?.trim();
      if (url) known.add(normalizeUrl(url));
    });
  }

  // From ingest queue (already staged)
  if (existsSync(QUEUE_PATH)) {
    readFileSync(QUEUE_PATH, 'utf8').split('\n').slice(1).forEach(line => {
      const url = line.split('\t')[0]?.trim();
      if (url) known.add(normalizeUrl(url));
    });
  }

  // From applications tracker
  if (existsSync(APPLICATIONS)) {
    const content = readFileSync(APPLICATIONS, 'utf8');
    const urlMatches = content.match(/https?:\/\/[^\s\)]+/g) || [];
    urlMatches.forEach(url => known.add(normalizeUrl(url)));
  }

  return known;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    // Strip tracking params — keep just origin + pathname
    return `${u.origin}${u.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

// ── RSS fetching ─────────────────────────────────────────────────────

async function fetchRss(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; career-ops/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Simple RSS XML parser — no deps, handles standard RSS 2.0
function parseRssItems(xml) {
  if (!xml) return [];
  const items = [];
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];

  for (const block of itemBlocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tag}>`, 'i'))
             || block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };

    const title    = cleanText(get('title'));
    const link     = cleanText(get('link') || get('guid'));
    const company  = cleanText(get('source') || get('author') || extractCompany(block));
    const location = cleanText(get('location') || extractLocation(block));
    const snippet  = cleanText(get('description')).slice(0, 200);

    if (title && link && link.startsWith('http')) {
      items.push({ title, url: link, company, location, snippet });
    }
  }

  return items;
}

function cleanText(str) {
  return str
    .replace(/<[^>]+>/g, ' ')   // strip HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCompany(block) {
  const m = block.match(/company[^>]*>([^<]+)</i)
         || block.match(/employer[^>]*>([^<]+)</i);
  return m ? m[1].trim() : '';
}

function extractLocation(block) {
  const m = block.match(/location[^>]*>([^<]+)</i)
         || block.match(/city[^>]*>([^<]+)</i);
  return m ? m[1].trim() : '';
}

// ── Build RSS URL ────────────────────────────────────────────────────

function buildRssUrl(template, query, daysBack) {
  return template
    .replace('{terms}',    encodeURIComponent(query.terms))
    .replace('{location}', encodeURIComponent(query.location))
    .replace('{days}',     String(daysBack))
    .replace('fromage=7',  `fromage=${daysBack}`);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 career-ops ingest${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`   Queries: ${queries.length} | Days back: ${DAYS_BACK}\n`);

  const known    = loadKnownUrls();
  const today    = new Date().toISOString().slice(0, 10);
  const newJobs  = [];
  const stats    = { fetched: 0, duplicate: 0, new: 0, errors: 0 };

  // Init files if needed
  if (!DRY_RUN) {
    if (!existsSync(QUEUE_PATH))  writeFileSync(QUEUE_PATH, QUEUE_HEADER + '\n');
    if (!existsSync(LOG_PATH))    writeFileSync(LOG_PATH,   LOG_HEADER + '\n');
  }

  const activeBoards = Object.entries(boards)
    .filter(([name, cfg]) => cfg.enabled && (!FILTER_BOARD || name === FILTER_BOARD));

  const activeQueries = queries
    .filter(q => !FILTER_QUERY || q.label.toLowerCase().includes(FILTER_QUERY.toLowerCase()));

  for (const query of activeQueries) {
    if (FILTER_QUERY && !query.label.toLowerCase().includes(FILTER_QUERY.toLowerCase())) continue;

    for (const [boardName, boardCfg] of activeBoards) {
      const rssUrl = buildRssUrl(boardCfg.rss_template, query, DAYS_BACK);
      process.stdout.write(`  [${boardName}] ${query.label} ... `);

      const xml   = await fetchRss(rssUrl);
      const items = parseRssItems(xml);
      stats.fetched += items.length;

      let boardNew = 0;
      for (const item of items) {
        const norm = normalizeUrl(item.url);
        if (known.has(norm)) {
          stats.duplicate++;
          continue;
        }
        known.add(norm);
        stats.new++;
        boardNew++;
        newJobs.push({ ...item, board: boardName, query_label: query.label, date: today });
      }

      if (!xml) {
        stats.errors++;
        console.log(`❌ fetch failed`);
      } else {
        console.log(`${items.length} found, ${boardNew} new`);
      }

      // Polite delay between requests
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\n📊 Results:`);
  console.log(`   Fetched:    ${stats.fetched}`);
  console.log(`   Duplicates: ${stats.duplicate}`);
  console.log(`   New:        ${stats.new}`);
  console.log(`   Errors:     ${stats.errors}`);

  if (newJobs.length === 0) {
    console.log('\n✅ No new jobs found.');
    return;
  }

  if (DRY_RUN) {
    console.log(`\n🔍 Dry run — would queue ${newJobs.length} jobs:`);
    newJobs.slice(0, 10).forEach(j => console.log(`   ${j.title} @ ${j.company || 'unknown'} (${j.board})`));
    if (newJobs.length > 10) console.log(`   ... and ${newJobs.length - 10} more`);
    return;
  }

  // Write to queue TSV
  const queueLines = newJobs.map(j =>
    [j.url, j.title, j.company, j.location, j.snippet.replace(/\t/g, ' '), j.board, j.query_label, j.date]
      .map(v => (v || '').replace(/\n/g, ' '))
      .join('\t')
  );
  appendFileSync(QUEUE_PATH, queueLines.join('\n') + '\n');

  console.log(`\n✅ ${newJobs.length} new jobs written to ${QUEUE_PATH}`);
  console.log(`   Run /career-ops ingest to pre-screen and queue for evaluation.\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
