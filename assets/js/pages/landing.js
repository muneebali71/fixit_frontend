/* Landing page: typed repo URL, the looping demo run in the hero, scroll reveals. */
(function () {
  "use strict";

  const UI = window.FixItUI;
  const M = window.FIXIT_MOCK;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  UI.hydrateIcons();
  document.querySelectorAll("[data-theme-icon]").forEach((el) => {
    el.innerHTML = UI.icon(UI.currentTheme() === "dark" ? "sun" : "moon");
  });
  document.querySelectorAll("[data-toggle-theme]").forEach((b) => b.addEventListener("click", UI.toggleTheme));
  document.getElementById("year").textContent = new Date().getFullYear();

  const nav = document.getElementById("site-nav");
  const onScroll = () => nav.classList.toggle("is-stuck", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- typed URL ----------

  const input = document.getElementById("hero-url");
  const sample = "https://github.com/muneebali71/inventory-api";
  let typing = !reduce;
  input.addEventListener("focus", () => (typing = false), { once: true });
  if (typing) {
    let i = 0;
    const tick = () => {
      if (!typing) return;
      input.value = sample.slice(0, ++i);
      if (i < sample.length) setTimeout(tick, 38 + Math.random() * 40);
    };
    setTimeout(tick, 700);
  } else {
    input.value = sample;
  }

  document.getElementById("hero-form").addEventListener("submit", (e) => {
    e.preventDefault();
    location.href = "signin.html?mode=signup";
  });

  // ---------- demo run ----------

  const phasesEl = document.getElementById("demo-phases");
  const listEl = document.getElementById("demo-list");
  const stepEl = document.getElementById("demo-step");
  const costEl = document.getElementById("demo-cost");
  const pillEl = document.getElementById("demo-pill");
  const statusEl = document.getElementById("demo-status");

  const shortLabels = { snapshot: "Clone", graph: "Graph", scanners: "Scan", plan: "Plan", specialists: "Hunt", verify: "Verify", report: "Report" };
  phasesEl.innerHTML = M.phases
    .map((p) => `<div class="demo-phase" data-phase="${p.key}"><span class="bar"></span>${shortLabels[p.key]}</div>`)
    .join("");

  const picks = ["f_01", "f_02", "f_03", "f_04", "f_06"].map((id) => M.findings.find((f) => f.id === id));
  const steps = [
    { phase: "snapshot", text: "Cloning into a sandbox…", cost: 0 },
    { phase: "graph", text: "Building the knowledge graph: 1,208 symbols", cost: 0.03 },
    { phase: "scanners", text: "pytest 214 passed · ruff · mypy · bandit · semgrep", cost: 0.03 },
    { phase: "plan", text: "Supervisor planned 9 tasks for 5 specialists", cost: 0.24 },
    { phase: "specialists", text: "Specialists searching their slices…", cost: 0.84 },
    { phase: "verify", text: "Reviewer reproducing each finding…", cost: 1.12 },
    { phase: "report", text: "8 confirmed · 1 inconclusive · ready for you", cost: 1.46 },
  ];

  const wait = (ms) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));

  function setPhase(index) {
    phasesEl.querySelectorAll(".demo-phase").forEach((el, i) => {
      el.classList.toggle("is-done", i < index);
      el.classList.toggle("is-active", i === index);
    });
    stepEl.textContent = steps[index].text;
    costEl.textContent = `${UI.money(steps[index].cost)} / $2.00`;
  }

  function findingRow(f) {
    const row = document.createElement("div");
    row.className = "demo-finding";
    row.innerHTML = `${UI.sev(f.severity)}<div style="min-width:0"><div class="t">${UI.esc(f.title)}</div><div class="f">${UI.esc(f.file_path)}:${f.line}</div></div><span class="verdict is-checking"><span class="spinner"></span>Checking</span>`;
    return row;
  }

  async function loop() {
    for (;;) {
      listEl.innerHTML = "";
      pillEl.className = "pill pill-running is-live";
      statusEl.textContent = "Running";
      for (let i = 0; i < 4; i++) {
        setPhase(i);
        await wait(1100);
      }
      setPhase(4);
      const rows = [];
      for (const f of picks) {
        const row = findingRow(f);
        listEl.appendChild(row);
        rows.push([row, f]);
        await wait(650);
      }
      setPhase(5);
      for (const [row, f] of rows) {
        await wait(700);
        row.querySelector(".verdict").outerHTML = UI.verdict(f.verification.verdict);
      }
      setPhase(6);
      phasesEl.querySelectorAll(".demo-phase").forEach((el) => {
        el.classList.add("is-done");
        el.classList.remove("is-active");
      });
      pillEl.className = "pill pill-waiting_human is-live";
      statusEl.textContent = "Waiting for you";
      await wait(5200);
      if (reduce) return;
    }
  }

  loop();
  UI.reveal();
})();
