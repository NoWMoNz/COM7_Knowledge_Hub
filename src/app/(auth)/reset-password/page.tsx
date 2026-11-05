import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-form";
import { resetPasswordAction } from "@/lib/auth/actions";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthShell title="ตั้งรหัสผ่านใหม่ / Set new password" description="เลือกรหัสผ่านใหม่ที่คาดเดายากและไม่ซ้ำกับที่อื่น / Choose a strong password you do not use elsewhere.">
      <ResetPasswordForm action={resetPasswordAction} />
    </AuthShell>
  );
}
