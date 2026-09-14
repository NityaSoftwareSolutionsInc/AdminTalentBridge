"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, Link2, LifeBuoy, Mail, ShieldAlert, ShieldCheck, UserRound, Users, Activity } from "lucide-react";
import { Button, Panel, PageIntro, Workspace, WorkspaceBody } from "@/components/ui";
import { TbLoader } from "@/components/TbLoader";
import { cn } from "@/lib/cn";

export type DashboardTenant = {
  id: string;
  name: string;
  enabled: boolean;
  jnpAllowed: boolean;
  createdAt: string;
  userCount: number;
  admins: Array<{ passwordSet: boolean; inviteSentAt: string | null }>;
  activeUsers7d?: number;
  activeUsers30d?: number;
  mailboxMappedCount?: number;
  pendingInviteCount?: number;
  maintenanceMode?: boolean;
  outlookAllowed?: boolean;
  viotalkAllowed?: boolean;
};

export type DashboardAudit = {
  id: string;
  action: string;
  tenantName: string | null;
  actorName: string;
  createdAt: string;
};

const COLORS = {
  accent: "#2563eb",
  accentSoft: "#93c5fd",
  success: "#059669",
  muted: "#94a3b8",
};

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: typeof Building2;
  tone?: "blue" | "green" | "amber" | "slate";
}) {
  const toneMap = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
            {label}
          </p>
          <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-tight text-[var(--color-text)]">
            {value}
          </p>
          {hint ? <p className="mt-2 text-[12px] text-[var(--color-text-muted)]">{hint}</p> : null}
        </div>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)]", toneMap[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </Panel>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn("flex flex-col p-4", className)}>
      <div className="mb-3">
        <h3 className="text-[14px] font-semibold text-[var(--color-text)]">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[12px] text-[var(--color-text-muted)]">{subtitle}</p> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </Panel>
  );
}

function buildActivitySeries(events: DashboardAudit[], days = 14) {
  const map = new Map<string, number>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  for (const event of events) {
    const key = new Date(event.createdAt).toISOString().slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).map(([date, count]) => ({
    date,
    label: new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    count,
  }));
}

function tooltipStyle() {
  return {
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
    fontSize: 12,
  };
}

