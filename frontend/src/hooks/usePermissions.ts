/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Permission hook for Role-Based Access Control (RBAC).
 * Centralizes role-to-capability mapping for the entire frontend.
 * 
 * Phase 1: Uses mock scope data for line-level permissions.
 * Phase 2: Will fetch real UserScope data from API.
 */
import { useAuth } from './useAuth';

// Match backend UserRole enum exactly (from app/enums.py)
export type UserRole =
    | 'system_admin'
    | 'owner'
    | 'factory_manager'
    | 'line_manager'
    | 'analyst'
    | 'viewer';

// Role sets for capability checks
const ADMIN_ROLES: UserRole[] = ['system_admin', 'owner'];
const INFRASTRUCTURE_ROLES: UserRole[] = ['system_admin', 'owner', 'factory_manager']; // Line Managers cannot change infrastructure
const DASHBOARD_CREATE_ROLES: UserRole[] = ['system_admin', 'owner', 'factory_manager', 'line_manager', 'analyst'];
const UPLOAD_ROLES: UserRole[] = ['system_admin', 'owner', 'factory_manager', 'line_manager'];

/**
 * Mock scope data for testing.
 * Maps user email → line IDs they are assigned to.
 * TODO: Replace with real API call to /api/v1/users/me/scopes
 */
const MOCK_USER_SCOPES: Record<string, { type: 'factory' | 'line'; lineIds: string[] }> = {
    // Factory Manager has access to ALL lines in their assigned factory
    'factory.manager@linesight.io': { type: 'factory', lineIds: [] },

    // Line Manager has access ONLY to specific assigned lines
    // TODO: Phase 2 - Fetch these IDs dynamically. For now, we mock it.
    'line.manager@linesight.io': { type: 'line', lineIds: [] }, // Will need to match the ID from seed data
};

export interface Permissions {
    /** Current user role, null if not authenticated */
    role: UserRole | null;
    /** True only for SYSTEM_ADMIN or OWNER (global org access) */
    isAdmin: boolean;
    /** Can add/configure factories and production lines */
    canManageInfrastructure: boolean;
    /** Can create and edit dashboards */
    canCreateDashboard: boolean;
    /** Can view dashboards (all authenticated users) */
    canViewDashboards: boolean;
    /** 
     * Check if user can upload files to a specific production line.
     * @param lineId - The production line ID to check
     * @returns true if user has write access to this line
     */
    canUploadToLine: (lineId: string) => boolean;
    /**
     * Check if user has any upload capability (may still be scope-limited)
     */
    canUploadAny: boolean;
}

/**
 * Hook to get current user's permissions based on their role.
 * 
 * @example
 * const { canUploadToLine, canManageInfrastructure } = usePermissions();
 * 
 * // Check line-specific upload access
 * if (canUploadToLine(lineId)) {
 *   // Show Upload button enabled
 * } else if (canUploadAny) {
 *   // Show Upload button disabled (not assigned to this line)
 * } else {
 *   // Hide Upload button entirely (read-only role)
 * }
 */
export function usePermissions(): Permissions {
    const { user } = useAuth();
    const role = (user?.role ?? null) as UserRole | null;
    const email = user?.email ?? '';

    // Check if role allows any upload capability
    const canUploadAny = role !== null && UPLOAD_ROLES.includes(role);

    /**
     * Check if user can upload to a specific line.
     * 
     * Logic:
     * 1. ANALYST/VIEWER → always false (read-only)
     * 2. SYSTEM_ADMIN/OWNER → always true (god mode)
     * 3. MANAGER → depends on scope:
     *    - Factory scope: true for all lines in their factory
     *    - Line scope: true only for assigned lines
     * 
     * Phase 1: Uses mock data. Phase 2: Will fetch real scopes from API.
     */
    const canUploadToLine = (lineId: string): boolean => {
        // No role = no access
        if (!role) return false;

        // Read-only roles: hard no
        if (role === 'analyst' || role === 'viewer') return false;

        // Admin/Owner: god mode
        if (role === 'system_admin' || role === 'owner') return true;

        // Factory Manager: can upload to any line in their factory
        if (role === 'factory_manager') return true;

        // Line Manager: STRICT CHECK - must be explicitly assigned
        if (role === 'line_manager') {
            // Check mock scope data
            // TODO: In Phase 2, check real UserScope from API
            const scope = MOCK_USER_SCOPES[email];

            // If line-level scope, check strictly against assigned IDs
            // For now, in Phase 1 mocking, we'll allow it if they are logged in as line manager
            // But we SHOULD enforce the check once we have the IDs

            // STRICT MODE: If we have specific line IDs in the scope, enforce them.
            if (scope?.type === 'line' && scope.lineIds.length > 0) {
                return scope.lineIds.includes(lineId);
            }

            // Fallback for Phase 1 testing if no IDs populated yet
            return true;
        }

        return false;
    };

    return {
        role,
        isAdmin: role !== null && ADMIN_ROLES.includes(role),
        canManageInfrastructure: role !== null && INFRASTRUCTURE_ROLES.includes(role),
        canCreateDashboard: role !== null && DASHBOARD_CREATE_ROLES.includes(role),
        canViewDashboards: role !== null,
        canUploadToLine,
        canUploadAny,
    };
}
