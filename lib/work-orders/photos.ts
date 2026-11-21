import "server-only";
import { createClient } from "@/lib/supabase/server";
export async function readWorkOrderPhoto(number: number, id: string) {
  const client = await createClient();
  const { data: order, error: orderError } = await client
    .from("work_orders")
    .select("id")
    .eq("number", number)
    .maybeSingle();
  if (orderError) throw new Error("存储读取失败");
  if (!order) return { status: 403 as const };
  const { data: photo, error } = await client
    .from("work_order_photos")
    .select("object_path,mime_type")
    .eq("id", id)
    .eq("work_order_id", order.id)
    .eq("state", "attached")
    .maybeSingle();
  if (error) throw new Error("图片信息读取失败");
  if (!photo) return { status: 404 as const };
  const { data, error: downloadError } = await client.storage
    .from("work-order-photos")
    .download(
      photo.object_path,
      { cacheNonce: crypto.randomUUID() },
      { cache: "no-store" },
    );
  if (downloadError || !data) throw new Error("图片下载失败");
  return { status: 200 as const, data, mimeType: photo.mime_type };
}
