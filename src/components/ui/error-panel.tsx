"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

/** Shared body for route error boundaries. Shows a generic message only; details stay in server logs. */
export function ErrorPanel({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-red-100 text-red-700"><TriangleAlert className="size-6" aria-hidden /></span>
      <h1 className="text-lg font-semibold text-slate-900">เกิดข้อผิดพลาด / Something went wrong</h1>
      <p className="text-sm text-slate-600">ไม่สามารถแสดงหน้านี้ได้ กรุณาลองใหม่ หากยังพบปัญหาโปรดแจ้งผู้ดูแลระบบ / This page could not be displayed. Please try again, or contact an administrator if it continues.</p>
      {error.digest && <p className="text-xs text-slate-500">รหัสอ้างอิง / Reference: {error.digest}</p>}
      <div className="mt-2 flex gap-2">
        <Button onClick={reset}>ลองอีกครั้ง / Try again</Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>กลับหน้าแรก / Home</Link>
      </div>
    </div>
  );
}
