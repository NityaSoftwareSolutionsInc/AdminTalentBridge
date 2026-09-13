"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  Badge,
  DataTable,
  EmptyState,
  FilterChip,
  Input,
  Td,
  Th,
  Toolbar,
  Workspace,
  WorkspaceBody,
} from "@/components/ui";

type Log = {
  id: string;
  kind: string;
  toEmail: string;
  subject: string;
  status: string;
  error: string;
  tenantName: string | null;
  previewUrl: string;
  createdAt: string;
};

export function EmailLogsView() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(next?: { q?: string; status?: string }) {
    setLoading(true);
    const params = new URLSearchParams();
    const query = next?.q ?? q;
    const st = next?.status ?? status;
    if (query) params.set("q", query);
    if (st) params.set("status", st);
    const res = await fetch(`/api/email-logs?${params}`);
    const data = await res.json();
    setLogs(data.logs || []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Workspace>
      <Toolbar>
        <div className="relative max-w-md min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <Input
            className="pl-8"
            placeholder="Search email or subject…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load({ q });
            }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["", "All"],
            ["sent", "Sent"],
            ["stubbed", "Stubbed"],
            ["failed", "Failed"],
          ].map(([value, label]) => (
            <FilterChip
              key={value || "all"}
              active={status === value}
              onClick={() => {
                setStatus(value);
                void load({ status: value });
              }}
            >
              {label}
            </FilterChip>
          ))}
        </div>
      </Toolbar>
      <WorkspaceBody>
        {loading ? (
          <div className="px-6 py-16 text-center text-[13px] text-[var(--color-text-muted)]">Loading…</div>
        ) : logs.length === 0 ? (
          <EmptyState title="No email delivery logs yet" />
        ) : (
          <DataTable minWidth="960px">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                <Th>When</Th>
                <Th>Status</Th>
                <Th>Kind</Th>
                <Th>To</Th>
                <Th>Subject</Th>
                <Th>Tenant</Th>
              </tr>
            </thead>
            <tbody className="bg-[var(--color-surface)]">
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <Td className="whitespace-nowrap text-[var(--color-text-muted)]">
                    {new Date(log.createdAt).toLocaleString()}
                  </Td>
                  <Td>
                    <Badge
                      tone={log.status === "sent" ? "green" : log.status === "failed" ? "red" : "amber"}
                    >
                      {log.status}
                    </Badge>
                  </Td>
                  <Td>{log.kind.replaceAll("_", " ")}</Td>
                  <Td>{log.toEmail}</Td>
                  <Td>
                    <p>{log.subject}</p>
                    {log.error ? <p className="text-[12px] text-red-600">{log.error}</p> : null}
                    {log.previewUrl ? (
                      <a className="text-[12px] text-blue-700 underline" href={log.previewUrl} target="_blank" rel="noreferrer">
                        Preview link
                      </a>
                    ) : null}
                  </Td>
                  <Td className="text-[var(--color-text-muted)]">{log.tenantName || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </WorkspaceBody>
    </Workspace>
  );
}
