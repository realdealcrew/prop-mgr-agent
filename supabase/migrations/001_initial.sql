-- Run this in the Supabase dashboard: SQL Editor → New query → Run.
-- Supabase projects include uuid-ossp by default; gen_random_uuid() is built in.

-- One row per building / landlord account.
-- property_id is included from day one so multi-tenant SaaS is a schema-level
-- concern from the start — no migration needed when you onboard landlord #2.
create table if not exists properties (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  owner_email text,
  created_at  timestamptz default now()
);

-- Tenants and contractors, keyed by phone number.
create table if not exists contacts (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid references properties(id) on delete cascade,
  name           text,
  phone          text not null,
  unit_number    text,
  type           text check (type in ('tenant', 'contractor', 'owner')),
  ghl_contact_id text,
  notes          text,
  created_at     timestamptz default now()
);

create index if not exists contacts_phone_idx on contacts (phone);

-- One row per inbound tenant request.
create table if not exists maintenance_tickets (
  id                          uuid primary key default gen_random_uuid(),
  property_id                 uuid references properties(id) on delete cascade,
  tenant_name                 text,
  tenant_phone                text not null,
  tenant_contact_id           text,       -- GHL contactId
  tenant_conversation_id      text,       -- GHL conversationId (tenant ↔ system thread)
  maintenance_conversation_id text,       -- GHL conversationId (maintenance ↔ system thread)
  unit_number                 text,
  issue_category              text check (issue_category in (
                                'plumbing', 'electrical', 'hvac', 'appliance',
                                'structural', 'pest', 'lockout', 'other', 'not_maintenance'
                              )),
  urgency                     text check (urgency in ('emergency', 'high', 'normal')),
  summary                     text,
  raw_message                 text,
  status                      text default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at                  timestamptz default now(),
  resolved_at                 timestamptz
);

-- Partial index: the "done" lookup only scans open tickets, so it stays fast
-- even with years of resolved ticket history in the table.
create index if not exists tickets_maintenance_conv_open_idx
  on maintenance_tickets (maintenance_conversation_id)
  where status = 'open';
