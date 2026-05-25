// Supabase server-side client — used only in API routes and server components.
//
// SUPABASE_SERVICE_ROLE_KEY bypasses Row Level Security, which is correct for
// trusted server code. Never import this file in client components or expose
// the key to the browser. For the landlord dashboard, create a separate client
// using the anon key with RLS policies instead.
//
// To generate full TypeScript types from your schema later:
//   npx supabase gen types typescript --project-id <your-project-id> > src/integrations/supabase/database.types.ts

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ContactRow {
  id: string;
  property_id: string | null;
  name: string | null;
  phone: string;
  unit_number: string | null;
  type: string | null;
  trade: string | null;
  is_active: boolean;
  ghl_contact_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface TicketRow {
  id: string;
  property_id: string | null;
  tenant_name: string | null;
  tenant_phone: string;
  tenant_contact_id: string | null;
  tenant_conversation_id: string | null;
  maintenance_conversation_id: string | null;
  unit_number: string | null;
  issue_category: string;
  urgency: string;
  summary: string;
  raw_message: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
}

export async function createTicket(fields: {
  tenantName: string | null;
  tenantPhone: string;
  tenantContactId: string;
  tenantConversationId: string;
  unitNumber: string | null;
  issueCategory: string;
  urgency: string;
  summary: string;
  rawMessage: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .insert({
      tenant_name: fields.tenantName,
      tenant_phone: fields.tenantPhone,
      tenant_contact_id: fields.tenantContactId,
      tenant_conversation_id: fields.tenantConversationId,
      unit_number: fields.unitNumber,
      issue_category: fields.issueCategory,
      urgency: fields.urgency,
      summary: fields.summary,
      raw_message: fields.rawMessage,
      status: "open",
    })
    .select("id")
    .single();

  if (error) throw new Error(`createTicket failed: ${error.message}`);
  return data;
}

export async function setMaintenanceConversationId(
  ticketId: string,
  conversationId: string
): Promise<void> {
  const { error } = await supabase
    .from("maintenance_tickets")
    .update({ maintenance_conversation_id: conversationId })
    .eq("id", ticketId);

  if (error) {
    throw new Error(`setMaintenanceConversationId failed: ${error.message}`);
  }
}

// Hot path for the "done" resolution flow.
// Uses the partial index on maintenance_conversation_id where status = 'open'.
export async function findOpenTicketByMaintenanceConversation(
  conversationId: string
): Promise<TicketRow | null> {
  const { data, error } = await supabase
    .from("maintenance_tickets")
    .select("*")
    .eq("maintenance_conversation_id", conversationId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`findOpenTicket failed: ${error.message}`);
  return data as TicketRow | null;
}

// Finds the active contractor whose trade matches the given issue category.
// Falls back to a "general" contractor if no exact match exists.
// Returns null if neither is found — callers should handle this gracefully.
export async function findContractorByTrade(
  trade: string
): Promise<ContactRow | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("type", "contractor")
    .eq("is_active", true)
    .in("trade", [trade, "general"])
    .order("trade", { ascending: true }) // exact match (e.g. "plumbing") sorts before "general"
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`findContractorByTrade failed: ${error.message}`);
  return data as ContactRow | null;
}

export async function resolveTicket(ticketId: string): Promise<void> {
  const { error } = await supabase
    .from("maintenance_tickets")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", ticketId);

  if (error) throw new Error(`resolveTicket failed: ${error.message}`);
}
