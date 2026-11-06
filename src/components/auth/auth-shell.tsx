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
    <main className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="bg-brand-mesh relative isolate hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-16">
        <div aria-hidden className="bg-grid-faint pointer-events-none absolute inset-0 -z-10 opacity-70" />
        {/* Decorative brand diamonds (echo the COM7 mark); purely visual */}
        <svg className="pointer-events-none absolute -right-32 top-1/4 -z-10 size-[34rem] text-brand-400/20" viewBox="0 0 100 100" aria-hidden>
          <rect x="18" y="18" width="64" height="64" rx="12" transform="rotate(45 50 50)" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <rect x="30" y="30" width="40" height="40" rx="8" transform="rotate(45 50 50)" fill="currentColor" opacity="0.45" />
        </svg>
        <div className="relative inline-flex w-fit rounded-2xl bg-white px-4 py-3 shadow-pop">
          <Logo height={42} priority />
        </div>
        <div className="relative max-w-lg space-y-10">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-200 ring-1 ring-white/15">
              <BookOpenText className="size-3.5" aria-hidden />Employee Knowledge Hub
            </span>
            <p className="text-[2.5rem] font-semibold leading-[1.15] tracking-tight">
              ศูนย์ความรู้พนักงาน<br /><span className="text-gradient-brand">COM7</span>
            </p>
            <p className="text-base text-white/70">ความรู้ที่ถูกต้อง หาง่าย และเชื่อถือได้ สำหรับการทำงานทุกวัน</p>
          </div>
          <ul className="space-y-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3 rounded-2xl bg-white/[0.06] p-3.5 text-sm text-white/80 ring-1 ring-white/10 backdrop-blur">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-glow"><Icon className="size-4" aria-hidden /></span>
                <span className="self-center">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">ระบบภายในสำหรับพนักงาน COM7 เท่านั้น / Internal system for COM7 employees</p>
      </section>

      <section className="bg-canvas flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="rise-in w-full max-w-[26rem]">
          <div className="mb-8 lg:hidden"><Logo height={44} priority /></div>
          <h1 className="sr-only">COM7 Knowledge Hub</h1>
          <div className="mb-7 space-y-2">
            <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900">{title}</h2>
            {description && <p className="text-[0.9375rem] text-slate-500">{description}</p>}
          </div>
          <div className="rounded-3xl border border-slate-200/80 bg-card p-6 shadow-lift sm:p-8">
            {children}
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">ต้องการบัญชีใหม่? ติดต่อผู้ดูแลระบบหรือฝ่าย IT / Need an account? Contact your administrator.</p>
        </div>
      </section>
    </main>
  );
}
