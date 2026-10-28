/* Shared UI for every app page: icons, formatters, the shell (sidebar + top bar),
 * toasts, modals, the "New run" dialog, theme switching and small animations.
 * Everything that renders data goes through esc(): repo text is untrusted. */
(function () {
  "use strict";

  const M = window.FIXIT_MOCK;
  const API = window.FixItAPI;
  const FEATURED_RUN = "run_7k2m";

  // ---------- icons (24px, stroked) ----------

  const ICONS = {
    logo: '<path d="M8 4c-2 0-3 1-3 3v2c0 1.5-.8 2.3-2 3 1.2.7 2 1.5 2 3v2c0 2 1 3 3 3M16 4c2 0 3 1 3 3v2c0 1.5.8 2.3 2 3-1.2.7-2 1.5-2 3v2c0 2-1 3-3 3"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    bug: '<path d="m8 2 1.9 1.9M16 2l-1.9 1.9M9 7.1V6a3 3 0 0 1 6 0v1.1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9M6.5 13H3M21 13h-3.5M6 9.5 3.5 8M18 9.5 20.5 8M6 17l-2.5 1.5M18 17l2.5 1.5"/>',
    graph: '<circle cx="6" cy="6" r="3"/><circle cx="18" cy="8" r="3"/><circle cx="9" cy="18" r="3"/><path d="M8.9 6.7 15 7.6M6.9 8.9l1.3 6.2M16.2 10.4l-5.2 5.4"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    xCircle: '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    pr: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7M6 9v12"/>',
    branch: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    commit: '<circle cx="12" cy="12" r="3"/><path d="M3 12h6M15 12h6"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    dollar: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5V8M12 16v1.5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    replay: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    box: '<path d="M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
    gitRepo: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  };

  function icon(name, cls = "") {
    const body = ICONS[name] || ICONS.info;
    // 1em by default so a bare icon sits in text; component CSS sets its own size.
    return `<svg class="${cls}" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  }

  // ---------- formatting ----------

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const money = (v) => (v == null ? "—" : `$${Number(v).toFixed(2)}`);
  const num = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));
  const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);

  function compact(v) {
    if (v == null) return "—";
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${Math.round(v / 1e3)}k`;
    return String(v);
  }

  function relTime(iso) {
    if (!iso) return "—";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    const future = diff < 0;
    const s = Math.abs(diff);
    let out;
    if (s < 45) return future ? "in a moment" : "just now";
    if (s < 3600) out = `${Math.round(s / 60)} min`;
    else if (s < 86400) out = `${Math.round(s / 3600)} h`;
    else out = `${Math.round(s / 86400)} day${Math.round(s / 86400) === 1 ? "" : "s"}`;
    return future ? `in ${out}` : `${out} ago`;
  }

  function duration(seconds) {
    if (seconds == null) return "—";
    const s = Math.max(0, Math.round(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${String(r).padStart(2, "0")}s`;
    return `${r}s`;
  }

  function runDuration(run) {
    if (!run.started_at) return null;
    const end = run.finished_at ? new Date(run.finished_at) : run.discovery_duration_s ? null : new Date();
    if (!end) return run.discovery_duration_s;
    return (end - new Date(run.started_at)) / 1000;
  }

  const STATUS = {
    queued: "Queued",
    running: "Running",
    waiting_human: "Waiting for you",
    succeeded: "Succeeded",
    needs_info: "Needs info",
    failed_soft: "Stopped early",
    failed_hard: "Failed",
    expired: "Expired",
    cancelled: "Cancelled",
  };

  const CATEGORY = {
    security: "Security",
    leak: "Leak",
    bug: "Bug",
    regression: "Regression",
    improvement: "Improvement",
  };

  const FINDING_STATUS = {
    discovered: "Found",
    selected: "Selected",
    in_progress: "Fixing",
    needs_info: "Needs info",
    dismissed: "Dismissed",
    fixed: "Fixed",
    failed: "Failed",
  };

  const VERDICT = {
    confirmed: ["Confirmed", "checkCircle"],
    rejected: ["Rejected", "xCircle"],
    inconclusive: ["Inconclusive", "help"],
    suggestion: ["Suggestion", "sparkles"],
    pending: ["Not verified yet", "clock"],
  };

  function pill(status) {
    const live = status === "running" || status === "queued" || status === "waiting_human";
    return `<span class="pill pill-${esc(status)}${live ? " is-live" : ""}"><span class="dot"></span>${esc(STATUS[status] || status)}</span>`;
  }

  const sev = (s) => `<span class="sev sev-${esc(s)}">${esc(s)}</span>`;
  const cat = (c) => `<span class="chip cat-${esc(c)}"><span class="dot"></span>${esc(CATEGORY[c] || c)}</span>`;

  function verdict(v) {
    const [label, ic] = VERDICT[v] || VERDICT.pending;
    return `<span class="verdict verdict-${esc(v || "pending")}">${icon(ic)}${label}</span>`;
  }

  function repoColor(name) {
    const known = M.repositories.find((r) => r.full_name === name);
    if (known) return known.color;
    let hash = 0;
    for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return ["#2364b8", "#0d6f64", "#6c4bd1", "#c2334b", "#a35a00"][hash % 5];
  }

  function repoAvatar(name) {
    const short = String(name).split("/").pop() || "?";
    const letters = short
      .split(/[-_.]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("");
    return `<span class="repo-avatar" style="background:${repoColor(name)}">${esc(letters || "?")}</span>`;
  }

  const shortRepo = (name) => String(name).split("/").pop();
  const qs = (key) => new URLSearchParams(location.search).get(key);

  // ---------- theme ----------

  function currentTheme() {
    const set = document.documentElement.getAttribute("data-theme");
    if (set) return set;
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function toggleTheme() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("fixit.theme", next);
    } catch (_) {
      /* not persisted */
    }
    document.querySelectorAll("[data-theme-icon]").forEach((el) => {
      el.innerHTML = icon(next === "dark" ? "sun" : "moon");
    });
  }

  // ---------- toasts & modals ----------

  function toastStack() {
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("role", "status");
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    return stack;
  }

  function toast(kind, title, body = "", ms = 4200) {
    const ic = { ok: "checkCircle", info: "info", warn: "alert" }[kind] || "info";
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.innerHTML = `${icon(ic)}<div><strong>${esc(title)}</strong>${body ? `<span class="muted">${esc(body)}</span>` : ""}</div>`;
    toastStack().appendChild(el);
    setTimeout(() => {
      el.classList.add("is-leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, ms);
  }

  function modal(html, { onClose } = {}) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    const previous = document.activeElement;
    function close() {
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      if (previous && previous.focus) previous.focus();
      if (onClose) onClose();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop || e.target.closest("[data-close]")) close();
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(backdrop);
    const first = backdrop.querySelector("input, textarea, select, button:not([data-close])");
    if (first) setTimeout(() => first.focus(), 30);
    return { el: backdrop, close };
  }

  function openNewRunModal(prefill = {}) {
    const repos = M.repositories
      .map((r) => `<button type="button" class="chip" data-repo="https://github.com/${esc(r.full_name)}" data-branch="${esc(r.default_branch)}">${esc(shortRepo(r.full_name))}</button>`)
      .join("");
    const { el, close } = modal(`
      <form id="new-run-form" novalidate>
        <div class="modal-head">
          <div>
            <h2>Start a run</h2>
            <p>FixIt maps the repo, sends its specialists over it and verifies every finding before you see it.</p>
          </div>
          <button type="button" class="icon-btn" data-close aria-label="Close">${icon("x")}</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label class="label" for="nr-url">Repository URL</label>
            <div class="input-group">
              <span class="addon">${icon("gitRepo")}</span>
              <input class="input" id="nr-url" name="repo_url" placeholder="https://github.com/owner/repo" value="${esc(prefill.repo_url || "")}" autocomplete="off" required />
            </div>
            <span class="hint" id="nr-url-hint">Connected repos:</span>
            <div class="row">${repos}</div>
          </div>
          <div class="grid grid-2" style="gap:14px">
            <div class="field">
              <label class="label" for="nr-branch">Branch</label>
              <div class="input-group">
                <span class="addon">${icon("branch")}</span>
                <input class="input" id="nr-branch" name="repo_branch" placeholder="default branch" value="${esc(prefill.repo_branch || "")}" />
              </div>
            </div>
            <div class="field">
              <span class="label">Hints</span>
              <label class="switch" style="height:40px"><input type="checkbox" name="use_issues" checked /> Use open GitHub issues</label>
            </div>
          </div>
          <div class="field">
            <span class="label">Limits</span>
            <div class="grid grid-3" style="gap:10px">
              <label class="field"><span class="hint">Max cost (USD)</span><input class="input" type="number" name="max_cost_usd" min="0.1" step="0.1" value="2.00" /></label>
              <label class="field"><span class="hint">Fix attempts</span><input class="input" type="number" name="max_attempts" min="1" max="10" value="5" /></label>
              <label class="field"><span class="hint">Timeout (min)</span><input class="input" type="number" name="timeout_min" min="5" max="120" value="30" /></label>
            </div>
            <span class="hint">If a run hits a limit it stops cleanly and keeps a partial report.</span>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn btn-primary">${icon("play")}Start run</button>
        </div>
      </form>`);

    const form = el.querySelector("#new-run-form");
    const url = form.querySelector("#nr-url");
    const branch = form.querySelector("#nr-branch");
    form.querySelectorAll("[data-repo]").forEach((chip) =>
      chip.addEventListener("click", () => {
        url.value = chip.dataset.repo;
        branch.value = chip.dataset.branch;
        url.classList.remove("is-invalid");
      }),
    );
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const value = url.value.trim();
      if (!/^https:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+\/?$/.test(value)) {
        url.classList.add("is-invalid");
        form.querySelector("#nr-url-hint").textContent = "Use a full https URL, like https://github.com/owner/repo";
        url.focus();
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      submit.classList.add("is-loading");
      const data = Object.fromEntries(new FormData(form));
      data.repo_url = value;
      data.use_issues = form.querySelector('[name="use_issues"]').checked;
      const run = await API.createRun(data);
      close();
      location.href = `run.html?id=${encodeURIComponent(run.id)}`;
    });
  }

  // ---------- notifications popover ----------

  function notificationsPopover(anchor) {
    const existing = anchor.querySelector(".popover");
    if (existing) {
      existing.remove();
      return;
    }
    const kinds = {
      approval: ["alert", "var(--warn-soft)", "var(--warn)"],
      report: ["file", "var(--info-soft)", "var(--info)"],
      pr: ["pr", "var(--ok-soft)", "var(--ok)"],
      info: ["help", "var(--violet-soft)", "var(--violet)"],
    };
    const items = M.notifications
      .map((n) => {
        const [ic, bg, fg] = kinds[n.kind] || kinds.info;
        return `<a class="popover-item" href="${esc(n.href)}"><span class="ic" style="background:${bg};color:${fg}">${icon(ic)}</span><span><strong>${esc(n.title)}</strong><br><span class="muted">${esc(n.body)}</span><time>${relTime(n.at)}</time></span></a>`;
      })
      .join("");
    const pop = document.createElement("div");
    pop.className = "popover";
    pop.innerHTML = `<div class="popover-head">Notifications</div>${items}`;
    pop.addEventListener("click", (e) => e.stopPropagation());
    anchor.appendChild(pop);
    setTimeout(() =>
      document.addEventListener(
        "click",
        function away(e) {
          if (!anchor.contains(e.target)) {
            pop.remove();
            document.removeEventListener("click", away);
          }
        },
      ),
    );
  }

  // ---------- shell ----------

  function renderShell({ active, crumbs = [] }) {
    const run = M.runs.find((r) => r.id === FEATURED_RUN);
    const waiting = API.pendingApprovals().length;
    const unread = M.notifications.filter((n) => n.unread).length;
    const org = M.organization;
    const spend = org.spent_today_usd / org.daily_cost_cap_usd;
    const link = (key, href, ic, label, extra = "") =>
      `<a href="${href}" ${active === key ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span>${extra}</a>`;

    const crumbHtml = crumbs
      .map((c, i) =>
        i === crumbs.length - 1
          ? `<span class="here">${esc(c.label)}</span>`
          : `<a href="${esc(c.href)}">${esc(c.label)}</a>${icon("chevronRight")}`,
      )
      .join("");

    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div class="mock-banner"><strong>Preview</strong> · mock data only, nothing here talks to a server yet</div>
      <div class="shell" id="shell">
        <aside class="sidebar" aria-label="Main">
          <a class="brand" href="index.html"><span class="brand-mark">${icon("logo")}</span>FixIt</a>
          <nav class="nav">
            ${link("dashboard", "dashboard.html", "grid", "Dashboard")}
            <div class="nav-label">${esc(shortRepo(run.repo))} · ${esc(run.id)}</div>
            ${link("run", `run.html?id=${FEATURED_RUN}`, "activity", "Run report")}
            ${link("findings", `findings.html?run=${FEATURED_RUN}`, "bug", "Findings", waiting ? `<span class="nav-count" title="Waiting for your approval">${waiting}</span>` : "")}
            ${link("graph", `graph.html?run=${FEATURED_RUN}`, "graph", "Knowledge graph")}
            <div class="nav-label">Workspace</div>
            ${link("settings", "settings.html", "sliders", "Settings")}
          </nav>
          <div class="sidebar-foot">
            <div class="budget-mini">
              <div class="row-between"><span class="muted">Today's spend</span><strong class="num">${money(org.spent_today_usd)} <span class="faint">/ ${money(org.daily_cost_cap_usd)}</span></strong></div>
              <div class="meter"><div class="meter-fill" data-fill="${Math.round(spend * 100)}"></div></div>
            </div>
            <a class="user-card" href="settings.html" style="text-decoration:none;color:inherit">
              <span class="avatar">${esc(M.user.initials)}</span>
              <span class="who"><strong>${esc(M.user.name)}</strong><span>${esc(org.name)}</span></span>
            </a>
          </div>
        </aside>
        <div class="sidebar-scrim" data-close-nav></div>
        <div class="main">
          <header class="topbar">
            <button class="icon-btn menu-btn" data-open-nav aria-label="Open menu">${icon("menu")}</button>
            <nav class="crumbs" aria-label="Breadcrumb">${crumbHtml}</nav>
            <label class="topbar-search input-group">
              <span class="addon">${icon("search")}</span>
              <input class="input" id="global-search" placeholder="Search runs and findings" aria-label="Search" />
              <kbd>Ctrl K</kbd>
            </label>
            <div class="topbar-actions">
              <button class="icon-btn" data-toggle-theme aria-label="Switch theme"><span data-theme-icon>${icon(currentTheme() === "dark" ? "sun" : "moon")}</span></button>
              <div style="position:relative">
                <button class="icon-btn" data-notifications aria-label="Notifications">${icon("bell")}${unread ? `<span class="badge-dot">${unread}</span>` : ""}</button>
              </div>
              <button class="btn btn-primary btn-sm" data-new-run style="margin-left:6px">${icon("plus")}<span>New run</span></button>
            </div>
          </header>
          <main class="page" id="page"></main>
        </div>
      </div>`,
    );

    const shell = document.getElementById("shell");
    shell.querySelector("[data-open-nav]").addEventListener("click", () => shell.classList.add("nav-open"));
    shell.querySelector("[data-close-nav]").addEventListener("click", () => shell.classList.remove("nav-open"));
    shell.querySelector("[data-toggle-theme]").addEventListener("click", toggleTheme);
    shell.querySelector("[data-new-run]").addEventListener("click", () => openNewRunModal());
    const bell = shell.querySelector("[data-notifications]");
    bell.addEventListener("click", (e) => {
      e.stopPropagation();
      notificationsPopover(bell.parentElement);
    });
    const search = shell.querySelector("#global-search");
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") toast("info", "Search is part of the real app", "This preview only has the sample run.");
    });
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        search.focus();
      }
    });
    fillMeters(shell);
    return document.getElementById("page");
  }

  // ---------- small animations ----------

  function fillMeters(root = document) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        root.querySelectorAll(".meter-fill[data-fill]").forEach((el) => {
          const value = Math.min(100, Number(el.dataset.fill));
          el.style.width = `${value}%`;
          el.classList.toggle("is-warn", value >= 70 && value < 90);
          el.classList.toggle("is-danger", value >= 90);
        }),
      ),
    );
  }

  function countUp(root = document) {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelectorAll("[data-count]").forEach((el) => {
      const target = Number(el.dataset.count);
      const decimals = Number(el.dataset.decimals || 0);
      const prefix = el.dataset.prefix || "";
      const suffix = el.dataset.suffix || "";
      const format = (v) => `${prefix}${v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
      if (reduce) {
        el.textContent = format(target);
        return;
      }
      const start = performance.now();
      const ms = 900;
      function frame(now) {
        const t = Math.min(1, (now - start) / ms);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = format(target * eased);
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  function reveal(root = document) {
    const els = root.querySelectorAll(".reveal:not(.is-in)");
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
  }

  // Renders source lines as a code block; `hot` lines are highlighted.
  function codeBlock(lines, { start = 1, hot = [], diff = false } = {}) {
    let n = start;
    const rows = lines
      .map((text) => {
        let cls = "";
        let no = "";
        if (diff) {
          if (text.startsWith("+++") || text.startsWith("---")) cls = "meta";
          else if (text.startsWith("@@")) cls = "hunk";
          else if (text.startsWith("+")) cls = "add";
          else if (text.startsWith("-")) cls = "del";
        } else {
          no = n;
          if (hot.includes(n)) cls = "is-hot";
          n += 1;
        }
        return `<div class="ln ${cls}"><span class="no">${no}</span><span class="tx">${esc(text) || " "}</span></div>`;
      })
      .join("");
    return `<pre class="code">${rows}</pre>`;
  }

  // Static pages mark icons as <i data-icon="name"></i>; this swaps in the SVG.
  function hydrateIcons(root = document) {
    root.querySelectorAll("[data-icon]").forEach((el) => {
      el.outerHTML = icon(el.dataset.icon, el.className);
    });
  }

  function errorState(page, message) {
    page.innerHTML = `<div class="card"><div class="empty">${icon("alert")}<h2>Not found</h2><p>${esc(message)}</p><a class="btn" href="dashboard.html">Back to the dashboard</a></div></div>`;
  }

  window.FixItUI = {
    FEATURED_RUN,
    icon,
    esc,
    money,
    num,
    pct,
    compact,
    relTime,
    duration,
    runDuration,
    pill,
    sev,
    cat,
    verdict,
    repoAvatar,
    shortRepo,
    qs,
    toast,
    modal,
    openNewRunModal,
    renderShell,
    fillMeters,
    countUp,
    reveal,
    codeBlock,
    hydrateIcons,
    errorState,
    toggleTheme,
    currentTheme,
    STATUS,
    CATEGORY,
    FINDING_STATUS,
  };
})();
