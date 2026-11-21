"use client";

import { LoaderCircle, LogOut } from "lucide-react";
import { useActionState } from "react";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function LogoutForm() {
  const [state, action, pending] = useActionState(logout, { message: "" });
  return (
    <form action={action}>
      <Button
        type="submit"
        variant="ghost"
        className="logout-button"
        disabled={pending}
      >
        {pending ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <LogOut size={16} />
        )}
        {pending ? "正在退出" : "退出登录"}
      </Button>
      {state.message && (
        <p role="alert" className="form-error">
          {state.message}
        </p>
      )}
    </form>
  );
}
