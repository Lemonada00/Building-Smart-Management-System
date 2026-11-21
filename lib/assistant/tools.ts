import "server-only";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { queryConstructionKnowledge } from "@/lib/assistant/coze";
import { draftFields } from "@/lib/assistant/draft-input";
import { prepareDraft } from "@/lib/assistant/drafts";
import type { RuntimeContext, SearchResult } from "@/lib/assistant/types";
import { searchInput } from "@/lib/assistant/validation";

export function workOrderTools(context: RuntimeContext) {
  return [
    tool(({ query }) => queryConstructionKnowledge(query, context.signal), {
      name: "query_construction_knowledge",
      description:
        "施工规范、工艺、数值或合规咨询获取依据。只传图文整理后的精练主题，避免身份、工单和任何私有链接。",
      schema: z.object({ query: z.string().trim().min(1).max(4000) }),
    }),
    ...(context.identity.role === "contractor"
      ? []
      : [
          tool((fields) => prepareDraft(context, fields), {
            name: "prepare_work_order_draft",
            description:
              "用户明确同意建单且四项齐备时，准备可编辑草稿。severity 为 minor/normal/major/urgent，discipline 为 architecture/structure/plumbing。未提供详情时填空字符串。草稿不是正式工单。",
            schema: draftFields,
          }),
        ]),
    tool(
      async (input) => {
        const { data, error } = await context.client.rpc(
          "search_assistant_work_orders",
          {
            p_number: input.number || null,
            p_keyword: input.keyword === "null" ? null : input.keyword,
            p_location: input.location === "null" ? null : input.location,
            p_status: input.status,
            p_severity: input.severity === "all" ? null : input.severity,
            p_scope: input.scope,
          },
        );
        if (error) throw new Error("工单查询失败，请稍后重试。");
        return data as SearchResult;
      },
      {
        name: "search_work_orders",
        description:
          "只读查询当前登录身份可见的真实工单。编号优先；不提供编号时按关键词、位置、状态、严重程度与本人范围组合。未指定状态用all。管理员问我的工单先向用户追问范围，确认前不要调用。",
        schema: searchInput,
      },
    ),
  ];
}
