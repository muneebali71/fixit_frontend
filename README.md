# fixit_frontend

The web app for FixIt: give it a repo link, and a team of
agents finds problems, proves each one with a test, and opens one pull request per fix you approve.

This is a **preview build**. Every page runs on mock data so you can see and click through the
whole product before the backend exists. Nothing talks to a server.

## Run it

Any static file server works. From this folder:

```bash
python -m http.server 5180 --bind 127.0.0.1
```

Then open <http://127.0.0.1:5180>. Opening `index.html` straight from disk also works.

## Pages

| Page | What it shows |
| --- | --- |
| `index.html` | Landing page: how it works, the agent team, proof, safety |
| `signin.html` | Sign in / create account (AWS Cognito in the real app) |
| `dashboard.html` | KPIs, recent runs, what is waiting for you, activity |
| `run.html?id=run_7k2m` | One run: phases, live event stream, agent team, budget, scanners, cost per agent |
| `findings.html?run=run_7k2m` | Ranked, verified findings; filter, sort and select which to fix |
| `finding.html?id=f_01` | One finding: evidence, verification, fix progress, attempts, diff, approve / request changes, PR |
| `graph.html?run=run_7k2m` | Knowledge graph of the repo: modules, edges, findings, test coverage |
| `settings.html` | Workspace, members, repositories, budgets, model roles, security |

Things to try:

- **New run** (top right) starts a run and plays it back live, phase by phase.
- On the run page, **Replay live view** replays the sample run's event stream.
- On `finding.html?id=f_01`, **Approve and open PR** or **Request changes**.
- On the findings page, tick confirmed findings and press **Fix**.
- The moon/sun button switches dark and light mode.
- **Settings → Reset demo data** undoes everything you clicked.

## How it is built

Plain HTML, CSS and JavaScript. No build step and no dependencies apart from Google Fonts.

```
assets/
  css/main.css        design tokens (light + dark), components, app shell
  css/pages.css       dashboard, run, findings, fix flow, graph, settings
  css/landing.css     landing and sign-in
  js/mock-data.js     all mock data, shaped like the backend's tables and enums
  js/api.js           the only data layer pages use (mock today, fetch() later)
  js/ui.js            icons, formatters, shell, toasts, modals, "New run" dialog
  js/pages/*.js       one script per page
```

## Connecting the backend later

Pages never read `mock-data.js` for data; they call `window.FixItAPI` in `assets/js/api.js`.
Each function there names the FastAPI route it stands in for, for example:

| Function | Planned route |
| --- | --- |
| `listRuns()`, `getRun(id)` | `GET /runs`, `GET /runs/{id}` |
| `createRun(input)` | `POST /runs` |
| `streamEvents(id, onEvent)` | `GET /runs/{id}/events` (Server-Sent Events) |
| `listFindings(runId)`, `getFinding(id)`, `getFix(id)` | findings and fix-flow routes |
| `approve(id, comment)`, `reject(id, comment)` | `POST /runs/{id}/approve` |

Replace a function body with a `fetch()` (or an `EventSource` for the event stream) and the page
keeps working, as long as the response keeps the same shape. Field names and enum values already
match the backend (`RunStatus`, `Severity`, `FindingSource`, `FindingStatus`).

All rendered data goes through `esc()` in `ui.js`. Keep it that way: repo text, issue text and
model output are untrusted.
