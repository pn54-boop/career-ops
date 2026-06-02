# Email Manager — Config
<!-- Edit this file to add senders, adjust exclusion rules, or add keywords. -->

---

## Job Alert Senders

Gmail search will look for emails from these senders. Add any new job alert service here.

```
job_alert_senders:
  # LinkedIn
  - jobalerts-noreply@linkedin.com
  - jobs-noreply@linkedin.com
  # Indeed
  - alert@indeed.com
  - noreply@indeed.com
  # Yale OCS
  - ocs@yale.edu
  - handshake@m.joinhandshake.com
  - no-reply@joinhandshake.com
  # Handshake (general)
  - alerts@m.joinhandshake.com
  # ZipRecruiter
  - alerts@ziprecruiter.com
  - noreply@ziprecruiter.com
  # Glassdoor
  - noreply@glassdoor.com
  # SimplyHired
  - noreply@simplyhired.com
  # Other — add as you set up new alerts
```

---

## Hard Exclusion Rules

The pre-screen checks each listing's title and visible snippet against these patterns. SKIP if any match.

### Commission / variable-primary comp
Title or snippet contains any of:
- "commission"
- "OTE"
- "quota"
- "100% commission"
- "uncapped earnings"
- "draw against commission"
- "earn what you make"

### Degree hard requirements
Title or snippet contains degree requirement phrasing AND it is clearly a hard requirement (not "preferred"):
- "MBA required"
- "JD required"
- "PhD required"
- "CFA required"
- "CPA required"
- "master's required"
- "doctoral"
- "law degree required"

Do NOT exclude if phrased as: "MBA preferred", "CFA a plus", "master's preferred"

### Language requirements
Title or snippet requires fluency in a language Patrick does not speak:
- "Spanish required" / "fluent Spanish"
- "French required" / "fluent French"
- "Mandarin required"
- "bilingual required" (when the second language is not English)

Do NOT exclude for: "Spanish a plus", "bilingual preferred"

### Role type exclusions
Title clearly indicates:
- "Intern" / "Internship"
- "Part-time" / "Part time"
- "Contract" / "Temp" / "Freelance" / "1099"
- "Sales Representative" / "Account Executive" / "SDR" / "BDR"
- "Financial Advisor" (commission-based advisory)
- "Insurance Agent" / "Insurance Advisor"
- "Loan Officer"

### Additional exclusions
```
additional_exclusions:
  # Add custom patterns here as you discover edge cases
  # Example:
  # - "Franchise"
  # - "MLM"
```

---

## Notes

- When in doubt, let the listing PASS. The full career-ops evaluation will catch it.
- These rules are intentionally conservative — better to evaluate a borderline role than to miss a good one.
- Update this file any time you want to tighten or loosen the pre-screen.
