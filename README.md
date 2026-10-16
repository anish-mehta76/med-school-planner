# Med School Planner

Track your MD application experiences, see where you stand against competitive-applicant benchmarks, and get recommendations to close gaps. Includes a research-targeting section for uterine (endometrial) and cervical cancer labs.

**Live site:** https://anish-mehta76.github.io/med-school-planner/

## Your data stays on your device

Everything you enter (profile, GPA/MCAT, experiences, hours, outputs, outreach notes) is saved in your browser's localStorage. Deploying a new version doesn't touch it: the storage key stays `med-school-planner:v1`, and `src/store/useStore.test.ts` fails the deploy if a change would drop saved fields. When a newer version is live, the app shows a **Reload** banner.

- **Sync Mac ↔ phone (optional):** Profile & academics → **Sync between devices**. Data is copied to `planner.json` in a **private** GitHub repo of yours (the app refuses public repos). Setup, once:
  1. Create a private repo, e.g. `med-school-planner-data`.
  2. GitHub → Settings → Developer settings → Fine-grained tokens → new token with access to **only** that repo and **Contents: Read and write**.
  3. Paste username, repo and token on the Mac → Connect, then do the same on the phone.

  Edits upload a few seconds after you make them; the other device pulls when it opens or comes back to the foreground. If both changed, the app asks which copy to keep, and every older version stays in the repo's history. The token is stored only in that browser's localStorage (never in backups or the synced file); revoke it on GitHub to cut access.
- **Move data between devices by hand:** Profile & academics → **Export backup** on one device, **Import backup** on the other. On iPhone, Export opens the share sheet (Save to Files / iCloud Drive or AirDrop), and Import picks the file from Files.
- **Private research tracker:** draft emails, project pitches and outreach columns are not part of this website or repo. On the Research targeting page, use **Import tracker CSV** to load them into your browser, and **Export tracker CSV** to write the full tracker back out (all original columns plus your in-app edits, same column order, UTF-8 BOM).
- **"Why this lab" wording:** the site ships neutral templates. Put your own wording in Research targeting → "Your 'Why this lab' wording"; it's saved only in your browser and included in backups.

## Add it to your iPhone home screen

Open the live site in Safari → **Share** → **Add to Home Screen**. It opens full screen like an app. Data in the home-screen app is separate from Safari's, so connect sync in the home-screen app (or export a backup from one and import it in the other).

## Deploy

Pushing to `main` deploys automatically: `.github/workflows/deploy.yml` runs `npm ci`, `npm test` and `npm run build`, then publishes `dist/` to GitHub Pages. Watch it in the repo's **Actions** tab, or run it by hand from Actions → Deploy to GitHub Pages → **Run workflow**.

## Develop

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

- `npm test`: unit tests (gap engine, recommender, mentor scoring, outreach, CSV import/export)
- `npm run build`: production build in `dist/` (served from `/med-school-planner/`)
- `npm run import-trackers`: regenerate the **public** mentor and program data (`src/data/mentors.ts`, `src/data/nycPrograms.ts`) from the tracker CSVs. Only public columns are written; private columns are never bundled.
- `npm run verify-pubmed`: read-only PubMed check of the Start-priority mentors.
- `python3 scripts/make-icons.py`: redraw the app icons in `public/`.

The tracker CSVs, `CLAUDE.md`, `reports/` and the research agents (`.claude/`) are kept in the local project folder only and are gitignored, because this repository is public. The import and verify scripts need the CSVs, so run them from that local folder.

## Research agents (run by hand)

The verifier, scout, outreach-coach and retro agents live in the local folder's `.claude/agents/` and are not scheduled, since this repo is public. To run one, open the local folder in Claude Code and ask, for example: "use the verifier on R01-R13". To give the retro agent real outcomes, use **Export tracker CSV** on the Research page and save it over the CSV in the local folder first.

## Where things live

- `src/engine/gaps.ts`: hour totals, projections and gap rules
- `src/engine/recommend.ts`: ranks opportunities by your gaps and upcoming deadlines
- `src/engine/mentorScore.ts`: transparent 0–100 mentor score (weights editable in Profile & academics)
- `src/engine/outreach.ts`: outreach pipeline, 10-business-day follow-ups, program deadline sorting
- `src/engine/whyThisLab.ts`: "why this lab" templates (no API calls)
- `src/lib/tracker.ts`: private tracker CSV import/export
- `src/data/benchmarks.ts`, `opportunities.ts`, `guides.ts`, `journalTiers.ts`: editable reference data
