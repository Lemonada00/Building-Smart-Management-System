"use client";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type FileUIPart,
  getToolName,
  isToolUIPart,
} from "ai";
import {
  ArrowUp,
  BookOpen,
  Bot,
  ClipboardList,
  ImagePlus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";
import { CreateOrderCard } from "@/components/assistant/create-order-card";
import {
  WorkOrderLink,
  WorkOrderResult,
} from "@/components/assistant/work-order-result";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DetailDrawer } from "@/components/work-orders/detail-drawer";
import {
  normalizeKnowledgeReplies,
  resultOf,
  structuredToolOutput,
  trimHistory,
} from "@/lib/assistant/history";
import type { ChatMessage, ChatSession } from "@/lib/assistant/types";

const prompts = [
  [ClipboardList, "查询工单", "帮我查一下当前待处理的工单"],
  [Plus, "新建工单", "我想登记一个现场问题并创建工单"],
  [BookOpen, "咨询规范", "现浇混凝土的养护时间有什么要求？请注明出处。"],
] as const;

function ImageSelection({ disabled }: { disabled: boolean }) {
  const attachments = usePromptInputAttachments();
  return (
    <PromptInputButton
      disabled={disabled}
      className="chat-image-button"
      aria-label="从相册选择图片"
      onClick={() => attachments.openFileDialog()}
    >
      <ImagePlus size={18} />
      <span>相册</span>
    </PromptInputButton>
  );
}
function ImagePreviews() {
  const attachments = usePromptInputAttachments();
  if (!attachments.files.length) return null;
  return (
    <Attachments className="chat-previews" variant="grid">
      {attachments.files.map((file) => (
        <Attachment
          data={file}
          key={file.id}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove aria-label="移除图片" />
        </Attachment>
      ))}
    </Attachments>
  );
}
type ChatProps = { initial: ChatSession; canCreate: boolean };

