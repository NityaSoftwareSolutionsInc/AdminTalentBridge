"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Plus, Search, X } from "lucide-react";
import { AdminShell, type AdminNavKey, type AdminSessionRole } from "@/components/AdminShell";
import { DashboardView } from "@/components/DashboardView";
import { EmailLogsView } from "@/components/EmailLogsView";
import { PlatformAdminsView } from "@/components/PlatformAdminsView";
import { TicketsView } from "@/components/TicketsView";
import { TenantDetailDrawer } from "@/components/TenantDetailDrawer";
import { TbLoader } from "@/components/TbLoader";
import {
  Badge,
  Banner,
  Button,
  DataTable,
  EmptyState,
  Field,
  FilterChip,
  Input,
  Panel,
  Td,
  Th,
  Toolbar,
  Workspace,
  WorkspaceBody,
} from "@/components/ui";

type AdminRow = {
  id: string;
  name: string;
  email: string;
  inviteSentAt: string | null;
  passwordSet: boolean;
};

type TenantRow = {
  id: string;
  name: string;
  enabled: boolean;
  jnpAllowed: boolean;
  createdAt: string;
  userCount: number;
  admins: AdminRow[];
  outlookAllowed?: boolean;
  viotalkAllowed?: boolean;
  maintenanceMode?: boolean;
  mailboxMappedCount?: number;
  activeUsers7d?: number;
  activeUsers30d?: number;
  pendingInviteCount?: number;
  invitePendingAgingDays?: number | null;
  lastUserLoginAt?: string | null;
  legalName?: string;
  region?: string;
  accountOwner?: string;
  createdBy?: { id: string; name: string; email: string } | null;
  createdById?: string | null;
  canMutate?: boolean;
};

type InviteResult = {
  sent: boolean;
  stub: boolean;
  previewUrl?: string;
  email?: string;
};

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  tenantId: string | null;
  tenantName: string | null;
  actorId: string;
  actorName: string;
  actorEmail: string;
  before: string;
  after: string;
  createdAt: string;
};

type OrgFilter = "all" | "mine" | "enabled" | "disabled" | "jnp" | "pending";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function auditAfterPreview(after: string) {
  if (!after) return "—";
  try {
    const parsed = JSON.parse(after) as Record<string, unknown>;
    if (parsed.name) return String(parsed.name);
    if (parsed.email) return String(parsed.email);
    if (parsed.enabled != null) return parsed.enabled ? "enabled" : "disabled";
    return after.slice(0, 80);
  } catch {
    return after.slice(0, 80);
  }
}

