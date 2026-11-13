// FORM's walkthrough: chapters, previous and next, autoplay while on screen, and pins tied to their notes.
const tour = document.querySelector<HTMLElement>("[data-tour]");
if (tour) {
  const shots = [...tour.querySelectorAll<HTMLElement>("[data-step]")];
  const notes = [...tour.querySelectorAll<HTMLElement>("[data-note]")];
  const tabs = [...tour.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const glow = tour.querySelector<HTMLElement>(".fx-tabs__glow")!;
  const count = tour.querySelector<HTMLElement>("[data-count]")!;
  const bar = tour.querySelector<HTMLElement>("[data-progress]")!;
  const play = tour.querySelector<HTMLButtonElement>("[data-play]")!;
  const STEP_MS = 7000;
  let index = 0;
  let playing = true;
  let visible = false;
  let held = false;
  let timer = 0;

  const placeGlow = (tab: HTMLButtonElement) => {
    glow.style.width = `${tab.offsetWidth}px`;
    glow.style.transform = `translateX(${tab.offsetLeft}px)`;
  };

  const restartBar = () => {
    bar.classList.remove("is-running");
    void bar.offsetWidth;
    if (playing) bar.classList.add("is-running");
  };

  const schedule = () => {
    clearTimeout(timer);
    restartBar();
    bar.classList.toggle("is-held", held || !visible);
    if (playing && visible && !held) timer = window.setTimeout(() => go(index + 1), STEP_MS);
  };

  const hot = (k: number | null) => {
    const shot = shots[index];
    const note = notes[index];
    const img = shot.querySelector<HTMLElement>(".fx-img")!;
    shot.querySelectorAll<HTMLElement>(".fx-pin").forEach((p) => p.classList.toggle("is-hot", Number(p.dataset.pin) === k));
    note.querySelectorAll<HTMLElement>("li").forEach((li) => li.classList.toggle("is-hot", Number(li.dataset.pin) === k));
    const pin = k === null ? null : shot.querySelector<HTMLElement>(`.fx-pin[data-pin="${k}"]`);
    if (pin) {
      img.style.setProperty("--ox", pin.style.getPropertyValue("--x"));
      img.style.setProperty("--oy", pin.style.getPropertyValue("--y"));
    }
    img.classList.toggle("is-zoom", pin !== null);
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
    schedule();
  });
  tour.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else return;
    e.preventDefault();
  });

  // Pointing at a pin or its note lights both and holds the tour on this screen.
  const hold = (on: boolean) => {
    held = on;
    schedule();
  };
  tour.addEventListener("pointerover", (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-pin]");
    if (el) hot(Number(el.dataset.pin));
  });
  tour.addEventListener("pointerout", (e) => {
    const from = (e.target as HTMLElement).closest("[data-pin]");
    const to = (e.relatedTarget as HTMLElement | null)?.closest?.("[data-pin]");
    if (from && from !== to) hot(null);
  });
  tour.querySelector(".fx-stage")!.addEventListener("pointerenter", () => hold(true));
  tour.querySelector(".fx-stage")!.addEventListener("pointerleave", () => {
    hot(null);
    hold(false);
  });

  // Autoplay only while the tour is on screen.
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
