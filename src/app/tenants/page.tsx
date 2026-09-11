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

export default function TenantsPage() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("");
  const [sendgridConfigured, setSendgridConfigured] = useState(false);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
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
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  function formatInvite(invite?: InviteResult | null) {
    if (!invite) return "";
    if (invite.sent) return `Invite sent to ${invite.email || "admin"}.`;
    if (invite.stub) {
      return `Invite stubbed (set SendGrid). Preview: ${invite.previewUrl || "(see server log)"}`;
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
      setNotice(`Created tenant “${data.tenant.name}”.`);
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
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">Admin TalentBridge</p>
            <h1 className="text-lg font-semibold">Tenants</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-300">{sessionName}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                sendgridConfigured ? "bg-teal-800 text-teal-100" : "bg-amber-800 text-amber-100"
              }`}
            >
              SendGrid {sendgridConfigured ? "ready" : "stub"}
            </span>
            <a href="/api/logout" className="text-teal-300 hover:text-white">
              Sign out
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800 break-all">{notice}</p> : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Create tenant</h2>
          <p className="mt-1 text-sm text-slate-600">Creates the org root and default tenant settings.</p>
          <form onSubmit={createTenant} className="mt-4 flex flex-wrap gap-3">
            <input
              className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-600"
              placeholder="Staffing firm name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60"
            >
              Create
            </button>
          </form>
        </section>

        <section className="space-y-4">
          {tenants.map((tenant) => {
            const form = adminForms[tenant.id] || { name: "", email: "" };
            const firstAdmin = tenant.admins[0];
            return (
              <article key={tenant.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{tenant.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {tenant.userCount} user{tenant.userCount === 1 ? "" : "s"} · created{" "}
                      {new Date(tenant.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        tenant.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {tenant.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleEnabled(tenant)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      {tenant.enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">
                  <h4 className="text-sm font-semibold text-slate-800">First tenant Administrator</h4>
                  {firstAdmin ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">
                          {firstAdmin.name} · {firstAdmin.email}
                        </p>
                        <p className="text-slate-500">
                          {firstAdmin.passwordSet
                            ? "Password set"
                            : firstAdmin.inviteSentAt
                              ? `Invite sent ${new Date(firstAdmin.inviteSentAt).toLocaleString()}`
                              : "Not invited yet"}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void resendInvite(tenant.id, firstAdmin.id)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-60"
                      >
                        Resend invite
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-600"
                        placeholder="Admin name"
                        value={form.name}
                        onChange={(e) =>
                          setAdminForms((prev) => ({
                            ...prev,
                            [tenant.id]: { ...form, name: e.target.value },
                          }))
                        }
                      />
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-teal-600"
                        placeholder="Admin email"
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setAdminForms((prev) => ({
                            ...prev,
                            [tenant.id]: { ...form, email: e.target.value },
                          }))
                        }
                      />
                      <button
                        type="button"
                        disabled={busy || !form.name.trim() || !form.email.trim()}
                        onClick={() => void createAdmin(tenant.id)}
                        className="sm:col-span-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60"
                      >
                        Create Admin & send invite
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          {tenants.length === 0 ? (
            <p className="text-sm text-slate-500">No tenants yet. Create the first staffing firm above.</p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
