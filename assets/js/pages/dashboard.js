/* Dashboard: greeting, KPIs, recent runs, what is waiting for you, activity. */
(async function () {
  "use strict";

  const UI = window.FixItUI;
  const API = window.FixItAPI;
  const { esc, icon, money } = UI;

  const page = UI.renderShell({ active: "dashboard", crumbs: [{ label: "Dashboard" }] });
  page.innerHTML = `
    <div class="skeleton" style="height:118px;border-radius:20px"></div>
    <div class="grid grid-4">${'<div class="skeleton" style="height:128px;border-radius:16px"></div>'.repeat(4)}</div>
    <div class="skeleton" style="height:420px;border-radius:16px"></div>`;

  const [{ user, organization }, runs, stats, notifications] = await Promise.all([
    API.me(),
    API.listRuns(),
    API.stats(),
    API.notifications(),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const running = runs.filter((r) => r.status === "running" || r.status === "queued");
  const spendPct = Math.round((organization.spent_today_usd / organization.daily_cost_cap_usd) * 100);

  function sparkline(values) {
    const w = 96;
    const h = 34;
    const max = Math.max(...values);
    const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 6)]);
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path class="area" d="${line} L${w} ${h} L0 ${h} Z"/><path class="line" d="${line}"/></svg>`;
  }

  function runRow(run) {
    const findings =
      run.findings_count == null
        ? `<span class="faint">—</span>`
        : `<strong class="num">${run.confirmed_count}</strong><span class="faint num"> / ${run.findings_count}</span>`;
    const phase = run.status === "running" && run.phase ? `<div class="hint" style="margin-top:4px">${esc(run.phase)}…</div>` : "";
    return `
      <tr class="is-link" data-href="run.html?id=${encodeURIComponent(run.id)}" tabindex="0">
        <td>
          <div class="repo-cell">
            ${UI.repoAvatar(run.repo)}
            <div style="min-width:0">
              <strong>${esc(UI.shortRepo(run.repo))}</strong>
              <div class="hint mono">${icon("branch", "")} ${esc(run.repo_branch || "default")} · ${esc(run.id)}</div>
            </div>
          </div>
        </td>
        <td>${UI.pill(run.status)}${phase}</td>
        <td>${findings}</td>
        <td class="num">${run.prs_opened ? `<span class="row" style="gap:6px">${icon("pr", "")}${run.prs_opened}</span>` : '<span class="faint">—</span>'}</td>
        <td class="num">${money(run.cost_usd)} <span class="faint">/ ${money(run.max_cost_usd)}</span></td>
        <td class="num nowrap">${run.started_at ? UI.duration(UI.runDuration(run)) : '<span class="faint">waiting</span>'}</td>
        <td class="nowrap muted">${UI.relTime(run.created_at)}</td>
      </tr>`;
  }

  const approvals = API.pendingApprovals();
  const waiting = [
    ...approvals.map((fid) => {
      const f = window.FIXIT_MOCK.findings.find((x) => x.id === fid);
      return {
        href: `finding.html?id=${fid}`,
        ic: "shieldCheck",
        title: `Approve the fix for ${f.code}`,
        body: `${f.title} · tests passed · reviewer approved`,
        tag: UI.sev(f.severity),
      };
    }),
    {
      href: "run.html?id=run_9w4e",
      ic: "help",
      title: "payments-service needs info",
      body: "No test command found on feature/refunds",
      tag: UI.pill("needs_info"),
    },
  ];

  const activityKinds = {
    approval: ["alert", "var(--warn-soft)", "var(--warn)"],
    report: ["file", "var(--info-soft)", "var(--info)"],
    pr: ["pr", "var(--ok-soft)", "var(--ok)"],
    info: ["help", "var(--violet-soft)", "var(--violet)"],
  };

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return d.toLocaleDateString("en-US", { weekday: "short" });
  });
  const maxWeekly = Math.max(...stats.weekly_findings);

  page.innerHTML = `
    <section class="hello">
      <div>
        <div class="eyebrow">${esc(organization.name)}</div>
        <h1>${greeting}, ${esc(user.name.split(" ")[0])}</h1>
        <p>${approvals.length ? `${approvals.length} fix${approvals.length === 1 ? " is" : "es are"} waiting for your approval` : "No fixes are waiting for you"} and ${running.length} run${running.length === 1 ? " is" : "s are"} in progress.</p>
      </div>
      <div class="row">
        ${approvals.length ? `<a class="btn" href="finding.html?id=${approvals[0]}">${icon("shieldCheck")}Review ${esc(window.FIXIT_MOCK.findings.find((x) => x.id === approvals[0]).code)}</a>` : ""}
        <button class="btn btn-primary" data-new-run-inline>${icon("plus")}New run</button>
      </div>
    </section>

    <section class="grid grid-4 stagger">
      <div class="card kpi">
        <span class="kpi-label">${icon("activity")}Runs this month</span>
        <span class="kpi-value" data-count="${stats.runs_this_month}">0</span>
        <span class="kpi-foot"><span class="up">+${stats.runs_delta}</span> vs last month</span>
      </div>
      <div class="card kpi">
        <span class="kpi-label">${icon("shieldCheck")}Confirmed findings</span>
        <span class="kpi-value" data-count="${stats.confirmed_findings}">0</span>
        <span class="kpi-foot">${UI.pct(stats.false_positive_rate)} later rejected by you</span>
        ${sparkline(stats.weekly_findings)}
      </div>
      <div class="card kpi">
        <span class="kpi-label">${icon("pr")}Pull requests</span>
        <span class="kpi-value"><span data-count="${stats.prs_merged}">0</span> <small>merged of ${stats.prs_opened}</small></span>
        <span class="kpi-foot">Solve rate <strong>${UI.pct(stats.solve_rate)}</strong> of selected findings</span>
      </div>
      <div class="card kpi">
        <span class="kpi-label">${icon("dollar")}Spend today</span>
        <span class="kpi-value"><span data-count="${organization.spent_today_usd}" data-decimals="2" data-prefix="$">$0.00</span> <small>/ ${money(organization.daily_cost_cap_usd)}</small></span>
        <div class="meter"><div class="meter-fill" data-fill="${spendPct}"></div></div>
        <span class="kpi-foot">${money(stats.spend_month_usd)} this month · cap resets at midnight</span>
      </div>
    </section>

    <section class="grid grid-main">
      <div class="card">
        <div class="card-head">
          <div>
            <h2>Recent runs</h2>
            <span class="card-sub">${runs.length} runs across ${new Set(runs.map((r) => r.repo)).size} repositories</span>
          </div>
          <div class="seg" role="group" aria-label="Filter runs">
            <button type="button" data-filter="all" aria-pressed="true">All</button>
            <button type="button" data-filter="active" aria-pressed="false">Active</button>
            <button type="button" data-filter="done" aria-pressed="false">Finished</button>
          </div>
        </div>
        <div class="card-body flush">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Repository</th><th>Status</th><th>Confirmed</th><th>PRs</th><th>Cost</th><th>Duration</th><th>Started</th></tr>
              </thead>
              <tbody id="runs-body"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="stack">
        <div class="card">
          <div class="card-head"><h2>Waiting for you</h2><span class="card-sub">${waiting.length} items</span></div>
          <div class="card-body flush">
            ${waiting
              .map(
                (w) => `<a class="wait-item" href="${w.href}"><span class="ic">${icon(w.ic)}</span><span style="min-width:0"><strong>${esc(w.title)}</strong><span class="muted">${esc(w.body)}</span></span>${w.tag}</a>`,
              )
              .join("")}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Confirmed findings</h2><span class="card-sub">last 7 days</span></div>
          <div class="card-body">
            <div class="bars">
              ${stats.weekly_findings
                .map((v, i) => `<div class="bar" style="height:${Math.max(6, (v / maxWeekly) * 100)}%;animation-delay:${i * 0.06}s" data-label="${v} on ${days[i]}"></div>`)
                .join("")}
            </div>
            <div class="bars-x">${days.map((d) => `<span>${d}</span>`).join("")}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Activity</h2></div>
          <div class="card-body" style="padding:10px 0 14px">
            <div class="activity">
              ${notifications
                .map((n) => {
                  const [ic, bg, fg] = activityKinds[n.kind] || activityKinds.info;
                  return `<div class="activity-item"><span class="ic" style="background:${bg};color:${fg}">${icon(ic)}</span><div><a href="${esc(n.href)}" style="color:inherit;font-weight:700">${esc(n.title)}</a><div class="muted">${esc(n.body)}</div><time>${UI.relTime(n.at)}</time></div></div>`;
                })
                .join("")}
            </div>
          </div>
        </div>
      </div>
    </section>`;

  const body = page.querySelector("#runs-body");
  const active = new Set(["running", "queued", "waiting_human"]);

  function renderRows(filter) {
    const rows = runs.filter((r) => filter === "all" || (filter === "active" ? active.has(r.status) : !active.has(r.status)));
    body.innerHTML = rows.length
      ? rows.map(runRow).join("")
      : `<tr><td colspan="7"><div class="empty">${icon("activity")}<span>No runs here yet.</span></div></td></tr>`;
    body.classList.remove("stagger");
    void body.offsetWidth;
    body.classList.add("stagger");
  }

  renderRows("all");
  page.querySelectorAll("[data-filter]").forEach((b) =>
    b.addEventListener("click", () => {
      page.querySelectorAll("[data-filter]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      renderRows(b.dataset.filter);
    }),
  );
  body.addEventListener("click", (e) => {
    const row = e.target.closest("tr[data-href]");
    if (row) location.href = row.dataset.href;
  });
  body.addEventListener("keydown", (e) => {
    const row = e.target.closest("tr[data-href]");
    if (row && e.key === "Enter") location.href = row.dataset.href;
  });
  page.querySelector("[data-new-run-inline]").addEventListener("click", () => UI.openNewRunModal());

  UI.countUp(page);
  UI.fillMeters(page);
})();
