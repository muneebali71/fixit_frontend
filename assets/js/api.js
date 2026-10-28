/* The only file pages talk to for data.
 *
 * Today every function resolves mock data after a short delay. When the backend lands,
 * replace each body with a fetch() to the FastAPI route named in its comment; the pages
 * keep working because they only use these functions and the shapes they return.
 *
 * Changes made in the UI (new runs, selections, approvals) are kept in sessionStorage so
 * the demo stays consistent while you click between pages.
 */
(function () {
  "use strict";

  const M = window.FIXIT_MOCK;
  const LATENCY_MS = 180;
  const STATE_KEY = "fixit.mock.state.v1";

  const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));
  const respond = (value, ms = LATENCY_MS) =>
    new Promise((resolve) => setTimeout(() => resolve(clone(value)), ms));
  const fail = (code, message, ms = LATENCY_MS) =>
    new Promise((_, reject) =>
      setTimeout(() => reject(Object.assign(new Error(message), { code })), ms),
    );

  function readState() {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {
      /* storage blocked: fall through to a fresh state */
    }
    return { newRuns: [], findingStatus: {}, fixes: {} };
  }

  function writeState(state) {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (_) {
      /* demo still works for this page view */
    }
  }

  function allRuns() {
    return [...readState().newRuns, ...M.runs];
  }

  function findRun(id) {
    return allRuns().find((r) => r.id === id) || null;
  }

  function withFindingState(finding) {
    const state = readState();
    const status = state.findingStatus[finding.id];
    return status ? { ...finding, status } : finding;
  }

  function fixFor(findingId) {
    const state = readState();
    return state.fixes[findingId] || M.fixes[findingId] || null;
  }

  function repoName(url) {
    try {
      const path = new URL(url).pathname.replace(/^\/+|\.git$|\/+$/g, "");
      return path || url;
    } catch (_) {
      return url;
    }
  }

  const api = {
    // GET /me (Cognito user + organization)
    me() {
      return respond({ user: M.user, organization: M.organization });
    },

    // GET /repositories
    repositories() {
      return respond(M.repositories);
    },

    // GET /stats
    stats() {
      return respond(M.stats);
    },

    // GET /notifications
    notifications() {
      return respond(M.notifications);
    },

    // GET /runs
    listRuns() {
      return respond(allRuns());
    },

    // GET /runs/{id}
    getRun(id) {
      const run = findRun(id);
      return run ? respond(run) : fail("not_found", `Run ${id} not found`);
    },

    // GET /runs/{id}/report (agents, scanners, graph summary, costs, events so far).
    // Live mock runs (new, queued or running) replay the featured run with their own repo.
    getRunDetail(id) {
      const run = findRun(id);
      if (!run) return fail("not_found", `Run ${id} not found`);
      const live = run.is_mock_new || run.status === "running" || run.status === "queued";
      const template = M.runDetails[id] || (live ? M.runDetails.run_7k2m : null);
      if (!template) return respond(null);
      const detail = clone(template);
      if (!M.runDetails[id]) {
        detail.events.forEach((e) => {
          e.message = e.message
            .replace("muneebali71/inventory-api@dev", `${run.repo}@${run.repo_branch || "main"}`)
            .replace("4e1b9c2a", run.base_commit_sha || run.mock_sha || "4e1b9c2a")
            .replace("run_7k2m", run.id);
        });
      }
      return respond(detail);
    },

    // POST /runs  -> 202 with the queued run
    createRun(input) {
      const state = readState();
      const id = `run_${Math.random().toString(36).slice(2, 6)}`;
      const run = {
        id,
        repo_url: input.repo_url,
        repo: repoName(input.repo_url),
        repo_branch: input.repo_branch || "main",
        base_commit_sha: null,
        source: "api",
        requested_by: M.user.name,
        status: "queued",
        phase: null,
        max_cost_usd: Number(input.max_cost_usd) || 2,
        max_attempts: Number(input.max_attempts) || 5,
        run_timeout_s: (Number(input.timeout_min) || 30) * 60,
        cost_usd: 0,
        created_at: new Date().toISOString(),
        started_at: null,
        finished_at: null,
        findings_count: null,
        confirmed_count: null,
        prs_opened: 0,
        use_issues: Boolean(input.use_issues),
        is_mock_new: true,
        // Shown once the mock snapshot "resolves" the branch.
        mock_sha: Math.random().toString(16).slice(2, 10).padEnd(8, "0"),
      };
      state.newRuns.unshift(run);
      writeState(state);
      return respond(run, 450);
    },

    // GET /runs/{id}/events (Server-Sent Events). The mock plays the stored events back
    // `speed` times faster. Returns a function that stops the stream.
    streamEvents(id, onEvent, { speed = 22, onDone } = {}) {
      let stopped = false;
      const timers = [];
      api.getRunDetail(id).then((detail) => {
        if (stopped || !detail) return;
        detail.events.forEach((event, index) => {
          const timer = setTimeout(() => {
            if (stopped) return;
            onEvent(event, index, detail.events.length);
            if (index === detail.events.length - 1 && onDone) onDone();
          }, (event.t * 1000) / speed + 300);
          timers.push(timer);
        });
      });
      return () => {
        stopped = true;
        timers.forEach(clearTimeout);
      };
    },

    // GET /runs/{id}/findings
    listFindings(runId) {
      const rows = M.findings.filter((f) => f.run_id === runId).map(withFindingState);
      return respond(rows.sort((a, b) => a.rank - b.rank));
    },

    // GET /findings/{id}
    getFinding(id) {
      const finding = M.findings.find((f) => f.id === id);
      return finding ? respond(withFindingState(finding)) : fail("not_found", `Finding ${id} not found`);
    },

    // GET /findings/{id}/fix (stages, attempts, diff, review, approval, PR)
    getFix(findingId) {
      return respond(fixFor(findingId));
    },

    // POST /runs/{id}/select  {finding_ids}. Unconfirmed findings are refused, like
    // select_findings() in the backend.
    selectFindings(runId, ids) {
      const state = readState();
      const refused = [];
      ids.forEach((id) => {
        const finding = M.findings.find((f) => f.id === id && f.run_id === runId);
        if (!finding || !finding.confirmed) refused.push(id);
        else state.findingStatus[id] = "selected";
      });
      writeState(state);
      return respond({ selected: ids.filter((id) => !refused.includes(id)), refused }, 500);
    },

    // POST /runs/{id}/approve  {finding_id, decision: "approved", comment}
    approve(findingId, comment) {
      const state = readState();
      const fix = clone(fixFor(findingId));
      if (!fix) return fail("invalid_state", "Nothing to approve");
      const now = new Date().toISOString();
      fix.current = "pr";
      fix.stages.human = { state: "done", note: `Approved by ${M.user.name}`, at: now };
      fix.stages.pr = { state: "done", note: "PR #42 open", at: now };
      fix.approval = { ...fix.approval, decision: "approved", reviewer: M.user.name, comment: comment || null, at: now };
      fix.pull_request = {
        number: 42,
        url: "https://github.com/muneebali71/inventory-api/pull/42",
        state: "open",
        branch_name: fix.branch_name,
        created_at: now,
      };
      state.fixes[findingId] = fix;
      state.findingStatus[findingId] = "fixed";
      writeState(state);
      return respond(fix, 1400);
    },

    // POST /runs/{id}/approve  {finding_id, decision: "rejected", comment}
    reject(findingId, comment) {
      const state = readState();
      const fix = clone(fixFor(findingId));
      if (!fix) return fail("invalid_state", "Nothing to reject");
      const round = (fix.approval?.round_number || 1) + 1;
      fix.current = "fixer";
      fix.stages.human = { state: "done", note: "Changes requested", at: new Date().toISOString() };
      fix.stages.fixer = { state: "running", note: `Attempt ${fix.attempts.length + 1} of 5, with your feedback` };
      ["diff_guard", "verifier", "reviewer"].forEach((key) => (fix.stages[key] = { state: "pending" }));
      fix.stages.pr = { state: "pending" };
      fix.approval = { ...fix.approval, round_number: round, decision: "rejected", comment, feedback: comment };
      state.fixes[findingId] = fix;
      writeState(state);
      return respond(fix, 900);
    },

    // Mock only: a new run whose live playback ended now has the sample report.
    finishMockRun(id) {
      const state = readState();
      const run = state.newRuns.find((r) => r.id === id);
      if (run) {
        const sample = M.runs.find((r) => r.id === "run_7k2m");
        Object.assign(run, {
          status: "waiting_human",
          phase: "report",
          base_commit_sha: run.mock_sha,
          started_at: run.started_at || run.created_at,
          cost_usd: sample.cost_usd,
          findings_count: sample.findings_count,
          confirmed_count: sample.confirmed_count,
          discovery_duration_s: sample.discovery_duration_s,
        });
        writeState(state);
      }
      return respond(run || null, 0);
    },

    // Finding ids whose fix waits for a human (part of GET /me in the real app). Synchronous
    // so the sidebar badge can render without waiting.
    pendingApprovals() {
      return Object.keys(M.fixes).filter((id) => fixFor(id)?.stages?.human?.state === "waiting");
    },

    // GET /runs/{id}/graph
    getGraph(runId) {
      return M.graph.run_id === runId ? respond(M.graph) : respond(null);
    },

    // Clears everything the demo changed (Settings → Reset demo data).
    resetDemo() {
      try {
        sessionStorage.removeItem(STATE_KEY);
      } catch (_) {
        /* nothing stored */
      }
      return respond(true, 100);
    },
  };

  window.FixItAPI = api;
})();
