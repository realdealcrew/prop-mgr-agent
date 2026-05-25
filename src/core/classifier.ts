import OpenAI from "openai";
import type { Classification } from "./types";

const MODEL = "anthropic/claude-sonnet-4-6"; // confirm slug in OpenRouter dashboard

// Lazy client — instantiated on first call so missing env vars surface at
// runtime (with a clear error) rather than crashing the Next.js build.
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY environment variable is not set");
    }
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: { "X-Title": "prop-mgr" },
    });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are a maintenance request classifier for a residential apartment building. Analyze tenant text messages and return structured JSON.

Return ONLY a valid JSON object with these exact fields:
- isMaintenanceRequest: boolean
- unitNumber: string | null — only if explicitly stated by the tenant, otherwise null. Do not infer.
- issueCategory: one of "plumbing" | "electrical" | "hvac" | "appliance" | "structural" | "pest" | "lockout" | "other" | "not_maintenance"
- urgency: one of "emergency" | "high" | "normal"
- summary: string — one factual sentence for the maintenance worker (e.g. "Toilet overflowing in unit 4, water on bathroom floor")

URGENCY RULES — apply the highest matching level, in order:

EMERGENCY — immediately life-threatening or catastrophic property damage. Classify as emergency if the message contains ANY of: flood, flooding, gas leak, gas smell, no heat, no hot water, smoke, fire, carbon monoxide, CO detector, CO alarm, sparks, electrical fire, sewage backup, burst pipe, broken pipe, water everywhere, water pouring, overflowing toilet, overflowing sink. Emergency classification overrides all other context.

HIGH — significant disruption but not immediately dangerous: broken lock or deadbolt, no AC (relevant in warm months), refrigerator not cooling, no electricity in unit, broken window, active roof leak, oven not working, dryer not working, no running water.

NORMAL — everything else: slow drain, dripping faucet, minor appliance issue, cosmetic damage, single pest sighting, light out, squeaky door, small crack, worn caulk.

EDGE CASES:
- No unit number mentioned → set unitNumber to null
- Ambiguous message that could plausibly be maintenance → classify as maintenance with best-guess category
- Clearly not maintenance (rent question, noise complaint unrelated to property, general chat) → isMaintenanceRequest: false, issueCategory: "not_maintenance"
- Unit mentioned as "apt 4", "unit 4B", "#4", "apartment 4" → extract just the identifier (e.g. "4", "4B")

Return ONLY the JSON object. No markdown, no explanation.`;

export async function classifyMessage(message: string): Promise<Classification> {
  const response = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: message },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "";

  if (!raw) {
    throw new Error("Empty response from OpenRouter");
  }

  let parsed: unknown;
  try {
    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Model returned non-JSON: ${raw}`);
  }

  const r = parsed as Record<string, unknown>;

  if (
    typeof r.isMaintenanceRequest !== "boolean" ||
    typeof r.urgency !== "string" ||
    typeof r.summary !== "string" ||
    typeof r.issueCategory !== "string"
  ) {
    throw new Error(`Malformed classification from model: ${raw}`);
  }

  return {
    isMaintenanceRequest: r.isMaintenanceRequest,
    unitNumber: typeof r.unitNumber === "string" ? r.unitNumber : null,
    issueCategory: r.issueCategory as Classification["issueCategory"],
    urgency: r.urgency as Classification["urgency"],
    summary: r.summary,
    rawMessage: message,
  };
}
