import { cloudinaryConfig, destroyAsset } from "@/lib/server/cloudinary";
import { deleteFileForGood } from "@/lib/server/delete-file";
import { adminDb } from "@/lib/server/firebase-admin";
import { errorResponse } from "@/lib/server/request-error";
import { verifyRequest } from "@/lib/server/verify-request";

/**
 * Delete for good (R13; plan §2.9, Task 6.3): destroys the file's Cloudinary
 * asset, then its `weddingFiles` document. Only the id comes from the client.
 * Answers 200 with a `DeleteResult`, also when the file was already gone.
 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/files/[fileId]">) {
  try {
    const caller = await verifyRequest(request);
    const { fileId } = await ctx.params;
    const config = cloudinaryConfig();
    const result = await deleteFileForGood(adminDb(), fileId, caller, {
      cloudName: config.cloudName,
      destroy: (asset) => destroyAsset(config, asset),
    });
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
