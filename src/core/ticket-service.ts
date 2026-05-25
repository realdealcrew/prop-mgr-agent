import { classifyMessage } from "./classifier";
import type { InboundMessage } from "./types";
import { URGENCY_RESPONSE_TIMES, URGENCY_LABELS } from "./types";
import * as db from "../integrations/supabase/client";
import { sendSms, findOrCreateContact } from "../channels/ghl/sms";

export async function handleNewMaintenanceRequest(
  message: InboundMessage
): Promise<{ ticketId: string; isMaintenanceRequest: boolean }> {
  const classification = await classifyMessage(message.body);

  // Always create a ticket — even for non-maintenance messages — so there's a full audit trail.
  const ticket = await db.createTicket({
    tenantName: message.senderName,
    tenantPhone: message.phone,
    tenantContactId: message.contactId,
    tenantConversationId: message.conversationId,
    unitNumber: classification.unitNumber,
    issueCategory: classification.issueCategory,
    urgency: classification.urgency,
    summary: classification.summary,
    rawMessage: message.body,
  });

  const ticketId = ticket.id;

  if (!classification.isMaintenanceRequest) {
    const firstName = message.senderName?.split(" ")[0] ?? "Hi";
    await sendSms(
      message.contactId,
      `Hi ${firstName}! This number is for maintenance requests only. ` +
        `For billing or other questions, please contact the office directly. We've logged your message.`
    );
    return { ticketId, isMaintenanceRequest: false };
  }

  // Confirm receipt to tenant
  await sendSms(message.contactId, buildTenantConfirmation(message.senderName, classification));

  // Look up the right contractor by trade, falling back to "general"
  const contractor = await db.findContractorByTrade(classification.issueCategory);

  if (!contractor) {
    console.warn("[ticket-service] No active contractor found for trade:", classification.issueCategory);
    return { ticketId, isMaintenanceRequest: true };
  }

  // Find or create the contractor as a GHL contact so we can SMS them
  const ghlContact = await findOrCreateContact(contractor.phone, contractor.name ?? "Contractor");

  const notificationText = buildMaintenanceNotification(
    classification.urgency,
    classification.summary,
    classification.unitNumber,
    message.senderName,
    message.phone,
    ticketId
  );

  const sendResult = await sendSms(ghlContact.id, notificationText);

  // Store the GHL conversation ID so we can match their "done" reply to this ticket
  if (sendResult.conversationId) {
    await db.setMaintenanceConversationId(ticketId, sendResult.conversationId);
  }

  return { ticketId, isMaintenanceRequest: true };
}

export async function handleMaintenanceDone(
  conversationId: string
): Promise<{ resolved: boolean; ticketId?: string }> {
  const ticket = await db.findOpenTicketByMaintenanceConversation(conversationId);

  if (!ticket) {
    return { resolved: false };
  }

  await db.resolveTicket(ticket.id);

  const tenantContactId = ticket.tenant_contact_id;
  const tenantName = ticket.tenant_name;
  const firstName = tenantName?.split(" ")[0] ?? "there";

  if (tenantContactId) {
    await sendSms(
      tenantContactId,
      `Hi ${firstName}! Your maintenance request has been completed. ` +
        `Please let us know if anything else comes up!`
    );
  }

  return { resolved: true, ticketId: ticket.id };
}

function buildTenantConfirmation(
  senderName: string | null,
  classification: { summary: string; urgency: string }
): string {
  const firstName = senderName?.split(" ")[0] ?? "Hi";
  const timeline =
    classification.urgency === "emergency"
      ? "This is marked EMERGENCY — we are responding immediately."
      : `We'll have someone on it ${URGENCY_RESPONSE_TIMES[classification.urgency as keyof typeof URGENCY_RESPONSE_TIMES]}.`;

  return (
    `Hi ${firstName}! We received your maintenance request: "${classification.summary}". ` +
    `${timeline} We'll follow up when it's resolved.`
  );
}

function buildMaintenanceNotification(
  urgency: string,
  summary: string,
  unitNumber: string | null,
  tenantName: string | null,
  tenantPhone: string,
  ticketId: string
): string {
  const label = URGENCY_LABELS[urgency as keyof typeof URGENCY_LABELS] ?? urgency;
  const unit = unitNumber ? `Unit ${unitNumber}` : "Unit unknown";
  const tenant = tenantName ?? tenantPhone;

  return (
    `[${label}] New maintenance request\n` +
    `${unit} — ${tenant}\n` +
    `Issue: ${summary}\n` +
    `Ticket #${ticketId}\n\n` +
    `Reply "done" when complete.`
  );
}
