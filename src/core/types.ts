export type UrgencyLevel = "emergency" | "high" | "normal";

export type IssueCategory =
  | "plumbing"
  | "electrical"
  | "hvac"
  | "appliance"
  | "structural"
  | "pest"
  | "lockout"
  | "other"
  | "not_maintenance";

export interface Classification {
  isMaintenanceRequest: boolean;
  unitNumber: string | null;
  issueCategory: IssueCategory;
  urgency: UrgencyLevel;
  summary: string;
  rawMessage: string;
}

// Normalized representation of any inbound message, regardless of source channel
export interface InboundMessage {
  contactId: string;       // Source-channel contact identifier
  conversationId: string;  // Source-channel conversation/thread identifier
  phone: string;           // Sender phone in E.164 or local format
  body: string;            // Raw message text
  senderName: string | null;
  timestamp: string;       // ISO 8601
  source: string;          // e.g. "ghl", "email", "web"
  sourceMetadata: Record<string, unknown>; // Channel-specific passthrough
}

export interface MaintenanceTicket {
  id?: string;
  tenantPhone: string;
  tenantName: string | null;
  tenantContactId: string;
  tenantConversationId: string;
  maintenanceConversationId?: string;
  unitNumber: string | null;
  issueCategory: IssueCategory;
  urgency: UrgencyLevel;
  summary: string;
  rawMessage: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  resolvedAt?: string;
}

export const URGENCY_RESPONSE_TIMES: Record<UrgencyLevel, string> = {
  emergency: "within 1 hour",
  high: "within 24 hours",
  normal: "within 3–5 business days",
};

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  emergency: "EMERGENCY",
  high: "Urgent",
  normal: "Routine",
};
