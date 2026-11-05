import { BookOpenText, Search, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const POINTS = [
  { icon: Search, text: "ค้นหาเอกสารและคู่มือของบริษัทได้ในที่เดียว / Find company documents in one place" },
  { icon: Sparkles, text: "ถามผู้ช่วย AI โดยคำตอบอ้างอิงจากเอกสารที่เผยแพร่อย่างเป็นทางการเท่านั้น / AI answers grounded only in official documents" },
  { icon: ShieldCheck, text: "เข้าถึงตามสิทธิ์ของคุณ ข้อมูลถูกป้องกันตามแผนกและบทบาท / Access follows your role and department" },
];

/** Split-screen auth layout: brand panel (large screens) + focused form card. Shared by login, forgot and reset password. */
export function AuthShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-12 text-white lg:flex">
        {/* Decorative brand diamond (echoes the COM7 mark); purely visual */}
        <svg className="pointer-events-none absolute -right-24 -top-16 size-[28rem] text-brand-500/15" viewBox="0 0 100 100" aria-hidden>
          <rect x="18" y="18" width="64" height="64" rx="10" transform="rotate(45 50 50)" fill="currentColor" />
        </svg>
        <div className="relative inline-flex w-fit rounded-lg bg-white px-4 py-3">
          <Logo height={46} priority />
        </div>
        <div className="relative max-w-md space-y-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-brand-400"><BookOpenText className="size-4" aria-hidden />Employee Knowledge Hub</div>
            <p className="text-3xl font-semibold leading-snug tracking-tight">ศูนย์ความรู้พนักงาน COM7</p>
            <p className="text-slate-300">ความรู้ที่ถูกต้อง หาง่าย และเชื่อถือได้ สำหรับการทำงานทุกวัน</p>
          </div>
          <ul className="space-y-4">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 text-sm text-slate-300">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-brand-400"><Icon className="size-4" aria-hidden /></span>
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">ระบบภายในสำหรับพนักงาน COM7 เท่านั้น / Internal system for COM7 employees</p>
      </section>

      <section className="flex flex-col items-center justify-center bg-background px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo height={44} priority /></div>
          <h1 className="sr-only">COM7 Knowledge Hub</h1>
          <div className="rounded-lg border border-border bg-card p-6 shadow-card sm:p-8">
            <div className="mb-6 space-y-1.5">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
              {description && <p className="text-sm text-slate-500">{description}</p>}
            </div>
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">ต้องการบัญชีใหม่? ติดต่อผู้ดูแลระบบหรือฝ่าย IT / Need an account? Contact your administrator.</p>
        </div>
      </section>
    </main>
  );
}
