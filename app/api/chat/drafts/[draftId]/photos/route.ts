import { z } from "zod";
import { draftAddress } from "@/lib/assistant/draft-input";
import { readDraftPhoto, uploadDraftPhoto } from "@/lib/assistant/drafts";
import { ChatError } from "@/lib/assistant/types";
import { assertSameOrigin } from "@/lib/assistant/validation";

type Context = RouteContext<"/api/chat/drafts/[draftId]/photos">;
const headers = { "Cache-Control": "private, no-store" };
function failed(error: unknown) {
  return Response.json(
    {
      error: error instanceof ChatError ? error.message : "草稿图片暂不可用。",
    },
    { status: error instanceof ChatError ? error.status : 503, headers },
  );
}
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const { draftId } = await context.params;
    const form = await request.formData();
    const image = form.get("image");
    const address = draftAddress.safeParse({
      draftId,
      sessionId: form.get("sessionId"),
    });
    if (!address.success || !(image instanceof File))
      throw new ChatError(400, "请选择有效图片。");
    return Response.json(
      await uploadDraftPhoto(address.data.sessionId, draftId, image),
      { headers },
    );
  } catch (error) {
    return failed(error);
  }
}
export async function GET(request: Request, context: Context) {
  try {
    const { draftId } = await context.params;
    const params = new URL(request.url).searchParams;
    const address = draftAddress.extend({ photoId: z.uuid() }).safeParse({
      draftId,
      sessionId: params.get("sessionId"),
      photoId: params.get("photoId"),
    });
    if (!address.success) throw new ChatError(400, "图片地址无效。");
    const { data, mimeType } = await readDraftPhoto(
      address.data.sessionId,
      draftId,
      address.data.photoId,
    );
    return new Response(data, {
      headers: {
        ...headers,
        "Content-Type": mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failed(error);
  }
}
