"use client";

import { FormEvent, Suspense, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TalentBridgeMark } from "@/components/TalentBridgeMark";

function Logo({
  theme = "light",
  product = "Platform Admin",
  size = 34,
}: {
  theme?: "light" | "dark";
  product?: string | null;
  size?: number;
}) {
  const dark = theme === "dark";
  return (
    <div className="flex items-center gap-3">
      <span
        className={
          dark
            ? "grid place-items-center rounded-[10px] bg-white/8 ring-1 ring-white/15"
            : "grid place-items-center rounded-[10px] bg-slate-50 ring-1 ring-slate-200/80"
        }
        style={{ width: size + 10, height: size + 10 }}
      >
        <TalentBridgeMark size={size} />
      </span>
      <div className="leading-tight">
        <div className={dark ? "auth-display text-[1.35rem] tracking-[-0.02em] text-white" : "auth-display text-[1.35rem] tracking-[-0.02em] text-slate-950"}>
          TalentBridge
        </div>
        {product ? (
          <div
            className={
              dark
                ? "mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-sky-200/80"
                : "mt-0.5 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500"
            }
          >
            {product}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AuthShell({
  children,
  headerLabel = "Platform access",
}: {
  children: ReactNode;
  headerLabel?: string;
}) {
  return (
    <main className="auth-shell relative min-h-screen lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(520px,0.95fr)]">
      <aside className="auth-brand relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16 xl:py-14">
        <div className="auth-brand-grid absolute inset-0" aria-hidden />
        <div className="relative z-[1]">
          <Logo theme="dark" size={40} />
        </div>
        <div className="relative z-[1] max-w-[34rem]">
          <p className="auth-display text-[2.35rem] leading-[1.12] tracking-[-0.02em] text-white xl:text-[2.75rem]">
            Govern every TalentBridge tenant from one console
          </p>
          <p className="mt-5 max-w-[30rem] text-[15px] leading-6 text-slate-300">
            Create organizations, enable JobsNProfiles entitlement, and invite the first Administrator — without entering a tenant workspace.
          </p>
          <ul className="mt-10 space-y-5 text-[13px]">
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-[1px] bg-sky-400" />
              <div>
                <div className="font-semibold text-white">Platform tenancy</div>
                <p className="mt-1 leading-5 text-slate-400">Enable or disable a firm. Disabled tenants cannot sign in to TalentBridge.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-[1px] bg-sky-400" />
              <div>
                <div className="font-semibold text-white">First-admin invite</div>
                <p className="mt-1 leading-5 text-slate-400">SendGrid invitation opens TalentBridge set-password — not this admin app.</p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-[1px] bg-sky-400" />
              <div>
                <div className="font-semibold text-white">Audited actions</div>
                <p className="mt-1 leading-5 text-slate-400">Tenant create, enable/disable and invites are recorded for platform review.</p>
              </div>
            </li>
          </ul>
        </div>
        <footer className="relative z-[1] border-t border-white/10 pt-6 text-[12px] text-slate-500">
          Global Admin only · Separate from tenant Administrator roles
        </footer>
      </aside>

      <section className="auth-form-pane relative flex min-h-screen flex-col">
        <div className="auth-form-ambient absolute inset-0" aria-hidden />
        <header className="relative z-[1] flex items-center justify-between px-6 py-5 sm:px-10 lg:px-12">
          <div className="lg:hidden">
            <Logo theme="light" size={32} />
          </div>
          <div className="hidden lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{headerLabel}</p>
          </div>
          <div className="auth-trust-chip">
            <span className="inline-block h-2 w-2 rounded-[1px] bg-blue-600" aria-hidden />
            <span>Encrypted session</span>
          </div>
        </header>

        <div className="relative z-[1] mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-5 py-6 sm:px-8">
          <div className="auth-card">
            <div className="auth-card-header">
              <Logo theme="light" size={34} product={null} />
            </div>
            <div className="auth-card-body">{children}</div>
          </div>
        </div>

        <footer className="relative z-[1] border-t border-slate-200/80 px-6 py-4 sm:px-10 lg:px-12">
          <div className="mx-auto flex max-w-[520px] flex-col gap-1 text-[11px] leading-4 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Platform console for Global Admins</span>
            <span className="text-slate-400">Unauthorized access is prohibited</span>
          </div>
        </footer>
      </section>
    </main>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("global.admin@talentbridge.example");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const passwordSet = params.get("passwordSet") === "1";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign-in failed");
        return;
      }
      router.replace("/tenants");
    } catch {
      setError("Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setNotice(data.message || "If that email is a Global Admin account, a reset link has been sent.");
      setMode("signin");
    } catch {
      setError("Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="mb-7">
        <div className="auth-kicker">
          <span className="auth-kicker-dot" aria-hidden />
          {mode === "forgot" ? "Account recovery" : "Organization sign-in"}
        </div>
        <h1 className="auth-display mt-3 text-[2rem] leading-[1.15] tracking-[-0.025em] text-slate-950">
          {mode === "forgot" ? "Reset password" : "Sign in"}
        </h1>
        <p className="mt-2.5 text-[14px] leading-[1.55] text-slate-500">
          {mode === "forgot"
            ? "Enter the Global Admin email. If it matches an account, we will send a reset link."
            : "Platform credentials only. Tenant users sign in on TalentBridge Contact Manager."}
        </p>
      </div>

      {passwordSet ? (
        <div className="auth-banner auth-banner-ok mb-5" role="status">
          Password saved. Sign in with your email and password.
        </div>
      ) : null}
      {notice ? (
        <div className="auth-banner auth-banner-ok mb-5" role="status">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="auth-banner auth-banner-err mb-5" role="alert">
          {error}
        </div>
      ) : null}

      {mode === "signin" ? (
        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block">
            <span className="auth-label">Work email</span>
            <input
              type="email"
              required
              autoComplete="username"
              className="auth-input auth-input-plain"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="auth-label auth-label-inline">Password</span>
              <button
                type="button"
                className="auth-text-link"
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                  setNotice(null);
                }}
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                className="auth-input auth-input-plain auth-input-trailing"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="auth-field-action"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <button type="submit" disabled={busy} className="auth-primary">
            {busy ? "Signing in…" : "Continue"}
          </button>
        </form>
      ) : (
        <form onSubmit={onForgot} className="space-y-5">
          <label className="block">
            <span className="auth-label">Work email</span>
            <input
              type="email"
              required
              autoComplete="username"
              className="auth-input auth-input-plain"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy} className="auth-primary">
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <button
            type="button"
            className="auth-secondary"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
          >
            Back to sign in
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#0b1f3a]" />}>
      <LoginForm />
    </Suspense>
  );
}
