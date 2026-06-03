# Mode: auto-pipeline — Full Automatic Pipeline

When the user pastes a JD (text or URL) without an explicit sub-command, execute the ENTIRE pipeline in sequence:

## Step 0 — Extract JD

If the input is a **URL** (not pasted JD text), follow this strategy to extract the content:

**Priority order:**

1. **Playwright (preferred):** Most job portals (Lever, Ashby, Greenhouse, Workday) are SPAs. Use `browser_navigate` + `browser_snapshot` to render and read the JD.
2. **WebFetch (fallback):** For static pages (ZipRecruiter, WeLoveProduct, company career pages).
3. **WebSearch (last resort):** Search for the role title + company in secondary portals that index the JD in static HTML.

**If no method works:** Ask the candidate to paste the JD manually or share a screenshot.

**If the input is JD text** (not a URL): use directly, without needing to fetch.

## Step 1 — A-G Evaluation

Execute Blocks A–G per `modes/oferta.md`.

**Context loading for this step:**
- Load: `cv.md`, `modes/_profile.md`, `config/profile.yml` — these are needed for scoring
- Do NOT load `article-digest.md` yet — load it in Step 1b below only if score warrants it
- Do NOT load `templates/cv-template.html` — load it in Step 3 only

Run Blocks A–E and Block G first. Compute the global score.

## Step 1b — Conditional: Load article-digest.md

**If global score ≥ 3.5:** Read `article-digest.md` now. Use it to enrich Block F (interview plan) with specific deal stories and STAR examples from the digest.

**If global score < 3.5:** Skip `article-digest.md` entirely. Skip Block F or produce a minimal version (2–3 generic stories from cv.md only). The role is not worth full interview prep.

## Step 2 — Save Report .md

Save the full evaluation in `reports/{###}-{company-slug}-{YYYY-MM-DD}.md` (see format in `modes/oferta.md`).
Include Block G in the saved report. Add **URL:** {url} and **Legitimacy:** {tier} to the report header.

## Step 3 — Generate PDF

**Only if global score ≥ 3.0.** Below 3.0, skip PDF generation entirely — log PDF as ❌ in tracker.

Read `config/profile.yml`. Check `cv.output_format`:

- If `"latex"`, execute the full pipeline from `modes/latex.md`
- Otherwise (default), execute the full pipeline from `modes/pdf.md`

**Now** read `templates/cv-template.html` — this is the first point in the pipeline where it is needed.

## Step 4 — Draft Application Answers (only if score >= 4.5)

If the final score is >= 4.5, generate a draft of responses for the application form:

1. **Extract form questions**: Use Playwright to navigate to the form and take a snapshot. If they cannot be extracted, use the generic questions.
2. **Generate responses** following the tone (see below).
3. **Save in the report** as section `## H) Draft Application Answers`.

### Generic questions (use if they cannot be extracted from the form)

- Why are you interested in this role?
- Why do you want to work at [Company]?
- Tell us about a relevant project or achievement
- What makes you a good fit for this position?
- How did you hear about this role?

### Tone for Form Answers

**Position: "I'm choosing you."** The candidate has options and is choosing this company for specific reasons.

**Tone rules:**
- **Confident without arrogance**: "I've spent the past four years running M&A processes end-to-end — your role is where I want to apply that next"
- **Selective without arrogance**: "I've been intentional about finding a team where analytical depth actually matters from day one"
- **Specific and concrete**: Always reference something REAL from the JD or the company, and something REAL from the candidate's experience
- **Direct, without fluff**: 2-4 sentences per response. No "I'm passionate about..." or "I would love the opportunity to..."
- **The hook is the proof, not the statement**: Instead of "I'm great at X", say "I ran X across 18 transactions"

**Framework per question:**
- **Why this role?** → "Your [specific thing] maps directly to [specific thing I've done]."
- **Why this company?** → Mention something specific about the firm. "I've followed [company] because of [specific thing]."
- **Relevant experience?** → A quantified proof point from cv.md or article-digest.md.
- **Good fit?** → "I sit at the intersection of [A] and [B], which is exactly where this role lives."
- **How did you hear?** → Honest: "Found through [portal/alert], evaluated against my criteria, scored well."

**Language**: Always in the language of the JD (EN default).

## Step 5 — Update Tracker

Record it in `data/applications.md` with all columns including Report and PDF as ✅ or ❌.

**If any step fails**, continue with the next ones and mark the failed step as pending in the tracker.

---

## Token gate summary

| Step | article-digest.md | cv-template.html |
|------|-------------------|-----------------|
| Step 1 (scoring) | ❌ Not loaded | ❌ Not loaded |
| Step 1b (Block F) | ✅ Load if score ≥ 3.5 | ❌ Not loaded |
| Step 3 (PDF) | Already loaded (if ≥ 3.5) | ✅ Load now |
| Score < 3.0 | ❌ Never loaded | ❌ Never loaded |
