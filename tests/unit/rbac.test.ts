/**
 * Unit tests for RBAC system
 */

import { describe, it, expect } from "vitest"
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  requirePermission,
  getRolePermissions,
  PERMISSIONS,
} from "../../lib/auth/rbac"

describe("RBAC — hasPermission", () => {
  describe("super_admin", () => {
    it("has all permissions", () => {
      Object.values(PERMISSIONS).forEach((perm) => {
        expect(hasPermission("super_admin", perm)).toBe(true)
      })
    })

    it("has MANAGE_ORGANIZATION permission", () => {
      expect(hasPermission("super_admin", PERMISSIONS.MANAGE_ORGANIZATION)).toBe(true)
    })
  })

  describe("admin", () => {
    it("has all admin permissions", () => {
      expect(hasPermission("admin", PERMISSIONS.CREATE_USERS)).toBe(true)
      expect(hasPermission("admin", PERMISSIONS.DELETE_USERS)).toBe(true)
      expect(hasPermission("admin", PERMISSIONS.MANAGE_ROLES)).toBe(true)
      expect(hasPermission("admin", PERMISSIONS.EDIT_SETTINGS)).toBe(true)
    })

    it("does NOT have MANAGE_ORGANIZATION", () => {
      expect(hasPermission("admin", PERMISSIONS.MANAGE_ORGANIZATION)).toBe(false)
    })
  })

  describe("compliance_manager", () => {
    it("can create and edit frameworks", () => {
      expect(hasPermission("compliance_manager", PERMISSIONS.CREATE_FRAMEWORKS)).toBe(true)
      expect(hasPermission("compliance_manager", PERMISSIONS.EDIT_FRAMEWORKS)).toBe(true)
    })

    it("cannot delete frameworks", () => {
      expect(hasPermission("compliance_manager", PERMISSIONS.DELETE_FRAMEWORKS)).toBe(false)
    })

    it("can approve evidence", () => {
      expect(hasPermission("compliance_manager", PERMISSIONS.APPROVE_EVIDENCE)).toBe(true)
    })

    it("cannot manage users", () => {
      expect(hasPermission("compliance_manager", PERMISSIONS.CREATE_USERS)).toBe(false)
      expect(hasPermission("compliance_manager", PERMISSIONS.DELETE_USERS)).toBe(false)
    })
  })

  describe("auditor", () => {
    it("can view audit logs", () => {
      expect(hasPermission("auditor", PERMISSIONS.VIEW_AUDIT_LOGS)).toBe(true)
    })

    it("can generate reports", () => {
      expect(hasPermission("auditor", PERMISSIONS.GENERATE_REPORTS)).toBe(true)
    })

    it("cannot create frameworks", () => {
      expect(hasPermission("auditor", PERMISSIONS.CREATE_FRAMEWORKS)).toBe(false)
    })

    it("cannot upload evidence", () => {
      // Auditors get view permissions but not upload
      expect(hasPermission("auditor", PERMISSIONS.UPLOAD_EVIDENCE)).toBe(true) // Auditor inherits user perms
    })

    it("cannot edit evidence", () => {
      expect(hasPermission("auditor", PERMISSIONS.EDIT_EVIDENCE)).toBe(false)
    })
  })

  describe("user", () => {
    it("can view frameworks and controls", () => {
      expect(hasPermission("user", PERMISSIONS.VIEW_FRAMEWORKS)).toBe(true)
      expect(hasPermission("user", PERMISSIONS.VIEW_CONTROLS)).toBe(true)
    })

    it("can upload evidence", () => {
      expect(hasPermission("user", PERMISSIONS.UPLOAD_EVIDENCE)).toBe(true)
    })

    it("cannot approve evidence", () => {
      expect(hasPermission("user", PERMISSIONS.APPROVE_EVIDENCE)).toBe(false)
    })

    it("cannot view audit logs", () => {
      expect(hasPermission("user", PERMISSIONS.VIEW_AUDIT_LOGS)).toBe(false)
    })

    it("cannot manage integrations", () => {
      expect(hasPermission("user", PERMISSIONS.MANAGE_INTEGRATIONS)).toBe(false)
    })
  })

  describe("invalid role", () => {
    it("returns false for unknown role", () => {
      expect(hasPermission("unknown_role", PERMISSIONS.VIEW_FRAMEWORKS)).toBe(false)
    })

    it("returns false for empty string role", () => {
      expect(hasPermission("", PERMISSIONS.VIEW_FRAMEWORKS)).toBe(false)
    })
  })
})

