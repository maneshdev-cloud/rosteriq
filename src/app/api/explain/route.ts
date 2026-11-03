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

// Consistent error shape for this API: { error: { code, message } }.
// Success/fallback shape is { text, mode } — mode "template" means the
// deterministic explanation was returned unchanged (no AI involved).
const MAX_TEXT_CHARS = 4000; // one issue explanation, generously bounded

function apiError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(req: Request) {
  let text = "";
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text : "";
  } catch {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  if (!text) return apiError(400, "MISSING_TEXT", "Field 'text' is required.");
  if (text.length > MAX_TEXT_CHARS) {
    return apiError(413, "TEXT_TOO_LARGE", `Field 'text' must be at most ${MAX_TEXT_CHARS} characters.`);
  }

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
