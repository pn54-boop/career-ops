# Career-Ops -- AI Job Search Pipeline

## Data Contract

**User Layer (NEVER auto-updated):** `cv.md`, `config/profile.yml`, `modes/_profile.md`, `article-digest.md`, `portals.yml`, `data/*`, `reports/*`, `output/*`, `interview-prep/*`

**System Layer (auto-updatable):** `modes/_shared.md`, `modes/oferta.md`, all other modes, `CLAUDE.md`, `*.mjs` scripts

**RULE:** Customizations (archetypes, narrative, negotiation scripts, proof points, location policy, comp targets) → write to `modes/_profile.md` or `config/profile.yml`. Never edit `modes/_shared.md` for user-specific content.

## Main Files

| File | Function |
|------|----------|
| `data/applications.md` | Application tracker |
| `data/pipeline.md` | Inbox of pending URLs |
| `portals.yml` | Query and company config |
| `templates/cv-template.html` | HTML template for CVs |
| `generate-pdf.mjs` | Playwright: HTML to PDF |
| `article-digest.md` | Compact proof points |
| `interview-prep/story-bank.md` | Accumulated STAR stories |
| `reports/` | Evaluation reports (`{###}-{company-slug}-{YYYY-MM-DD}.md`) |

## CV Source of Truth

- `cv.md` is the canonical CV; `article-digest.md` has detailed proof points
- **NEVER hardcode metrics** — read from these files at evaluation time

---

## Ethical Use

- **NEVER submit without user review.** Always stop before clicking Submit/Send/Apply.
- **Discourage low-fit applications.** Score below 4.0 → recommend against. Only proceed if user overrides.
- Quality over quantity: 5 targeted applications beat 50 generic ones.

---

## Offer Verification -- MANDATORY

**NEVER trust WebSearch/WebFetch to verify if an offer is still active.** ALWAYS use Playwright:
1. `browser_navigate` to the URL
2. `browser_snapshot` to read content
3. Footer/navbar only = closed. Title + description + Apply button = active.

**Batch exception:** Use WebFetch as fallback; mark report `**Verification:** unconfirmed (batch mode)`.

---

## Stack and Conventions

- Node.js (mjs), Playwright (PDF + scraping), YAML (config), HTML/CSS (template), Markdown (data)
- Output in `output/` (gitignored), Reports in `reports/`
- Report numbering: sequential 3-digit zero-padded
- **RULE: After each batch, run `node merge-tracker.mjs`**
- **RULE: NEVER create new entries in applications.md if company+role already exists.** Update existing entry.

### TSV Format for Tracker Additions

Write one TSV per evaluation to `batch/tracker-additions/{num}-{company-slug}.tsv`. Single line, 9 tab-separated columns:

```
{num}\t{date}\t{company}\t{role}\t{status}\t{score}/5\t{pdf_emoji}\t[{num}](reports/{num}-{slug}-{date}.md)\t{note}
```

Columns: num, date, company, role, **status** (before score), score, pdf emoji, report link, notes. The merge script handles the column swap in applications.md.

### Pipeline Integrity

1. NEVER edit applications.md to ADD entries — use TSV + `merge-tracker.mjs`
2. YES edit applications.md to UPDATE status/notes of existing entries
3. All reports must include `**URL:**` and `**Legitimacy:** {tier}` in header
4. All statuses must be canonical (see `templates/states.yml`)
5. Health check: `node verify-pipeline.mjs`

### Canonical States

| State | When |
|-------|------|
| `Evaluated` | Report done, pending decision |
| `Applied` | Application sent |
| `Responded` | Company responded |
| `Interview` | In interview process |
| `Offer` | Offer received |
| `Rejected` | Rejected by company |
| `Discarded` | Discarded by candidate or offer closed |
| `SKIP` | Doesn't fit |

**Rules:** No bold, no dates, no extra text in status field.