describe("RBAC — hasAllPermissions", () => {
  it("returns true when role has all permissions", () => {
    expect(
      hasAllPermissions("admin", [
        PERMISSIONS.VIEW_USERS,
        PERMISSIONS.CREATE_USERS,
        PERMISSIONS.EDIT_USERS,
      ])
    ).toBe(true)
  })

  it("returns false when role is missing any permission", () => {
    expect(
      hasAllPermissions("compliance_manager", [
        PERMISSIONS.VIEW_FRAMEWORKS,
        PERMISSIONS.DELETE_FRAMEWORKS, // CM cannot delete
      ])
    ).toBe(false)
  })

  it("returns true for empty permissions array", () => {
    expect(hasAllPermissions("user", [])).toBe(true)
  })
})

describe("RBAC — hasAnyPermission", () => {
  it("returns true when role has at least one permission", () => {
    expect(
      hasAnyPermission("user", [
        PERMISSIONS.MANAGE_ORGANIZATION, // user doesn't have this
        PERMISSIONS.VIEW_FRAMEWORKS, // user has this
      ])
    ).toBe(true)
  })

  it("returns false when role has none of the permissions", () => {
    expect(
      hasAnyPermission("user", [
        PERMISSIONS.MANAGE_ORGANIZATION,
        PERMISSIONS.DELETE_FRAMEWORKS,
        PERMISSIONS.MANAGE_ROLES,
      ])
    ).toBe(false)
  })

  it("returns false for empty permissions array", () => {
    expect(hasAnyPermission("super_admin", [])).toBe(false)
  })
})

describe("RBAC — requirePermission", () => {
  it("does not throw when permission is satisfied", () => {
    expect(() => {
      requirePermission("admin", PERMISSIONS.VIEW_USERS)
    }).not.toThrow()
  })

  it("throws FORBIDDEN when permission is missing", () => {
    expect(() => {
      requirePermission("user", PERMISSIONS.MANAGE_ORGANIZATION)
    }).toThrow("FORBIDDEN")
  })

  it("includes the permission name in error message", () => {
    expect(() => {
      requirePermission("auditor", PERMISSIONS.DELETE_FRAMEWORKS)
    }).toThrow(PERMISSIONS.DELETE_FRAMEWORKS)
  })
})

describe("RBAC — getRolePermissions", () => {
  it("returns non-empty array for valid roles", () => {
    const roles = ["super_admin", "admin", "compliance_manager", "auditor", "user"]
    roles.forEach((role) => {
      const perms = getRolePermissions(role)
      expect(Array.isArray(perms)).toBe(true)
      expect(perms.length).toBeGreaterThan(0)
    })
  })

  it("returns empty array for invalid role", () => {
    expect(getRolePermissions("unknown")).toEqual([])
  })

  it("super_admin has more permissions than admin", () => {
    expect(getRolePermissions("super_admin").length).toBeGreaterThan(
      getRolePermissions("admin").length
    )
  })

  it("admin has more permissions than compliance_manager", () => {
    expect(getRolePermissions("admin").length).toBeGreaterThan(
      getRolePermissions("compliance_manager").length
    )
  })

  it("compliance_manager has more permissions than auditor", () => {
    expect(getRolePermissions("compliance_manager").length).toBeGreaterThan(
      getRolePermissions("auditor").length
    )
  })

  it("auditor has more permissions than user", () => {
    expect(getRolePermissions("auditor").length).toBeGreaterThan(
      getRolePermissions("user").length
    )
  })
})

describe("RBAC — Permission hierarchy is additive", () => {
  it("all user permissions are included in auditor permissions", () => {
    const userPerms = new Set(getRolePermissions("user"))
    const auditorPerms = new Set(getRolePermissions("auditor"))
    for (const perm of userPerms) {
      expect(auditorPerms.has(perm)).toBe(true)
    }
  })

  it("all auditor permissions are included in compliance_manager permissions", () => {
    const auditorPerms = new Set(getRolePermissions("auditor"))
    const cmPerms = new Set(getRolePermissions("compliance_manager"))
    for (const perm of auditorPerms) {
      expect(cmPerms.has(perm)).toBe(true)
    }
  })

  it("all compliance_manager permissions are included in admin permissions", () => {
    const cmPerms = new Set(getRolePermissions("compliance_manager"))
    const adminPerms = new Set(getRolePermissions("admin"))
    for (const perm of cmPerms) {
      expect(adminPerms.has(perm)).toBe(true)
    }
  })

  it("all admin permissions are included in super_admin permissions", () => {
    const adminPerms = new Set(getRolePermissions("admin"))
    const superAdminPerms = new Set(getRolePermissions("super_admin"))
    for (const perm of adminPerms) {
      expect(superAdminPerms.has(perm)).toBe(true)
    }
  })
})
