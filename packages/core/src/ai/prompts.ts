// Prompt-set suggestions (PRD P0: "AI suggests 20 to 50 prompts from the site's services,
// location and competitors", grouped by intent). This is the deterministic template version;
// an LLM pass can rephrase and extend it later without changing the output shape.

export type Intent = "discovery" | "comparison" | "how-to" | "pricing" | "brand";

export interface TrackedPrompt {
  text: string;
  intent: Intent;
  location?: string;
}

/** Decides which question templates fit: people hire services, buy products, and read publishers. */
export type BusinessKind = "service" | "store" | "publisher";

export interface BrandProfile {
  name: string;
  domain: string;
  /** Other names people use for the brand. */
  aliases?: string[];
  kind?: BusinessKind; // default "service"
  businessType: string; // e.g. "wedding photographer", "coffee roaster", "cruise news site"
  services: string[]; // services, products or topics, e.g. ["engagement photos"]
  locations: string[]; // e.g. ["Tacoma", "Seattle"]
  competitors: { name: string; domain?: string; aliases?: string[] }[];
}

export function suggestPrompts(p: BrandProfile, max = 50): TrackedPrompt[] {
  const out: TrackedPrompt[] = [];
  const add = (text: string, intent: Intent, location?: string) => {
    if (!out.some((x) => x.text.toLowerCase() === text.toLowerCase())) out.push({ text, intent, location });
  };
  const kind = p.kind ?? "service";
  const locs = p.locations.length ? p.locations : [undefined];
  const bt = p.businessType;
  const article = /^[aeiou]/i.test(bt) ? "an" : "a";

  if (kind === "service") {
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
  } else if (kind === "store") {
    for (const loc of locs) {
      const where = loc ? ` in ${loc}` : "";
      add(`best ${bt}${where}`, "discovery", loc);
      for (const s of p.services) {
        add(`where to buy ${s}${where}`, "discovery", loc);
        add(`best ${s} to buy`, "discovery");
        add(`how much does ${s} cost?`, "pricing");
      }
    }
    for (const s of p.services) add(`how do I choose ${s}?`, "how-to");
  } else {
    add(`best ${bt}`, "discovery");
    add(`most reliable ${bt}`, "discovery");
    for (const s of p.services) {
      add(`best sources for ${s}`, "discovery");
      add(`where can I follow ${s}?`, "discovery");
      add(`latest ${s}`, "how-to");
      add(`how do I keep up with ${s}?`, "how-to");
    }
  }

  for (const c of p.competitors) {
    add(`${p.name} vs ${c.name}`, "comparison");
    add(`alternatives to ${c.name}`, "comparison", kind === "service" ? p.locations[0] : undefined);
    if (kind === "publisher") add(`is ${c.name} or ${p.name} better?`, "comparison");
  }
  add(kind === "publisher" ? `is ${p.name} reliable?` : `is ${p.name} legit?`, "brand");
  add(`${p.name} reviews`, "brand");
  add(kind === "publisher" ? `what does ${p.name} cover?` : `what does ${p.name} offer and how much does it cost?`, "brand");

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
