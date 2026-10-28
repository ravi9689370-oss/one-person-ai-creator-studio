"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

/**
 * Generic JSON form poster. Posts the current field map to `endpoint`,
 * surfaces field/validation errors, disables during submit, and refreshes the
 * server component tree on success. Used by every module's create forms.
 */
export function InlineForm({
  endpoint,
  method = "POST",
  fields,
  submitLabel,
  extra,
  onDone,
  successMessage,
  className,
  columnsMode = "stack",
  children,
}: {
  endpoint: string;
  method?: "POST" | "PATCH" | "PUT";
  fields: FormField[];
  submitLabel: string;
  extra?: Record<string, unknown>;
  onDone?: () => void;
  successMessage?: string;
  className?: string;
  columnsMode?: "stack" | "inline";
  children?: ReactNode;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOkMsg(null);
    const res = await fetch(endpoint, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, ...(extra ?? {}) }),
    });
    setBusy(false);
    if (!res.ok) {
      let msg = `Request failed (${res.status}).`;
      const body = (await res.json().catch(() => null)) as { error?: { message?: string; issues?: { path: string; message: string }[] } } | null;
      if (body?.error?.message) msg = body.error.message;
      if (body?.error?.issues?.length) {
        msg = body.error.issues.map((i) => `${i.path || "field"}: ${i.message}`).join("; ");
      }
      setError(msg);
      return;
    }
    setOkMsg(successMessage ?? "Saved.");
    setValues(Object.fromEntries(fields.map((f) => [f.name, f.resetAfter !== false ? "" : f.defaultValue ?? ""])));
    router.refresh();
    onDone?.();
  }

  return (
    <form onSubmit={submit} className={columnsMode === "inline" ? "flex flex-wrap items-end gap-2" : "space-y-3 " + (className ?? "")}>
      {fields.map((f) => (
        <FieldInput
          key={f.name}
          field={f}
          value={values[f.name] ?? ""}
          onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
        />
      ))}
      {children}
      <button
        type="submit"
        disabled={busy}
        className={`${columnsMode === "inline" ? "shrink-0" : "w-full"} rounded-lg bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60`}
      >
        {busy ? "Working…" : submitLabel}
      </button>
      {error && (
        <p role="alert" className="w-full rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}
      {okMsg && <p className="w-full text-xs text-emerald-700 dark:text-emerald-300">{okMsg}</p>}
    </form>
  );
}

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select" | "date" | "datetime-local" | "number" | "url";
  options?: { value: string; label: string }[];
  placeholder?: string;
  defaultValue?: string;
  resetAfter?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
};

function FieldInput({ field, value, onChange }: { field: FormField; value: string; onChange: (v: string) => void }) {
  const base =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-[#2c3560] dark:bg-[#0b1020]";
  return (
    <div className={columnsClass(field.type)}>
      <label htmlFor={`if-${field.name}`} className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
        {field.label}
      </label>
      {field.type === "textarea" ? (
        <textarea
          id={`if-${field.name}`}
          required={field.required}
          rows={field.min ?? 5}
          placeholder={field.placeholder}
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === "select" ? (
        <select id={`if-${field.name}`} required={field.required} className={base} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={`if-${field.name}`}
          type={field.type ?? "text"}
          required={field.required}
          placeholder={field.placeholder}
          className={base}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function columnsClass(_type?: string): string {
  return "";
}
