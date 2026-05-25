// ─── Trigger.dev stub ────────────────────────────────────────────────────────
//
// When your Trigger.dev account is ready, replace this file with:
//
//   import { task } from "@trigger.dev/sdk/v3";
//
//   export const maintenanceRequestTask = task({
//     id: "process-maintenance-request",
//     retry: { maxAttempts: 3, minTimeoutInMs: 1000, factor: 2 },
//     run: async (payload: MaintenanceJobPayload) => {
//       return handleNewMaintenanceRequest(payload.message);
//     },
//   });
//
//   export const resolutionTask = task({
//     id: "resolve-maintenance-request",
//     retry: { maxAttempts: 3 },
//     run: async (payload: ResolutionJobPayload) => {
//       return handleMaintenanceDone(payload.conversationId);
//     },
//   });
//
// In the webhook route, replace direct function calls with:
//   await maintenanceRequestTask.trigger(payload)
//   await resolutionTask.trigger(payload)
//
// Trigger.dev gives you: automatic retries, full run history, alerting,
// and the ability to inspect every payload that came through.
// ─────────────────────────────────────────────────────────────────────────────

import {
  handleNewMaintenanceRequest,
  handleMaintenanceDone,
} from "../core/ticket-service";
import type { InboundMessage } from "../core/types";

export interface MaintenanceJobPayload {
  message: InboundMessage;
}

export interface ResolutionJobPayload {
  conversationId: string;
}

export async function runMaintenanceRequestJob(
  payload: MaintenanceJobPayload
): Promise<void> {
  console.log("[job] process-maintenance-request started", {
    conversationId: payload.message.conversationId,
    phone: payload.message.phone,
  });

  const result = await handleNewMaintenanceRequest(payload.message);

  console.log("[job] process-maintenance-request completed", result);
}

export async function runResolutionJob(
  payload: ResolutionJobPayload
): Promise<void> {
  console.log("[job] resolve-maintenance-request started", {
    conversationId: payload.conversationId,
  });

  const result = await handleMaintenanceDone(payload.conversationId);

  if (!result.resolved) {
    console.warn("[job] resolve-maintenance-request: no open ticket found", {
      conversationId: payload.conversationId,
    });
  } else {
    console.log("[job] resolve-maintenance-request completed", result);
  }
}
