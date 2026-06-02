# career-ops — Session Handoff Doc
*Paste the contents of this file at the start of a new Claude Code session to restore full context.*

---

## Who You Are Working With

**Patrick G. Nauert** — Yale grad (Philosophy), former D-I football player (USAFA + Yale), finance professional based in Charleston, SC. Targeting analytical roles at 10–100 person companies across finance and beyond. Open to relocation, enjoys travel when company-paid.

**GitHub fork:** https://github.com/pn54-boop/career-ops  
**Local repo:** `C:\Users\patri\career-ops\`

---

## What career-ops Is

An AI-powered job search system built on Claude Code. It evaluates job postings (A–G blocks, scored 1–5), generates tailored PDF CVs, scans job portals, and tracks applications. Patrick uses it via the `/career-ops` slash command from any Claude Code session.

**Global skill:** `C:\Users\patri\.claude\skills\career-ops\SKILL.md`  
**Key command:** `/career-ops [URL or JD text]` — runs full pipeline (evaluate + report + PDF + tracker)

---

## Folder Access You Will Need

Request access to these at the start of the session if tools require it:

| Folder | Purpose |
|--------|---------|
| `C:\Users\patri\career-ops\` | Main repo — everything lives here |
| `C:\Users\patri\.claude\skills\career-ops\` | Global SKILL.md for /career-ops command |
| `C:\Users\patri\OneDrive\Documents\resume\Cover Letters\` | 22 cover letters used for voice/tone analysis |
| `C:\Users\patri\OneDrive\Documents\Career Coach\Aptitude\` | Forte + Strong Interest Inventory PDFs |
| `C:\Users\patri\career-ops\modes\` | AI instruction files (modes) |
| `C:\Users\patri\career-ops\config\` | profile.yml and other config |
| `C:\Users\patri\career-ops\data\` | applications.md, pipeline.md |
| `C:\Users\patri\career-ops\output\` | Generated PDFs |
| `C:\Users\patri\career-ops\reports\` | Evaluation reports |

---

## Current Status — What Has Been Done

### ✅ Repo Setup & Cleanup
- Forked from santifer/career-ops → pn54-boop/career-ops
- Removed all non-English mode files (de, fr, ja, pt, ru, tr, ua)
- Removed non-Claude platform files (AGENTS.md, GEMINI.md, .agents/, .qwen/, .claude-plugin/)
- Removed Nix files, update-system.mjs, modes/update.md
- Community/governance docs moved to `reference/` folder
- `origin` remote correctly points to pn54-boop/career-ops

### ✅ Interactive Docs Built
- `docs/architecture.html` — interactive architecture map (6 tabs)
- `reference/filemap.html` — interactive file map of all repo files
- Open locally: `file:///C:/Users/patri/career-ops/docs/architecture.html`

### ✅ User Config Files — Completed
| File | Status | Notes |
|------|--------|-------|
| `cv.md` | ✅ Complete | Full work history, 5 summary variants, metrics table |
| `config/profile.yml` | ✅ Complete | Contact, archetypes, comp, location all filled in |
| `modes/_profile.md` | ✅ Complete | Fully customized — see details below |
| `article-digest.md` | ❌ Does not exist yet | **NEXT TASK** |
| `portals.yml` | ⚠️ Needs target companies | Has structure, missing Patrick's targets |
| `writing-samples/` | ❌ Empty | Lower priority |

### ✅ modes/_profile.md — Key Contents
- 6 archetypes: VC Analyst, M&A Advisory, Investment Research, Strategy/BizDev, Operating Partner, Generalist
- Adaptive framing table (which experiences to lead with per role type)
- Full exit narrative + 45-second interview version
- Stallion Equity: frame as 2-month contract, no fund mention
- Insight Group (geotechnical): skip in finance interviews, explain naturally if asked
- Bulldog Mergers: independent consulting entity / tax structure, NOT a startup with employees
- Comp: $75K soft floor, total package governs, negotiation scripts included
- Automatic disqualifiers: sales-heavy, commission, contract roles, part-time
- Personality section from Forte + Strong Interest Inventory
- Writing style cache: 9 rules, banned phrases, 3 verbatim reference sentences
- Location: travel = positive, open to relocation

---

## Current Task — Where to Pick Up

