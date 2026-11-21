import { Suspense } from "react";
import Loading from "@/app/loading";
import { AppShell } from "@/components/app-shell";
import { AssistantChat } from "@/components/assistant/chat";
import { loadChatSession } from "@/lib/assistant/session";
import { requireIdentity } from "@/lib/auth/context";

export default function AssistantPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AssistantContent />
    </Suspense>
  );
}

async function AssistantContent() {
  const { profile, identity } = await requireIdentity("/assistant");
  const session = await loadChatSession();
  return (
    <AppShell profile={profile} identity={identity} title="智能助手">
      <AssistantChat
        key={session.id}
        initial={session}
        canCreate={identity.role !== "contractor"}
      />
    </AppShell>
  );
}
