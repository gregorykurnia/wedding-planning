import { timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/server/firebase-admin";
import { pushConfig, webPushSender } from "@/lib/server/push";
import { runReminders } from "@/lib/server/reminders";
import { RequestError, errorResponse } from "@/lib/server/request-error";

/**
 * The daily reminder run (S10, N11; plan §2.9, Task 6.2). Vercel Cron calls
 * it at 00:00 UTC (`vercel.json`) with `Authorization: Bearer <CRON_SECRET>`;
 * nothing else gets in, and with no secret set it refuses everyone. Running it
 * again the same day sends nothing new. Answers with a `RunSummary`.
 */
export async function GET(request: Request) {
  try {
    checkCronSecret(request);
    const summary = await runReminders(adminDb(), webPushSender(pushConfig()));
    console.log("Reminders", JSON.stringify(summary));
    return Response.json(summary);
  } catch (err) {
    return errorResponse(err);
  }
}

function checkCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new RequestError(503, "not-configured", "CRON_SECRET is not set");
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new RequestError(401, "not-allowed", "Only the scheduled run can start reminders");
  }
}
