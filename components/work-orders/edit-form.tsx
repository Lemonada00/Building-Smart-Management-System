"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  discardWorkOrderPhotos,
  prepareWorkOrderPhoto,
} from "@/app/actions/work-orders";
import { createClient } from "@/lib/supabase/client";
import {
  disciplineNames,
  severityNames,
  type WorkOrderDetail,
  type WorkOrderPhoto,
} from "@/lib/work-orders/types";
import { photoLimit, photoTypes } from "@/lib/work-orders/validation";

type DraftPhoto = {
  key: string;
  photo: WorkOrderPhoto;
  file?: File;
  uploaded?: string;
  message?: string;
};
export function EditForm({
  order,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  order: WorkOrderDetail;
  busy: boolean;
  error: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [photos, setPhotos] = useState<DraftPhoto[]>(() =>
    order.photos.map((photo) => ({ key: photo.id, photo, uploaded: photo.id })),
  );
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const objectUrls = useRef<string[]>([]);
  const reserved = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of objectUrls.current) URL.revokeObjectURL(url);
    },
    [],
  );
  function choose(files: FileList | null) {
    if (!files) return;
    const list = [...files];
    if (photos.length + list.length > 9) {
      setMessage("每张工单最多保留 9 张照片。");
      return;
    }
    const valid: DraftPhoto[] = [];
    let problem = "";
    for (const file of list) {
      if (
        !photoTypes.includes(file.type) ||
        file.size < 1 ||
        file.size > photoLimit
      ) {
        problem = `${file.name}：仅支持 JPEG/PNG/WebP，每张不超过 10 MiB。`;
        continue;
      }
      const key = crypto.randomUUID(),
        url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      valid.push({ key, file, photo: { id: key, name: file.name, url } });
    }
    setPhotos((current) => [...current, ...valid]);
    setMessage(problem);
  }
  async function save(form: HTMLFormElement) {
    if (busy || uploading) return;
    setUploading(true);
    setMessage("");
    const values = Object.fromEntries(new FormData(form));
    const ids: string[] = [];
    try {
      for (const item of photos) {
        if (item.uploaded) {
          ids.push(item.uploaded);
          continue;
        }
        if (!item.file) continue;
        setPhotos((current) =>
          current.map((p) =>
            p.key === item.key ? { ...p, message: "正在上传…" } : p,
          ),
        );
        const prepared = await prepareWorkOrderPhoto({
          number: order.number,
          name: item.file.name,
          mimeType: item.file.type,
          size: item.file.size,
        });
        if (!prepared.ok)
          throw new Error(`${item.file.name}：${prepared.error.message}`);
        reserved.current.push(prepared.photoId);
        const client = createClient();
        const { error: uploadError } = await client.storage
          .from(prepared.bucket)
          .upload(prepared.path, item.file, {
            upsert: false,
            cacheControl: "0, no-store",
            contentType: item.file.type,
          });
        if (uploadError)
          throw new Error(`${item.file.name}：上传失败，请重试。`);
        ids.push(prepared.photoId);
        setPhotos((current) =>
          current.map((p) =>
            p.key === item.key
              ? { ...p, uploaded: prepared.photoId, message: "已上传，待保存" }
              : p,
          ),
        );
      }
      await onSubmit({ ...values, photoIds: ids });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "上传失败，请重试。");
    } finally {
      setUploading(false);
    }
  }
  function cancel() {
    void discardWorkOrderPhotos(order.number, reserved.current).catch(() => {});
    onCancel();
  }
  return (
    <form
      className="wo-edit"
      onSubmit={(e) => {
        e.preventDefault();
        void save(e.currentTarget);
      }}
    >
      <h2>编辑问题信息</h2>
      <p className="wo-muted">编号、状态、项目、责任人及处理结果保持只读。</p>
      <fieldset disabled={busy || uploading}>
        <label>
          严重程度 *
          <select name="severity" defaultValue={order.severity}>
            {Object.entries(severityNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          专业类型 *
          <select name="discipline" defaultValue={order.discipline}>
            {Object.entries(disciplineNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          问题描述 *
          <textarea
            name="description"
            defaultValue={order.description}
            required
            rows={3}
          />
        </label>
        <label>
          详细位置 *
          <input name="location" defaultValue={order.location} required />
        </label>
        <label>
          问题详情（选填）
          <textarea
            name="details"
            defaultValue={order.details ?? ""}
            rows={4}
          />
        </label>
        <label>
          现场图片（选填）
          <span className="wo-muted">
            JPEG / PNG / WebP，10 MiB/张，最多 9 张；点击保存后生效。
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => {
              choose(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <div className="wo-photos">
          {photos.map((item) => (
            <div key={item.key}>
              <Image
                loading="eager"
                unoptimized
                width={800}
                height={600}
                src={item.photo.url}
                alt={item.photo.name}
              />
              <span>{item.photo.name}</span>
              {item.message && <small>{item.message}</small>}
              <button
                type="button"
                onClick={() =>
                  setPhotos((current) =>
                    current.filter((p) => p.key !== item.key),
                  )
                }
              >
                删除照片
              </button>
            </div>
          ))}
        </div>
      </fieldset>
      {(error || message) && (
        <p className="wo-form-error" role="alert">
          {message || error}
        </p>
      )}
      <div className="wo-form-buttons">
        <button type="button" disabled={busy || uploading} onClick={cancel}>
          取消编辑
        </button>
        <button
          className="wo-primary"
          type="submit"
          disabled={busy || uploading}
        >
          {uploading ? "正在上传…" : busy ? "正在保存…" : "保存"}
        </button>
      </div>
    </form>
  );
}
