// Screen walkthroughs (components/Tour.astro): chapters, previous and next, and autoplay while on screen.
// While playing, each screen lights its marks one by one; pointing at a mark or its note lights both and zooms in.
const MARK_MS = 1800;
const LEAD_MS = 900;

for (const tour of document.querySelectorAll<HTMLElement>("[data-tour]")) {
  const shots = [...tour.querySelectorAll<HTMLElement>("[data-step]")];
  const notes = [...tour.querySelectorAll<HTMLElement>("[data-note]")];
  const tabs = [...tour.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const glow = tour.querySelector<HTMLElement>(".fx-tabs__glow");
  const count = tour.querySelector<HTMLElement>("[data-count]")!;
  const bar = tour.querySelector<HTMLElement>("[data-progress]")!;
  const play = tour.querySelector<HTMLButtonElement>("[data-play]")!;
  const stage = tour.querySelector<HTMLElement>(".fx-stage")!;
  let index = 0;
  let playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  let visible = false;
  let held = false;
  let timers: number[] = [];

  play.setAttribute("aria-pressed", String(playing));
  play.setAttribute("aria-label", playing ? play.dataset.pauseLabel! : play.dataset.playLabel!);
  const marksOf = (i: number) => shots[i].querySelectorAll(".fx-pin").length;
  const stepMs = (i: number) => Math.max(6000, LEAD_MS + marksOf(i) * MARK_MS + 1600);

  const placeGlow = (tab: HTMLButtonElement) => {
    if (!glow) return;
    glow.style.width = `${tab.offsetWidth}px`;
    glow.style.transform = `translateX(${tab.offsetLeft}px)`;
  };

  const hot = (k: number | null, zoom = false) => {
    const shot = shots[index];
    const img = shot.querySelector<HTMLElement>(".fx-img")!;
    shot.querySelectorAll<HTMLElement>(".fx-pin").forEach((p) => p.classList.toggle("is-hot", Number(p.dataset.pin) === k));
    notes[index].querySelectorAll<HTMLElement>("li").forEach((li) => li.classList.toggle("is-hot", Number(li.dataset.pin) === k));
    const pin = k === null ? null : shot.querySelector<HTMLElement>(`.fx-pin[data-pin="${k}"]`);
    if (pin && zoom) {
      const v = (n: string) => parseFloat(pin.style.getPropertyValue(n)) || 0;
      img.style.setProperty("--ox", `${v("--x") + v("--w") / 2}%`);
      img.style.setProperty("--oy", `${v("--y") + v("--h") / 2}%`);
    }
    img.classList.toggle("is-zoom", Boolean(pin && zoom));
  };

  const clear = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  const schedule = () => {
    clear();
    bar.style.setProperty("--dur", `${stepMs(index)}ms`);
    bar.classList.remove("is-running");
    void bar.offsetWidth;
    if (playing) bar.classList.add("is-running");
    bar.classList.toggle("is-held", held || !visible);
    if (!playing || !visible || held) return;
    // On narrow screens a desktop screenshot is small, so autoplay also zooms in on each mark.
    const zoom = stage.clientWidth < 760 && !shots[index].classList.contains("fx-shot--phone");
    for (let k = 0; k < marksOf(index); k++) timers.push(window.setTimeout(() => hot(k, zoom), LEAD_MS + k * MARK_MS));
    timers.push(window.setTimeout(() => go(index + 1), stepMs(index)));
  };

  const go = (next: number) => {
    hot(null);
    index = (next + shots.length) % shots.length;
    shots.forEach((s, i) => s.classList.toggle("is-active", i === index));
    notes.forEach((n, i) => n.classList.toggle("is-active", i === index));
    const chapter = shots[index].dataset.chapter;
    tabs.forEach((t) => {
      const on = t.dataset.tab === chapter;
      t.setAttribute("aria-selected", String(on));
      if (on) placeGlow(t);
    });
    count.textContent = `${index + 1} / ${shots.length}`;
    schedule();
  };

  tabs.forEach((t) => t.addEventListener("click", () => go(Number(t.dataset.first))));
  tour.querySelector("[data-prev]")!.addEventListener("click", () => go(index - 1));
  tour.querySelector("[data-next]")!.addEventListener("click", () => go(index + 1));
  play.addEventListener("click", () => {
    playing = !playing;
    play.setAttribute("aria-pressed", String(playing));
    play.setAttribute("aria-label", playing ? play.dataset.pauseLabel! : play.dataset.playLabel!);
    if (!playing) hot(null);
    schedule();
  });
  tour.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else return;
    e.preventDefault();
  });

  // Pointing at the stage holds the tour; pointing at a mark or its note lights both.
  tour.addEventListener("pointerover", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-pin]");
    if (el) hot(Number(el.dataset.pin), true);
  });
  tour.addEventListener("pointerout", (e) => {
    const from = (e.target as HTMLElement).closest("[data-pin]");
    const to = (e.relatedTarget as HTMLElement | null)?.closest?.("[data-pin]");
    if (from && from !== to) hot(null);
  });
  stage.addEventListener("pointerenter", (e) => {
    if (e.pointerType !== "mouse") return;
    // A mark may already be lit by this same move (pointerover fires first), so only the autoplay stops here.
    held = true;
    schedule();
  });
  stage.addEventListener("pointerleave", () => {
    hot(null);
    held = false;
    schedule();
  });

  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    },
    { threshold: 0.35 },
  ).observe(tour);
  addEventListener("resize", () => {
    const t = tabs.find((x) => x.getAttribute("aria-selected") === "true");
    if (t) placeGlow(t);
  });
  go(0);
}
