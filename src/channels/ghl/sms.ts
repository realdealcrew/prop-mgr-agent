// GHL v2 API client for SMS
// Reference: https://highlevel.stoplight.io/docs/integrations/
// Auth: location-level API key from GHL sub-account → Settings → API Keys

import type { GHLContact, GHLSendMessageResponse } from "./types";

const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-04-15";

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    "Content-Type": "application/json",
    Version: GHL_VERSION,
  };
}

export async function sendSms(
  contactId: string,
  message: string
): Promise<GHLSendMessageResponse> {
  const res = await fetch(`${GHL_BASE}/conversations/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ type: "SMS", contactId, message }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL sendSms failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<GHLSendMessageResponse>;
}

// Looks up a GHL contact by phone number; creates one if not found.
// Used for the maintenance person, who may not already exist as a GHL contact.
export async function findOrCreateContact(
  phone: string,
  name: string
): Promise<GHLContact> {
  const locationId = process.env.GHL_LOCATION_ID!;

  // GHL duplicate-search endpoint: returns an existing contact by phone/email
  const searchRes = await fetch(
    `${GHL_BASE}/contacts/search/duplicate?locationId=${locationId}&phone=${encodeURIComponent(phone)}`,
    { headers: headers() }
  );

  if (searchRes.ok) {
    const data = (await searchRes.json()) as { contact?: GHLContact };
    if (data.contact) return data.contact;
  }

  const createRes = await fetch(`${GHL_BASE}/contacts/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ locationId, phone, name, tags: ["maintenance"] }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`GHL findOrCreateContact failed (${createRes.status}): ${text}`);
  }

  const created = (await createRes.json()) as { contact: GHLContact };
  return created.contact;
}
