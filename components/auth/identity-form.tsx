"use client";

import { ArrowRight, Building2, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { selectIdentity } from "@/app/actions/auth";
import { type Identity, roleNames } from "@/lib/auth/types";

export function IdentityForm({
  identities,
  next,
}: {
  identities: Identity[];
  next: string;
}) {
  const [state, action, pending] = useActionState(selectIdentity, {
    message: "",
  });
  return (
    <form action={action} className="identity-list">
      <input type="hidden" name="next" value={next} />
      {identities.map((identity) => (
        <button
          key={identity.id}
          type="submit"
          name="membershipId"
          value={identity.id}
          disabled={pending}
          className="identity-option"
        >
          <Building2 size={22} />
          <span>
            <strong>{identity.project_name}</strong>
            <small>{roleNames[identity.role]}</small>
          </span>
          {pending ? (
            <LoaderCircle size={18} className="animate-spin" />
          ) : (
            <ArrowRight size={18} />
          )}
        </button>
      ))}
      {pending && <p className="muted-note">正在确认本次登录身份…</p>}
      {state.message && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
