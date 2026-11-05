import Link from "next/link";
import { SearchX } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "ไม่พบหน้านี้" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Logo height={40} />
      <span className="mt-4 flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700"><SearchX className="size-7" aria-hidden /></span>
      <h1 className="text-2xl font-semibold text-slate-900">ไม่พบหน้านี้ / Page not found</h1>
      <p className="max-w-md text-sm text-slate-500">หน้านี้อาจถูกย้ายหรือลบ หรือคุณอาจไม่มีสิทธิ์เข้าถึง / The page may have moved or been removed, or you may not have access to it.</p>
      <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>กลับหน้าแรก / Back to home</Link>
    </main>
  );
}
