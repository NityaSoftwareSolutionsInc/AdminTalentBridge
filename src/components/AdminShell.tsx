"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Shield,
} from "lucide-react";
import { TalentBridgeMark } from "@/components/TalentBridgeMark";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";

export type AdminNavKey = "dashboard" | "organizations" | "audit" | "platform-admins" | "email-logs";

const NAV_ITEMS: Array<{
  key: AdminNavKey;
  label: string;
  icon: typeof Building2;
}> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "organizations", label: "Organizations", icon: Building2 },
  { key: "audit", label: "Audit log", icon: ScrollText },
  { key: "platform-admins", label: "Global Admins", icon: Shield },
  { key: "email-logs", label: "Email delivery", icon: Mail },
];

const TITLES: Record<AdminNavKey, string> = {
  dashboard: "Dashboard",
  organizations: "Organizations",
  audit: "Audit log",
  "platform-admins": "Global Admins",
  "email-logs": "Email delivery",
};

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials || "GA"}
    </span>
  );
}

type AdminShellProps = {
  active: AdminNavKey;
  onNavigate: (key: AdminNavKey) => void;
  sessionName: string;
  sendgridConfigured: boolean;
  primaryAction?: ReactNode;
  children: ReactNode;
};

export function AdminShell({
  active,
  onNavigate,
  sessionName,
  sendgridConfigured,
  primaryAction,
  children,
}: AdminShellProps) {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [menu, setMenu] = useState<"none" | "user">("none");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("tb-admin-nav-collapsed");
      if (stored === "1") setNavCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleNav() {
    setNavCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tb-admin-nav-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div className="flex h-screen bg-[var(--color-canvas)] text-[var(--color-text)]">
      {menu !== "none" ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-20 cursor-default bg-transparent"
          onClick={() => setMenu("none")}
        />
      ) : null}

      <aside
        className={cn(
          "flex shrink-0 flex-col overflow-visible bg-[var(--color-sidebar)] text-[var(--color-text-inverse)] transition-[width] duration-150 ease-out",
          navCollapsed ? "w-[64px]" : "w-[220px]",
        )}
      >
        <div
          className={cn(
            "flex items-center border-b border-white/10",
            navCollapsed ? "flex-col gap-2 px-1.5 py-3" : "gap-2 px-3 py-3",
          )}
        >
          <TalentBridgeMark size={28} />
          {!navCollapsed ? (
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-wider text-blue-200/90">TalentBridge</div>
              <div className="text-[13px] font-semibold leading-tight">Platform Admin</div>
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggleNav}
            title={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!navCollapsed}
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-blue-200 hover:bg-[var(--color-sidebar-hover)] hover:text-white"
          >
            {navCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav
          className={cn("flex-1 overflow-auto", navCollapsed ? "space-y-0.5 p-1.5" : "space-y-0.5 p-2")}
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                title={navCollapsed ? item.label : undefined}
                onClick={() => onNavigate(item.key)}
                className={cn(
                  "flex w-full cursor-pointer items-center rounded-[var(--radius-md)] text-[13px] transition-colors",
                  navCollapsed ? "h-9 justify-center" : "gap-2 px-2.5 py-1.5",
                  isActive
                    ? "bg-[var(--color-sidebar-accent)] text-white"
                    : "text-slate-200 hover:bg-[var(--color-sidebar-hover)] hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!navCollapsed ? <span className="truncate">{item.label}</span> : null}
              </button>
            );
          })}
        </nav>

        <div className={cn("border-t border-white/10 text-xs", navCollapsed ? "p-1.5" : "p-2.5")}>
          <div
            className={cn(
              "flex w-full items-center rounded-[var(--radius-md)] text-left",
              navCollapsed ? "h-9 justify-center" : "gap-2 px-2 py-1.5",
            )}
            title={sessionName || "Account"}
          >
            <Avatar name={sessionName || "Global Admin"} />
            {!navCollapsed ? (
              <div className="min-w-0">
                <div className="truncate text-[12px] font-medium">{sessionName || "Global Admin"}</div>
                <div className="truncate text-[11px] text-blue-200/90">Global Admin</div>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Platform
            </p>
            <h1 className="truncate text-[15px] font-semibold text-[var(--color-text)]">{TITLES[active]}</h1>
          </div>

          <div className="min-w-0 flex-1" />

          <Badge tone={sendgridConfigured ? "green" : "amber"} className="hidden sm:inline-flex">
            {sendgridConfigured ? "SendGrid ready" : "SendGrid stub"}
          </Badge>

          {primaryAction}

          <div className="relative">
            <button
              type="button"
              className="cursor-pointer rounded-full hover:ring-2 hover:ring-[var(--color-focus-ring)]"
              title={sessionName || "Account"}
              aria-label="Account menu"
              onClick={() => setMenu(menu === "user" ? "none" : "user")}
            >
              <Avatar name={sessionName || "U"} size={30} />
            </button>
            {menu === "user" ? (
              <div className="absolute right-0 z-30 mt-1 w-52 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-[var(--shadow-md)]">
                <a
                  href="/api/logout"
                  className="flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                >
                  <LogOut className="h-4 w-4 text-[var(--color-text-muted)]" />
                  Log out
                </a>
              </div>
            ) : null}
          </div>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">{children}</div>
      </div>
    </div>
  );
}
