"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  DataTable,
  EmptyState,
  Field,
  FilterChip,
  Input,
  Td,
  Th,
  Toolbar,
  Workspace,
  WorkspaceBody,
} from "@/components/ui";

type TicketRow = {
  id: string;
  tenantName: string;
  subject: string;
  category: string;
  categoryLabel: string;
  priority: "normal" | "high";
  status: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  requester: { name: string; email: string } | null;
  assignedTo: { id: string; name: string; email: string } | null;
};

type TicketDetail = TicketRow & {
  messages: Array<{
    id: string;
    authorKind: "tenant_user" | "platform_staff";
    body: string;
    createdAt: string;
    author: { name: string; email: string };
  }>;
};

const STATUSES = [
  { key: "", label: "All" },
  { key: "open", label: "Open" },
  { key: "in_progress", label: "In progress" },
  { key: "waiting_on_customer", label: "Waiting" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TicketsView({ selfId }: { selfId: string }) {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [canMutate, setCanMutate] = useState(false);
  const [status, setStatus] = useState("open");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [reply, setReply] = useState("");
  const [nextStatus, setNextStatus] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (query.trim()) params.set("q", query.trim());
    const res = await fetch(`/api/tickets?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load tickets");
      return;
    }
    setTickets(data.tickets || []);
    setOpenCount(data.openCount || 0);
    setCanMutate(Boolean(data.canMutate));
  }

  async function loadDetail(id: string) {
    const res = await fetch(`/api/tickets/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load ticket");
      return;
    }
    setDetail(data.ticket);
    setNextStatus(data.ticket.status);
    setCanMutate(Boolean(data.canMutate));
  }

  useEffect(() => {
    void load();
  }, [status]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId]);

  async function submitReply(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/tickets/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: reply,
          status: nextStatus || undefined,
          assignedToId: selfId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send reply");
      setReply("");
      setDetail(data.ticket);
      setNotice(data.mail?.stub ? "Reply saved. Email stubbed (configure SendGrid)." : "Reply sent.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Workspace>
      <Toolbar>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUSES.map((s) => (
            <FilterChip key={s.key || "all"} active={status === s.key} onClick={() => setStatus(s.key)}>
              {s.label}
            </FilterChip>
          ))}
        </div>
        <Input
          className="max-w-xs"
          placeholder="Search subject, tenant, requester…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
        />
        <p className="ml-auto text-[12px] text-[var(--color-text-muted)]">
          {openCount} open · {tickets.length} shown
        </p>
      </Toolbar>
      <WorkspaceBody padded>
        <div className="space-y-3">
          {error ? <Banner tone="error">{error}</Banner> : null}
          {notice ? <Banner tone="success">{notice}</Banner> : null}
          {!canMutate ? (
            <p className="text-[12px] text-[var(--color-text-muted)]">
              You can view tickets for tenants you created. Support and Global Admin reply and resolve.
            </p>
          ) : null}

          {tickets.length === 0 ? (
            <EmptyState title="No tickets" description="Help requests from TalentBridge appear here." />
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                <DataTable minWidth="720px">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                      <Th>Ticket</Th>
                      <Th>Tenant</Th>
                      <Th>Status</Th>
                      <Th>Updated</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr
                        key={t.id}
                        className={`cursor-pointer border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-muted)]/70 ${
                          selectedId === t.id ? "bg-blue-50/70" : ""
                        }`}
                        onClick={() => setSelectedId(t.id)}
                      >
                        <Td>
                          <p className="font-medium text-[var(--color-text)]">{t.subject}</p>
                          <p className="text-[12px] text-[var(--color-text-muted)]">
                            {t.categoryLabel}
                            {t.priority === "high" ? " · High" : ""} · {t.requester?.email || "—"}
                          </p>
                        </Td>
                        <Td className="text-[var(--color-text-muted)]">{t.tenantName}</Td>
                        <Td>
                          <Badge
                            tone={
                              t.status === "resolved" || t.status === "closed"
                                ? "green"
                                : t.status === "waiting_on_customer"
                                  ? "amber"
                                  : "blue"
                            }
                          >
                            {t.statusLabel}
                          </Badge>
                        </Td>
                        <Td className="text-[var(--color-text-muted)]">{fmt(t.updatedAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                {!detail ? (
                  <p className="text-[13px] text-[var(--color-text-muted)]">Select a ticket to view the thread.</p>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-[15px] font-semibold">{detail.subject}</h3>
                      <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                        {detail.tenantName} · {detail.requester?.name} ({detail.requester?.email})
                      </p>
                    </div>
                    <div className="max-h-[320px] space-y-2 overflow-auto">
                      {detail.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-[var(--radius-md)] px-3 py-2 text-[13px] ${
                            m.authorKind === "platform_staff"
                              ? "bg-blue-50 text-[var(--color-text)]"
                              : "bg-[var(--color-surface-muted)]"
                          }`}
                        >
                          <p className="text-[11px] font-medium text-[var(--color-text-muted)]">
                            {m.author.name} · {fmt(m.createdAt)}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                        </div>
                      ))}
                    </div>
                    {canMutate ? (
                      <form onSubmit={submitReply} className="space-y-2 border-t border-[var(--color-border)] pt-3">
                        <Field label="Status">
                          <select
                            className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px]"
                            value={nextStatus}
                            onChange={(e) => setNextStatus(e.target.value)}
                          >
                            {STATUSES.filter((s) => s.key).map((s) => (
                              <option key={s.key} value={s.key}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Reply">
                          <textarea
                            className="min-h-[88px] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-[13px]"
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            placeholder="Resolution or next step for the requester"
                          />
                        </Field>
                        <Button type="submit" disabled={busy || (!reply.trim() && nextStatus === detail.status)}>
                          Send update
                        </Button>
                      </form>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </WorkspaceBody>
    </Workspace>
  );
}
