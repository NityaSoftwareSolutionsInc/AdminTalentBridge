"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("global.admin@talentbridge.example");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
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

  return (
    <main className="min-h-screen bg-[#0b1f3a] text-white flex items-center justify-center p-8">
      <div className="w-full max-w-xl rounded-2xl bg-white text-slate-900 p-8 shadow-2xl">
        <p className="text-sm uppercase tracking-wide text-blue-700 font-semibold">TalentBridge Admin</p>
        <h1 className="mt-1 text-2xl font-semibold">Global Admin sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Platform credentials only. Create tenants and invite the first Administrator for each staffing firm.
        </p>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-1">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full h-10 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