**We are customizing Patrick's career-ops config files one by one.**

### NEXT: Create `article-digest.md`

This file does not exist yet. It needs to be created at `C:\Users\patri\career-ops\article-digest.md`.

**What it is:** Deeper proof points, deal stories, and metrics that override cv.md during evaluations. Think of it as the "evidence file" — specific case studies Claude reads when generating evaluations and interview prep.

**Format reference:** See `examples/article-digest-example.md` in the repo for structure.

**What to ask Patrick:**
- For each major role, dig for specific deal stories with numbers
- Key areas: Viking deal specifics (any memorable transactions?), Stallion Python workflow details, MVP/Spike investment thesis examples
- STAR-format stories for behavioral interviews
- Any metrics not already in cv.md

### AFTER THAT: `portals.yml`

Needs Patrick's target companies and finance-specific role keywords added. The file has the structure but is populated with template examples, not his actual targets.

**What to ask:** Which specific firms/companies does he want the scanner to monitor? What job title keywords should it filter for?

---

## Patrick's Preferences & Common Requests

### How he likes things done
- **Always ask before deleting files** — he confirmed this multiple times
- **Commit and push to pn54-boop/career-ops** after significant changes
- **Spawn subagents** for analysis tasks (he explicitly requested this for voice/tone analysis and aptitude analysis)
- **Show him before writing** when building new major files — he likes to review direction

### Job search preferences
- **Company size:** 10–100 people strongly preferred
- **Geography:** No constraint. Open to relocation anywhere. Travel is a positive
- **Sector:** Open — finance, tech, anything interesting. Actively considering moving away from pure finance
- **Role fit:** Analytical depth + ownership over outcomes + small team. NOT sales-heavy, commission-driven, or primarily people management
- **Auto-disqualify:** Sales/commission roles, contract roles, part-time roles

### Compensation
- **Target:** $75K–$100K+ base + bonus/carry/equity
- **Floor:** $75K soft floor — will flex for strong total package, equity, carry, or upside
- **Frame:** Total compensation package, not base salary alone

### Key personality/aptitude notes (from Forte + Strong Interest Inventory)
- Holland code: IRA (Investigative + Realistic + Artistic) — problem-solver, not a people-manager
- Sales interest: Very Low (36/100) — capital raising and BD drain him, analysis energizes him
- Risk tolerance: Very High (72nd percentile)
- Non-conformist: resists over-structured environments and bureaucracy
- Will only work hard for people he respects — lazy leadership is his #1 demotivator
- Genuinely enjoys VC deal team work (evaluating companies, building conviction)

### Writing style rules (for cover letters / application answers)
- Never use: "honed," "aligns seamlessly," "esteemed organization," "I look forward to the possibility"
- Open first sentence with something specific to the firm
- Close specifically (not boilerplate)
- Reference athletic background only as evidence of a trait, never as a credential
- Parallel triads are fine; 4-item filler lists are not
- Quantify scope (18+ deals, 100+ models) not vague impact percentages

---

## Technical Notes

### Git workflow
```bash
# Always push to Patrick's fork
git add [files]
git commit -m "message"
git push origin main
# remote is already set to https://github.com/pn54-boop/career-ops.git
```

### Running career-ops
```bash
# Health check
node doctor.mjs

# Pipeline validator
node verify-pipeline.mjs

# Generate PDF (after HTML CV is created)
node generate-pdf.mjs output/[filename].html output/[filename].pdf --format=letter
```

### Pending items (unmerged)
- `batch/tracker-additions/001-the-beach-company.tsv` — Beach Company evaluation from first session, not yet merged into applications.md
- Run `node merge-tracker.mjs` to merge it when ready

### Viewing the docs
```
file:///C:/Users/patri/career-ops/docs/architecture.html
file:///C:/Users/patri/career-ops/reference/filemap.html
```

---

## First Evaluation Completed
**Company:** The Beach Company (Associate, Investment Management)  
**Score:** 3.5/5 | **Legitimacy:** High Confidence  
**Report:** `reports/001-the-beach-company-2026-05-26.md`  
**PDF:** `output/cv-patrick-g-nauert-the-beach-company-2026-05-26.pdf`  
**Tracker:** Pending merge from `batch/tracker-additions/001-the-beach-company.tsv`
