import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-form";
import { forgotPasswordAction } from "@/lib/auth/actions";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="ลืมรหัสผ่าน / Forgot password" description="กรอกอีเมลของคุณ เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้ / Enter your email and we will send you a reset link.">
      <ForgotPasswordForm action={forgotPasswordAction} />
    </AuthShell>
  );
}
