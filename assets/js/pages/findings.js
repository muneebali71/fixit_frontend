/* Findings report: verification summary, filters, ranked cards, select-to-fix. */
(async function () {
  "use strict";

  const UI = window.FixItUI;
  const API = window.FixItAPI;
  const { esc, icon } = UI;

  const runId = UI.qs("run") || UI.FEATURED_RUN;
  const page = UI.renderShell({
    active: "findings",
    crumbs: [
      { label: "Dashboard", href: "dashboard.html" },
      { label: runId, href: `run.html?id=${runId}` },
      { label: "Findings" },
    ],
  });
  page.innerHTML = `<div class="skeleton" style="height:90px"></div>${'<div class="skeleton" style="height:120px;border-radius:16px"></div>'.repeat(4)}`;

  let run;
  try {
    run = await API.getRun(runId);
  } catch (err) {
    UI.errorState(page, err.message);
    return;
  }
  let findings = await API.listFindings(runId);

  if (!findings.length) {
    page.innerHTML = `<div class="card"><div class="empty">${icon("bug")}<h2>No findings for this run in the mock data</h2><p>The sample run on inventory-api has the full report.</p><a class="btn btn-primary" href="findings.html?run=${UI.FEATURED_RUN}">Open the sample report</a></div></div>`;
    return;
  }

  const verdictOf = (f) => f.verification?.verdict || "pending";
  const counts = findings.reduce((acc, f) => {
    acc[verdictOf(f)] = (acc[verdictOf(f)] || 0) + 1;
    acc[`cat:${f.category}`] = (acc[`cat:${f.category}`] || 0) + 1;
    return acc;
  }, {});
  const verdictColors = {
    confirmed: "var(--ok)",
    inconclusive: "var(--warn)",
    rejected: "var(--ink-3)",
    suggestion: "var(--cat-improvement)",
  };
  const fixable = (f) => f.confirmed && f.category !== "improvement" && (f.status === "discovered" || f.status === "selected");

  const state = { verdict: "all", category: "all", sort: "rank", selected: new Set() };

  page.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">Findings report</div>
        <h1>${findings.length} findings in ${esc(UI.shortRepo(run.repo))}</h1>
        <div class="sub">
          <span>${icon("branch")} ${esc(run.repo_branch)}</span>
          <span class="mono">${icon("commit")} ${esc(run.base_commit_sha)}</span>
          <span>Ranked by severity × confidence − fix effort</span>
        </div>
      </div>
      <div class="actions">
        <a class="btn" href="graph.html?run=${esc(runId)}">${icon("graph")}Knowledge graph</a>
        <button class="btn" data-export>${icon("file")}Export report</button>
      </div>
    </div>

    <section class="card">
      <div class="card-body stack-sm" style="padding-top:20px">
        <div class="row-between">
          <strong>Verification</strong>
          <span class="muted">Only confirmed findings can be fixed. Inconclusive ones are shown, never auto-fixed.</span>
        </div>
        <div class="verdict-bar">
          ${["confirmed", "inconclusive", "rejected", "suggestion"]
            .filter((v) => counts[v])
            .map((v, i) => `<span style="flex:${counts[v]};background:${verdictColors[v]};animation-delay:${i * 0.12}s" title="${counts[v]} ${v}"></span>`)
            .join("")}
        </div>
        <div class="legend">
          ${["confirmed", "inconclusive", "rejected", "suggestion"]
            .filter((v) => counts[v])
            .map((v) => `<span><i style="background:${verdictColors[v]}"></i>${counts[v]} ${v}</span>`)
            .join("")}
        </div>
      </div>
    </section>

    <div class="stack-sm">
      <div class="tabs" role="tablist" aria-label="Filter by verification">
        ${[
          ["all", "All", findings.length],
          ["confirmed", "Confirmed", counts.confirmed || 0],
          ["inconclusive", "Inconclusive", counts.inconclusive || 0],
          ["rejected", "Rejected", counts.rejected || 0],
          ["suggestion", "Suggestions", counts.suggestion || 0],
        ]
          .map(([key, label, n]) => `<button class="tab" role="tab" data-verdict="${key}" aria-selected="${key === "all"}">${label}<span class="count">${n}</span></button>`)
          .join("")}
      </div>
      <div class="filters">
        <div class="seg" role="group" aria-label="Filter by category">
          <button type="button" data-category="all" aria-pressed="true">All</button>
          ${["security", "bug", "leak", "regression", "improvement"]
            .filter((c) => counts[`cat:${c}`])
            .map((c) => `<button type="button" data-category="${c}" aria-pressed="false"><span class="chip cat-${c}" style="border:0;background:none;padding:0;height:auto"><span class="dot"></span></span>${UI.CATEGORY[c]} <span class="faint">${counts[`cat:${c}`]}</span></button>`)
            .join("")}
        </div>
        <label class="row" style="gap:8px;font-size:14px"><span class="muted">Sort</span>
          <select class="select" id="sort" style="width:auto;height:34px">
            <option value="rank">Rank</option>
            <option value="severity">Severity</option>
            <option value="confidence">Confidence</option>
          </select>
        </label>
      </div>
    </div>

    <section class="finding-list" id="list" aria-label="Findings"></section>
    <div id="select-slot" class="select-slot"></div>`;

  const list = page.querySelector("#list");
  const selectSlot = page.querySelector("#select-slot");
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

  function card(f) {
    const v = verdictOf(f);
    const canFix = fixable(f);
    const selected = state.selected.has(f.id);
    const statusChip =
      f.status !== "discovered"
        ? `<span class="chip" style="${f.status === "fixed" ? "color:var(--ok)" : f.status === "in_progress" ? "color:var(--info)" : ""}">${f.status === "in_progress" ? '<span class="spinner" style="width:11px;height:11px"></span>' : ""}${esc(UI.FINDING_STATUS[f.status])}</span>`
        : "";
    const reason = canFix
      ? "Select to fix"
      : f.category === "improvement"
        ? "Suggestions are never fixed automatically"
        : !f.confirmed
          ? "Only confirmed findings can be fixed"
          : `Already ${UI.FINDING_STATUS[f.status].toLowerCase()}`;
    return `
      <article class="finding-card ${selected ? "is-selected" : ""} ${v === "rejected" ? "is-muted" : ""}" data-id="${esc(f.id)}" tabindex="0">
        <div class="check-col" title="${esc(reason)}">
          <input type="checkbox" class="checkbox" data-select="${esc(f.id)}" ${selected ? "checked" : ""} ${canFix ? "" : "disabled"} aria-label="${esc(reason)}: ${esc(f.title)}" />
        </div>
        <div class="rank">${f.rank}<small>${esc(f.code)}</small></div>
        <div style="min-width:0">
          <div class="row" style="gap:8px">${UI.sev(f.severity)}${UI.cat(f.category)}${statusChip}</div>
          <h3>${esc(f.title)}</h3>
          <div class="loc">${esc(f.file_path)}${f.line ? `:${f.line}` : ""} · ${esc(f.specialist)} · ${esc(f.source.replace("_", " "))}</div>
          <p class="ev">${esc(f.evidence)}</p>
        </div>
        <div class="side">
          ${UI.verdict(v)}
          <span class="hint">${esc(f.verification?.method || "")}</span>
          <div class="conf">
            <div class="row-between"><span>confidence</span><span class="num">${UI.pct(f.confidence)}</span></div>
            <div class="meter"><div class="meter-fill" style="width:${Math.round(f.confidence * 100)}%"></div></div>
          </div>
          <span class="score">${f.score == null ? "unscored" : `score ${f.score.toFixed(2)}`}</span>
        </div>
      </article>`;
  }

  function render() {
    let rows = findings.filter(
      (f) => (state.verdict === "all" || verdictOf(f) === state.verdict) && (state.category === "all" || f.category === state.category),
    );
    rows = rows.slice().sort((a, b) => {
      if (state.sort === "severity") return sevOrder[a.severity] - sevOrder[b.severity] || a.rank - b.rank;
      if (state.sort === "confidence") return b.confidence - a.confidence;
      return a.rank - b.rank;
    });
    list.innerHTML = rows.length
      ? rows.map(card).join("")
      : `<div class="card"><div class="empty">${icon("filter")}<span>No findings match these filters.</span></div></div>`;
    list.classList.remove("stagger");
    void list.offsetWidth;
    list.classList.add("stagger");
    renderSelectBar();
  }

  function renderSelectBar() {
    const n = state.selected.size;
    if (!n) {
      selectSlot.innerHTML = "";
      return;
    }
    selectSlot.innerHTML = `
      <div class="select-bar" role="region" aria-label="Selection">
        <div class="grow"><strong>${n} finding${n === 1 ? "" : "s"} selected</strong><div style="opacity:.75;font-size:13px">Each gets its own sandbox, branch, failing test and review. About $0.30 each.</div></div>
        <button class="btn btn-ghost" data-clear>Clear</button>
        <button class="btn btn-primary" data-fix>${icon("zap")}Fix ${n} finding${n === 1 ? "" : "s"}</button>
      </div>`;
    selectSlot.querySelector("[data-clear]").addEventListener("click", () => {
      state.selected.clear();
      render();
    });
    selectSlot.querySelector("[data-fix]").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.classList.add("is-loading");
      const result = await API.selectFindings(runId, [...state.selected]);
      findings = findings.map((f) => (result.selected.includes(f.id) ? { ...f, status: "selected" } : f));
      state.selected.clear();
      render();
      UI.toast("ok", `Started ${result.selected.length} fix${result.selected.length === 1 ? "" : "es"}`, "Triage → reproducer → explorers → fixer → tests → review. You'll approve each PR.");
    });
  }

  list.addEventListener("change", (e) => {
    const box = e.target.closest("[data-select]");
    if (!box) return;
    if (box.checked) state.selected.add(box.dataset.select);
    else state.selected.delete(box.dataset.select);
    box.closest(".finding-card").classList.toggle("is-selected", box.checked);
    renderSelectBar();
  });
  list.addEventListener("click", (e) => {
    if (e.target.closest(".check-col")) return;
    const el = e.target.closest(".finding-card");
    if (el) location.href = `finding.html?id=${encodeURIComponent(el.dataset.id)}`;
  });
  list.addEventListener("keydown", (e) => {
    const el = e.target.closest(".finding-card");
    if (el && e.key === "Enter" && e.target === el) location.href = `finding.html?id=${encodeURIComponent(el.dataset.id)}`;
  });

  page.querySelectorAll("[data-verdict]").forEach((tab) =>
    tab.addEventListener("click", () => {
      page.querySelectorAll("[data-verdict]").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
      state.verdict = tab.dataset.verdict;
      render();
    }),
  );
  page.querySelectorAll("[data-category]").forEach((b) =>
    b.addEventListener("click", () => {
      page.querySelectorAll("[data-category]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      state.category = b.dataset.category;
      render();
    }),
  );
  page.querySelector("#sort").addEventListener("change", (e) => {
    state.sort = e.target.value;
    render();
  });
  page.querySelector("[data-export]").addEventListener("click", () =>
    UI.toast("info", "Export comes with the backend", "The real app downloads the report as Markdown or JSON."),
  );

  render();
})();
