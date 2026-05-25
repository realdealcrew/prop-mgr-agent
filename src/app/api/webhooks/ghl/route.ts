import { type NextRequest, NextResponse, after } from "next/server";
import { parseGHLWebhook } from "@/channels/ghl/webhook-parser";
import type { GHLInboundWebhookPayload } from "@/channels/ghl/types";
import {
  runMaintenanceRequestJob,
  runResolutionJob,
} from "@/jobs/process-maintenance-request";

const MAINTENANCE_PERSON_PHONE = process.env.MAINTENANCE_PERSON_PHONE ?? "";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";

// Normalizes a phone number to digits only for comparison,
// so "+1 (555) 123-4567" and "+15551234567" resolve to the same value.
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

// GHL can optionally send a shared secret on each webhook request.
// Configure it in GHL → Settings → Webhooks and set WEBHOOK_SECRET in .env.local.
function isValidSecret(req: NextRequest): boolean {
  if (!WEBHOOK_SECRET) return true;
  const sent =
    req.headers.get("x-ghl-signature") ?? req.headers.get("x-webhook-secret");
  return sent === WEBHOOK_SECRET;
}

// Accepts the natural ways a maintenance person might reply "done".
function isDoneMessage(body: string): boolean {
  return /^(done|all done|finished|completed|fixed|all set)[.!?✓]?$/i.test(
    body.trim()
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isValidSecret(req)) {
    console.warn("[webhook/ghl] rejected: invalid secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: GHLInboundWebhookPayload;
  try {
    payload = (await req.json()) as GHLInboundWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = parseGHLWebhook(payload);

  if (!message) {
    // Not an inbound SMS, or empty body — acknowledge so GHL doesn't retry.
    return NextResponse.json({ ok: true, skipped: true });
  }

  const isFromMaintenancePerson =
    MAINTENANCE_PERSON_PHONE !== "" &&
    digitsOnly(message.phone) === digitsOnly(MAINTENANCE_PERSON_PHONE);

  // Return 200 immediately so GHL doesn't time out waiting for us.
  // `after()` runs the job after the response is sent (Vercel / Node.js 18+).
  // When Trigger.dev is wired in, replace the `after()` block with a task.trigger() call
  // and remove `after` entirely — the job will run on Trigger.dev's infrastructure.
  after(async () => {
    try {
      if (isFromMaintenancePerson) {
        if (isDoneMessage(message.body)) {
          // TODO (Trigger.dev): await resolutionTask.trigger({ conversationId: message.conversationId })
          await runResolutionJob({ conversationId: message.conversationId });
        } else {
          // Maintenance person sent something other than "done".
          // Future: could support "status?", photo uploads, etc.
          console.log("[webhook/ghl] unhandled message from maintenance person:", {
            body: message.body,
            conversationId: message.conversationId,
          });
        }
      } else {
        // TODO (Trigger.dev): await maintenanceRequestTask.trigger({ message })
        await runMaintenanceRequestJob({ message });
      }
    } catch (err) {
      // Without Trigger.dev, failed jobs are not retried automatically.
      // TODO: wire in an alert here (Slack, email, etc.) so failures don't go unnoticed.
      console.error("[webhook/ghl] job failed", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        conversationId: message.conversationId,
        phone: message.phone,
        isFromMaintenancePerson,
      });
    }
  });

  return NextResponse.json({ ok: true });
}
