"use client";

import { ArrowUpRight, ClipboardPenLine, ImagePlus } from "lucide-react";
import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import {
  cancelDraft,
  confirmDraft,
  saveDraft,
} from "@/app/actions/assistant-drafts";
import { WorkOrderLink } from "@/components/assistant/work-order-result";
import { Button } from "@/components/ui/button";
import type {
  DraftCardData,
  DraftForm,
  DraftPhotoOption,
} from "@/lib/assistant/draft-input";
import type { ChatMessage } from "@/lib/assistant/types";
import { disciplineNames, severityNames } from "@/lib/work-orders/types";

type Props = {
  draftId: string;
  sessionId: string;
  busy: boolean;
  getSessionRevision: () => number;
  setConfirming: (pending: boolean) => void;
  onCreated: (messages: ChatMessage[], revision: number) => void;
  onOpen: (number: number) => void;
};
const stateText = {
  editing: "待确认",
  created: "已创建",
  cancelled: "已取消",
  expired: "已失效",
};
const textInputs = [
  ["description", "问题描述"],
  ["location", "详细位置"],
  ["details", "补充详情"],
] as const;

export function CreateOrderCard(props: Props) {
  const photoInputId = useId();
  const {
    draftId,
    sessionId,
    busy,
    setConfirming,
    getSessionRevision,
    onCreated,
    onOpen,
  } = props;
  const [data, setData] = useState<DraftCardData>();
  const [form, setForm] = useState<DraftForm>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveRequest, requestSave] = useState(0);
  const lock = useRef(false);
  const load = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const generation = ++load.current;
    async function read() {
      try {
        const response = await fetch(
          `/api/chat/drafts/${draftId}?sessionId=${sessionId}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "草稿暂不可用。");
        if (load.current === generation) {
          setData(result);
          setForm(result.form);
          setError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted && load.current === generation)
          setError(cause instanceof Error ? cause.message : "草稿加载失败。");
      }
    }
    void read();
    return () => controller.abort();
  }, [draftId, sessionId]);

  function change(next: DraftForm) {
    setForm(next);
    setDirty(true);
  }
  async function run(action: "save" | "cancel" | "confirm") {
    if (!data || !form || lock.current || busy) return;
    lock.current = true;
    setPending(action);
    if (action === "confirm") setConfirming(true);
    setError("");
    try {
      const address = { draftId, sessionId, expectedRevision: data.revision };
      const result =
        action === "cancel"
          ? await cancelDraft(address)
          : action === "save"
            ? await saveDraft({ ...address, form })
            : await confirmDraft({
                ...address,
                form,
                sessionRevision: getSessionRevision(),
              });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const update = result.data;
      setData({
        ...data,
        revision: update.draft.revision,
        status: update.draft.status,
        workOrderNumber: update.workOrderNumber,
      });
      setDirty(false);
      if (
        action === "confirm" &&
        update.messages &&
        update.sessionRevision !== undefined
      )
        onCreated(update.messages, update.sessionRevision);
    } catch {
      setError("操作未完成，已保留输入，请重试。");
    } finally {
      if (action === "confirm") setConfirming(false);
      setPending("");
      lock.current = false;
    }
  }

  const autoSave = useEffectEvent(() => {
    if (dirty && form?.description.trim() && form.location.trim()) {
      void run("save");
    }
  });
  useEffect(() => {
    if (!saveRequest) return;
    const timer = window.setTimeout(autoSave, 650);
    return () => window.clearTimeout(timer);
  }, [saveRequest]);

  async function addPhoto(file: File) {
    if (!data || !form || busy || lock.current) return;
    if (form.uploadIds.length + form.photoIds.length >= 9) {
      setError("最多选择九张照片。");
      return;
    }
    lock.current = true;
    setPending("photo");
    setError("");
    try {
      const input = new FormData();
      input.set("sessionId", sessionId);
      input.set("image", file);
      const response = await fetch(`/api/chat/drafts/${draftId}/photos`, {
        method: "POST",
        body: input,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "照片上传失败。");
      const photo = result as DraftPhotoOption;
      setData({ ...data, photos: [...data.photos, photo] });
      change({ ...form, photoIds: [...form.photoIds, photo.id] });
      requestSave((sequence) => sequence + 1);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "照片上传失败，请重试。",
      );
    } finally {
      lock.current = false;
      setPending("");
    }
  }

  if (!data || !form) return <p>{error || "正在读取建单草稿…"}</p>;
  const disabled = busy || Boolean(pending);
  const editing = data.status === "editing";
  const photoGroups = [
    ["保留对话图片", data.uploads, "uploadIds"],
    ["现场照片", data.photos, "photoIds"],
  ] as const;
  return (
    <section className="chat-draft">
      <header className="chat-orders-heading">
        <ClipboardPenLine size={18} />
        <h3>工单草稿</h3>
        <span className="chat-order-status" data-status={data.status}>
          {stateText[data.status]}
        </span>
      </header>
      <div className="chat-draft-body">
        {data.workOrderNumber && (
          <WorkOrderLink
            className="chat-order-link"
            number={data.workOrderNumber}
            onOpen={onOpen}
          >
            查看工单 #{data.workOrderNumber} <ArrowUpRight size={15} />
          </WorkOrderLink>
        )}
        {editing ? (
          <>
            <fieldset
              disabled={disabled}
              className="chat-draft-fields"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  requestSave((sequence) => sequence + 1);
                }
              }}
              onChange={(event) => {
                if (
                  event.target instanceof HTMLSelectElement ||
                  (event.target instanceof HTMLInputElement &&
                    event.target.type === "checkbox")
                ) {
                  requestSave((sequence) => sequence + 1);
                }
              }}
            >
              {textInputs.map(([key, label]) => (
                <label key={key} className="chat-draft-field">
                  <span>
                    {label}
                    {key === "details" && <small>（选填）</small>}
                  </span>
                  <textarea
                    rows={key === "location" ? 1 : 2}
                    value={form[key]}
                    onChange={(event) =>
                      change({ ...form, [key]: event.target.value })
                    }
                  />
                </label>
              ))}
              <div className="chat-draft-pair">
                <label className="chat-draft-field">
                  严重程度
                  <select
                    value={form.severity}
                    onChange={(e) =>
                      change({
                        ...form,
                        severity: e.target.value as DraftForm["severity"],
                      })
                    }
                  >
                    {Object.entries(severityNames).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="chat-draft-field">
                  专业类型
                  <select
                    value={form.discipline}
                    onChange={(e) =>
                      change({
                        ...form,
                        discipline: e.target.value as DraftForm["discipline"],
                      })
                    }
                  >
                    {Object.entries(disciplineNames).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="chat-draft-field">
                施工方责任人
                <select
                  value={form.assigneeId ?? ""}
                  onChange={(e) =>
                    change({ ...form, assigneeId: e.target.value || null })
                  }
                >
                  <option value="">
                    {data.assignees.length
                      ? "请选择当前项目施工方"
                      : "当前项目暂无可选施工方"}
                  </option>
                  {data.assignees.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              {photoGroups.map(
                ([label, photos, key]) =>
                  photos.length > 0 && (
                    <fieldset className="chat-draft-photos" key={key}>
                      <legend>{label}</legend>
                      {photos.map((photo) => (
                        <label
                          className="flex items-center gap-1"
                          key={photo.id}
                        >
                          <input
                            aria-label={photo.name}
                            type="checkbox"
                            checked={form[key].includes(photo.id)}
                            onChange={(event) => {
                              if (
                                event.target.checked &&
                                form.uploadIds.length + form.photoIds.length >=
                                  9
                              ) {
                                setError("最多选择九张照片。");
                                return;
                              }
                              change({
                                ...form,
                                [key]: event.target.checked
                                  ? [...form[key], photo.id]
                                  : form[key].filter((id) => id !== photo.id),
                              });
                            }}
                          />
                          {/* biome-ignore lint/performance/noImgElement: 会话照片按原地址或鉴权接口显示 */}
                          <img
                            className="size-12 rounded object-cover"
                            src={photo.url}
                            alt={photo.name}
                          />
                        </label>
                      ))}
                    </fieldset>
                  ),
              )}
              <div className="chat-draft-upload">
                <input
                  id={photoInputId}
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void addPhoto(file);
                    event.target.value = "";
                  }}
                />
                <label htmlFor={photoInputId}>
                  <ImagePlus size={16} /> 添加现场照片
                </label>
                <small>最多 9 张</small>
              </div>
            </fieldset>
            <div className="chat-draft-actions">
              <Button
                size="sm"
                type="button"
                disabled={
                  disabled ||
                  !form.assigneeId ||
                  !form.description.trim() ||
                  !form.location.trim()
                }
                onClick={() => void run("confirm")}
              >
                {pending === "confirm" ? "正在提交…" : "确认建单"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={
                  disabled ||
                  !dirty ||
                  !form.description.trim() ||
                  !form.location.trim()
                }
                onClick={() => void run("save")}
              >
                {pending === "save" ? "正在保存…" : "保存草稿"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                disabled={disabled}
                onClick={() => void run("cancel")}
              >
                取消草稿
              </Button>
            </div>
            {dirty && <p className="chat-caption">有未保存的修改。</p>}
          </>
        ) : (
          <p>
            {form.description} · {form.location}
          </p>
        )}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
