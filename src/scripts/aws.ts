// The AWS Secure Web System demo: click a part to read about it, send requests through the load balancer,
// take a zone offline, submit the bank's contact form to a simulated DynamoDB table, and try the S3 permissions.
import { sleep } from "./motion";

const root = document.querySelector<HTMLElement>("[data-aws]");
if (root) {
  type Part = { id: string; name: string; kind: string; text: string };
  const parts: Part[] = JSON.parse(root.dataset.parts!);
  const status = JSON.parse(root.dataset.status!) as { idle: string; served: string; down: string };
  const controls = JSON.parse(root.dataset.controls!) as { request: string; fail: string; restore: string };
  const $ = <T extends HTMLElement>(s: string, el: ParentNode = root) => el.querySelector<T>(s)!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("[data-part]")];
  const byId = (id: string) => buttons.find((b) => b.dataset.part === id)!;
  const statusLine = $("[data-aws-status]");

  // Reading about a part.
  const show = (id: string) => {
    const p = parts.find((x) => x.id === id)!;
    $("[data-detail-kind]").textContent = p.kind;
    $("[data-detail-name]").textContent = p.name;
    $("[data-detail-text]").textContent = p.text;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.part === id)));
  };
  buttons.forEach((b) => b.addEventListener("click", () => show(b.dataset.part!)));
  show("lb");

  // Traffic. Cross-zone balancing is off, so each request stays in the zone it arrived in, unless that zone is down.
  let zoneADown = false;
  let next: "a" | "b" = "a";
  let busy = false;
  const flash = async (ids: string[]) => {
    for (const id of ids) {
      byId(id).classList.add("is-hot");
      await sleep(320);
    }
    await sleep(380);
    ids.forEach((id) => byId(id).classList.remove("is-hot"));
  };
  const request = async () => {
    if (busy) return;
    busy = true;
    const zone = zoneADown ? "b" : next;
    next = next === "a" ? "b" : "a";
    statusLine.textContent = "…";
    await flash(["users", "lb", `web-${zone}`]);
    const server = parts.find((p) => p.id === `web-${zone}`)!.name;
    statusLine.textContent = zoneADown ? `${status.down} ${status.served} ${server}.` : `${status.served} ${server}.`;
    busy = false;
  };
  $("[data-act='request']").addEventListener("click", request);
  const failButton = $<HTMLButtonElement>("[data-act='fail']");
  failButton.addEventListener("click", () => {
    zoneADown = !zoneADown;
    $("[data-zone='a']").classList.toggle("is-down", zoneADown);
    failButton.textContent = zoneADown ? controls.restore : controls.fail;
    statusLine.textContent = zoneADown ? status.down : status.idle;
  });

  // The contact form writes a row to the table, by way of a web server and the IAM role.
  const form = document.querySelector<HTMLFormElement>("[data-aws-form]")!;
  const rows = form.querySelector<HTMLOListElement>("[data-aws-rows]")!;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const zone = zoneADown ? "b" : next;
    next = next === "a" ? "b" : "a";
    root.scrollIntoView({ behavior: "smooth", block: "nearest" });
    await flash(["users", "lb", `web-${zone}`, "iam", "dynamo"]);
    rows.querySelector(".awsx__empty")?.remove();
    const li = document.createElement("li");
    const id = crypto.randomUUID().slice(0, 8);
    const meta = document.createElement("span");
    meta.textContent = `id ${id} · ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
    const text = document.createElement("b");
    text.textContent = `${data.get("name")}: ${data.get("message")}`;
    li.append(text, meta);
    rows.prepend(li);
    form.reset();
  });

  // S3: staff documents open, finance is denied.
  document.querySelectorAll<HTMLButtonElement>("[data-open-file]").forEach((button) =>
    button.addEventListener("click", () => {
      const ok = button.dataset.openFile === "1";
      button.textContent = ok ? button.dataset.allowed! : button.dataset.denied!;
      button.classList.toggle("is-ok", ok);
      button.classList.toggle("is-no", !ok);
    }),
  );
}
