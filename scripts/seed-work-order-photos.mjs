import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
export async function seedWorkOrderPhotos(client) {
  const checked = (r) => {
    if (r.error) throw Error(r.error.message);
    return r.data;
  };
  const orders = checked(
    await client
      .from("work_orders")
      .select("id,number,creator_id,version")
      .not("seed_key", "is", null),
  );
  const bytes = await readFile(
    new URL("../public/demo/site-evidence.png", import.meta.url),
  );
  for (const w of orders) {
    // 仅在首次未操作样本上补照片，重复准备不覆盖真实处理结果。
    const existing = checked(
      await client
        .from("work_order_photos")
        .select("id")
        .eq("work_order_id", w.id),
    );
    if (existing.length || w.version !== 1) continue;
    const id = randomUUID(),
      path = `${w.id}/${id}.png`;
    checked(
      await client.storage.from("work-order-photos").upload(path, bytes, {
        upsert: false,
        contentType: "image/png",
        cacheControl: "0, no-store",
      }),
    );
    checked(
      await client.from("work_order_photos").insert({
        id,
        work_order_id: w.id,
        object_path: path,
        original_name: "模拟现场示意.png",
        mime_type: "image/png",
        size_bytes: bytes.length,
        uploader_id: w.creator_id,
        upload_session_id: randomUUID(),
        state: "attached",
        position: 0,
      }),
    );
  }
  const cutoff = new Date(Date.now() - 86400000).toISOString();
  const stale = checked(
    await client
      .from("work_order_photos")
      .select("id,object_path,work_order_id")
      .or(`state.eq.removed,and(state.eq.staged,created_at.lt.${cutoff})`),
  );
  for (const p of stale) {
    // 永久失效后才清文件，避免清理与编辑关联并发。
    const retired = await client
      .from("work_order_photos")
      .update({ state: "removed", position: null })
      .eq("id", p.id)
      .neq("state", "attached")
      .select("id");
    if (retired.error || !retired.data?.length) continue;
    const removed = await client.storage
      .from("work-order-photos")
      .remove([p.object_path]);
    if (removed.error)
      console.warn("存在未清理的无引用演示照片，业务权限不受影响。");
  }
  const draftPaths = await client.rpc("assistant_stale_draft_photo_paths");
  if (!draftPaths.error && draftPaths.data.length) {
    const removed = await client.storage
      .from("work-order-photos")
      .remove(draftPaths.data);
    if (removed.error) console.warn("部分已失效草稿照片未能清理。");
  } else if (draftPaths.error && draftPaths.error.code !== "PGRST202") {
    console.warn("未能获取已失效草稿照片。");
  }
  console.log("模拟照片准备完成；已有处理和照片保持不变。");
}
