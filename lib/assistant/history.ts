import type { ChatMessage, SearchResult } from "@/lib/assistant/types";

export function rounds(messages: ChatMessage[]) {
  const groups: ChatMessage[][] = [];
  for (const message of messages) {
    if (message.role === "user") groups.push([message]);
    else groups.at(-1)?.push(message);
  }
  return groups;
}
export function trimHistory(messages: ChatMessage[], limit = 6) {
  return rounds(messages).slice(-limit).flat();
}

export function structuredToolOutput(value: unknown): object | null {
  if (typeof value === "string") {
    try {
      return structuredToolOutput(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  if (
    "kwargs" in value &&
    value.kwargs &&
    typeof value.kwargs === "object" &&
    "content" in value.kwargs
  )
    return structuredToolOutput(value.kwargs.content);
  return value;
}

export function normalizeKnowledgeReplies(messages: ChatMessage[]) {
  const groups = rounds(messages);
  return groups.flatMap((round, groupIndex) => {
    if (groupIndex !== groups.length - 1) return round;
    const knowledge = round.flatMap((message) =>
      message.parts.filter(
        (part) =>
          part.type === "tool-query_construction_knowledge" ||
          (part.type === "dynamic-tool" &&
            part.toolName === "query_construction_knowledge"),
      ),
    );
    const results = knowledge.flatMap((part) =>
      "output" in part ? [structuredToolOutput(part.output)] : [],
    );
    if (
      !results.some(
        (result) =>
          result &&
          "status" in result &&
          (result.status === "unavailable" || result.status === "empty"),
      ) ||
      results.some(
        (result) => result && "status" in result && result.status === "ok",
      )
    )
      return round;
    const last = round.findLastIndex((message) => message.role === "assistant");
    return round.flatMap((message, index) => {
      if (message.role !== "assistant") return [message];
      const parts = message.parts.filter(
        (part) => part.type !== "text",
      ) as ChatMessage["parts"];
      if (index === last)
        parts.push({
          type: "text",
          text: "本轮未取得可核对的知识依据。可以补充条件后重试，或明确说明是否按现场事实报事。",
        });
      return parts.length ? [{ ...message, parts }] : [];
    });
  });
}
export function resultOf(value: unknown): SearchResult | null {
  try {
    const result = typeof value === "string" ? JSON.parse(value) : value;
    if (result && typeof result === "object" && "kwargs" in result) {
      return resultOf(result.kwargs?.content);
    }
    return result &&
      typeof result === "object" &&
      Array.isArray(result.items) &&
      typeof result.total === "number" &&
      typeof result.hasMore === "boolean"
      ? (result as SearchResult)
      : null;
  } catch {
    return null;
  }
}
export function referencedNumbers(messages: ChatMessage[]) {
  const numbers = new Set<number>();
  for (const message of messages)
    for (const part of message.parts) {
      if ("output" in part) {
        const result = resultOf(part.output);
        for (const item of result?.items ?? [])
          if (Number.isInteger(item.number)) numbers.add(item.number);
      }
      if (part.type === "text")
        for (const match of part.text.matchAll(
          /(?:#|\/work-orders\/)([1-9]\d{0,9})/g,
        ))
          numbers.add(Number(match[1]));
    }
  return [...numbers];
}
