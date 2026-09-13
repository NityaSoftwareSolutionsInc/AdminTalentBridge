"use client";

import { FormEvent, useEffect, useState } from "react";
import { Badge, Banner, Button, DataTable, EmptyState, Field, Input, Td, Th, Toolbar, Workspace, WorkspaceBody } from "@/components/ui";

type Admin = {
  id: string;
  name: string;
  email: string;
  enabled: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  failedLoginCount: number;
  lockedUntil: string | null;
  inviteSentAt: string | null;
  createdAt: string;
};

type LoginEvent = {
  id: string;
  email: string;
  success: boolean;
  reason: string;
  ip: string;
  createdAt: string;
};

function fmt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlatformAdminsView({ selfId }: { selfId: string }) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function load() {
    const res = await fetch("/api/platform-admins");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load admins");
      return;
    }
    setAdmins(data.admins || []);
    setLoginEvents(data.loginEvents || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/platform-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invite failed");
      setName("");
      setEmail("");
      setNotice(
        data.invite?.stub
          ? `Invite stubbed. Preview: ${data.invite.previewUrl || "see server log"}`
          : `Activation email sent to ${data.email}.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(admin: Admin) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform-admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: admin.id, enabled: !admin.enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function resend(adminId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId, resend: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Resend failed");
      setNotice(data.invite?.stub ? `Stubbed: ${data.invite.previewUrl}` : "Activation email resent.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resend failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Workspace>
      <Toolbar>
        <p className="text-[13px] text-[var(--color-text-secondary)]">
          Invite and manage Global Admin accounts. New admins must activate from email.
        </p>
      </Toolbar>
      <WorkspaceBody padded>
        <div className="space-y-4">
          {error ? <Banner tone="error">{error}</Banner> : null}
          {notice ? <Banner tone="success">{notice}</Banner> : null}

          <form onSubmit={invite} className="grid grid-cols-1 gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Button type="submit" disabled={busy}>
              Invite Global Admin
            </Button>
          </form>

          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            {admins.length === 0 ? (
              <EmptyState title="No platform admins" />
            ) : (
              <DataTable minWidth="860px">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                    <Th>Admin</Th>
                    <Th>Status</Th>
                    <Th>Last login</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id} className="border-b border-[var(--color-border)] last:border-b-0">
                      <Td>
                        <p className="font-medium text-[var(--color-text)]">
                          {a.name}
                          {a.id === selfId ? " (you)" : ""}
                        </p>
                        <p className="text-[12px] text-[var(--color-text-muted)]">{a.email}</p>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={a.enabled ? "green" : "slate"}>{a.enabled ? "Enabled" : "Disabled"}</Badge>
                          {a.mustChangePassword ? <Badge tone="amber">Must change password</Badge> : null}
                          {a.lockedUntil && new Date(a.lockedUntil) > new Date() ? (
                            <Badge tone="red">Locked</Badge>
                          ) : null}
                        </div>
                      </Td>
                      <Td className="text-[var(--color-text-muted)]">{fmt(a.lastLoginAt)}</Td>
                      <Td align="right">
                        <div className="flex flex-col items-end gap-2">
                          {!a.passwordChangedAt ? (
                            <Button type="button" variant="secondary" disabled={busy} onClick={() => void resend(a.id)}>
                              Resend activation
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={busy || a.id === selfId}
                            onClick={() => void toggle(a)}
                          >
                            {a.enabled ? "Disable" : "Enable"}
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </div>

          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-border)] px-5 py-3">
              <h3 className="text-[14px] font-semibold">Recent login attempts</h3>
            </div>
            {loginEvents.length === 0 ? (
              <EmptyState title="No login events yet" />
            ) : (
              <DataTable minWidth="720px">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                    <Th>When</Th>
                    <Th>Email</Th>
                    <Th>Result</Th>
                    <Th>IP</Th>
                  </tr>
                </thead>
                <tbody>
                  {loginEvents.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--color-border)] last:border-b-0">
                      <Td className="text-[var(--color-text-muted)]">{fmt(e.createdAt)}</Td>
                      <Td>{e.email}</Td>
                      <Td>
                        <Badge tone={e.success ? "green" : "red"}>
                          {e.success ? "Success" : e.reason || "Failed"}
                        </Badge>
                      </Td>
                      <Td className="text-[var(--color-text-muted)]">{e.ip || "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </div>
        </div>
      </WorkspaceBody>
    </Workspace>
  );
}
