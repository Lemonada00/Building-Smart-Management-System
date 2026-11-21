"use server";
import { revalidatePath } from "next/cache";
import { getLoginContext } from "@/lib/auth/context";
import { callWorkOrderRpc } from "@/lib/work-orders/mutations";
import type { Assignee, Command, CommandResult } from "@/lib/work-orders/types";
import {
  photoLimit,
  photoTypes,
  validateCommand,
} from "@/lib/work-orders/validation";

async function identityError() {
  const ctx = await getLoginContext();
  if (!ctx?.activeIdentity)
    return {
      ok: false as const,
      error: {
        code: ctx ? "IDENTITY_REQUIRED" : "UNAUTHENTICATED",
        message: "登录或当前身份失效，请重新登录。",
      },
    };
  return null;
}
export async function submitWorkOrderCommand(
  input: Command,
): Promise<CommandResult> {
  const auth = await identityError();
  if (auth) return auth;
  const message = validateCommand(input);
  if (message)
    return { ok: false, error: { code: "VALIDATION_FAILED", message } };
  const result: CommandResult = await callWorkOrderRpc("process_work_order", {
    p_number: input.number,
    p_expected_version: input.expectedVersion,
    p_action: input.action,
    p_payload: input.payload,
  });
  if (result.ok && !result.unchanged) {
    revalidatePath("/admin/work-orders");
    revalidatePath("/dashboard");
  }
  return result;
}
export async function getWorkOrderAssignees(
  number: number,
): Promise<
  | { ok: true; data: Assignee[] }
  | { ok: false; error: { code: string; message: string } }
> {
  const auth = await identityError();
  if (auth) return auth;
  return callWorkOrderRpc("list_work_order_assignees", { p_number: number });
}
export async function prepareWorkOrderPhoto(input: {
  number: number;
  name: string;
  mimeType: string;
  size: number;
}): Promise<
  | { ok: true; photoId: string; path: string; bucket: string }
  | { ok: false; error: { code: string; message: string } }
> {
  const auth = await identityError();
  if (auth) return auth;
  if (
    !photoTypes.includes(input.mimeType) ||
    !Number.isInteger(input.size) ||
    input.size < 1 ||
    input.size > photoLimit ||
    !input.name.trim()
  )
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "仅支持 JPEG/PNG/WebP，每张不超过 10 MiB。",
      },
    };
  return callWorkOrderRpc("prepare_work_order_photo", {
    p_number: input.number,
    p_name: input.name,
    p_mime: input.mimeType,
    p_size: input.size,
  });
}
export async function discardWorkOrderPhotos(
  number: number,
  photoIds: string[],
) {
  const auth = await identityError();
  if (auth) return auth;
  return callWorkOrderRpc("discard_work_order_photos", {
    p_number: number,
    p_ids: photoIds,
  });
}
