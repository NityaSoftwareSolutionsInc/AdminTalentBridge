"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Badge, Banner, Button, Field, Input, Panel } from "@/components/ui";

export type TenantDetail = {
  id: string;
  name: string;
  enabled: boolean;
  jnpAllowed: boolean;
  outlookAllowed: boolean;
  viotalkAllowed: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  legalName: string;
  billingContact: string;
  region: string;
  notes: string;
  accountOwner: string;
  createdAt: string;
  createdBy?: { id: string; name: string; email: string } | null;
  canMutate?: boolean;
  canSupportAccess?: boolean;
  userCount: number;
  mailboxMappedCount: number;
  activeUsers7d: number;
  activeUsers30d: number;
  lastUserLoginAt: string | null;
  lastPlatformAuditAt: string | null;
  lastPlatformAuditAction: string | null;
  pendingInviteCount: number;
  invitePendingAgingDays: number | null;
  admins: Array<{
    id: string;
    name: string;
    email: string;
    inviteSentAt: string | null;
    passwordSet: boolean;
    lastLoginAt: string | null;
  }>;
  recentAudit?: Array<{ id: string; action: string; createdAt: string }>;
};

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TenantDetailDrawer({
  tenantId,
  onClose,
  onChanged,
}: {
  tenantId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    legalName: "",
    billingContact: "",
    region: "",
    notes: "",
    accountOwner: "",
    maintenanceMessage: "",
  });

  async function load() {
    const res = await fetch(`/api/tenants/${tenantId}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load tenant");
      return;
    }
    setTenant(data.tenant);
    setForm({
      legalName: data.tenant.legalName || "",
      billingContact: data.tenant.billingContact || "",
      region: data.tenant.region || "",
      notes: data.tenant.notes || "",
      accountOwner: data.tenant.accountOwner || "",
      maintenanceMessage: data.tenant.maintenanceMessage || "",
    });
  }

  useEffect(() => {
    void load();
  }, [tenantId]);

  async function patch(body: Record<string, unknown>, okMessage: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      setNotice(okMessage);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function openSupport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tenants/support-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open support access");
      window.open(data.url, "_blank", "noopener,noreferrer");
      setNotice(`Support access opened for ${data.user.email} (30 min, read-only).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Support access failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <Panel className="relative z-10 flex h-full w-full max-w-xl flex-col rounded-none border-y-0 border-r-0 shadow-[var(--shadow-md)]">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              Tenant detail
            </p>
            <h2 className="mt-1 text-[16px] font-semibold text-[var(--color-text)]">{tenant?.name || "…"}</h2>
          </div>
          <Button type="button" variant="ghost" className="h-8 w-8 px-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
          {error ? <Banner tone="error">{error}</Banner> : null}
          {notice ? <Banner tone="success">{notice}</Banner> : null}
          {!tenant ? (
            <p className="text-[13px] text-[var(--color-text-muted)]">Loading…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone={tenant.enabled ? "green" : "slate"}>{tenant.enabled ? "Enabled" : "Disabled"}</Badge>
                <Badge tone={tenant.jnpAllowed ? "green" : "slate"}>
                  JNP {tenant.jnpAllowed ? "on" : "off"}
                </Badge>
                <Badge tone={tenant.outlookAllowed ? "green" : "slate"}>
                  Outlook {tenant.outlookAllowed ? "on" : "off"}
                </Badge>
                <Badge tone={tenant.viotalkAllowed ? "green" : "slate"}>
                  VioTalk {tenant.viotalkAllowed ? "on" : "off"}
                </Badge>
                {tenant.maintenanceMode ? <Badge tone="amber">Maintenance</Badge> : null}
              </div>

              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Users</p>
                  <p className="mt-1 text-[18px] font-semibold">{tenant.userCount}</p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    Active {tenant.activeUsers7d}/7d · {tenant.activeUsers30d}/30d
                  </p>
                </div>
                <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-3">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">Created by</p>
                  <p className="mt-1 text-[13px] font-medium">{tenant.createdBy?.name || "—"}</p>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                    {tenant.createdBy?.email || "Unknown creator"} · {fmt(tenant.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {tenant.canSupportAccess ? (
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => void openSupport()}>
                    <ExternalLink className="h-4 w-4" />
                    Open as support
                  </Button>
                ) : null}
                {tenant.canMutate ? (
                  <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void patch({ enabled: !tenant.enabled }, tenant.enabled ? "Tenant disabled." : "Tenant enabled.")
                  }
                >
                  {tenant.enabled ? "Disable" : "Enable"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void patch(
                      {
                        maintenanceMode: !tenant.maintenanceMode,
                        maintenanceMessage:
                          form.maintenanceMessage ||
                          "This organization is temporarily unavailable for maintenance.",
                      },
                      tenant.maintenanceMode ? "Maintenance cleared." : "Maintenance mode on.",
                    )
                  }
                >
                  {tenant.maintenanceMode ? "Clear maintenance" : "Maintenance mode"}
                </Button>
                  </>
                ) : (
                  <p className="text-[12px] text-[var(--color-text-muted)]">
                    View only. Managers can change tenants they created.
                  </p>
                )}
              </div>

              <section className="space-y-3">
                <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Entitlements</h3>
                {(
                  [
                    ["jnpAllowed", "JobsNProfiles", tenant.jnpAllowed],
                    ["outlookAllowed", "Outlook", tenant.outlookAllowed],
                    ["viotalkAllowed", "VioTalk", tenant.viotalkAllowed],
                  ] as const
                ).map(([key, label, value]) => (
                  <label key={key} className="flex items-center justify-between gap-3 text-[13px]">
                    <span>{label}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-w-[88px]"
                      disabled={busy || !tenant.canMutate}
                      onClick={() => void patch({ [key]: !value }, `${label} ${value ? "revoked" : "allowed"}.`)}
                    >
                      {value ? "On" : "Off"}
                    </Button>
                  </label>
                ))}
              </section>

              <section className="space-y-3">
                <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Metadata</h3>
                <Field label="Legal name">
                  <Input value={form.legalName} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} />
                </Field>
                <Field label="Billing contact">
                  <Input
                    value={form.billingContact}
                    onChange={(e) => setForm((f) => ({ ...f, billingContact: e.target.value }))}
                  />
                </Field>
                <Field label="Region">
                  <Input value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} />
                </Field>
                <Field label="Internal account owner">
                  <Input
                    value={form.accountOwner}
                    onChange={(e) => setForm((f) => ({ ...f, accountOwner: e.target.value }))}
                  />
                </Field>
                <Field label="Notes">
                  <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </Field>
                <Field label="Maintenance message">
                  <Input
                    value={form.maintenanceMessage}
                    onChange={(e) => setForm((f) => ({ ...f, maintenanceMessage: e.target.value }))}
                    placeholder="Shown on TalentBridge login during maintenance"
                  />
                </Field>
                <Button
                  type="button"
                  disabled={busy || !tenant.canMutate}
                  onClick={() =>
                    void patch(
                      {
                        legalName: form.legalName,
                        billingContact: form.billingContact,
                        region: form.region,
                        notes: form.notes,
                        accountOwner: form.accountOwner,
                        maintenanceMessage: form.maintenanceMessage,
                      },
                      "Tenant metadata saved.",
                    )
                  }
                >
                  Save metadata
                </Button>
              </section>

              <section>
                <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Administrators</h3>
                <div className="mt-2 space-y-2">
                  {tenant.admins.map((a) => (
                    <div key={a.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2">
                      <p className="text-[13px] font-medium">{a.name}</p>
                      <p className="text-[12px] text-[var(--color-text-muted)]">{a.email}</p>
                      <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                        {a.passwordSet ? "Activated" : "Activation pending"} · Last login {fmt(a.lastLoginAt)}
                      </p>
                    </div>
                  ))}
                </div>
                {tenant.pendingInviteCount ? (
                  <p className="mt-2 text-[12px] text-amber-800">
                    {tenant.pendingInviteCount} pending invite
                    {tenant.invitePendingAgingDays != null ? ` · aging ${tenant.invitePendingAgingDays}d` : ""}
                  </p>
                ) : null}
              </section>

              <section>
                <h3 className="text-[13px] font-semibold text-[var(--color-text)]">Recent platform audit</h3>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  Last action: {tenant.lastPlatformAuditAction || "—"} · {fmt(tenant.lastPlatformAuditAt)}
                </p>
                <ul className="mt-2 space-y-1 text-[12px] text-[var(--color-text-secondary)]">
                  {(tenant.recentAudit || []).slice(0, 8).map((e) => (
                    <li key={e.id}>
                      {fmt(e.createdAt)} — {e.action.replaceAll("_", " ")}
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}
