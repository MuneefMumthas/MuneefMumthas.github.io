// Small things shared by every page: the theme switch, things rising into view, and the About text filling in.
const root = document.documentElement;

// ---- Theme switch. The choice is remembered.
const toggle = document.querySelector<HTMLButtonElement>("[data-theme-toggle]");
const paintTheme = () => {
  const dark = root.dataset.theme !== "light";
  toggle?.setAttribute("aria-pressed", String(!dark));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0e0e0f" : "#efefee");
};
paintTheme();
toggle?.addEventListener("click", () => {
  const next = root.dataset.theme === "light" ? "dark" : "light";
  const apply = () => {
    root.dataset.theme = next;
    paintTheme();
  };
  try {
    localStorage.setItem("theme", next);
  } catch {}
  const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
  if (doc.startViewTransition) doc.startViewTransition(apply);
  else apply();
});

// ---- Rise into view.
const rise = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-in");
      rise.unobserve(entry.target);
    }
  },
  { rootMargin: "0px 0px -8% 0px" },
);
document.querySelectorAll(".rise").forEach((el) => rise.observe(el));

// ---- Back to top, smoothly.
document.querySelectorAll<HTMLAnchorElement>("[data-top]").forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault();
    scrollTo({ top: 0, behavior: "smooth" });
  }),
);

// ---- Text that fills in word by word as it scrolls up the screen.
const fills = [...document.querySelectorAll<HTMLElement>("[data-fill]")];
if (fills.length) {
  const groups = fills.map((block) => {
    const words: HTMLElement[] = [];
    block.querySelectorAll<HTMLElement>("p").forEach((p) => {
      const parts = [...p.childNodes];
      p.replaceChildren();
      for (const node of parts) {
        if (node.nodeType !== Node.TEXT_NODE) {
          p.append(node);
          words.push(node as HTMLElement);
          continue;
        }
        (node.textContent ?? "").split(/(\s+)/).forEach((piece) => {
          if (!piece) return;
          if (/^\s+$/.test(piece)) return p.append(piece);
          const span = document.createElement("span");
          span.className = "word";
          span.textContent = piece;
          p.append(span);
          words.push(span);
        });
      }
    });
    block.classList.add("is-split");
    return { block, words };
  });
  let ticking = false;
  const paint = () => {
    ticking = false;
    for (const { block, words } of groups) {
      const rect = block.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, (innerHeight * 0.82 - rect.top) / (rect.height * 0.9 + innerHeight * 0.18)));
      const lit = Math.round(progress * words.length);
      words.forEach((word, i) => word.classList.toggle("is-lit", i < lit));
    }
  };
  const request = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(paint);
    }
  };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  paint();
}

// ---- Top bar links: the letters roll up on hover. The role rolls once more, then goes home.
document.querySelectorAll<HTMLElement>("[data-roll]").forEach((link) => {
  for (const node of [...link.childNodes]) {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
    const wrap = document.createElement("span");
    wrap.className = "roll";
    wrap.setAttribute("aria-hidden", "true");
    [...node.textContent.trim()].forEach((ch, k) => {
      const span = document.createElement("span");
      span.className = "roll__ch";
      span.textContent = ch;
      span.style.setProperty("--k", String(k));
      wrap.append(span);
    });
    const label = document.createElement("span");
    label.className = "visually-hidden";
    label.textContent = node.textContent.trim();
    node.replaceWith(wrap, label);
  }
});
document.querySelector<HTMLAnchorElement>("[data-role]")?.addEventListener("click", (event) => {
  const link = event.currentTarget as HTMLAnchorElement;
  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  link.classList.remove("is-rolling");
  void link.offsetWidth;
  link.classList.add("is-rolling");
  setTimeout(() => {
    if (location.pathname === "/") {
      link.classList.remove("is-rolling");
      scrollTo({ top: 0, behavior: "smooth" });
    } else location.href = link.href;
  }, 260);
});

// ---- A small plus follows the pointer on mouse and trackpad, as in the reference, and grows over anything clickable.
if (matchMedia("(pointer: fine)").matches) {
  const dot = document.createElement("div");
  // Hidden until the pointer first moves, so it never sits in the corner.
  dot.className = "cursor is-away";
  dot.setAttribute("aria-hidden", "true");
  document.body.append(dot);
  root.classList.add("has-cursor");
  let x = -100, y = -100, cx = x, cy = y, raf = 0;
  const loop = () => {
    cx += (x - cx) * 0.35;
    cy += (y - cy) * 0.35;
    dot.style.transform = `translate(${cx}px, ${cy}px)`;
    raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.3 ? requestAnimationFrame(loop) : 0;
  };
  addEventListener("pointermove", (e) => {
    if (cx < -50) {
      cx = e.clientX;
      cy = e.clientY;
      dot.classList.remove("is-away");
    }
    x = e.clientX;
    y = e.clientY;
    const t = e.target as Element;
    dot.classList.toggle("is-link", !!t.closest("a, button, [role=button], label, summary, input[type=range], input[type=radio]"));
    dot.classList.toggle("is-text", !!t.closest("input:not([type=range]):not([type=radio]), textarea, select"));
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  document.addEventListener("pointerleave", () => dot.classList.add("is-away"));
  document.addEventListener("pointerenter", () => dot.classList.remove("is-away"));
}
