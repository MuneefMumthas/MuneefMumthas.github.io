// UNEEFLOW: the real screens, in order. The app's own Next and Back buttons are live areas on the screenshots.
const root = document.querySelector<HTMLElement>("[data-uneeflow]");

if (root) {
  const steps = [...root.querySelectorAll<HTMLElement>(".uf__steps li")];
  const shots = [...root.querySelectorAll<HTMLElement>(".uf__shots li")];
  let current = 0;

  const show = (index: number) => {
    current = (index + shots.length) % shots.length;
    steps.forEach((step, i) => step.classList.toggle("is-active", i === current));
    shots.forEach((shot, i) => shot.classList.toggle("is-active", i === current));
  };

  root.addEventListener("click", (event) => {
    const target = (event.target as Element).closest<HTMLElement>("[data-go], [data-step]");
    if (!target) return;
    if (target.dataset.step) show(Number(target.dataset.step));
    else show(current + Number(target.dataset.go));
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") show(current + 1);
    else if (event.key === "ArrowLeft") show(current - 1);
  });
}
