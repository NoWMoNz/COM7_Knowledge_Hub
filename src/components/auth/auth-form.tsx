"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/auth/actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function Status({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />{state.error}
      </p>
    );
  if (state.success)
    return (
      <p role="status" className="flex items-start gap-2 rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5 text-sm text-brand-900">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />{state.success}
      </p>
    );
  return null;
}

function Field({ id, label, icon: Icon, error, children }: { id: string; label: string; icon: typeof Mail; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" aria-hidden />
        {children}
      </div>
      {error && <p id={`${id}-error`} role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

function EmailField({ autoFocus = false }: { autoFocus?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Field id="email" label="อีเมล / Email" icon={Mail} error={error}>
      <Input
        id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus={autoFocus}
        placeholder="name@company.com" className="pl-9" aria-invalid={error ? true : undefined} aria-describedby={error ? "email-error" : undefined}
        onBlur={(e) => setError(e.currentTarget.value && !e.currentTarget.validity.valid ? "รูปแบบอีเมลไม่ถูกต้อง / Enter a valid email address" : null)}
        onChange={() => error && setError(null)}
      />
    </Field>
  );
}

function PasswordField({ id, label, autoComplete, value, onValue, error }: {
  id: string; label: string; autoComplete: string; value?: string; onValue?: (v: string) => void; error?: string | null;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field id={id} label={label} icon={Lock} error={error}>
      <Input
        id={id} name={id} type={show ? "text" : "password"} autoComplete={autoComplete} required className="pl-9 pr-11"
        aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}
        {...(onValue ? { value, onChange: (e) => onValue(e.target.value) } : {})}
      />
      <button
        type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}
        aria-label={show ? "ซ่อนรหัสผ่าน / Hide password" : "แสดงรหัสผ่าน / Show password"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate-500 transition-colors hover:text-slate-900"
      >
        {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </Field>
  );
}

function Submit({ pending, pendingLabel, children }: { pending: boolean; pendingLabel: string; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full" aria-busy={pending}>
      {pending ? <><Loader2 className="size-4 animate-spin" aria-hidden />{pendingLabel}</> : children}
    </Button>
  );
}

const linkClass = "text-sm font-medium text-brand-700 underline-offset-4 hover:underline";

export function LoginForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <Status state={state} />
      <EmailField autoFocus />
      <div className="space-y-1.5">
        <PasswordField id="password" label="รหัสผ่าน / Password" autoComplete="current-password" />
        <div className="text-right"><Link href="/forgot-password" className={linkClass}>ลืมรหัสผ่าน? / Forgot password?</Link></div>
      </div>
      <Submit pending={pending} pendingLabel="กำลังเข้าสู่ระบบ… / Signing in…">เข้าสู่ระบบ / Login</Submit>
    </form>
  );
}

export function ForgotPasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <Status state={state} />
      <EmailField autoFocus />
      <Submit pending={pending} pendingLabel="กำลังส่ง… / Sending…">ส่งลิงก์รีเซ็ต / Send reset link</Submit>
      <div className="text-center">
        <Link href="/login" className={`${linkClass} inline-flex items-center gap-1`}><ArrowLeft className="size-3.5" aria-hidden />กลับไปหน้าเข้าสู่ระบบ / Back to login</Link>
      </div>
    </form>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 text-xs ${ok ? "text-brand-800" : "text-slate-500"}`}>
      <span className={`flex size-4 items-center justify-center rounded-full ${ok ? "bg-brand-700 text-white" : "border border-slate-300"}`}>{ok && <Check className="size-3" aria-hidden />}</span>
      {children}
    </li>
  );
}

export function ResetPasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const rulesId = useId();
  const longEnough = pw.length >= 12;
  const matches = pw.length > 0 && pw === confirm;
  const mismatch = confirm.length > 0 && pw !== confirm ? "รหัสผ่านไม่ตรงกัน / Passwords do not match" : null;
  return (
    <form action={formAction} className="space-y-4">
      <Status state={state} />
      <PasswordField id="password" label="รหัสผ่านใหม่ / New password" autoComplete="new-password" value={pw} onValue={setPw} />
      <PasswordField id="confirm" label="ยืนยันรหัสผ่าน / Confirm password" autoComplete="new-password" value={confirm} onValue={setConfirm} error={mismatch} />
      <ul id={rulesId} className="space-y-1.5" aria-label="เงื่อนไขรหัสผ่าน / Password requirements">
        <Rule ok={longEnough}>ยาวอย่างน้อย 12 ตัวอักษร / At least 12 characters</Rule>
        <Rule ok={matches}>รหัสผ่านทั้งสองช่องตรงกัน / Both entries match</Rule>
      </ul>
      <Submit pending={pending} pendingLabel="กำลังบันทึก… / Saving…">บันทึกรหัสผ่านใหม่ / Save new password</Submit>
    </form>
  );
}
