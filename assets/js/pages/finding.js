/* One finding: evidence, verification and, once selected, the whole fix flow
 * (triage → reproducer → explorers → fixer → diff guard → verifier → reviewer →
 * your approval → pull request). Approve / request changes are wired to the mock API. */
(async function () {
  "use strict";

  const UI = window.FixItUI;
  const API = window.FixItAPI;
  const M = window.FIXIT_MOCK;
  const { esc, icon } = UI;

  const id = UI.qs("id") || "f_01";
  const page = UI.renderShell({ active: "findings", crumbs: [{ label: "Dashboard", href: "dashboard.html" }, { label: "Findings" }] });
  page.innerHTML = `<div class="skeleton" style="height:110px"></div><div class="skeleton" style="height:110px;border-radius:16px"></div><div class="skeleton" style="height:420px;border-radius:16px"></div>`;

  let finding;
  try {
    finding = await API.getFinding(id);
  } catch (err) {
    UI.errorState(page, err.message);
    return;
  }
  let fix = await API.getFix(id);
  const run = await API.getRun(finding.run_id);
  const siblings = (await API.listFindings(finding.run_id)).map((f) => f.id);

  // Breadcrumbs now that the run is known.
  document.querySelector(".crumbs").innerHTML = `<a href="dashboard.html">Dashboard</a>${icon("chevronRight")}<a href="run.html?id=${esc(run.id)}">${esc(run.id)}</a>${icon("chevronRight")}<a href="findings.html?run=${esc(run.id)}">Findings</a>${icon("chevronRight")}<span class="here">${esc(finding.code)}</span>`;

  const STAGES = [
    ["triage", "Triage", "help"],
    ["reproducer", "Reproducer", "bug"],
    ["explorers", "Explorers", "search"],
    ["fixer", "Fixer", "zap"],
    ["diff_guard", "Diff guard", "layers"],
    ["verifier", "Verifier", "checkCircle"],
    ["reviewer", "Reviewer", "shieldCheck"],
    ["human", "You", "users"],
    ["pr", "Pull request", "pr"],
  ];

  const node = M.graph.nodes.find((n) => n.findings.includes(finding.id));
  const index = siblings.indexOf(finding.id);
  const prev = siblings[index - 1];
  const next = siblings[index + 1];
  const v = finding.verification || { verdict: "pending" };
  const canFix = finding.confirmed && finding.category !== "improvement" && finding.status === "discovered";

  page.innerHTML = `
    <div class="page-head">
      <div style="min-width:0">
        <div class="eyebrow">${esc(finding.code)} · rank ${finding.rank} of ${siblings.length}</div>
        <h1>${esc(finding.title)}</h1>
        <div class="row" style="margin-top:12px;gap:8px">
          ${UI.sev(finding.severity)}${UI.cat(finding.category)}${UI.verdict(v.verdict)}
          <span class="chip" id="status-chip">${esc(UI.FINDING_STATUS[finding.status])}</span>
        </div>
        <div class="meta" style="margin-top:12px">
          <span>${icon("file")}<span class="mono">${esc(finding.file_path)}${finding.line ? `:${finding.line}` : ""}</span></span>
          <span>${icon("users")}${esc(finding.specialist)} specialist</span>
          <span>${icon("target")}confidence ${UI.pct(finding.confidence)}</span>
          ${finding.score != null ? `<span>${icon("activity")}score ${finding.score.toFixed(2)}</span>` : ""}
        </div>
      </div>
      <div class="actions">
        ${node ? `<a class="btn" href="graph.html?run=${esc(run.id)}&node=${encodeURIComponent(node.id)}">${icon("graph")}In the graph</a>` : ""}
        <a class="btn btn-ghost ${prev ? "" : "is-disabled"}" ${prev ? `href="finding.html?id=${prev}"` : 'aria-disabled="true"'} aria-label="Previous finding">${icon("chevronLeft")}Prev</a>
        <a class="btn btn-ghost ${next ? "" : "is-disabled"}" ${next ? `href="finding.html?id=${next}"` : 'aria-disabled="true"'} aria-label="Next finding">Next ${icon("chevronRight")}</a>
      </div>
    </div>

    <section class="card" id="pipeline-card" ${fix ? "" : "hidden"}>
      <div class="card-head">
        <div><h2>Fix progress</h2><span class="card-sub mono" id="branch-name"></span></div>
        <span class="card-sub" id="fix-cost"></span>
      </div>
      <div class="pipeline" id="pipeline"></div>
    </section>

    <section class="grid grid-main">
      <div class="stack" id="left"></div>
      <div class="stack" id="right"></div>
    </section>`;

  const left = page.querySelector("#left");
  const right = page.querySelector("#right");

  // ---------- sections ----------

  function pipeline() {
    if (!fix) return;
    page.querySelector("#pipeline-card").hidden = false;
    page.querySelector("#branch-name").textContent = fix.branch_name;
    page.querySelector("#fix-cost").textContent = `fix cost so far ${UI.money(fix.cost_usd)}`;
    page.querySelector("#pipeline").innerHTML = STAGES.map(([key, label, ic]) => {
      const s = fix.stages[key] || { state: "pending" };
      const glyph = s.state === "done" ? icon("check") : s.state === "running" ? '<span class="spinner" style="width:13px;height:13px"></span>' : icon(ic);
      return `<div class="pstage is-${s.state}"><span class="dot">${glyph}</span><strong>${label}</strong><small>${esc(s.note || (s.state === "pending" ? "Not started" : ""))}</small></div>`;
    }).join("");
  }

  function evidenceCard() {
    const s = finding.snippet;
    return `
      <div class="card">
        <div class="card-head"><h2>Evidence</h2><span class="card-sub">from the ${esc(finding.specialist)} specialist</span></div>
        <div class="card-body stack-sm">
          <p>${esc(finding.evidence)}</p>
          ${
            s
              ? `<div><div class="file-bar"><span>${icon("file")} ${esc(finding.file_path)}</span><span>lines ${s.start}–${s.start + s.lines.length - 1}</span></div>${UI.codeBlock(s.lines, { start: s.start, hot: s.hot })}</div>`
              : ""
          }
        </div>
      </div>`;
  }

  function diffStats(lines) {
    const add = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
    const del = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
    return `<span><span class="plus">+${add}</span> <span class="minus">−${del}</span></span>`;
  }

  function fileOf(lines) {
    const header = lines.find((l) => l.startsWith("+++"));
    return header ? header.replace(/^\+\+\+ (b\/)?/, "") : "";
  }

  function patchCard() {
    if (!fix || !fix.diff) return "";
    return `
      <div class="card" id="patch-card">
        <div class="card-head">
          <h2>The fix</h2>
          <span class="card-sub">attempt ${fix.attempts.length} · diff guard passed</span>
        </div>
        <div class="card-body stack-sm">
          <div class="tabs" role="tablist">
            <button class="tab" role="tab" data-diff="patch" aria-selected="true">Patch</button>
            <button class="tab" role="tab" data-diff="test" aria-selected="false">New regression test</button>
          </div>
          <div data-diff-panel="patch"><div class="file-bar"><span>${icon("file")} ${esc(fileOf(fix.diff))}</span>${diffStats(fix.diff)}</div>${UI.codeBlock(fix.diff, { diff: true })}</div>
          <div data-diff-panel="test" hidden><div class="file-bar"><span>${icon("file")} ${esc(fileOf(fix.test_diff))}</span>${diffStats(fix.test_diff)}</div>${UI.codeBlock(fix.test_diff, { diff: true })}</div>
        </div>
      </div>`;
  }

  function attemptsCard() {
    if (!fix || !fix.attempts.length) return "";
    const items = fix.attempts
      .map((a) => {
        const ok = a.tests_passed;
        return `
          <div class="attempt ${ok ? "ok" : "bad"}">
            <span class="badge">${a.attempt_number}</span>
            <div class="body">
              <div class="row-between">
                <strong>${ok ? "Tests passed" : `${a.failed_tests.length} tests failed`}</strong>
                <span class="hint">${UI.relTime(a.at)} · ${a.test_duration_s}s</span>
              </div>
              <p class="muted">${esc(a.explanation)}</p>
              <div class="row" style="gap:6px">
                ${a.files_changed.map((f) => `<span class="chip chip-mono">${esc(f)}</span>`).join("")}
                <span class="chip chip-mono"><span style="color:var(--ok)">+${a.lines_added}</span>&nbsp;<span style="color:var(--danger)">−${a.lines_removed}</span></span>
                <span class="chip" style="color:var(--ok)">${icon("check")}diff guard</span>
              </div>
              ${
                a.failure_note
                  ? `<div class="failure-note"><strong>Failure note for the next attempt</strong><span>${esc(a.failure_note.what_failed)}</span><span class="muted">Likely cause: ${esc(a.failure_note.likely_cause)}</span><span class="hint mono">${a.failed_tests.map(esc).join("<br>")}</span></div>`
                  : ""
              }
              ${a.review_approved != null ? `<div class="notice notice-ok" style="padding:10px 12px">${icon("shieldCheck")}<span><strong>Reviewer approved.</strong> ${a.review_concerns.length ? esc(a.review_concerns.join(" ")) : "No concerns."}</span></div>` : ""}
            </div>
          </div>`;
      })
      .join("");
    return `
      <div class="card">
        <div class="card-head"><h2>Attempts</h2><span class="card-sub">${fix.attempts.length} of ${run.max_attempts || 5} used · the fixer only sees failure notes, not full logs</span></div>
        <div class="card-body attempts">${items}</div>
      </div>`;
  }

  function explorersCard() {
    if (!fix || !fix.explorations?.length) return "";
    return `
      <div class="card">
        <div class="card-head"><h2>What the explorers found</h2><span class="card-sub">parallel, read-only, ~300-token summaries</span></div>
        <div class="card-body explore">
          ${fix.explorations
            .map((e) => `<div class="explore-item"><span class="q">${esc(e.question)}</span><span class="muted">${esc(e.summary)}</span><span class="refs">${e.relevant_files.map((f) => `<span class="chip chip-mono">${esc(f)}</span>`).join("")}</span></div>`)
            .join("")}
        </div>
      </div>`;
  }

  function verificationCard() {
    return `
      <div class="card">
        <div class="card-head"><h2>Verification</h2>${UI.verdict(v.verdict)}</div>
        <div class="card-body stack-sm">
          <p>${esc(v.detail || "")}</p>
          ${
            v.command
              ? `<dl class="kv">
                  <dt>Method</dt><dd>${esc(v.method)}</dd>
                  <dt>Command</dt><dd><code>${esc(v.command)}</code></dd>
                  <dt>Log</dt><dd class="mono" style="font-size:13px">${esc(v.log_ref)}</dd>
                  <dt>Took</dt><dd>${v.duration_s}s in sandbox ${esc(run.sandbox_id || "")}</dd>
                </dl>`
              : ""
          }
        </div>
      </div>`;
  }

  function reproCard() {
    if (!fix || !fix.repro) return "";
    return `
      <div class="card">
        <div class="card-head"><h2>Reproducer</h2><span class="chip" style="color:var(--danger)">${icon("xCircle")}fails before the fix</span></div>
        <div class="card-body stack-sm">
          <dl class="kv"><dt>Test</dt><dd class="mono" style="font-size:13px">${esc(fix.repro.test_file)}</dd><dt>Command</dt><dd><code>${esc(fix.repro.command)}</code></dd></dl>
          <pre class="code" style="padding:12px 16px;white-space:pre-wrap;color:#ff9aa9">${esc(fix.repro.error_text)}</pre>
        </div>
      </div>`;
  }

  function prCard(pr) {
    return `
      <div class="pr-card">
        <span class="ic">${icon("pr")}</span>
        <div style="min-width:0"><strong>PR #${pr.number} · ${esc(pr.state)}</strong><div class="hint mono" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(pr.branch_name)}</div></div>
        <a class="btn btn-sm" href="${esc(pr.url)}" data-mock-link>${icon("external")}Open</a>
      </div>`;
  }

  function approvalCard() {
    if (!fix) {
      if (canFix) {
        return `
          <div class="card">
            <div class="card-head"><h2>Fix this finding</h2></div>
            <div class="card-body stack-sm">
              <p class="muted">FixIt writes a failing test first, then a patch, runs your whole suite and gets a code review before asking you.</p>
              <button class="btn btn-primary" data-start-fix>${icon("zap")}Start the fix</button>
            </div>
          </div>`;
      }
      const why =
        finding.category === "improvement"
          ? "Improvements are suggestions. FixIt never fixes them automatically."
          : v.verdict === "rejected"
            ? "The reviewer showed this is not a real problem, so it won't be fixed."
            : v.verdict === "inconclusive"
              ? "The reviewer couldn't reproduce this. Unconfirmed findings are shown but never auto-fixed."
              : `This finding is ${UI.FINDING_STATUS[finding.status].toLowerCase()}.`;
      return `<div class="notice notice-info">${icon("info")}<span>${esc(why)}</span></div>`;
    }

    const stage = fix.stages.human;
    if (fix.pull_request) {
      return `
        <div class="card approval is-done">
          <div class="card-head"><h2>Approved</h2><span class="card-sub">${UI.relTime(fix.approval?.at)}</span></div>
          <div class="card-body stack-sm">
            <svg class="success-burst" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="32" cy="32" r="25"/><path d="m21 33 8 8 15-17"/></svg>
            <p style="text-align:center">Approved by <strong>${esc(fix.approval?.reviewer || M.user.name)}</strong>${fix.approval?.comment ? `: “${esc(fix.approval.comment)}”` : "."}</p>
            ${prCard(fix.pull_request)}
          </div>
        </div>`;
    }
    if (fix.approval?.decision === "rejected") {
      return `
        <div class="card">
          <div class="card-head"><h2>Sent back to the fixer</h2><span class="card-sub">round ${fix.approval.round_number} of ${fix.approval.max_rounds}</span></div>
          <div class="card-body stack-sm">
            <div class="notice notice-warn">${icon("message")}<span><strong>Your feedback:</strong> ${esc(fix.approval.feedback)}</span></div>
            <p class="muted">The fixer gets your note as a failure note, runs the suite again and comes back for review. The graph resumes from its checkpoint.</p>
          </div>
        </div>`;
    }
    if (!stage || stage.state !== "waiting") {
      return `
        <div class="card">
          <div class="card-head"><h2>Your approval</h2></div>
          <div class="card-body"><p class="muted">You'll be asked once the fix passes the tests and the code review.</p></div>
        </div>`;
    }
    const lastAttempt = fix.attempts[fix.attempts.length - 1];
    const checks = [
      ["The new failing test now passes", true],
      [`${fix.tests.passed} passed, ${fix.tests.failed} failed in the full suite`, fix.tests.failed === 0],
      [`Diff guard: ${lastAttempt.files_changed.length} files, +${lastAttempt.lines_added} −${lastAttempt.lines_removed}, no CI or lockfile edits`, lastAttempt.guard_ok],
      [`Reviewer approved${fix.review.concerns.length ? ` with ${fix.review.concerns.length} note` : ""}`, fix.review.decision === "approve"],
    ];
    return `
      <div class="card approval">
        <div class="card-head"><h2>Your approval</h2><span class="card-sub">round ${fix.approval.round_number} of ${fix.approval.max_rounds} · expires ${UI.relTime(fix.approval.expires_at)}</span></div>
        <div class="card-body stack-sm">
          ${checks.map(([text, ok]) => `<div class="row" style="gap:10px;flex-wrap:nowrap"><span style="color:${ok ? "var(--ok)" : "var(--danger)"}">${icon(ok ? "checkCircle" : "xCircle")}</span><span>${esc(text)}</span></div>`).join("")}
          ${fix.review.concerns.length ? `<div class="notice notice-info" style="padding:10px 12px">${icon("message")}<span>${esc(fix.review.concerns[0])}</span></div>` : ""}
          <label class="field"><span class="label">Comment <span class="faint">(required to request changes)</span></span><textarea class="textarea" id="approval-comment" placeholder="Optional note for the PR, or what should change"></textarea></label>
          <div class="row">
            <button class="btn btn-primary" data-approve style="flex:1">${icon("pr")}Approve and open PR</button>
            <button class="btn btn-danger" data-reject>Request changes</button>
          </div>
          <span class="hint">Only this step holds the GitHub token. The PR targets ${esc(run.repo_branch)} on ${esc(run.repo)}.</span>
        </div>
      </div>`;
  }

  function render() {
    pipeline();
    left.innerHTML = evidenceCard() + patchCard() + attemptsCard() + explorersCard();
    right.innerHTML = approvalCard() + verificationCard() + reproCard();
    wire();
  }

  // ---------- behaviour ----------

  function setStatus(status) {
    finding.status = status;
    page.querySelector("#status-chip").textContent = UI.FINDING_STATUS[status];
  }

  function wire() {
    page.querySelectorAll("[data-diff]").forEach((tab) =>
      tab.addEventListener("click", () => {
        page.querySelectorAll("[data-diff]").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
        page.querySelectorAll("[data-diff-panel]").forEach((p) => (p.hidden = p.dataset.diffPanel !== tab.dataset.diff));
      }),
    );

    page.querySelectorAll("[data-mock-link]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        UI.toast("info", "Mock pull request", "In the real app this opens the PR on GitHub.");
      }),
    );

    const approve = page.querySelector("[data-approve]");
    if (approve) {
      approve.addEventListener("click", async () => {
        approve.classList.add("is-loading");
        page.querySelector("[data-reject]").disabled = true;
        fix = await API.approve(finding.id, page.querySelector("#approval-comment").value.trim());
        setStatus("fixed");
        render();
        UI.toast("ok", `PR #${fix.pull_request.number} opened`, fix.branch_name);
      });
    }

    const reject = page.querySelector("[data-reject]");
    if (reject) {
      reject.addEventListener("click", async () => {
        const box = page.querySelector("#approval-comment");
        const comment = box.value.trim();
        if (!comment) {
          box.classList.add("is-invalid");
          box.placeholder = "Say what should change, e.g. use the ORM instead of raw SQL";
          box.focus();
          return;
        }
        reject.classList.add("is-loading");
        fix = await API.reject(finding.id, comment);
        render();
        UI.toast("info", "Sent back to the fixer", "Your note becomes the next attempt's failure note.");
      });
    }

    const start = page.querySelector("[data-start-fix]");
    if (start) {
      start.addEventListener("click", async () => {
        start.classList.add("is-loading");
        await API.selectFindings(finding.run_id, [finding.id]);
        setStatus("selected");
        start.closest(".card").outerHTML = `<div class="notice notice-ok">${icon("checkCircle")}<span><strong>Fix started.</strong> Triage runs first; you'll get a notification when it needs your approval.</span></div>`;
        UI.toast("ok", "Fix started", `${finding.code} is queued for triage.`);
      });
    }
  }

  render();
})();
