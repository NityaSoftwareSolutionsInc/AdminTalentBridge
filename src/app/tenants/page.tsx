"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  createdAt: string;
  userCount: number;
  admins: AdminRow[];
};

type InviteResult = {
  sent: boolean;
  stub: boolean;
  previewUrl?: string;
  email?: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "red";
}) {
  const map = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    amber: "bg-amber-50 text-amber-800 ring-amber-100",
    red: "bg-red-50 text-red-700 ring-red-100",
  };
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", map[tone])}>
      {children}
    </span>
  );
}

export default function TenantsPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [sendgridConfigured, setSendgridConfigured] = useState(false);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [adminForms, setAdminForms] = useState<Record<string, { name: string; email: string }>>({});

  const load = useCallback(async () => {
    const [sessionRes, tenantsRes] = await Promise.all([fetch("/api/session"), fetch("/api/tenants")]);
    if (sessionRes.status === 401) {
      router.replace("/login");
      return;
    }
    const sessionData = await sessionRes.json();
    const tenantsData = await tenantsRes.json();
    setSessionName(sessionData.session?.name || "");
    setSendgridConfigured(Boolean(sessionData.sendgridConfigured));
    setTenants(tenantsData.tenants || []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  function formatInvite(invite?: InviteResult | null) {
    if (!invite) return "";
    if (invite.sent) return `Invite sent to ${invite.email || "admin"}.`;
    if (invite.stub) {
      return `Invite stubbed (configure SendGrid). Preview link is in the server log${
        invite.previewUrl ? `: ${invite.previewUrl}` : ""
      }.`;
    }
    return "Invite was not sent.";
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
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create tenant");
        return;
      }
      setNewName("");
      setNotice(`Created tenant “${data.tenant.name}”. Invite the first Administrator below.`);
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

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-slate-200 bg-[var(--color-sidebar)] text-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-300">TalentBridge Admin</p>
            <h1 className="truncate text-[15px] font-semibold">Tenant management</h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Badge tone={sendgridConfigured ? "green" : "amber"}>
              {sendgridConfigured ? "SendGrid ready" : "SendGrid stub"}
            </Badge>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-white">{sessionName || "—"}</p>
              <p className="text-[11px] text-slate-400">Global Admin</p>
            </div>
            <a
              href="/api/logout"
              className="rounded-md px-2.5 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Sign out
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-6 py-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Platform</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Organizations</h2>
            <p className="mt-1 text-sm text-slate-600">
              Create tenants, enable or disable access, and invite the first Administrator.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            {loading ? "Loading…" : `${tenants.length} tenant${tenants.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        {notice ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 break-all">
            {notice}
          </p>
        ) : null}

        <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <h3 className="text-[15px] font-semibold text-slate-900">Create tenant</h3>
          <p className="mt-1 text-sm text-slate-600">Adds the org root and default TalentBridge settings.</p>
          <form
            onSubmit={createTenant}
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
          >
            <label className="block min-w-0">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Staffing firm name
              </span>
              <input
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                placeholder="e.g. Northstar Staffing"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
            </label>
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 sm:min-w-[120px]"
            >
              Create
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">Loading tenants…</div>
          ) : tenants.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-800">No tenants yet</p>
              <p className="mt-1 text-sm text-slate-500">Create the first staffing firm to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Tenant
                    </th>
                    <th className="w-20 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Users
                    </th>
                    <th className="w-28 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Status
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Administrator
                    </th>
                    <th className="w-32 px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => {
                    const form = adminForms[tenant.id] || { name: "", email: "" };
                    const firstAdmin = tenant.admins[0];
                    return (
                      <tr key={tenant.id} className="border-b border-slate-100 last:border-b-0 align-top">
                        <td className="px-5 py-4">
                          <p className="text-[13px] font-medium text-slate-900">{tenant.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">Created {formatDate(tenant.createdAt)}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm tabular-nums text-slate-800">{tenant.userCount}</span>
                        </td>
                        <td className="px-5 py-4">
                          <Badge tone={tenant.enabled ? "green" : "slate"}>
                            {tenant.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          {firstAdmin ? (
                            <div className="flex flex-wrap items-end justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[13px] font-medium text-slate-900">{firstAdmin.name}</p>
                                <p className="truncate text-xs text-slate-500">{firstAdmin.email}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {firstAdmin.passwordSet
                                    ? "Password set"
                                    : firstAdmin.inviteSentAt
                                      ? `Invited ${formatDate(firstAdmin.inviteSentAt)}`
                                      : "Not invited"}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void resendInvite(tenant.id, firstAdmin.id)}
                                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:border-blue-600 hover:bg-blue-50 disabled:opacity-40"
                              >
                                Resend invite
                              </button>
                            </div>
                          ) : (
                            <div>
                              <p className="mb-2 text-sm text-slate-500">No administrator yet</p>
                              <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                                <label className="block min-w-0">
                                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                    Name
                                  </span>
                                  <input
                                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                    placeholder="Full name"
                                    value={form.name}
                                    onChange={(e) =>
                                      setAdminForms((prev) => ({
                                        ...prev,
                                        [tenant.id]: { ...form, name: e.target.value },
                                      }))
                                    }
                                  />
                                </label>
                                <label className="block min-w-0">
                                  <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                                    Email
                                  </span>
                                  <input
                                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                    placeholder="admin@firm.com"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) =>
                                      setAdminForms((prev) => ({
                                        ...prev,
                                        [tenant.id]: { ...form, email: e.target.value },
                                      }))
                                    }
                                  />
                                </label>
                                <button
                                  type="button"
                                  disabled={busy || !form.name.trim() || !form.email.trim()}
                                  onClick={() => void createAdmin(tenant.id)}
                                  className="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                                >
                                  Invite
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void toggleEnabled(tenant)}
                            className="h-9 min-w-[96px] rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 hover:border-blue-600 hover:bg-blue-50 disabled:opacity-40"
                          >
                            {tenant.enabled ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
