/* Run page: phase stepper, live event stream, agent team, budget, scanners, costs.
 * Queued/running runs play their events back as a live stream (SSE in the real app);
 * finished runs show the final state and can be replayed. */
(async function () {
  "use strict";

  const UI = window.FixItUI;
  const API = window.FixItAPI;
  const M = window.FIXIT_MOCK;
  const { esc, icon, money } = UI;

  const id = UI.qs("id") || UI.FEATURED_RUN;
  const featured = id === UI.FEATURED_RUN;
  const page = UI.renderShell({
    active: featured ? "run" : "dashboard",
    crumbs: [{ label: "Dashboard", href: "dashboard.html" }, { label: id }],
  });
  page.innerHTML = `<div class="skeleton" style="height:96px"></div><div class="skeleton" style="height:120px;border-radius:16px"></div><div class="skeleton" style="height:420px;border-radius:16px"></div>`;

  let run;
  try {
    run = await API.getRun(id);
  } catch (err) {
    UI.errorState(page, err.message);
    return;
  }
  const detail = await API.getRunDetail(id);
  const isLive = run.status === "running" || run.status === "queued";
  const END = detail ? detail.events[detail.events.length - 1].t : 0;
  const reportRun = detail && (featured || run.is_mock_new || isLive) ? UI.FEATURED_RUN : null;

  // ---------- static frame ----------

  const phaseIcons = { snapshot: "box", graph: "graph", scanners: "search", plan: "target", specialists: "users", verify: "shieldCheck", report: "file" };

  page.innerHTML = `
    <section class="run-head">
      <div class="page-head">
        <div style="min-width:0">
          <div class="run-title">
            ${UI.repoAvatar(run.repo)}
            <h1>${esc(UI.shortRepo(run.repo))}</h1>
            <span id="run-pill">${UI.pill(run.status)}</span>
          </div>
          <div class="meta" style="margin-top:12px">
            <span>${icon("gitRepo")}${esc(run.repo)}</span>
            <span>${icon("branch")}${esc(run.repo_branch || "default branch")}</span>
            <span>${icon("commit")}<span class="mono" id="run-sha">${esc(run.base_commit_sha || "resolving…")}</span></span>
            <span>${icon("clock")}<span id="run-clock">${run.started_at ? UI.duration(UI.runDuration(run)) : "not started"}</span></span>
            <span>${icon("users")}${esc(run.requested_by || "—")}</span>
          </div>
        </div>
        <div class="actions" id="run-actions"></div>
      </div>
      ${run.error_summary ? `<div class="notice ${run.status === "needs_info" ? "notice-warn" : "notice-danger"}">${icon("alert")}<span><strong>${esc(UI.STATUS[run.status])}.</strong> ${esc(run.error_summary)}</span></div>` : ""}
    </section>

    <section class="card">
      <div class="stepper" id="stepper">
        ${M.phases
          .map(
            (p) => `<div class="step" data-phase="${p.key}"><span class="dot">${icon(phaseIcons[p.key])}</span><strong>${esc(p.label)}</strong><small>${esc(p.detail)}</small></div>`,
          )
          .join("")}
      </div>
    </section>

    <div id="result-slot"></div>

    ${
      detail
        ? `<section class="grid grid-main">
            <div class="stack">
              <div class="card">
                <div class="card-head">
                  <div><h2>Live events</h2><span class="card-sub mono">GET /runs/${esc(run.id)}/events</span></div>
                  <span class="row" id="live-tag"></span>
                </div>
                <div class="card-body"><div class="log" id="log" aria-live="polite"></div></div>
              </div>
              <div class="card">
                <div class="card-head">
                  <div><h2>Agent team</h2><span class="card-sub">Each agent sees only its brief and its slice of the graph</span></div>
                </div>
                <div class="card-body"><div class="agent-grid" id="agents"></div></div>
              </div>
            </div>
            <div class="stack">
              <div class="card">
                <div class="card-head"><h2>Budget</h2><span class="card-sub">stops cleanly at any limit</span></div>
                <div class="card-body stack-sm" id="budget"></div>
              </div>
              <div class="card">
                <div class="card-head"><h2>Scanners</h2><span class="card-sub">${esc(detail.detected.language)} · ${esc(detail.detected.package_manager)} · <code>${esc(detail.detected.test_command)}</code></span></div>
                <div class="card-body flush scanner-list" id="scanners"></div>
              </div>
              <div class="card">
                <div class="card-head"><h2>Cost by agent</h2><span class="card-sub">one row per LLM call, summed</span></div>
                <div class="card-body stack-sm" id="costs"></div>
              </div>
            </div>
          </section>`
        : `<div class="card"><div class="empty">${icon("file")}<h2>No detailed report in the mock data</h2><p>The sample run has the full report, live events and agent team.</p><a class="btn btn-primary" href="run.html?id=${UI.FEATURED_RUN}">Open the sample run</a></div></div>`
    }`;

  const stepper = page.querySelector("#stepper");

  // Finished runs without detail: mark phases up to where they stopped.
  if (!detail) {
    const order = M.phases.map((p) => p.key);
    const reached = order.indexOf(run.phase);
    const failed = ["needs_info", "failed_soft", "failed_hard", "cancelled", "expired"].includes(run.status);
    stepper.querySelectorAll(".step").forEach((el, i) => {
      if (run.status === "succeeded" || i < reached) el.classList.add("is-done");
      else if (i === reached) el.classList.add(failed ? "is-failed" : "is-active");
    });
    renderActions(false);
    return;
  }

  // ---------- dynamic parts ----------

  const log = page.querySelector("#log");
  const agentsEl = page.querySelector("#agents");
  const budgetEl = page.querySelector("#budget");
  const scannersEl = page.querySelector("#scanners");
  const costsEl = page.querySelector("#costs");
  const resultSlot = page.querySelector("#result-slot");
  const liveTag = page.querySelector("#live-tag");
  const clock = page.querySelector("#run-clock");

  // Agent activity windows come from the events each agent emitted.
  const windows = {};
  detail.agents.forEach((a) => {
    const ts = detail.events.filter((e) => e.node === a.key).map((e) => e.t);
    windows[a.key] = ts.length ? [Math.min(...ts), Math.max(...ts)] : [0, END];
  });

  const totalCost = detail.costs.reduce((s, c) => s + c.amount_usd, 0);
  const maxCost = Math.max(...detail.costs.map((c) => c.amount_usd));

  function renderStepper(t) {
    stepper.querySelectorAll(".step").forEach((el) => {
      // Graph and scanners overlap, so two steps can be active at once.
      const [start, end] = detail.phase_times[el.dataset.phase];
      const done = t >= end;
      el.classList.toggle("is-done", done);
      el.classList.toggle("is-active", !done && t >= start);
    });
  }

  function renderAgents(t) {
    agentsEl.innerHTML = detail.agents
      .map((a) => {
        const [start, end] = windows[a.key];
        const state = t >= end && t >= start ? "done" : t >= start ? "running" : "waiting";
        const frac = state === "done" ? 1 : state === "running" ? Math.min(1, (t - start) / Math.max(1, end - start)) : 0;
        const steps = Math.round(a.steps * frac);
        const stateHtml = {
          done: `${icon("checkCircle")}${a.findings != null ? `${a.findings} found` : "Done"}`,
          running: `<span class="spinner"></span>Working`,
          waiting: `${icon("clock")}Waiting`,
        }[state];
        return `
          <div class="agent is-${state}">
            <div class="agent-top">
              <strong>${esc(a.name)}</strong>
              <span class="role role-${a.role}">${a.role}</span>
              <span class="state">${stateHtml}</span>
            </div>
            <div class="meter-row">
              <div class="meter"><div class="meter-fill" style="width:${Math.round((steps / a.step_limit) * 100)}%"></div></div>
            </div>
            <div class="agent-meta">
              <span>${steps}/${a.step_limit} steps · ${UI.compact(Math.round(a.tokens * frac))} tokens</span>
              <span class="num">${money(a.cost_usd * frac)}</span>
            </div>
            <div class="hint" title="Scope">${icon("target")} ${esc(a.scope)}</div>
          </div>`;
      })
      .join("");
  }

  function renderBudget(t) {
    const frac = Math.min(1, t / END);
    const cost = run.is_mock_new || isLive ? M.runs[0].cost_usd * frac : run.cost_usd * frac;
    const inTok = (run.input_tokens || M.runs[0].input_tokens) * frac;
    const outTok = (run.output_tokens || M.runs[0].output_tokens) * frac;
    const calls = (run.tool_calls || M.runs[0].tool_calls) * frac;
    const timeout = run.run_timeout_s || 1800;
    const meter = (label, value, cap, text) => `
      <div class="meter-row">
        <div class="row-between"><span class="muted">${label}</span><strong class="num">${text}</strong></div>
        <div class="meter"><div class="meter-fill" data-fill="${Math.round((value / cap) * 100)}" style="width:${Math.min(100, (value / cap) * 100)}%"></div></div>
      </div>`;
    budgetEl.innerHTML = `
      ${meter("Cost", cost, run.max_cost_usd, `${money(cost)} / ${money(run.max_cost_usd)}`)}
      ${meter("Wall time", t, timeout, `${UI.duration(t)} / ${UI.duration(timeout)}`)}
      <div class="grid grid-2" style="gap:10px;margin-top:4px">
        <div class="stat" style="padding:10px 12px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line)"><b class="num" style="font:800 18px var(--font-display)">${UI.compact(Math.round(inTok))}</b><span class="hint">input tokens</span></div>
        <div class="stat" style="padding:10px 12px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line)"><b class="num" style="font:800 18px var(--font-display)">${UI.compact(Math.round(outTok))}</b><span class="hint">output tokens</span></div>
        <div class="stat" style="padding:10px 12px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line)"><b class="num" style="font:800 18px var(--font-display)">${Math.round(calls)}</b><span class="hint">tool calls</span></div>
        <div class="stat" style="padding:10px 12px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line)"><b class="num" style="font:800 18px var(--font-display)">${run.max_attempts || 5}</b><span class="hint">fix attempts per finding</span></div>
      </div>`;
    budgetEl.querySelectorAll(".meter-fill").forEach((el) => {
      const v = Number(el.dataset.fill);
      el.classList.toggle("is-warn", v >= 70 && v < 90);
      el.classList.toggle("is-danger", v >= 90);
    });
  }

  function renderScanners(t) {
    const done = t >= detail.phase_times.scanners[1];
    const started = t >= detail.phase_times.scanners[0];
    scannersEl.innerHTML = detail.scanners
      .map((s, i) => {
        const finished = done || t >= detail.phase_times.scanners[0] + (i + 1) * 8;
        const ic = !started ? "clock" : !finished ? null : s.state === "ok" ? "checkCircle" : s.state === "warn" ? "alert" : "xCircle";
        return `<div class="scanner ${finished ? s.state : ""}">${ic ? icon(ic) : '<span class="spinner" style="color:var(--info)"></span>'}<span class="tool">${esc(s.tool)}</span><span class="muted">${finished ? esc(s.result) : started ? "running…" : "waiting"}</span><span class="faint num">${finished ? `${s.duration_s}s` : ""}</span></div>`;
      })
      .join("");
  }

  function renderCosts(t) {
    const frac = Math.min(1, t / END);
    costsEl.innerHTML =
      detail.costs
        .map(
          (c) => `<div class="cost-row"><span class="node" title="${esc(c.node)}">${esc(c.node)}</span><div class="meter"><div class="meter-fill ${c.role === "strong" ? "strong" : ""}" style="width:${(c.amount_usd / maxCost) * 100 * frac}%"></div></div><span class="num" style="text-align:right">${money(c.amount_usd * frac)}</span></div>`,
        )
        .join("") +
      `<div class="row-between" style="margin-top:6px;font-size:13px"><span class="legend"><span><i style="background:var(--violet)"></i>strong model</span><span><i style="background:var(--accent)"></i>cheap model</span></span><strong class="num">${money(totalCost * frac)}</strong></div>`;
  }

  function logLine(e) {
    const mm = String(Math.floor(e.t / 60)).padStart(2, "0");
    const ss = String(e.t % 60).padStart(2, "0");
    return `<div class="log-line ${e.level}"><span class="t">${mm}:${ss}</span><span class="n">${esc(e.node)}</span><span class="m">${esc(e.message)}</span></div>`;
  }

  function renderResult() {
    const findingsHref = `findings.html?run=${reportRun}`;
    const sample = reportRun !== run.id;
    resultSlot.innerHTML = `
      <div class="result-band">
        <div>
          <h2>Report ready: 12 findings, 8 confirmed</h2>
          <p class="muted">1 inconclusive and 1 rejected by the reviewer; 2 improvement suggestions. Pick the confirmed ones you want fixed.${sample ? " (Opens the sample report.)" : ""}</p>
        </div>
        <div class="row">
          <a class="btn" href="graph.html?run=${reportRun}">${icon("graph")}Knowledge graph</a>
          <a class="btn btn-primary" href="${findingsHref}">${icon("bug")}Review findings</a>
        </div>
      </div>`;
  }

  function renderActions(live) {
    const actions = page.querySelector("#run-actions");
    if (live) {
      actions.innerHTML = `<button class="btn" data-skip>${icon("play")}Skip to the end</button><button class="btn btn-danger" data-cancel>${icon("x")}Cancel run</button>`;
      actions.querySelector("[data-skip]").addEventListener("click", finish);
      actions.querySelector("[data-cancel]").addEventListener("click", () => {
        stopStream();
        page.querySelector("#run-pill").innerHTML = UI.pill("cancelled");
        liveTag.innerHTML = "";
        log.querySelector(".log-cursor")?.remove();
        log.insertAdjacentHTML("beforeend", `<div class="log-line err"><span class="t">--:--</span><span class="n">api</span><span class="m">Run cancelled by ${esc(M.user.name)}. Sandbox destroyed.</span></div>`);
        actions.innerHTML = "";
        UI.toast("warn", "Run cancelled", "The sandbox was destroyed and nothing was kept.");
      });
    } else if (detail) {
      actions.innerHTML = `<a class="btn" href="${run.trace_url || "#"}" data-trace>${icon("activity")}Trace</a><button class="btn" data-replay>${icon("replay")}Replay live view</button>`;
      actions.querySelector("[data-replay]").addEventListener("click", startLive);
      actions.querySelector("[data-trace]").addEventListener("click", (e) => {
        e.preventDefault();
        UI.toast("info", "Traces live in Logfire", "The real app links each run to its trace.");
      });
    } else {
      actions.innerHTML = `<a class="btn" href="dashboard.html">${icon("grid")}All runs</a>`;
    }
  }

  function renderAt(t) {
    renderStepper(t);
    renderAgents(t);
    renderBudget(t);
    renderScanners(t);
    renderCosts(t);
    clock.textContent = UI.duration(t);
  }

  // ---------- final state ----------

  function showFinal() {
    renderAt(END);
    log.innerHTML = detail.events.map(logLine).join("");
    log.scrollTop = log.scrollHeight;
    renderResult();
    renderActions(false);
    liveTag.innerHTML = `<span class="chip">${detail.events.length} events</span>`;
  }

  // ---------- live playback ----------

  let stopStream = () => {};
  let ticker = null;

  function finish() {
    stopStream();
    clearInterval(ticker);
    showFinal();
    page.querySelector("#run-pill").innerHTML = UI.pill("waiting_human");
    page.querySelector("#run-sha").textContent = run.base_commit_sha || run.mock_sha || "4e1b9c2a";
    if (run.is_mock_new) API.finishMockRun(run.id);
    if (isLive || run.is_mock_new) UI.toast("ok", "Report ready", "12 findings, 8 confirmed. Pick what to fix.");
  }

  function startLive() {
    resultSlot.innerHTML = "";
    log.innerHTML = '<div class="log-cursor"></div>';
    page.querySelector("#run-pill").innerHTML = UI.pill("running");
    liveTag.innerHTML = `<span class="pill pill-running is-live"><span class="dot"></span>Live</span>`;
    renderActions(true);
    renderAt(0);
    let t = 0;
    const speed = 22;
    const startedAt = performance.now();
    ticker = setInterval(() => {
      t = Math.min(END, ((performance.now() - startedAt) / 1000) * speed);
      renderStepper(t);
      renderBudget(t);
      renderCosts(t);
      clock.textContent = UI.duration(t);
    }, 250);
    stopStream = API.streamEvents(
      run.id,
      (event) => {
        const cursor = log.querySelector(".log-cursor");
        cursor.insertAdjacentHTML("beforebegin", logLine(event));
        log.scrollTop = log.scrollHeight;
        if (event.node === "snapshot") page.querySelector("#run-sha").textContent = run.base_commit_sha || run.mock_sha || "4e1b9c2a";
        renderAgents(event.t);
        renderScanners(event.t);
      },
      { speed, onDone: () => setTimeout(finish, 600) },
    );
  }

  // New runs start queued, so they play live once; afterwards they show the final state.
  if (isLive) startLive();
  else showFinal();
})();
