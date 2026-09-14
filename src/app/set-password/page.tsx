"use client";

import { Suspense, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TalentBridgeMark } from "@/components/TalentBridgeMark";
import { TbLoader } from "@/components/TbLoader";

function Logo({ size = 34 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="grid place-items-center rounded-[10px] bg-slate-50 ring-1 ring-slate-200/80"
        style={{ width: size + 10, height: size + 10 }}
      >
        <TalentBridgeMark size={size} />
      </span>
      <div className="auth-display text-[1.35rem] tracking-[-0.02em] text-slate-950">TalentBridge</div>
    </div>
  );
}

function AuthCard({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell relative flex min-h-screen flex-col">
      <div className="auth-form-ambient absolute inset-0" aria-hidden />
      <div className="relative z-[1] mx-auto flex w-full max-w-[520px] flex-1 flex-col justify-center px-5 py-10 sm:px-8">
        <div className="auth-card">
          <div className="auth-card-header">
            <Logo />
          </div>
          <div className="auth-card-body">{children}</div>
        </div>
      </div>
    </main>
  );
}

function SetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not set password");
      router.replace("/login?passwordSet=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard>
      <div className="auth-kicker">
        <span className="auth-kicker-dot" aria-hidden />
        Password reset
      </div>
      <h1 className="auth-display mt-3 text-[2rem] leading-[1.15] tracking-[-0.025em] text-slate-950">
        Set your password
      </h1>
      <p className="mt-2.5 text-[14px] leading-[1.55] text-slate-500">
        This link comes from a password reset email. It can be used once.
      </p>

      {!token ? (
        <div className="auth-banner auth-banner-err mt-5" role="alert">
          This link is missing a token. Request a new password reset email.
        </div>
      ) : null}
      {error ? (
        <div className="auth-banner auth-banner-err mt-5" role="alert">
          {error}
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block">
          <span className="auth-label">New password</span>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              className="auth-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[12px] text-slate-500 hover:text-slate-800"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        <label className="block">
          <span className="auth-label">Confirm password</span>
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            className="auth-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy || !token} className="auth-primary">
          {busy ? "Saving…" : "Save password and continue"}
        </button>
      </form>
    </AuthCard>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<TbLoader variant="page" hint="Loading" />}>
      <SetPasswordForm />
    </Suspense>
  );
}
