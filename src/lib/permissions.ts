// Central permission matrix and helpers for Elsewedy Task Flow.
import type { AppRole } from "@/lib/i18n";

export type PermState = "allow" | "own" | "read" | "deny";

export const PERM_LABEL: Record<PermState, string> = {
  allow: "سماح كامل",
  own: "المهام الخاصة فقط",
  read: "قراءة فقط",
  deny: "غير مسموح",
};

export const PERM_COLOR: Record<PermState, string> = {
  allow: "bg-emerald-50 text-emerald-700 border-emerald-200",
  own: "bg-amber-50 text-amber-800 border-amber-200",
  read: "bg-slate-50 text-slate-700 border-slate-200",
  deny: "bg-red-50 text-red-700 border-red-200",
};

export const PERMISSIONS = [
  { key: "view_dashboard", label: "عرض لوحة القيادة" },
  { key: "view_all_tasks", label: "عرض كل المهام" },
  { key: "view_assigned_tasks", label: "عرض المهام المسندة" },
  { key: "create_task", label: "إنشاء تاسك" },
  { key: "edit_sales_fields", label: "تعديل بيانات المبيعات" },
  { key: "edit_design_fields", label: "تعديل بيانات التصميم" },
  { key: "change_overall_status", label: "تغيير الحالة العامة" },
  { key: "change_design_status", label: "تغيير حالة التصميم" },
  { key: "assign_sales_owner", label: "تعيين مسؤول السيلز" },
  { key: "assign_designer", label: "تعيين المصمم" },
  { key: "upload_files", label: "رفع الملفات" },
  { key: "add_comments", label: "إضافة تعليقات" },
  { key: "approve_final_design", label: "اعتماد النسخة النهائية" },
  { key: "archive_task", label: "أرشفة التاسك" },
  { key: "restore_task", label: "استرجاع التاسك" },
  { key: "export_data", label: "تصدير البيانات" },
  { key: "view_reports", label: "عرض التقارير" },
  { key: "view_activity_log", label: "عرض سجل النشاط" },
  { key: "manage_users", label: "إدارة المستخدمين" },
  { key: "manage_roles", label: "إدارة الأدوار" },
  { key: "manage_settings", label: "إدارة الإعدادات" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

// Default matrix — the ground truth for roles.
export const PERMISSION_MATRIX: Record<PermissionKey, Record<AppRole, PermState>> = {
  view_dashboard: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "allow", design_manager: "allow", designer: "allow", view_only: "read" },
  view_all_tasks: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "own", design_manager: "allow", designer: "own", view_only: "read" },
  view_assigned_tasks: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "allow", design_manager: "allow", designer: "allow", view_only: "read" },
  create_task: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "allow", design_manager: "deny", designer: "deny", view_only: "deny" },
  edit_sales_fields: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "own", design_manager: "deny", designer: "deny", view_only: "deny" },
  edit_design_fields: { super_admin: "allow", admin: "allow", sales_manager: "deny", sales_executive: "deny", design_manager: "allow", designer: "own", view_only: "deny" },
  change_overall_status: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "own", design_manager: "allow", designer: "own", view_only: "deny" },
  change_design_status: { super_admin: "allow", admin: "allow", sales_manager: "deny", sales_executive: "deny", design_manager: "allow", designer: "own", view_only: "deny" },
  assign_sales_owner: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "deny", design_manager: "deny", designer: "deny", view_only: "deny" },
  assign_designer: { super_admin: "allow", admin: "allow", sales_manager: "deny", sales_executive: "deny", design_manager: "allow", designer: "deny", view_only: "deny" },
  upload_files: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "own", design_manager: "allow", designer: "own", view_only: "deny" },
  add_comments: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "allow", design_manager: "allow", designer: "allow", view_only: "deny" },
  approve_final_design: { super_admin: "allow", admin: "allow", sales_manager: "deny", sales_executive: "deny", design_manager: "allow", designer: "deny", view_only: "deny" },
  archive_task: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "deny", design_manager: "allow", designer: "deny", view_only: "deny" },
  restore_task: { super_admin: "allow", admin: "allow", sales_manager: "deny", sales_executive: "deny", design_manager: "deny", designer: "deny", view_only: "deny" },
  export_data: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "read", design_manager: "allow", designer: "read", view_only: "read" },
  view_reports: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "read", design_manager: "allow", designer: "read", view_only: "read" },
  view_activity_log: { super_admin: "allow", admin: "allow", sales_manager: "allow", sales_executive: "read", design_manager: "allow", designer: "read", view_only: "read" },
  manage_users: { super_admin: "allow", admin: "allow", sales_manager: "deny", sales_executive: "deny", design_manager: "deny", designer: "deny", view_only: "deny" },
  manage_roles: { super_admin: "allow", admin: "read", sales_manager: "deny", sales_executive: "deny", design_manager: "deny", designer: "deny", view_only: "deny" },
  manage_settings: { super_admin: "allow", admin: "read", sales_manager: "deny", sales_executive: "deny", design_manager: "deny", designer: "deny", view_only: "deny" },
};

const RANK: Record<PermState, number> = { deny: 0, read: 1, own: 2, allow: 3 };

/** Best permission across a user's roles. */
export function effectivePerm(roles: string[], key: PermissionKey): PermState {
  let best: PermState = "deny";
  for (const r of roles) {
    const v = PERMISSION_MATRIX[key]?.[r as AppRole];
    if (v && RANK[v] > RANK[best]) best = v;
  }
  return best;
}

export function can(roles: string[], key: PermissionKey, isOwn = true): boolean {
  const p = effectivePerm(roles, key);
  if (p === "allow") return true;
  if (p === "own") return isOwn;
  return false;
}

export function canView(roles: string[], key: PermissionKey): boolean {
  return effectivePerm(roles, key) !== "deny";
}

export const SALES_FIELDS = [
  "customer_name", "sales_owner_id", "customer_type", "products",
  "order_details", "size_qty_material", "design_brief", "priority", "request_date",
] as const;

export const DESIGN_FIELDS = [
  "designer_id", "design_status", "design_start_date", "delivery_due_date",
  "designer_notes", "sales_client_revisions", "final_version_url",
  "actual_delivery_date", "delivered", "files_url",
] as const;

export function canEditTaskField(
  roles: string[],
  field: string,
  ownership: { isSalesOwner: boolean; isDesigner: boolean },
): boolean {
  if (roles.includes("view_only") && roles.length === 1) return false;
  if ((SALES_FIELDS as readonly string[]).includes(field)) {
    return can(roles, "edit_sales_fields", ownership.isSalesOwner);
  }
  if ((DESIGN_FIELDS as readonly string[]).includes(field)) {
    return can(roles, "edit_design_fields", ownership.isDesigner);
  }
  // task_name / month_code / overall_status: shared
  if (field === "overall_status") return can(roles, "change_overall_status", ownership.isSalesOwner || ownership.isDesigner);
  return can(roles, "edit_sales_fields", ownership.isSalesOwner) || can(roles, "edit_design_fields", ownership.isDesigner);
}

export function isAdminRole(roles: string[]): boolean {
  return roles.includes("super_admin") || roles.includes("admin");
}
