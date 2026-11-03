// Optional AI explanation layer — GROUNDED AND POWERLESS BY DESIGN.
//
// Every issue already has a deterministic explanation built from validated
// data. This route may only REPHRASE that text when a Groq key is present:
// - the model receives the validated text and nothing else,
// - it is instructed not to add facts, names, dates, or numbers,
// - it can never mark a roster valid/invalid or change any decision,
// - on ANY failure (no key, timeout, API error) the deterministic text is
//   returned unchanged with mode "template".
// The application is fully functional without this route.

export async function POST(req: Request) {
  let text = "";
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text : "";
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!text) return Response.json({ error: "Missing text" }, { status: 400 });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ text, mode: "template" });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Rephrase the given roster-issue explanation in one or two short, clear sentences for an operations manager. Do not add any fact, name, date, number, or recommendation that is not already in the text. Do not say whether the roster is valid. Output only the rephrased text.",
          },
          { role: "user", content: text },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return Response.json({ text, mode: "template" });
    const data = await res.json();
    const rephrased = data?.choices?.[0]?.message?.content?.trim();
    if (!rephrased) return Response.json({ text, mode: "template" });
    return Response.json({ text: rephrased, mode: "ai" });
  } catch {
    return Response.json({ text, mode: "template" });
  }
}
