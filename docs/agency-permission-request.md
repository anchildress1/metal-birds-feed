# Aircraft Register Data — Permission Request Template

Generic template for contacting any national civil aviation agency to request permission to redistribute their published aircraft register through metal-birds-feed. Fill in the bracketed variables before sending.

## Variables to fill

- `{AGENCY_NAME}` — full agency name in English (e.g. "Georgian Civil Aviation Agency")
- `{AGENCY_SHORT}` — common acronym (e.g. "GCAA")
- `{AGENCY_EMAIL}` — recipient address
- `{COUNTRY}` — country name in English
- `{REGISTER_URL}` — direct URL to the public register page
- `{SENDER_NAME}` — project lead's name
- `{SENDER_EMAIL}` — reply-to address
- `{REPO_URL}` — repository link (omit the line entirely if the repo is not public yet)

## Email body

**To:** `{AGENCY_EMAIL}`
**Subject:** Permission to redistribute the {COUNTRY} Civil Aircraft Register with attribution

---

Dear {AGENCY_NAME},

I am writing on behalf of _metal-birds-feed_ ({REPO_URL}), a source-available, non-commercial data project I operate. The project translates publicly available national aircraft registers from various countries into a single common format. The normalized data is held in operator-private storage; metal-birds-feed itself has no public API and no user-facing display. The data is intended for consumption by other non-commercial applications I operate — no such consumer applications exist at the time of writing.

I would like to include the {COUNTRY} civil aircraft register — which {AGENCY_SHORT} publishes at {REGISTER_URL} — as one of the project's data sources. The information I would normalize and redistribute is identical in content to what is already publicly displayed on your register page.

If I proceed, I commit to the following:

1. Attribution to {AGENCY_SHORT}, with a link to {REGISTER_URL}, will be clearly cited inside the project itself — specifically in the repository README and a `DATA_LICENSES` document covering all sources. The project's data store remains operator-private with no public read API or user-facing display.
2. The data will be refreshed regularly from your published register so that corrections, additions, or removals are reflected over time.
3. I will honor any request from {AGENCY_SHORT} to remove or modify the project's use of the data, promptly and without dispute.

Before publishing anything, I respectfully request your guidance on three points:

1. Does {AGENCY_SHORT} permit redistribution of the published register, with attribution, for a non-commercial source-available project?
2. If yes, is there a specific attribution text `{AGENCY_SHORT}` would like me to use? (For example: _"Source: `{AGENCY_NAME}` — `{REGISTER_URL}`"_.)
3. Are there any restrictions, conditions, or formal procedures I should follow?

If {AGENCY_SHORT} would prefer that the project not redistribute the data, I will respect that decision and exclude {COUNTRY} from the project.

Thank you for your work maintaining the register, and for your time considering this request. I look forward to your reply.

Kind regards,

{SENDER_NAME}
Project lead, metal-birds-feed
{SENDER_EMAIL}
{REPO_URL}

---

## Notes for whoever is sending it

- The tone is intentionally formal and slightly deferential — appropriate for unsolicited correspondence with a government agency.
- "Source-available, non-commercial" is the accurate legal posture. Avoid "open source" — that has a specific meaning under the OSI definition that allows commercial use, which metal-birds-feed does not.
- The email deliberately does not commit to a specific refresh cadence in writing. Internal target is monthly; the email keeps "regularly" so the project is not contractually pinned to a number.
- For agencies whose primary working language is not English (GCAA in Georgian, EU member states in their respective languages), translate the body into the local language. A bilingual side-by-side format is also acceptable.
- Any reply must be preserved verbatim and translated literally before being recorded in `DATA_LICENSES.md`. Do not paraphrase — attribution conditions and restrictions need to be quoted accurately.
- The 30-day clock for falling back to the public-record argument (per spec) starts the day the email is sent. Record the send date in `DATA_LICENSES.md`.
- For GCAA specifically: send to `office@gcaa.ge`. Send the Georgian translation, signing as project lead.
