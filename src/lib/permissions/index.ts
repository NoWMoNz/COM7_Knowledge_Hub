/** Permission strings; must match role_permissions.permission in the database. */
export const PERMISSIONS = {
  CATEGORY_MANAGE: "category:manage",
  DOCUMENT_MANAGE: "document:manage",
  USER_READ: "user:read",
  USER_MANAGE: "user:manage",
  ROLE_MANAGE: "role:manage",
  DEPARTMENT_MANAGE: "department:manage",
  AUDIT_READ: "audit:read",
  ADMIN_ACCESS: "admin:access",
  ACCESS_MANAGE: "access:manage",
  CONTENT_MANAGE: "content:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function hasPermission(granted: readonly string[], required: Permission): boolean {
  return granted.includes(required);
}

/** Human-readable labels for the role editor. Add new permissions here when introducing them. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  "category:manage": "จัดการหมวดหมู่ / Manage categories",
  "document:manage": "จัดการเอกสาร / Manage documents",
  "user:read": "ดูผู้ใช้ / View users",
  "user:manage": "จัดการผู้ใช้ / Manage users",
  "role:manage": "จัดการบทบาท / Manage roles",
  "department:manage": "จัดการแผนก / Manage departments",
  "audit:read": "ดู Audit log / View audit logs",
  "admin:access": "เข้า Admin Dashboard / Admin dashboard access",
  "access:manage": "กำหนดสิทธิ์เข้าถึงเอกสาร / Manage document access",
  "content:manage": "จัดการประกาศ/FAQ/ลิงก์ลัด / Manage announcements, FAQ, quick links",
};
