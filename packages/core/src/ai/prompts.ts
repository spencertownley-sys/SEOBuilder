// Prompt-set suggestions (PRD P0: "AI suggests 20 to 50 prompts from the site's services,
// location and competitors", grouped by intent). This is the deterministic template version;
// an LLM pass can rephrase and extend it later without changing the output shape.

export type Intent = "discovery" | "comparison" | "how-to" | "pricing" | "brand";

export interface TrackedPrompt {
  text: string;
  intent: Intent;
  location?: string;
}

export interface BrandProfile {
  name: string;
  domain: string;
  /** Other names people use for the brand. */
  aliases?: string[];
  businessType: string; // e.g. "wedding photographer"
  services: string[]; // e.g. ["engagement photos", "elopement photography"]
  locations: string[]; // e.g. ["Tacoma", "Seattle"]
  competitors: { name: string; domain?: string; aliases?: string[] }[];
}

export function suggestPrompts(p: BrandProfile, max = 50): TrackedPrompt[] {
  const out: TrackedPrompt[] = [];
  const add = (text: string, intent: Intent, location?: string) => {
    if (!out.some((x) => x.text.toLowerCase() === text.toLowerCase())) out.push({ text, intent, location });
  };
  const locs = p.locations.length ? p.locations : [undefined];
  const bt = p.businessType;
  const article = /^[aeiou]/i.test(bt) ? "an" : "a";

  for (const loc of locs) {
    const where = loc ? ` in ${loc}` : "";
    // The business type names a provider ("wedding photographer"); services name a thing bought ("headshots").
    add(`best ${bt}${where}`, "discovery", loc);
    add(`how do I find a good ${bt}${where}?`, "discovery", loc);
    add(`how much does ${article} ${bt} cost${where}?`, "pricing", loc);
    add(`top rated ${bt} near ${loc ?? "me"}`, "discovery", loc);
    add(`affordable ${bt}${where}`, "pricing", loc);
    for (const s of p.services) {
      add(`best place for ${s}${where}`, "discovery", loc);
      add(`who should I hire for ${s}${where}?`, "discovery", loc);
      add(`what are typical prices for ${s}${where}?`, "pricing", loc);
    }
  }
  for (const s of p.services) {
    add(`how do I choose ${article} ${bt} for ${s}?`, "how-to");
    add(`what should I ask before booking ${s}?`, "how-to");
  }
  for (const c of p.competitors) {
    add(`${p.name} vs ${c.name}`, "comparison");
    add(`alternatives to ${c.name}`, "comparison", p.locations[0]);
  }
  add(`is ${p.name} legit?`, "brand");
  add(`${p.name} reviews`, "brand");
  add(`what does ${p.name} offer and how much does it cost?`, "brand");

  // Interleave intents so a truncated list still covers every group.
  const byIntent = new Map<Intent, TrackedPrompt[]>();
  for (const x of out) byIntent.set(x.intent, [...(byIntent.get(x.intent) ?? []), x]);
  const mixed: TrackedPrompt[] = [];
  while (mixed.length < Math.min(max, out.length)) {
    for (const list of byIntent.values()) {
      const next = list.shift();
      if (next && mixed.length < max) mixed.push(next);
    }
  }
  return mixed;
}
