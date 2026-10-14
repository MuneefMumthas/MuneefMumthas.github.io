// The Hybrid Loan Approval System's rule explorer. Same rules and same matching as the project's own app:
// for each rule, the share of its conditions the input meets; the best share wins. Missing features are skipped.
type Rule = { c: number; f: number; n: number; if: [string, "<=" | ">", number][] };

const root = document.querySelector<HTMLElement>("[data-loan]");
if (root) {
  const rules: Rule[] = JSON.parse(root.querySelector("[data-rules]")!.textContent!);
  const labels = JSON.parse(root.dataset.labels!) as { approve: string[]; reject: string[] };
  const words = JSON.parse(root.dataset.words!) as Record<string, string>;
  const names = JSON.parse(root.dataset.names!) as Record<string, string>;
  const form = root.querySelector<HTMLFormElement>("[data-loan-form]")!;
  const verdict = root.querySelector<HTMLElement>("[data-verdict]")!;
  const meta = root.querySelector<HTMLElement>("[data-meta]")!;
  const conds = root.querySelector<HTMLOListElement>("[data-conds]")!;

  const evaluate = (input: Record<string, number>) => {
    let best: Rule | null = null;
    let bestScore = 0;
    for (const rule of rules) {
      let met = 0;
      for (const [feature, op, value] of rule.if) {
        if (!(feature in input)) continue;
        const v = input[feature];
        if ((op === "<=" && v <= value) || (op === ">" && v > value)) met++;
      }
      const score = met / rule.if.length;
      if (score > bestScore) {
        bestScore = score;
        best = rule;
      }
    }
    return best ? { rule: best, score: bestScore } : null;
  };

  const render = () => {
    const input: Record<string, number> = {};
    new FormData(form).forEach((value, key) => (input[key] = Number(value)));
    form.querySelectorAll<HTMLOutputElement>("[data-out]").forEach((o) => (o.textContent = input[o.dataset.out!].toFixed(2)));
    const result = evaluate(input);
    if (!result) return;
    const { rule, score } = result;
    const tier = rule.f >= 0.75 ? 0 : rule.f >= 0.5 ? 1 : 2;
    verdict.textContent = (rule.c === 1 ? labels.approve : labels.reject)[tier];
    verdict.className = `loand__verdict ${rule.c === 1 ? "is-yes" : "is-no"}`;
    const usable = rule.if.filter(([f]) => f in input);
    const met = usable.filter(([f, op, v]) => (op === "<=" ? input[f] <= v : input[f] > v)).length;
    meta.textContent = `${met}/${rule.if.length} ${words.met} · ${Math.round(rule.f * 100)}% ${words.confidence} · ${rule.n} ${rule.n === 1 ? words.support.replace(/s$/, "") : words.support} · match ${Math.round(score * 100)}%`;
    // Tree paths repeat a feature as they narrow it. For reading, each feature is shown once, as the range the rule allows.
    const ranges = new Map<string, { lo: number; hi: number; ok: boolean; known: boolean }>();
    for (const [f, op, v] of rule.if) {
      const r = ranges.get(f) ?? { lo: -Infinity, hi: Infinity, ok: true, known: f in input };
      if (op === ">") r.lo = Math.max(r.lo, v);
      else r.hi = Math.min(r.hi, v);
      r.ok &&= r.known && (op === "<=" ? input[f] <= v : input[f] > v);
      ranges.set(f, r);
    }
    conds.replaceChildren(
      ...[...ranges].map(([f, r], k) => {
        const li = document.createElement("li");
        li.style.setProperty("--k", String(k));
        li.classList.toggle("is-miss", !r.ok);
        const name = document.createElement("span");
        const range = document.createElement("span");
        range.className = "t-mono";
        if (f === "Credit_History") name.textContent = `${names[f]}: ${r.lo > -Infinity ? words.yes : words.no}`;
        else {
          name.textContent = names[f] ?? f.replace(/_1$/, "").replace(/_/g, " ");
          range.textContent = r.lo > -Infinity && r.hi < Infinity ? `${r.lo} < x ≤ ${r.hi}` : r.lo > -Infinity ? `> ${r.lo}` : `≤ ${r.hi}`;
        }
        li.append(name, range);
        return li;
      }),
    );
  };
  form.addEventListener("input", render);
  render();
}
