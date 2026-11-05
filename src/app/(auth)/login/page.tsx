import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-form";
import { loginAction } from "@/lib/auth/actions";

export const metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <AuthShell title="เข้าสู่ระบบ / Login" description="ใช้บัญชีพนักงานของคุณเพื่อเข้าถึงเอกสารและผู้ช่วย AI / Sign in with your employee account.">
      <LoginForm action={loginAction} />
    </AuthShell>
  );
}
