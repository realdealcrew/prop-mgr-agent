// Quick connectivity check — not part of the app, run once to verify credentials.
// Usage: npx tsx --env-file=.env.local scripts/check-supabase.ts

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function check(table: string) {
  const { error } = await supabase.from(table).select("id").limit(1);
  if (error) {
    console.error(`  ✗ ${table}: ${error.message}`);
    return false;
  }
  console.log(`  ✓ ${table}`);
  return true;
}

async function main() {
  console.log(`\nConnecting to: ${url}\n`);

  const results = await Promise.all([
    check("properties"),
    check("contacts"),
    check("maintenance_tickets"),
  ]);

  if (results.every(Boolean)) {
    console.log("\nAll tables reachable. Credentials are good.\n");
  } else {
    console.log("\nSome checks failed — verify your credentials and that the migration ran.\n");
    process.exit(1);
  }
}

main();
