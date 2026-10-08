// AI answer runner adapters (PRD: "AI answer tracking"). Each engine answers a prompt the way
// a consumer assistant would — with web search on, so answers carry citations — and returns
// the answer text plus cited URLs. Official APIs only; API answers can differ from what people
// see in the consumer apps, and the UI says so.

import Anthropic from "@anthropic-ai/sdk";

export type EngineId = "claude" | "chatgpt" | "gemini" | "perplexity";

export interface EngineAnswer {
  engine: EngineId;
  model: string;
  text: string;
  citedUrls: string[];
  runAt: string;
  error?: string;
}

export interface Engine {
  id: EngineId;
  model: string;
  available(): boolean;
  ask(prompt: string, opts?: { location?: string }): Promise<EngineAnswer>;
}

const SYSTEM =
  "You are a helpful assistant answering a member of the public. Search the web when it helps, recommend specific businesses or sources by name where appropriate, and cite your sources.";

function uniq(urls: string[]): string[] {
  return [...new Set(urls.filter(Boolean))];
}

function fail(engine: EngineId, model: string, e: unknown): EngineAnswer {
  return { engine, model, text: "", citedUrls: [], runAt: new Date().toISOString(), error: e instanceof Error ? e.message : String(e) };
}

// ---------- Claude (Anthropic SDK) ----------

export function claudeEngine(model = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5"): Engine {
  return {
    id: "claude",
    model,
    available: () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    async ask(prompt, opts) {
      try {
        const client = new Anthropic();
        const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: "user", content: prompt }];
        let text = "";
        const cited: string[] = [];
        let servedBy = model;
        // Server tools can pause a long turn; resume it a few times by re-sending the content so far.
        for (let i = 0; i < 4; i++) {
          const res = await client.beta.messages.create({
            model,
            max_tokens: 16000,
            system: SYSTEM,
            output_config: { effort: "medium" },
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            tools: [
              {
                type: "web_search_20260209",
                name: "web_search",
                max_uses: 5,
                ...(opts?.location ? { user_location: { type: "approximate" as const, city: opts.location } } : {}),
              },
            ],
            messages,
          });
          servedBy = res.model;
          if (res.stop_reason === "refusal") return fail("claude", model, new Error("Model declined to answer (refusal)"));
          for (const block of res.content) {
            if (block.type === "text") {
              text += block.text;
              for (const c of block.citations ?? []) if ("url" in c && typeof c.url === "string") cited.push(c.url);
            }
          }
          if (res.stop_reason !== "pause_turn") break;
          messages.push({ role: "assistant", content: res.content });
        }
        return { engine: "claude", model: servedBy, text, citedUrls: uniq(cited), runAt: new Date().toISOString() };
      } catch (e) {
        return fail("claude", model, e);
      }
    },
  };
}

// ---------- ChatGPT (OpenAI Responses API, raw HTTP) ----------

export function chatgptEngine(model = process.env.OPENAI_MODEL ?? "gpt-5"): Engine {
  return {
    id: "chatgpt",
    model,
    available: () => Boolean(process.env.OPENAI_API_KEY),
    async ask(prompt, opts) {
      try {
        const res = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          body: JSON.stringify({
            model,
            instructions: SYSTEM,
            input: prompt,
            tools: [{ type: "web_search", ...(opts?.location ? { user_location: { type: "approximate", city: opts.location } } : {}) }],
          }),
          signal: AbortSignal.timeout(180000),
        });
        if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const j = (await res.json()) as any;
        let text = "";
        const cited: string[] = [];
        for (const item of j.output ?? []) {
          if (item.type !== "message") continue;
          for (const c of item.content ?? []) {
            if (c.type === "output_text") {
              text += c.text;
              for (const a of c.annotations ?? []) if (a.type === "url_citation" && a.url) cited.push(a.url);
            }
          }
        }
        return { engine: "chatgpt", model: j.model ?? model, text, citedUrls: uniq(cited), runAt: new Date().toISOString() };
      } catch (e) {
        return fail("chatgpt", model, e);
      }
    },
  };
}

// ---------- Gemini (Google AI generateContent with Search grounding, raw HTTP) ----------

export function geminiEngine(model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"): Engine {
  return {
    id: "gemini",
    model,
    available: () => Boolean(process.env.GEMINI_API_KEY),
    async ask(prompt) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
          }),
          signal: AbortSignal.timeout(180000),
        });
        if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const j = (await res.json()) as any;
        const cand = j.candidates?.[0];
        const text = (cand?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
        const cited = (cand?.groundingMetadata?.groundingChunks ?? []).map((c: any) => c.web?.uri).filter(Boolean);
        return { engine: "gemini", model, text, citedUrls: uniq(cited), runAt: new Date().toISOString() };
      } catch (e) {
        return fail("gemini", model, e);
      }
    },
  };
}

// ---------- Perplexity (chat completions, raw HTTP) ----------

export function perplexityEngine(model = process.env.PERPLEXITY_MODEL ?? "sonar"): Engine {
  return {
    id: "perplexity",
    model,
    available: () => Boolean(process.env.PERPLEXITY_API_KEY),
    async ask(prompt) {
      try {
        const res = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
          body: JSON.stringify({ model, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }] }),
          signal: AbortSignal.timeout(180000),
        });
        if (!res.ok) throw new Error(`Perplexity ${res.status}: ${(await res.text()).slice(0, 300)}`);
        const j = (await res.json()) as any;
        const text = j.choices?.[0]?.message?.content ?? "";
        const cited = [...(j.citations ?? []), ...(j.search_results ?? []).map((r: any) => r.url)];
        return { engine: "perplexity", model: j.model ?? model, text, citedUrls: uniq(cited), runAt: new Date().toISOString() };
      } catch (e) {
        return fail("perplexity", model, e);
      }
    },
  };
}

export function allEngines(): Engine[] {
  return [chatgptEngine(), claudeEngine(), geminiEngine(), perplexityEngine()];
}

export function availableEngines(ids?: EngineId[]): Engine[] {
  return allEngines().filter((e) => e.available() && (!ids || ids.includes(e.id)));
}
