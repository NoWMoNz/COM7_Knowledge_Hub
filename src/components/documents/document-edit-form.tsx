"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDocumentAction } from "@/app/(employee)/documents/actions";

type Props = {
  doc: { id: string; title: string; description: string | null; category_id: string | null };
  categories: { id: string; name: string }[];
};

export function DocumentEditForm({ doc, categories }: Props) {
  const [state, action, pending] = useActionState(updateDocumentAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={doc.id} />
      {state.error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.success && <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.success}</p>}
      <div className="space-y-1">
        <Label htmlFor="title">ชื่อเอกสาร / Title</Label>
        <Input id="title" name="title" defaultValue={doc.title} required maxLength={200} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">คำอธิบาย / Description</Label>
        <textarea id="description" name="description" defaultValue={doc.description ?? ""} maxLength={2000} rows={3}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="categoryId">หมวดหมู่ / Category</Label>
        <select id="categoryId" name="categoryId" defaultValue={doc.category_id ?? ""} className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm">
          <option value="">— ไม่ระบุ / None —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <Button type="submit" disabled={pending} className="bg-brand-700 hover:bg-brand-800">
        {pending && <Loader2 className="mr-2 size-4 animate-spin" />}บันทึก / Save
      </Button>
    </form>
  );
}
