import { draftAddress } from "@/lib/assistant/draft-input";
import { getDraftCard } from "@/lib/assistant/drafts";
import { ChatError } from "@/lib/assistant/types";

export async function GET(
  request: Request,
  context: RouteContext<"/api/chat/drafts/[draftId]">,
) {
  const { draftId } = await context.params;
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  const headers = { "Cache-Control": "private, no-store" };
  if (!draftAddress.safeParse({ sessionId, draftId }).success)
    return Response.json({ error: "草稿地址无效。" }, { status: 400, headers });
  try {
    return Response.json(await getDraftCard(String(sessionId), draftId), {
      headers,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof ChatError ? error.message : "草稿暂不可用。" },
      { status: error instanceof ChatError ? error.status : 503, headers },
    );
  }
}