export function AssistantChat(props: ChatProps) {
  return (
    <TooltipProvider>
      <PromptInputProvider>
        <ChatContent {...props} />
      </PromptInputProvider>
    </TooltipProvider>
  );
}
function ChatContent({ initial, canCreate }: ChatProps) {
  const controller = usePromptInputController();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const revision = useRef(initial.revision);
  const failed = useRef(false);
  const uploaded = useRef(new Map<string, FileUIPart>());
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [composerReady, setComposerReady] = useState(false);
  useEffect(() => setComposerReady(true), []);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            sessionId: initial.id,
            revision: revision.current,
            messages: trimHistory(messages),
          },
        }),
      }),
    [initial.id],
  );
  const chat = useChat<ChatMessage>({
    id: initial.id,
    messages: initial.messages,
    transport,
    onError: () => {
      failed.current = true;
      setNotice(
        "本轮发送或保存失败，原消息已保留。请重试；如提示版本冲突，请刷新后核对。",
      );
    },
    onFinish: ({ messages, isError, isAbort, isDisconnect }) => {
      if (!isError && !isAbort && !isDisconnect) {
        revision.current += 1;
        failed.current = false;
        chat.setMessages(trimHistory(normalizeKnowledgeReplies(messages)));
      }
    },
  });
  const busy =
    uploading ||
    confirming ||
    chat.status === "submitted" ||
    chat.status === "streaming";
  const hasInput =
    Boolean(controller.textInput.value.trim()) ||
    controller.attachments.files.length > 0;
  async function send() {
    if (!composerReady || busy) return;
    const text = controller.textInput.value.trim();
    const chosen = controller.attachments.files;
    if (!text && !chosen.length) throw new Error("空消息");
    if (text.length > 4000) {
      setNotice("每条消息最多 4000 字。");
      throw new Error("过长");
    }
    if (chat.error) {
      setNotice("请先点击重试完成上一轮。");
      throw new Error("请重试");
    }
    setNotice("");
    setUploading(true);
    try {
      const files: FileUIPart[] = [];
      for (const file of chosen) {
        let saved = uploaded.current.get(file.id);
        if (!saved) {
          const blob = await (await fetch(file.url)).blob();
          const form = new FormData();
          form.set("sessionId", initial.id);
          form.set("image", blob, file.filename ?? "现场图片");
          const response = await fetch("/api/chat/uploads", {
            method: "POST",
            body: form,
          });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error ?? "图片上传失败。");
          saved = body.files[0] as FileUIPart;
          uploaded.current.set(file.id, saved);
        }
        files.push(saved);
      }
      failed.current = false;
      await chat.sendMessage({ text, files });
      if (failed.current)
        throw new Error("本轮未完成，原输入已保留，请点击重试。");
      uploaded.current.clear();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "发送失败，请重试。");
      throw error;
    } finally {
      setUploading(false);
    }
  }
  async function retry() {
    if (busy) return;
    failed.current = false;
    setNotice("");
    chat.clearError();
    await chat.regenerate();
    if (!failed.current) {
      controller.textInput.clear();
      controller.attachments.clear();
      uploaded.current.clear();
    }
  }
  const renderedDrafts = new Set<string>();
  const displayMessages =
    chat.status === "streaming"
      ? normalizeKnowledgeReplies(chat.messages)
      : chat.messages;
  return (
    <section className="assistant-chat">
      <header className="chat-heading">
        <span className="chat-heading-mark">
          <Bot size={23} />
        </span>
        <div>
          <h1>智能助手</h1>
          <p>查工单、登记现场问题、咨询施工规范</p>
        </div>
      </header>
      <Conversation className="chat-conversation">
        <ConversationContent className="chat-messages">
          {!chat.messages.length && (
            <div className="chat-welcome">
              <h2>今天要跟进什么？</h2>
              <p>输入工单编号，或上传照片并描述现场情况。</p>
              <div className="chat-suggestions">
                {prompts
                  .filter(([, label]) => canCreate || label !== "新建工单")
                  .map(([Icon, label, prompt]) => (
                    <button
                      key={label}
                      type="button"
                      disabled={!composerReady || busy}
                      onClick={() => {
                        controller.textInput.setInput(prompt);
                        inputRef.current?.focus();
                      }}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ))}
              </div>
            </div>
          )}
          {displayMessages.map((message) => (
            <Message
              from={message.role}
              key={message.id}
              className="chat-message"
            >
              {message.role === "assistant" && (
                <span className="chat-message-author">
                  <Bot size={15} /> 智能助手
                </span>
              )}
              <MessageContent className="chat-message-content">
                {Array.from(message.parts.entries())
                  .sort(
                    ([, left], [, right]) =>
                      Number(isToolUIPart(left)) - Number(isToolUIPart(right)),
                  )
                  .map(([index, part]) => {
                    const key = `${message.id}-${index}`;
                    if (part.type === "text")
                      return (
                        <MessageResponse
                          key={key}
                          className="chat-message-text"
                          components={{
                            a: ({ href, children }) => {
                              const match = href?.match(
                                /^\/work-orders\/([1-9]\d{0,9})$/,
                              );
                              return !busy &&
                                match &&
                                Number(match[1]) <= 2147483647 ? (
                                <WorkOrderLink
                                  number={Number(match[1])}
                                  onOpen={setSelected}
                                >
                                  {children}
                                </WorkOrderLink>
                              ) : (
                                <span>{children}</span>
                              );
                            },
                          }}
                        >
                          {part.text}
                        </MessageResponse>
                      );
                    if (part.type === "file")
                      return (
                        <Attachments key={key} variant="grid">
                          <Attachment data={{ ...part, id: key }}>
                            <AttachmentPreview />
                          </Attachment>
                        </Attachments>
                      );
                    if (isToolUIPart(part)) {
                      const name = getToolName(part);
                      if (name === "query_construction_knowledge") return null;
                      if (name === "prepare_work_order_draft") {
                        const result =
                          "output" in part
                            ? structuredToolOutput(part.output)
                            : null;
                        const draftId =
                          result &&
                          "draftId" in result &&
                          typeof result.draftId === "string" &&
                          /^[0-9a-f-]{36}$/i.test(result.draftId)
                            ? result.draftId
                            : null;
                        if (!draftId || renderedDrafts.has(draftId))
                          return null;
                        renderedDrafts.add(draftId);
                        return (
                          <CreateOrderCard
                            key={draftId}
                            draftId={draftId}
                            sessionId={initial.id}
                            busy={busy}
                            setConfirming={setConfirming}
                            getSessionRevision={() => revision.current}
                            onOpen={setSelected}
                            onCreated={(messages, nextRevision) => {
                              if (nextRevision < revision.current) return;
                              revision.current = nextRevision;
                              chat.setMessages(trimHistory(messages));
                            }}
                          />
                        );
                      }
                      if (name !== "search_work_orders") return null;
                      const result =
                        "output" in part ? resultOf(part.output) : null;
                      return result ? (
                        <WorkOrderResult
                          key={key}
                          result={result}
                          onOpen={busy ? undefined : setSelected}
                        />
                      ) : (
                        <p className="chat-caption" key={key}>
                          {part.state === "output-error"
                            ? "工单查询失败，请重试。"
                            : "正在查询工单…"}
                        </p>
                      );
                    }
                    return null;
                  })}
              </MessageContent>
            </Message>
          ))}
          {busy && (
            <output className="chat-caption">
              {uploading ? "正在处理消息…" : "正在理解并准备回复…"}
            </output>
          )}
        </ConversationContent>
        <ConversationScrollButton aria-label="滚动到最新消息" />
      </Conversation>
      <div className="chat-composer">
        {(notice || chat.error) && (
          <div className="chat-error" role="alert">
            <p>{notice || "发送失败，请重试。"}</p>
            {chat.error && (
              <button type="button" disabled={busy} onClick={retry}>
                <RotateCcw size={14} />
                重试本轮
              </button>
            )}
          </div>
        )}
        <PromptInput
          className="chat-input-form"
          method="post"
          accept="image/jpeg,image/png,image/webp"
          multiple
          maxFiles={9}
          maxFileSize={10 * 1024 * 1024}
          onError={() =>
            setNotice(
              "请选择 JPEG、PNG、WebP，每张最多 10 MiB，一次最多 9 张。",
            )
          }
          onSubmit={send}
        >
          <PromptInputBody>
            <PromptInputTextarea
              ref={inputRef}
              placeholder="输入工单编号或描述现场情况…"
              aria-label="输入消息"
              className="chat-input-text"
              maxLength={4000}
              disabled={!composerReady || busy}
            />
          </PromptInputBody>
          <ImagePreviews />
          <PromptInputFooter className="chat-input-actions">
            <ImageSelection disabled={!composerReady || busy} />
            <PromptInputSubmit
              aria-label="发送消息"
              className="chat-send-button"
              disabled={
                !composerReady || busy || !hasInput || Boolean(chat.error)
              }
            >
              <ArrowUp size={18} />
              <span>发送</span>
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
        <p className="chat-caption">
          保留最近 6 轮，退出后清空。图片使用公开链接，请勿上传敏感信息。
        </p>
      </div>
      {selected !== null && <DetailDrawer number={selected} onClose={close} />}
    </section>
  );
}
