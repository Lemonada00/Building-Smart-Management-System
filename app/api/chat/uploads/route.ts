import { z } from "zod";
import { ChatError } from "@/lib/assistant/types";
import { uploadChatFile } from "@/lib/assistant/uploads";
import { assertSameOrigin } from "@/lib/assistant/validation";

// 使用 App Router 默认 Node.js；与项目 cacheComponents 配置兼容。
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const form = await request.formData();
    const id = z.uuid().safeParse(form.get("sessionId"));
    const file = form.get("image");
    if (!id.success || !(file instanceof File))
      throw new ChatError(400, "请选择有效图片。");
    return Response.json(
      { files: [await uploadChatFile(id.data, file)] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof ChatError
            ? error.message
            : "图片上传失败，请稍后重试。",
      },
      {
        status: error instanceof ChatError ? error.status : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
