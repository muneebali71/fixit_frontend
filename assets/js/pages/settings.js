/* Settings: workspace, members, repositories, budgets, model roles, security, demo reset. */
(async function () {
  "use strict";

  const UI = window.FixItUI;
  const API = window.FixItAPI;
  const M = window.FIXIT_MOCK;
  const { esc, icon, money } = UI;

  const page = UI.renderShell({ active: "settings", crumbs: [{ label: "Settings" }] });
  const [{ user, organization }, repos] = await Promise.all([API.me(), API.repositories()]);

  const sections = [
    ["workspace", "Workspace"],
    ["members", "Members"],
    ["repositories", "Repositories"],
    ["budgets", "Budgets and limits"],
    ["models", "Models"],
    ["security", "Security"],
    ["demo", "Demo data"],
  ];

  const numberRow = (label, hint, name, value, step = 1, suffix = "") => `
    <div class="setting-row">
      <div><span class="label">${label}</span><span class="hint">${hint}</span></div>
      <div class="input-group"><input class="input num" type="number" name="${name}" value="${value}" step="${step}" min="0" aria-label="${label}" />${suffix ? `<span class="addon" style="padding:0 12px 0 0">${suffix}</span>` : ""}</div>
    </div>`;

  page.innerHTML = `
    <div class="page-head">
      <div>
        <div class="eyebrow">${esc(organization.name)}</div>
        <h1>Settings</h1>
        <div class="sub"><span>Everything here belongs to this workspace only. Nobody outside it can see your runs, code or findings.</span></div>
      </div>
    </div>

    <div class="settings-layout">
      <nav class="settings-nav" aria-label="Settings sections">
        ${sections.map(([id, label], i) => `<a href="#${id}" class="${i === 0 ? "is-active" : ""}">${label}</a>`).join("")}
      </nav>

      <div class="stack">
        <section class="card" id="workspace">
          <div class="card-head"><h2>Workspace</h2><span class="chip">${esc(organization.plan)}</span></div>
          <div class="card-body flush">
            <div class="setting-row">
              <div><span class="label">Name</span><span class="hint">Shown in the sidebar and on PR descriptions.</span></div>
              <input class="input" value="${esc(organization.name)}" aria-label="Workspace name" />
            </div>
            <div class="setting-row">
              <div><span class="label">Workspace id</span><span class="hint">Every row, file and job carries it; the database enforces it.</span></div>
              <code style="justify-self:start">${esc(organization.id)}</code>
            </div>
            <div class="setting-row">
              <div><span class="label">Parallel runs</span><span class="hint">More runs wait in the queue.</span></div>
              <select class="select" aria-label="Parallel runs"><option>1</option><option selected>2</option><option>4</option></select>
            </div>
          </div>
          <div class="card-body" style="display:flex;justify-content:flex-end;border-top:1px solid var(--line)"><button class="btn btn-primary btn-sm" data-save="Workspace">Save</button></div>
        </section>

        <section class="card" id="members">
          <div class="card-head"><h2>Members</h2><button class="btn btn-sm" data-invite>${icon("plus")}Invite</button></div>
          <div class="card-body flush">
            ${organization.members
              .map(
                (m) => `<div class="list-row"><span class="avatar" style="${m.role === "owner" ? "" : "background:linear-gradient(135deg,#a35a00,#c2334b)"}">${esc(m.initials)}</span><div style="min-width:0"><strong>${esc(m.name)}${m.email === user.email ? ' <span class="faint">(you)</span>' : ""}</strong><span class="hint">${esc(m.email)} · joined ${UI.relTime(m.joined)}</span></div><span class="chip">${esc(m.role)}</span></div>`,
              )
              .join("")}
          </div>
        </section>

        <section class="card" id="repositories">
          <div class="card-head"><div><h2>Repositories</h2><span class="card-sub">Connected through the FixIt GitHub App</span></div><button class="btn btn-sm" data-connect>${icon("plus")}Connect repository</button></div>
          <div class="card-body flush">
            ${repos
              .map(
                (r) => `<div class="list-row">${UI.repoAvatar(r.full_name)}<div style="min-width:0"><strong>${esc(r.full_name)}</strong><span class="hint">${esc(r.stack)} · ${esc(r.default_branch)} · ${r.runs} runs · last ${UI.relTime(r.last_run_at)}</span></div><button class="btn btn-sm" data-run-repo="${esc(r.full_name)}" data-branch="${esc(r.default_branch)}">${icon("play")}Run</button></div>`,
              )
              .join("")}
          </div>
        </section>

        <section class="card" id="budgets">
          <div class="card-head"><div><h2>Budgets and limits</h2><span class="card-sub">Defaults for new runs. Hitting any limit stops cleanly with a partial report.</span></div></div>
          <div class="card-body flush">
            ${numberRow("Daily cost cap", `New runs are refused once today's spend reaches it. Today: ${money(organization.spent_today_usd)}.`, "daily_cap", organization.daily_cost_cap_usd.toFixed(2), 0.5, "USD")}
            ${numberRow("Max cost per run", "Checked before every model call.", "max_cost", "2.00", 0.1, "USD")}
            ${numberRow("Fix attempts per finding", "Each failed attempt leaves a short failure note for the next.", "max_attempts", 5)}
            ${numberRow("Code-review rounds", "Then it goes to you with the reviewer's concerns.", "review_rounds", 2)}
            ${numberRow("Your feedback rounds", "Request changes at most this many times per fix.", "human_rounds", 2)}
            ${numberRow("Run timeout", "Wall-clock limit for a run; the sandbox is killed after it.", "timeout", 30, 5, "min")}
            ${numberRow("Approval expiry", "Runs waiting longer than this become expired.", "expiry", 7, 1, "days")}
          </div>
          <div class="card-body" style="display:flex;justify-content:flex-end;border-top:1px solid var(--line)"><button class="btn btn-primary btn-sm" data-save="Budgets">Save</button></div>
        </section>

        <section class="card" id="models">
          <div class="card-head"><div><h2>Models</h2><span class="card-sub">Agents ask for a role, never a model. Set on the server.</span></div><span class="chip chip-mono">${esc(M.models.provider)}</span></div>
          <div class="card-body flush">
            ${[
              ["strong", "Strong", M.models.strong, "Supervisor, security specialist, reviewer, fixer"],
              ["cheap", "Cheap", M.models.cheap, "Graph summaries, triage, explorers, most specialists"],
              ["fallback", "Fallback", M.models.fallback, "Answers when the primary model is rate-limited or down"],
            ]
              .map(
                ([key, label, model, use]) => `<div class="setting-row"><div><span class="label">${label} <span class="role role-${key === "strong" ? "strong" : "cheap"}">${key}</span></span><span class="hint">${use}</span></div><code style="justify-self:start">${esc(model)}</code></div>`,
              )
              .join("")}
          </div>
          <div class="card-body"><div class="notice notice-info">${icon("info")}<span>Switching to OpenAI is three server settings: <code>FIXIT_LLM_BASE_URL</code>, <code>FIXIT_LLM_API_KEY</code> and the model names. No code changes.</span></div></div>
        </section>

        <section class="card" id="security">
          <div class="card-head"><h2>Security</h2></div>
          <div class="card-body flush">
            <div class="setting-row"><div><span class="label">Require MFA for members</span><span class="hint">Enforced by Cognito at sign-in.</span></div><label class="switch"><input type="checkbox" checked /> On</label></div>
            <div class="setting-row"><div><span class="label">Record prompts in traces</span><span class="hint">Prompts contain your code. Off keeps traces to timings and token counts.</span></div><label class="switch"><input type="checkbox" /> Off</label></div>
            <div class="setting-row"><div><span class="label">Network in sandboxes</span><span class="hint">Only the package mirror and your git host are reachable.</span></div><span class="chip">${icon("lock")}Locked down</span></div>
            <div class="setting-row"><div><span class="label">Allowed commands</span><span class="hint">Model output never runs outside this list.</span></div><div class="row" style="gap:6px">${["pytest", "npm test", "grep", "ls", "git diff"].map((c) => `<code>${c}</code>`).join("")}</div></div>
          </div>
        </section>

        <section class="card danger-zone" id="demo">
          <div class="card-head"><h2>Demo data</h2></div>
          <div class="card-body row-between">
            <span class="muted">Undo the runs you started, the fixes you selected and the approvals you gave in this preview.</span>
            <button class="btn btn-danger" data-reset>${icon("replay")}Reset demo data</button>
          </div>
        </section>
      </div>
    </div>`;

  page.querySelectorAll("[data-save]").forEach((b) =>
    b.addEventListener("click", () => {
      b.classList.add("is-loading");
      setTimeout(() => {
        b.classList.remove("is-loading");
        UI.toast("ok", `${b.dataset.save} saved`, "Mock only: nothing is stored on a server.");
      }, 600);
    }),
  );
  page.querySelector("[data-invite]").addEventListener("click", () => UI.toast("info", "Invites come with Cognito", "The real app emails an invite link."));
  page.querySelector("[data-connect]").addEventListener("click", () => UI.toast("info", "Connect through GitHub", "The real app opens the GitHub App install page."));
  page.querySelectorAll("[data-run-repo]").forEach((b) =>
    b.addEventListener("click", () => UI.openNewRunModal({ repo_url: `https://github.com/${b.dataset.runRepo}`, repo_branch: b.dataset.branch })),
  );
  page.querySelector("[data-reset]").addEventListener("click", async () => {
    await API.resetDemo();
    UI.toast("ok", "Demo data reset", "Everything is back to the sample state.");
  });

  // Highlight the section in view.
  const links = [...page.querySelectorAll(".settings-nav a")];
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) links.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${entry.target.id}`));
      }),
    { rootMargin: "-40% 0px -55% 0px" },
  );
  sections.forEach(([id]) => io.observe(page.querySelector(`#${id}`)));
})();
