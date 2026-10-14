// The recreated operations suite. Everything the visitor does is written to a hash-chained audit log.
import { onVisible, prefersReducedMotion, sleep } from "./motion";

const suite = document.querySelector<HTMLElement>("[data-suite]");

if (suite) {
  const data = JSON.parse(document.getElementById("suite-data")!.textContent!) as {
    columns: { id: string; name: string }[];
    log: Record<string, string>;
    admin: { intact: string; broken: string; tampered: string; tamper: string; restore: string; seed: string[] };
    apps: Record<string, string>;
    tasks: { submitted: string; approved: string };
  };
  const $ = <T extends HTMLElement>(selector: string, root: ParentNode = suite!) => root.querySelector<T>(selector)!;
  const $$ = <T extends HTMLElement>(selector: string, root: ParentNode = suite!) => [...root.querySelectorAll<T>(selector)];

  // ---- Audit log: each entry's hash covers the entry and the hash before it.
  type Entry = { n: number; action: string; hash: string; prev: string };
  const entries: Entry[] = [];
  const GENESIS = "0".repeat(64);
  const auditBody = $("[data-audit]");
  const verdict = $("[data-verdict]");
  const tamperButton = $<HTMLButtonElement>("[data-tamper]");
  let tampered = false;
  let queue: Promise<void> = Promise.resolve();

  const sha256 = async (text: string) => {
    if (!crypto.subtle) return "unavailable";
    const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  const shownAction = (entry: Entry) => (tampered && entry.n === 2 ? `${entry.action} ${data.admin.tampered}` : entry.action);

  const render = (fresh = 0, bad = 0) => {
    auditBody.replaceChildren(
      ...entries.map((entry) => {
        const row = document.createElement("tr");
        if (entry.n === fresh) row.className = "is-new";
        if (bad && entry.n >= bad) row.className = "is-bad";
        for (const text of [String(entry.n), shownAction(entry), entry.hash.slice(0, 10), entry.prev.slice(0, 10)]) {
          const cell = document.createElement("td");
          cell.textContent = text;
          row.append(cell);
        }
        return row;
      }),
    );
    tamperButton.disabled = entries.length < 2;
  };

  const log = (action: string) => {
    queue = queue.then(async () => {
      const prev = entries.length ? entries[entries.length - 1].hash : GENESIS;
      const n = entries.length + 1;
      entries.push({ n, action, prev, hash: await sha256(`${prev}|${n}|${action}`) });
      verdict.textContent = "";
      render(n);
    });
    return queue;
  };

  $("[data-verify]").addEventListener("click", async () => {
    await queue;
    let prev = GENESIS;
    for (const entry of entries) {
      const expected = await sha256(`${prev}|${entry.n}|${shownAction(entry)}`);
      if (expected !== entry.hash) {
        verdict.textContent = `${data.admin.broken} ${entry.n}.`;
        return render(0, entry.n);
      }
      prev = entry.hash;
    }
    verdict.textContent = data.admin.intact;
    render();
  });
  tamperButton.addEventListener("click", () => {
    tampered = !tampered;
    tamperButton.textContent = tampered ? data.admin.restore : data.admin.tamper;
    verdict.textContent = "";
    render();
  });

  // ---- Moving between the sign-in screen, the launcher and the apps.
  const go = (view: string, record = true) => {
    // Clicking the app that is already open does nothing, so it does not add another audit row.
    if (suite.dataset.view === view) return;
    suite.dataset.view = view;
    $(".suite__main").scrollTop = 0;
    $$<HTMLButtonElement>(".suite__nav [data-go]").forEach((button) => button.setAttribute("aria-current", String(button.dataset.go === view)));
    if (record && data.apps[view]) log(`${data.log.opened} ${data.apps[view]}`);
  };
  $$<HTMLButtonElement>("[data-go]").forEach((button) => button.addEventListener("click", () => go(button.dataset.go!)));

  const code = $(".suite__code");
  const signIn = async () => {
    await log(data.log.signedIn);
    suite.classList.add("is-assembling");
    go("home", false);
    setTimeout(() => suite.classList.remove("is-assembling"), 1600);
  };
  $("[data-signin]").addEventListener("click", signIn);

  // The first time the suite comes on screen it signs itself in, so the launcher assembles in front of the visitor.
  render();
  if (prefersReducedMotion()) {
    log(data.log.signedIn);
  } else {
    go("signin", false);
    code.textContent = "";
    let started = false;
    onVisible(suite, async (visible) => {
      if (!visible || started) return;
      started = true;
      await sleep(500);
      for (const char of code.dataset.code!) {
        code.textContent += char;
        await sleep(90);
      }
      await sleep(450);
      if (suite.dataset.view === "signin") signIn();
    });
  }

  // ---- Task board: drag with a mouse, arrow keys on a focused card, or the buttons on each card.
  const columns = $$("[data-col]");
  const names = data.columns.map((column) => column.name);
  const ids = data.columns.map((column) => column.id);
  const columnOf = (card: HTMLElement) => columns.indexOf(card.closest<HTMLElement>("[data-col]")!);
  const refresh = (card: HTMLElement) => {
    const index = columnOf(card);
    $<HTMLButtonElement>('[data-move="-1"]', card).disabled = index === 0;
    $<HTMLButtonElement>('[data-move="1"]', card).disabled = index === columns.length - 1;
    $<HTMLButtonElement>("[data-approve]", card).hidden = ids[index] !== "review";
  };
  const place = (card: HTMLElement, index: number, focus = false, approved = false) => {
    const target = Math.max(0, Math.min(columns.length - 1, index));
    if (target === columnOf(card)) return;
    $("ul", columns[target]).append(card);
    refresh(card);
    const title = card.dataset.title!;
    if (approved) log(`${data.log.approved} "${title}"`);
    else log(`${data.log.moved} "${title}" ${data.log.to} ${names[target]}`);
    if (focus) card.focus();
  };

  $$(".suite__card").forEach((card) => {
    refresh(card);
    $$<HTMLButtonElement>("[data-move]", card).forEach((button) =>
      button.addEventListener("click", () => place(card, columnOf(card) + Number(button.dataset.move), true)),
    );
    $("[data-approve]", card).addEventListener("click", () => place(card, ids.indexOf("done"), true, true));
    card.addEventListener("keydown", (event) => {
      if (event.target !== card || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault();
      place(card, columnOf(card) + (event.key === "ArrowRight" ? 1 : -1), true);
    });

    // Mouse drag only. On touch the buttons do the job, and the page keeps scrolling normally.
    let start: { x: number; y: number } | null = null;
    let dragging = false;
    const over = (x: number) => columns.findIndex((column) => x >= column.getBoundingClientRect().left && x <= column.getBoundingClientRect().right);
    card.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
      start = { x: event.clientX, y: event.clientY };
      card.setPointerCapture(event.pointerId);
    });
    card.addEventListener("pointermove", (event) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!dragging && Math.hypot(dx, dy) < 6) return;
      dragging = true;
      card.classList.add("is-dragging");
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(1.5deg)`;
      const target = over(event.clientX);
      columns.forEach((column, i) => column.classList.toggle("is-target", i === target && i !== columnOf(card)));
    });
    const drop = (event: PointerEvent) => {
      if (!start) return;
      const target = dragging ? over(event.clientX) : -1;
      start = null;
      dragging = false;
      card.classList.remove("is-dragging");
      card.style.transform = "";
      columns.forEach((column) => column.classList.remove("is-target"));
      if (target >= 0) place(card, target);
    };
    card.addEventListener("pointerup", drop);
    card.addEventListener("pointercancel", drop);
  });

  // ---- Releases: one signed release is live per app, and an earlier one can be put back.
  $$<HTMLButtonElement>("[data-rollback]").forEach((button) =>
    button.addEventListener("click", () => {
      const row = button.closest<HTMLElement>("[data-version]")!;
      const release = row.closest<HTMLElement>("[data-release]")!;
      $$("[data-version]", release).forEach((item) => (item.dataset.live = String(item === row)));
      log(`${data.log.rolledBack} ${release.dataset.release} ${data.log.to} ${row.dataset.version}`);
    }),
  );

  // ---- CRM: a lead becomes a proposal, and the proposal becomes a client plan.
  const flow = $("[data-flow]");
  $$<HTMLButtonElement>("[data-advance]").forEach((button) =>
    button.addEventListener("click", () => {
      const step = Number(flow.dataset.step) + 1;
      flow.dataset.step = String(step);
      log(step === 1 ? data.log.proposal : data.log.plan);
    }),
  );
  $("[data-flow-reset]").addEventListener("click", () => (flow.dataset.step = "0"));
}
