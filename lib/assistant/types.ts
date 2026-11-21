import type { UIMessage } from "ai";
import type { Identity } from "@/lib/auth/types";
import type { createClient } from "@/lib/supabase/server";
import type { WorkOrderDetail } from "@/lib/work-orders/types";

export type ChatMessage = UIMessage;
export type ChatSession = {
  id: string;
  revision: number;
  messages: ChatMessage[];
};
export type RuntimeContext = {
  client: Awaited<ReturnType<typeof createClient>>;
  identity: Identity;
  userId: string;
  sessionId: string;
  sessionRevision: number;
  sourceMessageId: string;
  uploadIds: string[];
  signal: AbortSignal;
};
export type SearchResult = {
  kind: "ok" | "forbidden" | "not_found";
  total: number;
  hasMore: boolean;
  items: WorkOrderDetail[];
};
export class ChatError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
