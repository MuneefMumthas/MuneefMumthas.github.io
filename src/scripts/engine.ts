// Lead engine: a simulation of the workflow's control flow over the real exported graph.
// It moves one task at a time through the nodes, takes the failure branch on request,
// and shows that a stopped run keeps the checkpoints it has written.
import { onVisible, prefersReducedMotion, sleep, tween } from "./motion";

const root = document.querySelector<HTMLElement>("[data-engine]");

if (root) {
  const data = JSON.parse(document.getElementById("engine-data")!.textContent!) as {
    states: Record<string, string>;
    totals: { tasks: number; zones: number; categories: number };
    kinds: Record<string, string>;
  };
  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const view = $<HTMLElement>("[data-view]");
  const svg = $<SVGSVGElement>("[data-world]");
  const token = $<SVGCircleElement>("[data-token]");
  const stateTag = $<HTMLElement>("[data-state]");
  const now = $<HTMLElement>("[data-now]");
  const out = {
    task: $<HTMLElement>("[data-task]"),
    zone: $<HTMLElement>("[data-zone]"),
    category: $<HTMLElement>("[data-category]"),
    checkpoints: $<HTMLElement>("[data-checkpoints]"),
    failed: $<HTMLElement>("[data-failed]"),
  };
  const buttons = Object.fromEntries([...root.querySelectorAll<HTMLButtonElement>("[data-act]")].map((b) => [b.dataset.act!, b]));
  const nodes = new Map([...root.querySelectorAll<SVGGElement>("[data-node]")].map((n) => [n.dataset.node!, n]));
  const edges = [...root.querySelectorAll<SVGPathElement>(".eng__edges path")];
  const edge = (from: string, to: string) => edges.find((e) => e.dataset.from === from && e.dataset.to === to);

  // The routes a task can take, written with the node names from the exported graph.
  const START = ["Scrape Form", "Build Tasks", "Loop Over Tasks"];
  const BEGIN = ["Start Scraper Job", "Job Started?"];
  const POLL = ["Wait Before Status Check", "Check Scraper Status", "Task Complete?"];
  const NOT_YET = ["Task Failed?"];
  const SAVE = [
    "Download Task CSV",
    "Validate CSV Download",
    "CSV Downloaded?",
    "Extract Task CSV",
    "Normalize and Preliminary Filter",
    "Enrich and Score Leads",
    "Prepare Checkpoint Rows",
    "Build Checkpoint Excel",
    "Write Checkpoint Excel",
    "Restore Leads After Checkpoint",
    "Task Cooldown",
    "Loop Over Tasks",
  ];
  const FAIL = ["Record Failed Task", "Build Failure Checkpoint Excel", "Write Failure Checkpoint", "Restore Failure Marker", "Task Cooldown", "Loop Over Tasks"];
  const FINISH = ["Global Deduplicate and Select Targets", "Finalize Master Columns", "Build Final Excel", "Write Final Excel"];
  const BRANCHES = new Set(["Job Started?", "Task Complete?", "CSV Downloaded?"]);

  const quick = () => prefersReducedMotion();
  let run = 0; // increases whenever the current run is interrupted
  let mode: "idle" | "running" | "paused" | "stopped" | "finishing" | "done" = "idle";
  let at = START[0];
  let task = 1;
  let checkpoints = 0;
  let failed = 0;
  let failNext = false;
  let wantFinish = false;

  const paint = () => {
    out.task.textContent = String(task);
    out.zone.textContent = String(Math.ceil(task / data.totals.categories));
    out.category.textContent = String(((task - 1) % data.totals.categories) + 1);
    out.checkpoints.textContent = String(checkpoints);
    out.failed.textContent = String(failed);
    stateTag.textContent = data.states[mode];
    stateTag.classList.toggle("is-live", mode === "running" || mode === "finishing");
    const busy = mode === "running" || mode === "finishing";
    buttons.toggle.textContent = busy ? buttons.toggle.dataset.pause! : buttons.toggle.dataset.run!;
    buttons.toggle.disabled = mode === "stopped" || mode === "done";
    buttons.stop.textContent = mode === "stopped" ? buttons.stop.dataset.resume! : buttons.stop.dataset.stop!;
    buttons.stop.disabled = mode === "done" || mode === "finishing" || mode === "idle";
    buttons.fail.disabled = mode !== "running" || failNext;
    buttons.finish.disabled = mode === "done" || mode === "finishing" || wantFinish;
  };

  const centre = (id: string) => ({ x: Number(nodes.get(id)!.dataset.x), y: Number(nodes.get(id)!.dataset.y) });
  const follow = (x: number) => {
    const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
    view.scrollTo({ left: Math.max(0, x * scale - view.clientWidth * 0.4), behavior: quick() ? "auto" : "smooth" });
  };
  const arrive = (id: string) => {
    nodes.get(at)?.classList.replace("is-current", "is-done");
    at = id;
    const node = nodes.get(id)!;
    node.classList.remove("is-done");
    node.classList.add("is-current");
    const { x, y } = centre(id);
    token.setAttribute("cx", String(x));
    token.setAttribute("cy", String(y - 34));
    now.textContent = `${id} · ${data.kinds[node.dataset.kind!]}`;
    follow(x);
  };
  const clearTrail = () => nodes.forEach((n) => n.classList.remove("is-done"));

  // Move the task along one edge of the graph.
  const hop = async (to: string, id: number) => {
    const path = edge(at, to);
    if (path && !quick()) {
      path.classList.add("is-hot");
      const length = path.getTotalLength();
      follow(centre(to).x);
      await tween(
        Math.min(900, 300 + length * 0.6),
        (t) => {
          const p = path.getPointAtLength(length * t);
          token.setAttribute("cx", String(p.x));
          token.setAttribute("cy", String(p.y));
        },
        () => id === run,
      );
      path.classList.remove("is-hot");
    }
    if (id !== run) return false;
    arrive(to);
    await sleep(quick() ? 0 : 260);
    return id === run;
  };
  const walk = async (route: string[], id: number): Promise<boolean | "fail"> => {
    for (const to of route) {
      if (to === at) continue;
      if (!(await hop(to, id))) return false;
      // A requested failure takes effect at the next decision point.
      if (failNext && BRANCHES.has(to)) return "fail";
    }
    return true;
  };

  const loop = async (id: number) => {
    if (!START.includes(at)) {
      // Resuming: the interrupted task starts again from the loop. Checkpoints already written are untouched.
      clearTrail();
      arrive("Loop Over Tasks");
    } else if ((await walk(START, id)) !== true) return;
    while (id === run && !wantFinish && task <= data.totals.tasks) {
      paint();
      let result = await walk(BEGIN, id);
      if (result === true) result = await walk(POLL, id);
      if (result === true && task % 2 === 1) {
        // The scraper is still working, so the status check goes round once more.
        result = await walk(NOT_YET, id);
        if (result === true) result = await walk(POLL, id);
      }
      if (result === true) result = await walk(SAVE, id);
      if (result === false) return;
      if (result === "fail") {
        failNext = false;
        if (at === "Task Complete?" && !(await hop("Task Failed?", id))) return;
        if ((await walk(FAIL, id)) !== true) return;
        failed++;
      } else {
        checkpoints++;
      }
      task++;
      clearTrail();
      paint();
    }
    if (id !== run) return;
    // The end of the run: every task is done, so deduplicate across all of them and export.
    mode = "finishing";
    wantFinish = false;
    checkpoints = data.totals.tasks - failed;
    task = data.totals.tasks;
    paint();
    if ((await walk(FINISH, id)) !== true) return;
    mode = "done";
    paint();
  };

  const start = () => {
    mode = "running";
    paint();
    loop(++run);
  };
  const reset = () => {
    run++;
    mode = "idle";
    task = 1;
    checkpoints = 0;
    failed = 0;
    failNext = false;
    wantFinish = false;
    nodes.forEach((n) => n.classList.remove("is-done", "is-current"));
    edges.forEach((e) => e.classList.remove("is-hot"));
    at = START[0];
    arrive(START[0]);
    paint();
  };

  buttons.toggle.addEventListener("click", () => {
    if (mode === "running" || mode === "finishing") {
      run++;
      mode = "paused";
      paint();
    } else start();
  });
  buttons.fail.addEventListener("click", () => {
    failNext = true;
    paint();
  });
  buttons.stop.addEventListener("click", () => {
    if (mode === "stopped") return start();
    run++;
    mode = "stopped";
    failNext = false;
    paint();
  });
  buttons.finish.addEventListener("click", () => {
    wantFinish = true;
    if (mode !== "running") start();
    else paint();
  });
  buttons.restart.addEventListener("click", () => {
    reset();
    start();
  });

  reset();
  // It starts by itself the first time it is on screen, and pauses whenever it leaves.
  let auto = !quick();
  let left = false;
  onVisible(root, (visible) => {
    if (visible && ((auto && mode === "idle") || (left && mode === "paused"))) {
      auto = false;
      left = false;
      start();
    } else if (!visible && (mode === "running" || mode === "finishing")) {
      // Leaving the app pauses the run. Coming back picks it up again.
      run++;
      mode = "paused";
      left = true;
      paint();
    }
  });
}
