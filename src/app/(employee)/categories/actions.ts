"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit";
import { categorySchema, uuidSchema } from "@/lib/validation/documents";
import type { FormState } from "@/lib/auth/actions";

export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(PERMISSIONS.CATEGORY_MANAGE);
  const parsed = categorySchema.safeParse({ name: formData.get("name"), description: formData.get("description") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const idRaw = formData.get("id");
  const id = idRaw ? uuidSchema.safeParse(idRaw) : null;
  if (id && !id.success) return { error: "Invalid category." };

  const { data, error } = id
    ? await supabase.from("categories").update(parsed.data).eq("id", id.data).select("id").single()
    : await supabase.from("categories").insert(parsed.data).select("id").single();
  if (error) {
    return { error: error.code === "23505" ? "ชื่อหมวดหมู่นี้มีอยู่แล้ว / This category name already exists." : "Could not save category." };
  }
  await writeAudit({ actorId: user.id, action: id ? "category.update" : "category.create", resourceType: "category", resourceId: data.id, metadata: parsed.data });
  revalidatePath("/categories");
  revalidatePath("/dashboard");
  return { success: "บันทึกแล้ว / Saved." };
}

export async function deleteCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePermission(PERMISSIONS.CATEGORY_MANAGE);
  const id = uuidSchema.safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid category." };

  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id.data);
  if (error) {
    return {
      error:
        error.code === "23503"
          ? "ยังมีเอกสารใช้หมวดหมู่นี้อยู่ ย้ายเอกสารไปหมวดอื่นก่อน / Documents still use this category. Reassign them first."
          : "Could not delete category.",
    };
  }
  await writeAudit({ actorId: user.id, action: "category.delete", resourceType: "category", resourceId: id.data });
  revalidatePath("/categories");
  revalidatePath("/dashboard");
  return { success: "ลบแล้ว / Deleted." };
}