export function DashboardView({
  tenants,
  auditEvents,
  loading,
  openTicketCount = 0,
  ownedTenantCount,
  onOpenOrganizations,
  onOpenTickets,
}: {
  tenants: DashboardTenant[];
  auditEvents: DashboardAudit[];
  loading: boolean;
  openTicketCount?: number;
  ownedTenantCount?: number;
  onOpenOrganizations: () => void;
  onOpenTickets?: () => void;
}) {
  const total = tenants.length;
  const enabled = tenants.filter((t) => t.enabled).length;
  const disabled = total - enabled;
  const jnpAllowed = tenants.filter((t) => t.jnpAllowed).length;
  const users = tenants.reduce((sum, t) => sum + t.userCount, 0);
  const pendingInvites = tenants.reduce((sum, t) => {
    if (typeof t.pendingInviteCount === "number") return sum + t.pendingInviteCount;
    return sum + t.admins.filter((a) => !a.passwordSet).length;
  }, 0);
  const activeUsers7d = tenants.reduce((sum, t) => sum + (t.activeUsers7d ?? 0), 0);
  const mailboxesMapped = tenants.reduce((sum, t) => sum + (t.mailboxMappedCount ?? 0), 0);
  const maintenanceTenants = tenants.filter((t) => t.maintenanceMode).length;

  const statusData = [
    { name: "Enabled", value: enabled, color: COLORS.success },
    { name: "Disabled", value: disabled, color: COLORS.muted },
  ].filter((d) => d.value > 0);

  const jnpData = [
    { name: "JNP allowed", value: jnpAllowed, color: COLORS.accent },
    { name: "Not allowed", value: Math.max(total - jnpAllowed, 0), color: COLORS.accentSoft },
  ].filter((d) => d.value > 0);

  const usersByTenant = [...tenants]
    .sort((a, b) => b.userCount - a.userCount)
    .slice(0, 8)
    .map((t) => ({
      name: t.name.length > 16 ? `${t.name.slice(0, 14)}…` : t.name,
      fullName: t.name,
      users: t.userCount,
    }));

  const activity = buildActivitySeries(auditEvents, 14);

  if (loading) {
    return <TbLoader variant="inline" hint="Loading dashboard" className="h-full" />;
  }

  return (
    <Workspace>
      <WorkspaceBody padded>
        <div className="flex w-full flex-col gap-4">
          <PageIntro
            meta={
              <div className="flex gap-2">
                <Button variant="secondary" type="button" onClick={onOpenOrganizations}>
                  Manage organizations
                </Button>
                {onOpenTickets ? (
                  <Button variant="secondary" type="button" onClick={onOpenTickets}>
                    Tickets
                  </Button>
                ) : null}
              </div>
            }
          >
            Platform health across all TalentBridge tenants — entitlement, users, and admin activity.
          </PageIntro>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <StatCard label="Tenants" value={total} hint={`${enabled} enabled`} icon={Building2} tone="blue" />
            <StatCard label="Users" value={users} hint="Across all orgs" icon={Users} tone="slate" />
            <StatCard
              label="JNP allowed"
              value={jnpAllowed}
              hint={`${Math.max(total - jnpAllowed, 0)} not allowed`}
              icon={Link2}
              tone="blue"
            />
            <StatCard
              label="Pending invites"
              value={pendingInvites}
              hint="Admins without password"
              icon={UserRound}
              tone={pendingInvites ? "amber" : "green"}
            />
            <StatCard
              label="Open tickets"
              value={openTicketCount}
              hint="Help queue"
              icon={LifeBuoy}
              tone={openTicketCount ? "amber" : "green"}
            />
            {ownedTenantCount != null ? (
              <StatCard
                label="My tenants"
                value={ownedTenantCount}
                hint="Created by you"
                icon={Building2}
                tone="blue"
              />
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Active 7d"
              value={activeUsers7d}
              hint="Users across tenants"
              icon={Activity}
              tone="blue"
            />
            <StatCard
              label="Mailboxes mapped"
              value={mailboxesMapped}
              hint="Outlook connections"
              icon={Mail}
              tone="slate"
            />
            <StatCard
              label="Disabled"
              value={disabled}
              hint="Cannot sign in"
              icon={ShieldCheck}
              tone={disabled ? "amber" : "green"}
            />
            <StatCard
              label="Maintenance"
              value={maintenanceTenants}
              hint="Tenants in maintenance"
              icon={ShieldAlert}
              tone={maintenanceTenants ? "amber" : "green"}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <ChartCard
              title="Admin activity"
              subtitle="Platform audit events · last 14 days"
              className="min-h-[280px] xl:col-span-7"
            >
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activity} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={tooltipStyle()} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="Events"
                      stroke={COLORS.accent}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: COLORS.accent }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Tenant status" subtitle="Enabled vs disabled" className="min-h-[280px] xl:col-span-5">
              <div className="h-[240px] w-full">
                {statusData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-text-muted)]">
                    No tenants yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={2}>
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle()} />
                      <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>

            <ChartCard
              title="Users by organization"
              subtitle="Top tenants by user count"
              className="min-h-[300px] xl:col-span-7"
            >
              <div className="h-[250px] w-full">
                {usersByTenant.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-text-muted)]">
                    No user data yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usersByTenant} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip
                        contentStyle={tooltipStyle()}
                        formatter={(value) => [value as number, "Users"]}
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload as { fullName?: string } | undefined;
                          return row?.fullName || "";
                        }}
                      />
                      <Bar dataKey="users" name="Users" fill={COLORS.accent} radius={[4, 4, 0, 0]} maxBarSize={42} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>

            <ChartCard
              title="JobsNProfiles entitlement"
              subtitle="Allowed vs restricted"
              className="min-h-[300px] xl:col-span-5"
            >
              <div className="h-[250px] w-full">
                {jnpData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-text-muted)]">
                    No tenants yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={jnpData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={2}>
                        {jnpData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle()} />
                      <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>
          </div>
        </div>
      </WorkspaceBody>
    </Workspace>
  );
}
