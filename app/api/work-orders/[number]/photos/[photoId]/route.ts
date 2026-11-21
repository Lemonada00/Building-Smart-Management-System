import { getLoginContext } from "@/lib/auth/context";
import { readWorkOrderPhoto } from "@/lib/work-orders/photos";
import { parseNumber } from "@/lib/work-orders/types";

const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ number: string; photoId: string }> },
) {
  try {
    const context = await getLoginContext();
    if (!context) return new Response(null, { status: 401, headers });
    if (!context.activeIdentity)
      return new Response(null, { status: 403, headers });
    const p = await params;
    const number = parseNumber(p.number);
    if (
      number === null ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        p.photoId,
      )
    )
      return new Response(null, { status: 404, headers });
    const result = await readWorkOrderPhoto(number, p.photoId);
    if (result.status !== 200)
      return new Response(null, { status: result.status, headers });
    return new Response(result.data, {
      headers: { ...headers, "Content-Type": result.mimeType },
    });
  } catch {
    return new Response(null, { status: 502, headers });
  }
}
