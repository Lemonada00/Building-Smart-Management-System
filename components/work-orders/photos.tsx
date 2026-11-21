"use client";
import Image from "next/image";
import { useState } from "react";
import type { WorkOrderPhoto } from "@/lib/work-orders/types";

// 私有图片必须每次鉴权，不进入优化缓存。
function PhotoImage({ photo }: { photo: WorkOrderPhoto }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className="wo-muted">图片暂不可用</span>
  ) : (
    <Image
      unoptimized
      width={800}
      height={600}
      src={photo.url}
      alt={photo.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
export function Photos({ photos }: { photos: WorkOrderPhoto[] }) {
  const [preview, setPreview] = useState<WorkOrderPhoto | null>(null);
  return (
    <>
      {photos.length ? (
        <div className="wo-photos">
          {photos.map((p) => (
            <button type="button" key={p.id} onClick={() => setPreview(p)}>
              <PhotoImage photo={p} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="wo-muted">暂无现场图片</p>
      )}
      {preview && (
        <div className="wo-modal-overlay">
          <section
            className="wo-photo-preview"
            role="dialog"
            aria-modal="true"
            aria-label="现场图片预览"
          >
            <button type="button" onClick={() => setPreview(null)}>
              关闭预览 ×
            </button>
            <PhotoImage photo={preview} />
            <p>{preview.name}</p>
          </section>
        </div>
      )}
    </>
  );
}
