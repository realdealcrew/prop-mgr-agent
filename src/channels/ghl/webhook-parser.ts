import type { InboundMessage } from "../../core/types";
import type { GHLInboundWebhookPayload } from "./types";

export function parseGHLWebhook(
  payload: GHLInboundWebhookPayload
): InboundMessage | null {
  if (payload.type !== "InboundMessage") return null;
  if (payload.direction !== "inbound") return null;
  if (payload.messageType !== "SMS") return null; // only handle SMS for now
  if (!payload.body?.trim()) return null;

  return {
    contactId: payload.contactId,
    conversationId: payload.conversationId,
    // GHL puts the sender's phone in `from` for SMS messages
    phone: payload.from ?? "",
    body: payload.body.trim(),
    // Name is not included in the webhook payload — would require a separate
    // GET /contacts/{contactId} call. Leaving null for now; ticket-service
    // will use the phone number as fallback in notifications.
    senderName: null,
    timestamp: payload.dateAdded ?? new Date().toISOString(),
    source: "ghl",
    sourceMetadata: {
      locationId: payload.locationId,
      messageId: payload.messageId,
      messageType: payload.messageType,
    },
  };
}
