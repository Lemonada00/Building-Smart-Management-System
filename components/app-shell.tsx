"use client";

import {
  ClipboardList,
  LayoutDashboard,
  Menu,
  MessageSquare,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { LogoutForm } from "@/components/auth/logout-form";
import { Brand } from "@/components/brand";
import type { Identity, LoginContext } from "@/lib/auth/types";
import { pages, roleNames } from "@/lib/auth/types";

const icons = {
  "/assistant": MessageSquare,
  "/work-orders": ClipboardList,
  "/dashboard": LayoutDashboard,
  "/admin/work-orders": ClipboardList,
};

export function AppShell({
  profile,
  identity,
  title,
  children,
}: {
  profile: NonNullable<LoginContext["profile"]>;
  identity: Identity;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const activePath = pathname.startsWith("/work-orders/")
    ? identity.role === "admin"
      ? "/admin/work-orders"
      : "/work-orders"
    : pathname;
  return (
    <div
      className={`workspace ${pathname === "/assistant" ? "workspace-chat" : ""}`}
    >
      {open && (
        <button
          type="button"
          aria-label="关闭菜单遮罩"
          className="nav-backdrop"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand compact />
          <button
            type="button"
            className="mobile-close icon-button"
            aria-label="关闭菜单"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <p className="nav-label">工作空间</p>
        <nav className="main-nav">
          {pages
            .filter((page) => page.roles.includes(identity.role))
            .map((page) => {
              const Icon = icons[page.href as keyof typeof icons];
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  prefetch={false}
                  className={
                    activePath === page.href ? "nav-item active" : "nav-item"
                  }
                  aria-current={activePath === page.href ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <Icon size={18} strokeWidth={1.7} />
                  <span>{page.title}</span>
                </Link>
              );
            })}
        </nav>
        <div className="sidebar-user">
          <div className="user-main">
            <span className="avatar">
              {profile.avatar_url ? (
                <Image
                  unoptimized
                  src={profile.avatar_url}
                  alt={profile.name}
                  width={40}
                  height={40}
                />
              ) : (
                profile.name.slice(0, 1)
              )}
            </span>
            <div>
              <p className="user-name">{profile.name}</p>
              <p className="user-department">{profile.department}</p>
            </div>
          </div>
          <p className="user-project">{identity.project_name}</p>
          <span className="role-tag">{roleNames[identity.role]}</span>
          <LogoutForm />
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-header">
          <div className="header-location">
            <button
              type="button"
              className="mobile-menu icon-button"
              aria-label="打开菜单"
              onClick={() => setOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>工作空间</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{title}</strong>
          </div>
          <span className="header-project">{identity.project_name}</span>
        </header>
        <main className="workspace-content">{children}</main>
      </div>
    </div>
  );
}
