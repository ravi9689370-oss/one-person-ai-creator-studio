"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [state, setState] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (state.name.trim().length < 1) errs.name = "Name is required.";
    if (!/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(state.email.trim())) errs.email = "Enter a valid email address.";
    if (state.password.length < 8) errs.password = "Password must be at least 8 characters.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    setBusy(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setFormError(body?.error?.message ?? "Registration failed. Try again.");
      setBusy(false);
      return;
    }
    const signing = await signIn("credentials", { email: state.email, password: state.password, redirect: false });
    if (signing?.error) {
      setFormError("Account created, but sign-in failed. Please sign in manually.");
      setBusy(false);
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 text-slate-900 shadow-pop dark:bg-[#111830] dark:text-slate-100">
      <header>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">You will set up your studio workspace next.</p>
      </header>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" id="name" value={state.name} onChange={(v) => setState({ ...state, name: v })} error={errors.name} autoComplete="name" />
        <Field label="Email" id="email" type="email" value={state.email} onChange={(v) => setState({ ...state, email: v })} error={errors.email} autoComplete="email" />
        <Field label="Password" id="password" type="password" value={state.password} onChange={(v) => setState({ ...state, password: v })} error={errors.password} autoComplete="new-password" hint="Minimum 8 characters." />
        {formError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{formError}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="text-center text-sm">
          Already registered? <Link href="/login" className="text-indigo-700 hover:underline dark:text-indigo-400">Sign in</Link>
        </p>
      </form>
    </div>
  );
}

function Field(props: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  error?: string;
  hint?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {props.label}
      </label>
      <input
        id={props.id}
        name={props.id}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        required={props.required ?? true}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:bg-[#0b1020] ${
          props.error ? "border-rose-400" : "border-slate-300 dark:border-[#2c3560]"
        }`}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.error && <p className="mt-1 text-xs text-rose-600">{props.error}</p>}
      {props.hint && !props.error && <p className="mt-1 text-xs text-slate-500">{props.hint}</p>}
    </div>
  );
}
