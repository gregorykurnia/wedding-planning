import { PUSH_SUBSCRIPTIONS, subscriptionId } from "@/lib/model/push";
import { TEST_PUSH } from "@/lib/model/reminders";
import { adminDb } from "@/lib/server/firebase-admin";
import { isPushEndpoint, pushConfig, webPushSender } from "@/lib/server/push";
import { RequestError, errorResponse } from "@/lib/server/request-error";
import { verifyRequest } from "@/lib/server/verify-request";
import { veilHref } from "@/veil/href";

/**
 * "Send a test reminder" (guide §4.30, §5.3; Task 6.2): sends one push to the
 * caller's own device, named by its endpoint. The device must already be
 * saved under the caller's account, so nobody can send to someone else's.
 * Answers 200 `{ result: "sent" }`; 404 `not-subscribed` when the device isn't
 * saved or its push service has forgotten it (the subscription is removed).
 */
export async function POST(request: Request) {
  try {
    const caller = await verifyRequest(request);
    const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
    if (!isPushEndpoint(body?.endpoint)) throw new RequestError(400, "bad-endpoint", "That isn't a push endpoint");
    const ref = adminDb().collection(PUSH_SUBSCRIPTIONS).doc(subscriptionId(body.endpoint));
    const snap = await ref.get();
    const data = snap.data();
    if (!data || data.uid !== caller.uid || data.endpoint !== body.endpoint) {
      throw new RequestError(404, "not-subscribed", "This device isn't set up for reminders");
    }
    const result = await webPushSender(pushConfig())(
      { endpoint: data.endpoint, keys: data.keys },
      JSON.stringify({ ...TEST_PUSH, url: veilHref("/settings") }),
    );
    if (result === "gone") {
      await ref.delete();
      throw new RequestError(404, "not-subscribed", "The push service has forgotten this device");
    }
    if (result === "failed") throw new RequestError(502, "push-failed", "The push service didn't take the test");
    return Response.json({ result });
  } catch (err) {
    return errorResponse(err);
  }
}
