"use client";

import { ArrowRight, Badge, LoaderCircle, LockKeyhole } from "lucide-react";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, {
    message: "",
    employeeId: "",
  });
  return (
    <form action={action} className="login-form">
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="employeeId">工号</label>
        <div className="input-wrap">
          <Badge size={19} />
          <input
            id="employeeId"
            name="employeeId"
            autoComplete="username"
            placeholder="输入您的员工编号"
            defaultValue={state.employeeId}
            required
            maxLength={32}
            disabled={pending}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="password">密码</label>
        <div className="input-wrap">
          <LockKeyhole size={19} />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="输入系统访问密码"
            required
            disabled={pending}
          />
        </div>
      </div>
      {state.message && (
        <p className="form-error" role="alert">
          {state.message}
        </p>
      )}
      <Button className="login-submit" type="submit" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" />
            正在登录
          </>
        ) : (
          <>
            登录
            <ArrowRight size={17} />
          </>
        )}
      </Button>
    </form>
  );
}
