// GHL InboundMessage webhook payload
// Source: https://marketplace.gohighlevel.com/docs/webhook/InboundMessage
// Fires whenever a contact sends a message across SMS, Email, Call, etc.

export interface GHLInboundWebhookPayload {
  type: string;            // "InboundMessage"
  locationId: string;
  contactId: string;
  conversationId: string;
  messageId: string;
  body: string;
  direction: "inbound" | "outbound";
  messageType: "SMS" | "Email" | "CALL" | "Voicemail" | "GMB" | "FB";
  dateAdded: string;       // ISO 8601
  status?: string;         // "delivered", "completed", "voicemail"
  attachments?: string[];
  // SMS-specific
  from?: string;           // sender phone number (E.164)
  to?: string;             // receiving phone number
  contentType?: string;
  // Email-specific
  emailMessageId?: string;
  threadId?: string;
  subject?: string;
  // NOTE: contact name fields (firstName, lastName) are NOT included in the webhook
  // payload. To get the tenant's name, make a separate GET /contacts/{id} API call.
}

export interface GHLSendMessageResponse {
  conversationId: string;
  id: string;
  messageType: string;
  msg: string;
  status: string;
}

export interface GHLContact {
  id: string;
  locationId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  email?: string;
  tags?: string[];
}
