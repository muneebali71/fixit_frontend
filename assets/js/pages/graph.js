/* Knowledge graph: modules as nodes (size = symbols), imports/calls as edges,
 * findings as red badges, test coverage as a ring. Click a module for its details. */
(async function () {
  "use strict";

  const UI = window.FixItUI;
  const API = window.FixItAPI;
  const M = window.FIXIT_MOCK;
  const { esc, icon } = UI;

  const runId = UI.qs("run") || UI.FEATURED_RUN;
  const page = UI.renderShell({
    active: "graph",
    crumbs: [
      { label: "Dashboard", href: "dashboard.html" },
      { label: runId, href: `run.html?id=${runId}` },
      { label: "Knowledge graph" },
    ],
  });
  page.innerHTML = `<div class="skeleton" style="height:90px"></div><div class="skeleton" style="height:560px;border-radius:16px"></div>`;

  const [graph, findings, detail] = await Promise.all([API.getGraph(runId), API.listFindings(runId), API.getRunDetail(runId).catch(() => null)]);
  if (!graph) {
    page.innerHTML = `<div class="card"><div class="empty">${icon("graph")}<h2>No graph for this run in the mock data</h2><a class="btn btn-primary" href="graph.html?run=${UI.FEATURED_RUN}">Open the sample graph</a></div></div>`;
    return;
  }

  const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const findingById = Object.fromEntries(findings.map((f) => [f.id, f]));
  const sevRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const radius = (n) => 20 + Math.sqrt(n.symbols) * 1.6;
  const neighbors = (id) => graph.edges.filter(([a, b]) => a === id || b === id).map(([a, b]) => (a === id ? b : a));
  const stats = detail?.graph || { files: 142, modules: 11, symbols: 1208, edges: 3940, coverage: 0.71 };

  const state = { selected: byId[UI.qs("node")] ? UI.qs("node") : "app/repositories", mode: "findings" };

  function edgePath([a, b]) {
    const p = byId[a];
    const q = byId[b];
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const bend = 0.12;
    return `M${p.x} ${p.y} Q${mx - dy * bend} ${my + dx * bend} ${q.x} ${q.y}`;
  }

  function worstSeverity(node) {
    const sevs = node.findings.map((id) => findingById[id]).filter((f) => f && f.category !== "improvement" && f.verification?.verdict !== "rejected").map((f) => f.severity);
    return sevs.sort((a, b) => sevRank[a] - sevRank[b])[0] || null;
  }

  function nodeSvg(n, i) {
    const r = radius(n);
    const real = n.findings.filter((id) => findingById[id]?.verification?.verdict !== "rejected").length;
    const worst = worstSeverity(n);
    const circ = 2 * Math.PI * (r + 7);
    const cov = n.coverage ?? 0;
    const covColor = cov >= 0.8 ? "var(--ok)" : cov >= 0.6 ? "var(--warn)" : "var(--danger)";
    const showFindings = state.mode === "findings";
    return `
      <g class="g-node ${state.selected === n.id ? "is-selected" : ""}" data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.label)}: ${n.files} files, ${real} findings">
        ${showFindings && real && (worst === "critical" || worst === "high") ? `<circle class="halo" cx="${n.x}" cy="${n.y}" r="${r + 6}"/>` : ""}
        <g class="core" style="animation-delay:${0.08 * i}s">
          ${!showFindings && n.coverage != null ? `<circle cx="${n.x}" cy="${n.y}" r="${r + 7}" fill="none" stroke="var(--sunken)" stroke-width="5"/><circle class="ring" cx="${n.x}" cy="${n.y}" r="${r + 7}" stroke="${covColor}" stroke-dasharray="${(circ * cov).toFixed(1)} ${circ.toFixed(1)}"/>` : ""}
          <circle class="body" cx="${n.x}" cy="${n.y}" r="${r}" ${showFindings && worst ? `style="stroke:${worst === "critical" || worst === "high" ? "var(--danger)" : "var(--warn)"}"` : ""}/>
          <text class="label" x="${n.x}" y="${n.y + 4}" style="font-size:${r > 34 ? 15 : 13}px">${n.files}</text>
          <text class="sub" x="${n.x}" y="${n.y + r + 18}" style="font:700 13px var(--font-display);fill:var(--ink)">${esc(n.label)}</text>
          <text class="sub" x="${n.x}" y="${n.y + r + 33}">${showFindings ? `${n.symbols} symbols` : n.coverage == null ? "no tests" : `${Math.round(cov * 100)}% covered`}</text>
          ${showFindings && real ? `<circle class="flag" cx="${n.x + r * 0.72}" cy="${n.y - r * 0.72}" r="10"/><text class="flag-text" x="${n.x + r * 0.72}" y="${n.y - r * 0.72 + 4}">${real}</text>` : ""}
        </g>
      </g>`;
  }

  page.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">Knowledge graph · ${esc(graph.commit)}</div>
        <h1>How ${esc(UI.shortRepo(M.runs.find((r) => r.id === runId)?.repo || "the repo"))} fits together</h1>
        <div class="sub"><span>Built by plain-code parsers; the cheap model only writes the module summaries. Specialists get slices of this, never the whole repo.</span></div>
      </div>
      <div class="seg" role="group" aria-label="Show">
        <button type="button" data-mode="findings" aria-pressed="true">${icon("bug")}Findings</button>
        <button type="button" data-mode="coverage" aria-pressed="false">${icon("shieldCheck")}Test coverage</button>
      </div>
    </div>

    <section class="grid grid-4 stagger">
      <div class="card kpi"><span class="kpi-label">${icon("file")}Files</span><span class="kpi-value" data-count="${stats.files}">0</span><span class="kpi-foot">in ${graph.nodes.length} modules</span></div>
      <div class="card kpi"><span class="kpi-label">${icon("layers")}Symbols</span><span class="kpi-value" data-count="${stats.symbols}">0</span><span class="kpi-foot">classes, functions, methods</span></div>
      <div class="card kpi"><span class="kpi-label">${icon("graph")}Edges</span><span class="kpi-value" data-count="${stats.edges}">0</span><span class="kpi-foot">contains, imports, calls, tests</span></div>
      <div class="card kpi"><span class="kpi-label">${icon("shieldCheck")}Covered by tests</span><span class="kpi-value" data-count="${Math.round(stats.coverage * 100)}" data-suffix="%">0</span><div class="meter"><div class="meter-fill" data-fill="${Math.round(stats.coverage * 100)}"></div></div></div>
    </section>

    <section class="graph-layout">
      <div class="graph-canvas">
        <svg viewBox="50 40 880 530" id="graph-svg" role="group" aria-label="Module graph"></svg>
        <div class="graph-legend" id="legend"></div>
      </div>
      <aside class="card" id="side" aria-live="polite"></aside>
    </section>`;

  const svg = page.querySelector("#graph-svg");
  const side = page.querySelector("#side");
  const legend = page.querySelector("#legend");

  function draw() {
    svg.innerHTML = `
      <g>${graph.edges.map((e, i) => `<path class="g-edge" data-edge="${esc(e[0])}|${esc(e[1])}" d="${edgePath(e)}" style="animation-delay:${0.03 * i}s"/>`).join("")}</g>
      <g>${graph.nodes.map(nodeSvg).join("")}</g>`;
    legend.innerHTML =
      state.mode === "findings"
        ? `<span><i style="background:var(--danger)"></i>critical or high finding</span><span><i style="background:var(--warn)"></i>medium or low finding</span><span><i style="border:2px solid var(--line-strong)"></i>no open findings</span><span class="faint">Number inside = files · size = symbols</span>`
        : `<span><i style="background:var(--ok)"></i>80%+ covered</span><span><i style="background:var(--warn)"></i>60–79%</span><span><i style="background:var(--danger)"></i>under 60%</span><span class="faint">Ring length = share of lines run by tests</span>`;
  }

  function highlight(id) {
    const near = new Set(id ? [id, ...neighbors(id)] : []);
    svg.querySelectorAll(".g-edge").forEach((el) => {
      const [a, b] = el.dataset.edge.split("|");
      const hot = id && (a === id || b === id);
      el.classList.toggle("is-hot", Boolean(hot));
      el.classList.toggle("is-dim", Boolean(id) && !hot);
    });
    svg.querySelectorAll(".g-node").forEach((el) => el.classList.toggle("is-dim", Boolean(id) && !near.has(el.dataset.node)));
  }

  function renderSide() {
    const n = byId[state.selected];
    const items = n.findings.map((fid) => findingById[fid]).filter(Boolean);
    side.innerHTML = `
      <div class="card-head">
        <div><div class="eyebrow" style="margin-bottom:6px">Module</div><h2 class="mono" style="font-size:17px">${esc(n.id)}</h2></div>
      </div>
      <div class="card-body stack-sm">
        <p class="muted">${esc(n.summary)}</p>
        <div class="stat-grid">
          <div class="stat"><b>${n.files}</b><span>files</span></div>
          <div class="stat"><b>${n.symbols}</b><span>symbols</span></div>
          <div class="stat"><b>${n.tests}</b><span>tests touch it</span></div>
          <div class="stat"><b>${n.coverage == null ? "—" : UI.pct(n.coverage)}</b><span>line coverage</span></div>
        </div>
        <hr class="divider" />
        <strong>Findings here</strong>
        ${
          items.length
            ? items
                .map((f) => `<a class="mini-finding" href="finding.html?id=${esc(f.id)}">${UI.sev(f.severity)}<span style="min-width:0"><strong>${esc(f.title)}</strong><span class="hint">${esc(f.code)} · ${UI.verdict(f.verification?.verdict)}</span></span></a>`)
                .join("")
            : `<p class="hint">Nothing found in this module.</p>`
        }
        <hr class="divider" />
        <strong>Connected to</strong>
        <div class="row" style="gap:6px">${neighbors(n.id).map((id) => `<button class="chip chip-mono" data-jump="${esc(id)}" style="cursor:pointer">${esc(id)}</button>`).join("")}</div>
      </div>`;
    side.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => select(b.dataset.jump)));
  }

  function select(id) {
    state.selected = id;
    svg.querySelectorAll(".g-node").forEach((el) => el.classList.toggle("is-selected", el.dataset.node === id));
    highlight(id);
    renderSide();
    const url = new URL(location.href);
    url.searchParams.set("node", id);
    history.replaceState(null, "", url);
  }

  svg.addEventListener("click", (e) => {
    const el = e.target.closest(".g-node");
    if (el) select(el.dataset.node);
  });
  svg.addEventListener("keydown", (e) => {
    const el = e.target.closest(".g-node");
    if (el && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      select(el.dataset.node);
    }
  });
  svg.addEventListener("mouseover", (e) => {
    const el = e.target.closest(".g-node");
    if (el) highlight(el.dataset.node);
  });
  svg.addEventListener("mouseleave", () => highlight(state.selected));

  page.querySelectorAll("[data-mode]").forEach((b) =>
    b.addEventListener("click", () => {
      page.querySelectorAll("[data-mode]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      state.mode = b.dataset.mode;
      draw();
      highlight(state.selected);
    }),
  );

  draw();
  renderSide();
  setTimeout(() => highlight(state.selected), 900);
  UI.countUp(page);
  UI.fillMeters(page);
})();
