// Unee section: switch between recorded decisions and let each one resolve from "no idea" to its recorded probabilities.
import { onVisible, prefersReducedMotion } from "./motion";

type Case = { tab: string; input: string; question: string; options: { key: string; p: number }[] };

const root = document.querySelector<HTMLElement>("[data-decide]");
if (root) {
  const data = JSON.parse(document.getElementById("unee-data")!.textContent!) as { cases: Case[]; threshold: number; act: string; ask: string };
  const bars = root.querySelector<HTMLElement>("[data-bars]")!;
  const input = root.querySelector<HTMLElement>("[data-input]")!;
  const question = root.querySelector<HTMLElement>("[data-question]")!;
  const verdict = root.querySelector<HTMLElement>("[data-verdict]")!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-case]")];
  let timer = 0;

  const show = (index: number, animate: boolean) => {
    const c = data.cases[index];
    clearTimeout(timer);
    buttons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
    input.textContent = c.input;
    question.textContent = c.question;
    const sure = Math.max(...c.options.map((o) => o.p)) >= data.threshold;
    const settle = () => {
      bars.querySelectorAll<HTMLElement>(".decide__fill").forEach((fill, i) => (fill.style.width = `${c.options[i].p * 100}%`));
      bars.querySelectorAll<HTMLElement>(".decide__value").forEach((value, i) => (value.textContent = `${(c.options[i].p * 100).toFixed(1)}%`));
      verdict.textContent = sure ? data.act : data.ask;
      verdict.classList.toggle("live", sure);
      verdict.classList.remove("is-pending");
    };
    // Every option starts equally likely, then the bars move to what the model returned.
    bars.innerHTML = c.options
      .map(
        (o) =>
          `<li><span class="t-mono decide__key">${o.key}</span><span class="decide__track"><span class="decide__fill" style="width:${animate ? 100 / c.options.length : o.p * 100}%"></span></span><span class="t-mono decide__value">${animate ? "" : (o.p * 100).toFixed(1) + "%"}</span></li>`,
      )
      .join("");
    if (!animate) return settle();
    verdict.classList.add("is-pending");
    void bars.offsetWidth;
    timer = window.setTimeout(settle, 350);
  };

  buttons.forEach((button, i) => button.addEventListener("click", () => show(i, !prefersReducedMotion())));

  let played = false;
  onVisible(root, (visible) => {
    if (visible && !played && !prefersReducedMotion()) {
      played = true;
      show(0, true);
    }
  });
}

// Copy buttons only appear when the clipboard is available.
document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
  if (!navigator.clipboard) return;
  button.hidden = false;
  const label = button.textContent;
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(button.dataset.copy!);
    button.textContent = button.dataset.copied!;
    setTimeout(() => (button.textContent = label), 1600);
  });
});
