// The WhatsApp CRM recreation. Scripted: the visitor picks a customer message and watches what the assistant does with it.
import { prefersReducedMotion, sleep } from "./motion";

type Script = {
  id: string;
  customer: string;
  reply: string;
  uses: string[];
  lead: null | { need: string; date: string; stage: string; followUp: string };
  handover: boolean;
};

const root = document.querySelector<HTMLElement>("[data-chat]");

if (root) {
  const scripts = JSON.parse(document.getElementById("chat-data")!.textContent!) as Script[];
  const thread = root.querySelector<HTMLElement>("[data-thread]")!;
  const status = root.querySelector<HTMLElement>("[data-status]")!;
  const lead = root.querySelector<HTMLElement>("[data-lead]")!;
  const reset = root.querySelector<HTMLButtonElement>("[data-reset]")!;
  const chips = [...root.querySelectorAll<HTMLButtonElement>("[data-say]")];
  const knowledge = [...root.querySelectorAll<HTMLElement>("[data-knowledge]")];
  const leadCells = [...lead.querySelectorAll<HTMLElement>("dd")];
  let busy = false;

  const bubble = (text: string, kind: string) => {
    const item = document.createElement("li");
    item.className = `wa__msg wa__msg--${kind} is-new`;
    item.textContent = text;
    thread.append(item);
    thread.scrollTop = thread.scrollHeight;
    return item;
  };

  const clear = () => {
    thread.replaceChildren();
    lead.classList.add("is-empty");
    knowledge.forEach((item) => item.classList.remove("is-used"));
    status.textContent = status.dataset.assistant!;
    status.classList.remove("is-person");
    chips.forEach((chip) => (chip.disabled = false));
    reset.hidden = true;
  };

  const say = async (script: Script, chip: HTMLButtonElement) => {
    if (busy) return;
    busy = true;
    chip.disabled = true;
    reset.hidden = false;
    const quick = prefersReducedMotion();
    bubble(script.customer, "in");
    knowledge.forEach((item) => item.classList.remove("is-used"));
    if (!quick) {
      await sleep(450);
      // The assistant looks things up before it answers, so the knowledge it used lights first.
      knowledge.forEach((item) => item.classList.toggle("is-used", script.uses.includes(item.dataset.knowledge!)));
      await sleep(650);
    } else {
      knowledge.forEach((item) => item.classList.toggle("is-used", script.uses.includes(item.dataset.knowledge!)));
    }
    bubble(script.reply, "out");
    if (script.lead) {
      const values = [script.lead.need, script.lead.date, script.lead.stage, script.lead.followUp];
      leadCells.forEach((cell, i) => ((cell.querySelector(".tag") ?? cell).textContent = values[i]));
      lead.classList.remove("is-empty");
    }
    if (script.handover) {
      status.textContent = status.dataset.person!;
      status.classList.add("is-person");
      chips.forEach((button) => (button.disabled = true));
    }
    busy = false;
  };

  clear();
  chips.forEach((chip) => chip.addEventListener("click", () => say(scripts.find((s) => s.id === chip.dataset.say)!, chip)));
  reset.addEventListener("click", clear);
}
