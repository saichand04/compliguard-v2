/**
 * CompliGuard RBAC System
 *
 * Roles: super_admin > admin > compliance_manager > auditor > user
 * Permissions are additive — higher roles include all lower-role permissions.
 */

export const PERMISSIONS = {
  // Users
  VIEW_USERS: 'users:view',
  CREATE_USERS: 'users:create',
  EDIT_USERS: 'users:edit',
  DELETE_USERS: 'users:delete',
  INVITE_USERS: 'users:invite',

  // Roles
  MANAGE_ROLES: 'roles:manage',

  // Frameworks
  VIEW_FRAMEWORKS: 'frameworks:view',
  CREATE_FRAMEWORKS: 'frameworks:create',
  EDIT_FRAMEWORKS: 'frameworks:edit',
  DELETE_FRAMEWORKS: 'frameworks:delete',

  // Controls
  VIEW_CONTROLS: 'controls:view',
  CREATE_CONTROLS: 'controls:create',
  EDIT_CONTROLS: 'controls:edit',
  DELETE_CONTROLS: 'controls:delete',
  ASSIGN_CONTROLS: 'controls:assign',

  // Evidence
  VIEW_EVIDENCE: 'evidence:view',
  UPLOAD_EVIDENCE: 'evidence:upload',
  EDIT_EVIDENCE: 'evidence:edit',
  DELETE_EVIDENCE: 'evidence:delete',
  APPROVE_EVIDENCE: 'evidence:approve',

  // Reports
  VIEW_REPORTS: 'reports:view',
  GENERATE_REPORTS: 'reports:generate',

  // Audit logs
  VIEW_AUDIT_LOGS: 'audit_logs:view',

  // Settings
  VIEW_SETTINGS: 'settings:view',
  EDIT_SETTINGS: 'settings:edit',

  // Organization
  MANAGE_ORGANIZATION: 'organization:manage',

  // Risks
  VIEW_RISKS: 'risks:view',
  CREATE_RISKS: 'risks:create',
  EDIT_RISKS: 'risks:edit',
  DELETE_RISKS: 'risks:delete',

  // Policies
  VIEW_POLICIES: 'policies:view',
  CREATE_POLICIES: 'policies:create',
  EDIT_POLICIES: 'policies:edit',
  DELETE_POLICIES: 'policies:delete',
  APPROVE_POLICIES: 'policies:approve',

  // Vendors
  VIEW_VENDORS: 'vendors:view',
  CREATE_VENDORS: 'vendors:create',
  EDIT_VENDORS: 'vendors:edit',
  DELETE_VENDORS: 'vendors:delete',

  // Findings
  VIEW_FINDINGS: 'findings:view',
  CREATE_FINDINGS: 'findings:create',
  EDIT_FINDINGS: 'findings:edit',

  // Tasks
  VIEW_TASKS: 'tasks:view',
  CREATE_TASKS: 'tasks:create',
  EDIT_TASKS: 'tasks:edit',
  DELETE_TASKS: 'tasks:delete',
  ASSIGN_TASKS: 'tasks:assign',

  // Integrations
  VIEW_INTEGRATIONS: 'integrations:view',
  MANAGE_INTEGRATIONS: 'integrations:manage',

  // API Keys
  MANAGE_API_KEYS: 'api_keys:manage',
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

type Role = 'super_admin' | 'admin' | 'compliance_manager' | 'auditor' | 'user'

/** Base user permissions — read access to most areas */
const USER_PERMISSIONS: Permission[] = [
  PERMISSIONS.VIEW_FRAMEWORKS,
  PERMISSIONS.VIEW_CONTROLS,
  PERMISSIONS.VIEW_EVIDENCE,
  PERMISSIONS.UPLOAD_EVIDENCE,
  PERMISSIONS.VIEW_REPORTS,
  PERMISSIONS.VIEW_RISKS,
  PERMISSIONS.VIEW_POLICIES,
  PERMISSIONS.VIEW_VENDORS,
  PERMISSIONS.VIEW_FINDINGS,
  PERMISSIONS.VIEW_TASKS,
  PERMISSIONS.CREATE_TASKS,
  PERMISSIONS.EDIT_TASKS,
]

/** Auditor: read-only with download/export rights */
const AUDITOR_PERMISSIONS: Permission[] = [
  ...USER_PERMISSIONS,
  PERMISSIONS.VIEW_AUDIT_LOGS,
  PERMISSIONS.GENERATE_REPORTS,
]

/** Compliance Manager: full operational control */
const COMPLIANCE_MANAGER_PERMISSIONS: Permission[] = [
  ...AUDITOR_PERMISSIONS,
  PERMISSIONS.VIEW_USERS,
  PERMISSIONS.INVITE_USERS,
  PERMISSIONS.CREATE_FRAMEWORKS,
  PERMISSIONS.EDIT_FRAMEWORKS,
  PERMISSIONS.CREATE_CONTROLS,
  PERMISSIONS.EDIT_CONTROLS,
  PERMISSIONS.ASSIGN_CONTROLS,
  PERMISSIONS.EDIT_EVIDENCE,
  PERMISSIONS.APPROVE_EVIDENCE,
  PERMISSIONS.CREATE_RISKS,
  PERMISSIONS.EDIT_RISKS,
  PERMISSIONS.CREATE_POLICIES,
  PERMISSIONS.EDIT_POLICIES,
  PERMISSIONS.APPROVE_POLICIES,
  PERMISSIONS.CREATE_VENDORS,
  PERMISSIONS.EDIT_VENDORS,
  PERMISSIONS.CREATE_FINDINGS,
  PERMISSIONS.EDIT_FINDINGS,
  PERMISSIONS.ASSIGN_TASKS,
  PERMISSIONS.DELETE_TASKS,
  PERMISSIONS.VIEW_INTEGRATIONS,
]

/** Admin: full access except super_admin-only features */
const ADMIN_PERMISSIONS: Permission[] = [
  ...COMPLIANCE_MANAGER_PERMISSIONS,
  PERMISSIONS.CREATE_USERS,
  PERMISSIONS.EDIT_USERS,
  PERMISSIONS.DELETE_USERS,
  PERMISSIONS.MANAGE_ROLES,
  PERMISSIONS.DELETE_FRAMEWORKS,
  PERMISSIONS.DELETE_CONTROLS,
  PERMISSIONS.DELETE_EVIDENCE,
  PERMISSIONS.DELETE_RISKS,
  PERMISSIONS.DELETE_POLICIES,
  PERMISSIONS.DELETE_VENDORS,
  PERMISSIONS.VIEW_SETTINGS,
  PERMISSIONS.EDIT_SETTINGS,
  PERMISSIONS.MANAGE_INTEGRATIONS,
  PERMISSIONS.MANAGE_API_KEYS,
]

/** Super Admin: full access including system-level changes */
const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  ...ADMIN_PERMISSIONS,
  PERMISSIONS.MANAGE_ORGANIZATION,
]

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: SUPER_ADMIN_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  compliance_manager: COMPLIANCE_MANAGER_PERMISSIONS,
  auditor: AUDITOR_PERMISSIONS,
  user: USER_PERMISSIONS,
}

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: string, permission: Permission): boolean {
  const rolePerms = ROLE_PERMISSIONS[role as Role]
  if (!rolePerms) return false
  return rolePerms.includes(permission)
}

/**
 * Get all permissions for a role.
 */
export function getRolePermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as Role] ?? []
}

/**
 * Check if a role has ALL the given permissions.
 */
export function hasAllPermissions(role: string, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p))
}

/**
 * Check if a role has ANY of the given permissions.
 */
export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

/**
 * Throw a 403 error if the role does not have the required permission.
 * Use in API routes: requirePermission(session.role, PERMISSIONS.EDIT_CONTROLS)
 */
export function requirePermission(role: string, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`FORBIDDEN: requires permission ${permission}`)
  }
}
