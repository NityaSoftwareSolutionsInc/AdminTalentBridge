import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const controlInputClass =
  "h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus-ring)]";

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-[var(--color-text)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageIntro({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="max-w-3xl text-[13px] text-[var(--color-text-secondary)]">{children}</div>
      {meta ? <div className="text-[12px] text-[var(--color-text-muted)]">{meta}</div> : null}
    </div>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlInputClass, className)} {...props} />;
}

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
  className?: string;
}) {
  const map = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-100",
    amber: "bg-amber-50 text-amber-800 ring-amber-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    blue: "bg-blue-50 text-blue-800 ring-blue-100",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        map[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost";
type BtnSize = "md" | "sm";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  const styles: Record<BtnVariant, string> = {
    primary:
      "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-40",
    secondary:
      "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-focus)] hover:bg-blue-50 disabled:opacity-40",
    ghost:
      "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] disabled:opacity-40",
  };
  const sizes: Record<BtnSize, string> = {
    md: "h-9 px-3.5 text-[13px]",
    sm: "h-8 px-2.5 text-[12px]",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] font-medium",
        styles[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-[var(--radius-md)] px-2.5 text-[12px] font-medium",
        active
          ? "bg-[var(--color-accent)] text-white"
          : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)] hover:bg-slate-200/70",
      )}
    >
      {children}
    </button>
  );
}

export function Banner({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  const map = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-blue-100 bg-blue-50 text-blue-900",
  };
  return (
    <p className={cn("rounded-[var(--radius-md)] border px-3 py-2 text-[13px] leading-5", map[tone])}>
      {children}
    </p>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-[13px] font-medium text-[var(--color-text)]">{title}</p>
      {description ? <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function DataTable({ children, minWidth = "900px" }: { children: ReactNode; minWidth?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className, align = "left" }: { children: ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <th
      className={cn(
        "px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  title,
}: {
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
  title?: string;
}) {
  return (
    <td
      title={title}
      className={cn(
        "px-5 py-3.5 align-middle text-[var(--color-text-secondary)]",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-5">
      {children}
    </div>
  );
}

export function Workspace({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex h-full min-h-0 flex-col", className)}>{children}</div>;
}

export function WorkspaceBody({ children, padded = false }: { children: ReactNode; padded?: boolean }) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-auto bg-[var(--color-canvas)]",
        padded && "p-4 sm:p-5",
      )}
    >
      {children}
    </div>
  );
}