export default function TenantsPage() {
  const router = useRouter();
  const [nav, setNav] = useState<AdminNavKey>("dashboard");
  const [sessionName, setSessionName] = useState("");
  const [sessionPlatformAdminId, setSessionPlatformAdminId] = useState("");
  const [sessionRole, setSessionRole] = useState<AdminSessionRole>("global_admin");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [sendgridConfigured, setSendgridConfigured] = useState(false);
  const [openTicketCount, setOpenTicketCount] = useState(0);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OrgFilter>("all");
  const [auditQ, setAuditQ] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [newName, setNewName] = useState("");
  const [newJnpAllowed, setNewJnpAllowed] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adminForms, setAdminForms] = useState<Record<string, { name: string; email: string }>>({});
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const navReadyRef = useRef(false);
  const auditFiltersRef = useRef({ q: "", action: "", from: "", to: "" });
  auditFiltersRef.current = { q: auditQ, action: auditAction, from: auditFrom, to: auditTo };

  const loadAudit = useCallback(async (overrides?: { q?: string; action?: string; from?: string; to?: string }) => {
    const params = new URLSearchParams();
    const filters = { ...auditFiltersRef.current, ...overrides };
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.action.trim()) params.set("action", filters.action.trim());
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const qs = params.toString();
    const auditRes = await fetch(`/api/audit${qs ? `?${qs}` : ""}`);
    const auditData = auditRes.ok ? await auditRes.json() : { events: [] };
    setAuditEvents(auditData.events || []);
  }, []);

  const load = useCallback(async () => {
    const [sessionRes, tenantsRes, ticketsRes] = await Promise.all([
      fetch("/api/session"),
      fetch("/api/tenants"),
      fetch("/api/tickets"),
    ]);
    if (sessionRes.status === 401) {
      router.replace("/login");
      return;
    }
    const sessionData = await sessionRes.json();
    const tenantsData = await tenantsRes.json();
    const ticketsData = ticketsRes.ok ? await ticketsRes.json() : { openCount: 0 };
    const role = (sessionData.session?.role || "global_admin") as AdminSessionRole;
    setSessionName(sessionData.session?.name || "");
    setSessionPlatformAdminId(sessionData.session?.platformAdminId || "");
    setSessionRole(role);
    setMustChangePassword(Boolean(sessionData.session?.mustChangePassword));
    setSendgridConfigured(Boolean(sessionData.sendgridConfigured));
    setTenants(tenantsData.tenants || []);
    setOpenTicketCount(ticketsData.openCount || 0);
    if (!navReadyRef.current) {
      setNav(role === "support" ? "tickets" : "dashboard");
      setFilter(role === "manager" ? "mine" : "all");
      navReadyRef.current = true;
    }
    await loadAudit();
    setLoading(false);
  }, [router, loadAudit]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showCreate) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowCreate(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showCreate]);

  const filteredTenants = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((t) => {
      if (filter === "mine" && t.createdById !== sessionPlatformAdminId) return false;
      if (filter === "enabled" && !t.enabled) return false;
      if (filter === "disabled" && t.enabled) return false;
      if (filter === "jnp" && !t.jnpAllowed) return false;
      if (filter === "pending") {
        const pending = t.admins.some((a) => !a.passwordSet) || t.admins.length === 0;
        if (!pending) return false;
      }
      if (!q) return true;
      const adminHay = t.admins.map((a) => `${a.name} ${a.email}`).join(" ");
      const creatorHay = t.createdBy ? `${t.createdBy.name} ${t.createdBy.email}` : "";
      return `${t.name} ${adminHay} ${creatorHay}`.toLowerCase().includes(q);
    });
  }, [tenants, query, filter, sessionPlatformAdminId]);

  function formatInvite(invite?: InviteResult | null) {
    if (!invite) return "";
    if (invite.sent) {
      return `Activation email sent to ${invite.email || "admin"}. They must open that email to activate before signing in.`;
    }
    if (invite.stub) {
      return `Activation email stubbed (configure SendGrid). Preview link is in the server log${
        invite.previewUrl ? `: ${invite.previewUrl}` : ""
      }. They must use that link to activate.`;
    }
    return "Activation email was not sent.";
  }

  async function createTenant(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          jnpAllowed: newJnpAllowed,
          adminName: newAdminName,
          adminEmail: newAdminEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create tenant");
        return;
      }
      setNewName("");
      setNewJnpAllowed(false);
      setNewAdminName("");
      setNewAdminEmail("");
      setShowCreate(false);
      setNotice(
        `Created tenant “${data.tenant.name}”. ${formatInvite(data.tenant?.adminInvite?.invite)} JobsNProfiles is ${
          data.tenant.jnpAllowed ? "allowed" : "not allowed"
        }.`,
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleJnpAllowed(tenant: TenantRow) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id, jnpAllowed: !tenant.jnpAllowed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update JobsNProfiles access");
        return;
      }
      setNotice(
        `${data.tenant.name}: JobsNProfiles is now ${data.tenant.jnpAllowed ? "allowed" : "not allowed"}.`,
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(tenant: TenantRow) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id, enabled: !tenant.enabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not update tenant");
        return;
      }
      setNotice(`${data.tenant.name} is now ${data.tenant.enabled ? "enabled" : "disabled"}.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function createAdmin(tenantId: string) {
    const form = adminForms[tenantId] || { name: "", email: "" };
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/tenants/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, name: form.name, email: form.email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create admin");
        return;
      }
      setAdminForms((prev) => ({ ...prev, [tenantId]: { name: "", email: "" } }));
      setNotice(formatInvite(data.invite));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resendInvite(tenantId: string, userId: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/tenants/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, userId, resend: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not resend invite");
        return;
      }
      setNotice(formatInvite(data.invite));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Could not change password");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setMustChangePassword(false);
    } finally {
      setPasswordBusy(false);
    }
  }

  const filters: Array<{ key: OrgFilter; label: string }> = [
    { key: "all", label: "All" },
    ...(sessionRole === "manager" ? [{ key: "mine" as const, label: "My organizations" }] : []),
    { key: "enabled", label: "Enabled" },
    { key: "disabled", label: "Disabled" },
    { key: "jnp", label: "JNP allowed" },
    { key: "pending", label: "Pending invite" },
  ];

  return (
    <>
      <AdminShell
        active={nav}
        onNavigate={(key) => {
          setNav(key);
          setError(null);
          setNotice(null);
          if (key !== "organizations") setShowCreate(false);
        }}
        sessionName={sessionName}
        sessionRole={sessionRole}
        sendgridConfigured={sendgridConfigured}
        primaryAction={
          nav === "organizations" && sessionRole !== "support" ? (
            <Button
              type="button"
              onClick={() => {
                setShowCreate(true);
                setError(null);
              }}
            >
              <Plus className="h-4 w-4" />
              Create tenant
            </Button>
          ) : null
        }
      >
        {nav === "dashboard" ? (
          <DashboardView
            tenants={tenants}
            auditEvents={auditEvents}
            loading={loading}
            openTicketCount={openTicketCount}
            ownedTenantCount={
              sessionRole === "manager"
                ? tenants.filter((t) => t.createdById === sessionPlatformAdminId).length
                : undefined
            }
            onOpenOrganizations={() => setNav("organizations")}
            onOpenTickets={() => setNav("tickets")}
          />
        ) : nav === "tickets" ? (
          <TicketsView selfId={sessionPlatformAdminId} />
        ) : nav === "platform-admins" ? (
          <PlatformAdminsView selfId={sessionPlatformAdminId} />
        ) : nav === "email-logs" ? (
          <EmailLogsView />
        ) : (
          <Workspace>
            {(error || notice) && !showCreate ? (
              <div className="space-y-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-5">
                {error ? <Banner tone="error">{error}</Banner> : null}
                {notice ? <Banner tone="success">{notice}</Banner> : null}
              </div>
            ) : null}

            {nav === "organizations" ? (
              <>
                <Toolbar>
                  <div className="relative max-w-md min-w-[220px] flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <Input
                      className="pl-8"
                      placeholder="Search tenants or admins…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Search organizations"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {filters.map((f) => (
                      <FilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
                        {f.label}
                      </FilterChip>
                    ))}
                  </div>
                  <p className="ml-auto text-[12px] text-[var(--color-text-muted)]">
                    {loading
                      ? "Loading…"
                      : `${filteredTenants.length} of ${tenants.length} tenant${tenants.length === 1 ? "" : "s"}`}
                  </p>
                </Toolbar>

                <WorkspaceBody>
                  {loading ? (
                    <TbLoader variant="inline" hint="Loading tenants" />
                  ) : filteredTenants.length === 0 ? (
                    <EmptyState
                      title={tenants.length === 0 ? "No tenants yet" : "No matches"}
                      description={
                        tenants.length === 0
                          ? "Create the first staffing firm to get started."
                          : "Try a different search or filter."
                      }
                      action={
                        tenants.length === 0 && sessionRole !== "support" ? (
                          <Button type="button" onClick={() => setShowCreate(true)}>
                            <Plus className="h-4 w-4" />
                            Create tenant
                          </Button>
                        ) : null
                      }
                    />
                  ) : (
                    <DataTable minWidth="1040px">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                          <Th>Tenant</Th>
                          <Th className="w-20">Users</Th>
                          <Th className="w-28">Status</Th>
                          <Th className="w-28">JNP</Th>
                          <Th>Administrator</Th>
                          <Th className="w-56" align="right">
                            Actions
                          </Th>
                        </tr>
                      </thead>
                      <tbody className="bg-[var(--color-surface)]">
                        {filteredTenants.map((tenant) => {
                          const form = adminForms[tenant.id] || { name: "", email: "" };
                          const firstAdmin = tenant.admins[0];
                          const active7d = tenant.activeUsers7d ?? 0;
                          const mailboxes = tenant.mailboxMappedCount ?? 0;
                          const pendingAging = tenant.invitePendingAgingDays;
                          const needsActivation = Boolean(firstAdmin && !firstAdmin.passwordSet);
                          return (
                            <tr
                              key={tenant.id}
                              className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-muted)]/50"
                            >
                              <Td>
                                <div className="min-w-0 max-w-[280px]">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      className="truncate text-left text-[13px] font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)]"
                                      onClick={() => setSelectedTenantId(tenant.id)}
                                    >
                                      {tenant.name}
                                    </button>
                                    {tenant.maintenanceMode ? <Badge tone="amber">Maintenance</Badge> : null}
                                  </div>
                                  <p className="mt-1 truncate text-[12px] text-[var(--color-text-muted)]">
                                    {active7d} active · {mailboxes} mailboxes
                                    {pendingAging != null && pendingAging > 0
                                      ? ` · pending ${pendingAging}d`
                                      : ""}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
                                    {formatDate(tenant.createdAt)}
                                    {tenant.createdBy ? ` · ${tenant.createdBy.name}` : ""}
                                  </p>
                                </div>
                              </Td>
                              <Td>
                                <span className="tabular-nums text-[13px] font-medium text-[var(--color-text)]">
                                  {tenant.userCount}
                                </span>
                              </Td>
                              <Td>
                                <Badge tone={tenant.enabled ? "green" : "slate"}>
                                  {tenant.enabled ? "Enabled" : "Disabled"}
                                </Badge>
                              </Td>
                              <Td>
                                <Badge tone={tenant.jnpAllowed ? "green" : "slate"}>
                                  {tenant.jnpAllowed ? "Allowed" : "Off"}
                                </Badge>
                              </Td>
                              <Td>
                                {firstAdmin ? (
                                  <div className="min-w-0 max-w-[260px]">
                                    <p className="truncate text-[13px] font-medium text-[var(--color-text)]">
                                      {firstAdmin.name}
                                    </p>
                                    <p className="truncate text-[12px] text-[var(--color-text-muted)]">
                                      {firstAdmin.email}
                                    </p>
                                    <div className="mt-1.5">
                                      {firstAdmin.passwordSet ? (
                                        <Badge tone="green">Activated</Badge>
                                      ) : (
                                        <Badge tone="amber">
                                          {firstAdmin.inviteSentAt
                                            ? `Pending · ${formatDate(firstAdmin.inviteSentAt)}`
                                            : "Not activated"}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ) : tenant.canMutate ? (
                                  <div className="max-w-[360px] rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 p-3">
                                    <p className="mb-2 text-[12px] font-medium text-[var(--color-text-secondary)]">
                                      Invite first administrator
                                    </p>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                                      <Field label="Name">
                                        <Input
                                          placeholder="Full name"
                                          value={form.name}
                                          onChange={(e) =>
                                            setAdminForms((prev) => ({
                                              ...prev,
                                              [tenant.id]: { ...form, name: e.target.value },
                                            }))
                                          }
                                        />
                                      </Field>
                                      <Field label="Email">
                                        <Input
                                          placeholder="admin@yourcompany.com"
                                          type="email"
                                          value={form.email}
                                          onChange={(e) =>
                                            setAdminForms((prev) => ({
                                              ...prev,
                                              [tenant.id]: { ...form, email: e.target.value },
                                            }))
                                          }
                                        />
                                      </Field>
                                      <Button
                                        type="button"
                                        size="sm"
                                        disabled={busy || !form.name.trim() || !form.email.trim()}
                                        onClick={() => void createAdmin(tenant.id)}
                                      >
                                        Invite
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[12px] text-[var(--color-text-muted)]">No administrator</p>
                                )}
                              </Td>
                              <Td align="right">
                                {tenant.canMutate ? (
                                  <div className="inline-flex flex-wrap items-center justify-end gap-1">
                                    {needsActivation && firstAdmin ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy}
                                        title="Resend activation email"
                                        onClick={() => void resendInvite(tenant.id, firstAdmin.id)}
                                      >
                                        <Mail className="h-3.5 w-3.5" />
                                        Resend
                                      </Button>
                                    ) : null}
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() => void toggleJnpAllowed(tenant)}
                                    >
                                      {tenant.jnpAllowed ? "Revoke JNP" : "Allow JNP"}
                                    </Button>
                                    <span
                                      className="mx-0.5 hidden h-4 w-px bg-[var(--color-border)] sm:inline-block"
                                      aria-hidden
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={busy}
                                      className={
                                        tenant.enabled
                                          ? "text-red-600 hover:bg-red-50 hover:text-red-700"
                                          : "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                      }
                                      onClick={() => void toggleEnabled(tenant)}
                                    >
                                      {tenant.enabled ? "Disable" : "Enable"}
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-[12px] text-[var(--color-text-muted)]">View only</span>
                                )}
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </DataTable>
                  )}
                </WorkspaceBody>
              </>
            ) : (
              <>
                <Toolbar>
                  <div className="relative min-w-[160px] max-w-xs flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <Input
                      className="pl-8"
                      placeholder="Search audit…"
                      value={auditQ}
                      onChange={(e) => setAuditQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void loadAudit();
                      }}
                      aria-label="Search audit"
                    />
                  </div>
                  <Field label="Action" className="min-w-[140px]">
                    <Input
                      placeholder="e.g. tenant.create"
                      value={auditAction}
                      onChange={(e) => setAuditAction(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void loadAudit();
                      }}
                      aria-label="Filter by action"
                    />
                  </Field>
                  <Field label="From" className="w-[150px]">
                    <Input
                      type="date"
                      value={auditFrom}
                      onChange={(e) => {
                        setAuditFrom(e.target.value);
                        void loadAudit({ from: e.target.value });
                      }}
                      aria-label="From date"
                    />
                  </Field>
                  <Field label="To" className="w-[150px]">
                    <Input
                      type="date"
                      value={auditTo}
                      onChange={(e) => {
                        setAuditTo(e.target.value);
                        void loadAudit({ to: e.target.value });
                      }}
                      aria-label="To date"
                    />
                  </Field>
                  <Button type="button" variant="secondary" onClick={() => void loadAudit()}>
                    Apply
                  </Button>
                  <p className="ml-auto text-[12px] text-[var(--color-text-muted)]">
                    {loading
                      ? "Loading…"
                      : `${auditEvents.length} event${auditEvents.length === 1 ? "" : "s"}`}
                  </p>
                </Toolbar>
                <WorkspaceBody>
                  {loading ? (
                    <TbLoader variant="inline" hint="Loading audit" />
                  ) : auditEvents.length === 0 ? (
                    <EmptyState title="No platform audit events yet" />
                  ) : (
                    <DataTable minWidth="900px">
                      <thead className="sticky top-0 z-10">
                        <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                          <Th>When</Th>
                          <Th>Actor</Th>
                          <Th>Action</Th>
                          <Th>Tenant</Th>
                          <Th>Detail</Th>
                        </tr>
                      </thead>
                      <tbody className="bg-[var(--color-surface)]">
                        {auditEvents.map((e) => (
                          <tr
                            key={e.id}
                            className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-muted)]/70"
                          >
                            <Td className="whitespace-nowrap text-[var(--color-text-muted)]">
                              {formatDateTime(e.createdAt)}
                            </Td>
                            <Td>
                              <p className="font-medium text-[var(--color-text)]">{e.actorName}</p>
                              <p className="text-[12px] text-[var(--color-text-muted)]">{e.actorEmail}</p>
                            </Td>
                            <Td>{e.action.replaceAll("_", " ")}</Td>
                            <Td className="text-[var(--color-text-muted)]">{e.tenantName || "—"}</Td>
                            <Td
                              className="max-w-xs truncate text-[12px] text-[var(--color-text-muted)]"
                              title={e.after}
                            >
                              {e.entityType} · {auditAfterPreview(e.after)}
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </DataTable>
                  )}
                </WorkspaceBody>
              </>
            )}
          </Workspace>
        )}
      </AdminShell>

      {selectedTenantId ? (
        <TenantDetailDrawer
          tenantId={selectedTenantId}
          onClose={() => setSelectedTenantId(null)}
          onChanged={() => void load()}
        />
      ) : null}

      {mustChangePassword ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/55" />
          <Panel className="relative z-10 w-full max-w-md shadow-[var(--shadow-md)]">
            <div className="border-b border-[var(--color-border)] px-5 py-4">
              <h2 className="text-[15px] font-semibold text-[var(--color-text)]">Change your password</h2>
              <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                You must set a new password before continuing.
              </p>
            </div>
            <form onSubmit={changePassword} className="space-y-3 px-5 py-4">
              {passwordError ? <Banner tone="error">{passwordError}</Banner> : null}
              <Field label="Current password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Field label="New password">
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </Field>
              <div className="flex justify-end border-t border-[var(--color-border)] pt-4">
                <Button type="submit" disabled={passwordBusy || !currentPassword || !newPassword}>
                  {passwordBusy ? "Saving…" : "Update password"}
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      ) : null}

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close create tenant dialog"
            className="absolute inset-0 bg-slate-900/45"
            onClick={() => {
              if (!busy) setShowCreate(false);
            }}
          />
          <Panel className="relative z-10 w-full max-w-lg shadow-[var(--shadow-md)]">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
              <div>
                <h2 id="create-tenant-title" className="text-[15px] font-semibold text-[var(--color-text)]">
                  Create tenant
                </h2>
                <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                  Creates the organization and emails the first Administrator an activation link. They must activate
                  from that email before they can sign in to TalentBridge.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-8 shrink-0 px-0"
                aria-label="Close"
                disabled={busy}
                onClick={() => setShowCreate(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={createTenant} className="space-y-3 px-5 py-4" aria-labelledby="create-tenant-title">
              {error ? <Banner tone="error">{error}</Banner> : null}
              <Field label="Staffing firm name">
                <Input
                  placeholder="e.g. Northstar Staffing"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Administrator name">
                  <Input
                    placeholder="Full name"
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Administrator email">
                  <Input
                    type="email"
                    placeholder="admin@yourcompany.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    required
                  />
                </Field>
              </div>
              <Banner tone="info">
                Use a business email (not Gmail, Yahoo, Outlook.com, etc.). An activation email is sent to this
                address — the Administrator cannot sign in until they activate from that link.
              </Banner>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={newJnpAllowed}
                  onChange={(e) => setNewJnpAllowed(e.target.checked)}
                />
                <span className="text-[13px] text-[var(--color-text-secondary)]">
                  Allow JobsNProfiles
                  <span className="mt-0.5 block text-[12px] text-[var(--color-text-muted)]">
                    Tenant administrators can map recruiters and pull candidates only if this is on.
                  </span>
                </span>
              </label>
              <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
                <Button type="button" variant="secondary" disabled={busy} onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={busy || !newName.trim() || !newAdminName.trim() || !newAdminEmail.trim()}
                >
                  {busy ? "Creating…" : "Create & send activation"}
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      ) : null}
    </>
  );
}
