// Chat client for the assistant app. It talks to the endpoint set in content.ts.
// Request:  POST { messages: [{ role: "user" | "assistant", content }] }
// Reply:    text/event-stream of `data: {"text": "..."}` lines ending with `data: [DONE]`, or JSON { reply }.
const root = document.querySelector<HTMLElement>("[data-ask]");

if (root) {
  const endpoint = root.dataset.endpoint!;
  const thread = root.querySelector<HTMLElement>("[data-thread]")!;
  const form = root.querySelector<HTMLFormElement>("[data-form]")!;
  const input = form.querySelector<HTMLInputElement>("input")!;
  const button = form.querySelector<HTMLButtonElement>("button")!;
  const messages: { role: "user" | "assistant"; content: string }[] = [];

  const bubble = (role: string, text: string) => {
    const item = document.createElement("li");
    item.dataset.role = role;
    item.textContent = text;
    thread.append(item);
    thread.scrollTop = thread.scrollHeight;
    return item;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question || button.disabled) return;
    input.value = "";
    button.disabled = true;
    messages.push({ role: "user", content: question });
    bubble("user", question);
    const reply = bubble("assistant", "");
    let text = "";
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages }) });
      if (!response.ok) throw new Error(String(response.status));
      if ((response.headers.get("content-type") ?? "").includes("text/event-stream") && response.body) {
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let pending = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += value;
          const lines = pending.split("\n");
          pending = lines.pop()!;
          for (const line of lines) {
            const payload = line.startsWith("data:") ? line.slice(5).trim() : "";
            if (!payload || payload === "[DONE]") continue;
            text += (JSON.parse(payload) as { text?: string }).text ?? "";
            reply.textContent = text;
            thread.scrollTop = thread.scrollHeight;
          }
        }
      } else {
        text = ((await response.json()) as { reply?: string }).reply ?? "";
        reply.textContent = text;
      }
      if (!text) throw new Error("empty");
      messages.push({ role: "assistant", content: text });
    } catch {
      messages.pop();
      reply.dataset.role = "error";
      reply.textContent = root.dataset.error!;
    }
    button.disabled = false;
    input.focus();
  });
}
