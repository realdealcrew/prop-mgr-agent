-- Adds contractor routing support to the contacts table.
--
-- trade: maps to issue_category values from maintenance_tickets.
--   "general" is the catch-all for any category without a dedicated contractor.
--   Valid values: general | plumbing | electrical | hvac | appliance |
--                 structural | pest | lockout
--
-- is_active: lets you disable a contractor without deleting their record
--   (e.g. they're unavailable, replaced, or seasonal).

alter table contacts
  add column if not exists trade text,
  add column if not exists is_active boolean not null default true;

-- Partial index: contractor lookups only scan active rows.
create index if not exists contacts_trade_active_idx
  on contacts (trade)
  where is_active = true;
