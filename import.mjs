#!/usr/bin/env node

/**
 * import.mjs — CSV job importer.
 *
 * Reads a CSV file with the pipeline schema, deduplicates against known jobs,
 * and writes new entries to data/ingest-queue.tsv for pre-screening by
 * /career-ops ingest.
 *
 * Expected CSV schema (header row required):
 *   job_id, title, company, location, work_type, salary, linkedin_url
 *
 * Usage:
 *   node import.mjs jobs.csv
 *   node import.mjs jobs.csv --dry-run
 *   node import.mjs jobs.csv --no-header   # if CSV has no header row
 *
 * The CSV file can be placed anywhere — provide the full or relative path.
 * Column order must match the schema above unless a header row is present.
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';

// ── Config ───────────────────────────────────────────────────────────

const QUEUE_PATH   = 'data/ingest-queue.tsv';
const LOG_PATH     = 'data/ingest-log.tsv';
const APPLICATIONS = 'data/applications.md';
const PIPELINE     = 'data/pipeline.md';

const QUEUE_HEADER = 'url\ttitle\tcompany\tlocation\tsnippet\tboard\tquery_label\tdate_found';
const LOG_HEADER   = 'url\ttitle\tcompany\tboard\tdate_found\tstatus';

mkdirSync('data', { recursive: true });

// ── Args ─────────────────────────────────────────────────────────────

const args      = process.argv.slice(2);
const csvPath   = args.find(a => !a.startsWith('--'));
const DRY_RUN   = args.includes('--dry-run');
const NO_HEADER = args.includes('--no-header');

if (!csvPath) {
  console.error('Usage: node import.mjs <file.csv> [--dry-run] [--no-header]');
  process.exit(1);
}

if (!existsSync(csvPath)) {
  console.error(`❌ File not found: ${csvPath}`);
  process.exit(1);
}

// ── CSV parser ───────────────────────────────────────────────────────
// Handles quoted fields, commas inside quotes, and CRLF line endings.

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    rows.push(fields);
  }

  return rows;
}

// ── Column mapping ───────────────────────────────────────────────────

const SCHEMA_COLS = ['job_id', 'title', 'company', 'location', 'work_type', 'salary', 'linkedin_url'];

function buildColMap(headerRow) {
  const map = {};
  headerRow.forEach((col, i) => {
    const normalized = col.toLowerCase().trim().replace(/\s+/g, '_');
    if (SCHEMA_COLS.includes(normalized)) map[normalized] = i;
  });
  return map;
}

function extractRow(fields, colMap) {
  const get = (key) => (fields[colMap[key]] || '').trim();
  return {
    job_id:      get('job_id'),
    title:       get('title'),
    company:     get('company'),
    location:    get('location'),
    work_type:   get('work_type'),
    salary:      get('salary'),
    url:         get('linkedin_url'),
  };
}

// ── Dedup ────────────────────────────────────────────────────────────

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

function loadKnownUrls() {
  const known = new Set();
  for (const path of [LOG_PATH, QUEUE_PATH]) {
    if (existsSync(path)) {
      readFileSync(path, 'utf8').split('\n').slice(1).forEach(line => {
        const url = line.split('\t')[0]?.trim();
        if (url) known.add(normalizeUrl(url));
      });
    }
  }
  if (existsSync(APPLICATIONS)) {
    (readFileSync(APPLICATIONS, 'utf8').match(/https?:\/\/[^\s\)]+/g) || [])
      .forEach(url => known.add(normalizeUrl(url)));
  }
  if (existsSync(PIPELINE)) {
    (readFileSync(PIPELINE, 'utf8').match(/https?:\/\/[^\s\)]+/g) || [])
      .forEach(url => known.add(normalizeUrl(url)));
  }
  return known;
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const text  = readFileSync(csvPath, 'utf8');
  const rows  = parseCsv(text);
  const today = new Date().toISOString().slice(0, 10);

  if (rows.length === 0) {
    console.error('❌ CSV file is empty.');
    process.exit(1);
  }

  // Resolve header / column mapping
  let colMap;
  let dataRows;

  if (NO_HEADER) {
    // Assume schema order: job_id, title, company, location, work_type, salary, linkedin_url
    colMap = { job_id: 0, title: 1, company: 2, location: 3, work_type: 4, salary: 5, linkedin_url: 6 };
    dataRows = rows;
  } else {
    colMap   = buildColMap(rows[0]);
    dataRows = rows.slice(1);

    if (!colMap.linkedin_url && !colMap.url) {
      console.error('❌ Could not find a URL column.');
      console.error('   Expected column name: linkedin_url (or url)');
      console.error(`   Found columns: ${rows[0].join(', ')}`);
      process.exit(1);
    }
    // Allow "url" as alias for "linkedin_url"
    if (!colMap.linkedin_url && colMap.url) colMap.linkedin_url = colMap.url;
  }

  console.log(`\n📥 career-ops import${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`   File:  ${csvPath}`);
  console.log(`   Rows:  ${dataRows.length}`);

  const known  = loadKnownUrls();
  const newJobs = [];
  const stats  = { total: 0, skipped_no_url: 0, duplicate: 0, new: 0 };

  for (const fields of dataRows) {
    if (fields.every(f => !f)) continue; // blank row
    stats.total++;

    const job = extractRow(fields, colMap);

    if (!job.url || !job.url.startsWith('http')) {
      stats.skipped_no_url++;
      continue;
    }

    const norm = normalizeUrl(job.url);
    if (known.has(norm)) {
      stats.duplicate++;
      continue;
    }

    known.add(norm);
    stats.new++;

    // Build snippet from available fields
    const snippetParts = [];
    if (job.work_type) snippetParts.push(job.work_type);
    if (job.salary)    snippetParts.push(job.salary);
    const snippet = snippetParts.join(' | ');

    newJobs.push({
      url:         job.url,
      title:       job.title,
      company:     job.company,
      location:    job.location,
      snippet,
      board:       'csv-import',
      query_label: job.job_id || 'imported',
      date:        today,
    });
  }

  console.log(`\n📊 Results:`);
  console.log(`   Total rows:    ${stats.total}`);
  console.log(`   No URL:        ${stats.skipped_no_url}`);
  console.log(`   Duplicates:    ${stats.duplicate}`);
  console.log(`   New:           ${stats.new}`);

  if (newJobs.length === 0) {
    console.log('\n✅ No new jobs to import.');
    return;
  }

  if (DRY_RUN) {
    console.log(`\n🔍 Would import ${newJobs.length} jobs:`);
    newJobs.slice(0, 15).forEach(j =>
      console.log(`   ${j.title} @ ${j.company || 'unknown'} — ${j.location}`)
    );
    if (newJobs.length > 15) console.log(`   ... and ${newJobs.length - 15} more`);
    return;
  }

  // Init files if needed
  if (!existsSync(QUEUE_PATH)) writeFileSync(QUEUE_PATH, QUEUE_HEADER + '\n');
  if (!existsSync(LOG_PATH))   writeFileSync(LOG_PATH,   LOG_HEADER   + '\n');

  const lines = newJobs.map(j =>
    [j.url, j.title, j.company, j.location, j.snippet, j.board, j.query_label, j.date]
      .map(v => (v || '').replace(/\t|\n/g, ' '))
      .join('\t')
  );
  appendFileSync(QUEUE_PATH, lines.join('\n') + '\n');

  console.log(`\n✅ ${newJobs.length} jobs written to ${QUEUE_PATH}`);
  console.log(`   Run /career-ops ingest to pre-screen and queue for evaluation.\n`);
}

main();
