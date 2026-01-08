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
    | 'manager'
    | 'analyst'
    | 'viewer';

// Role sets for capability checks
const ADMIN_ROLES: UserRole[] = ['system_admin', 'owner'];
const INFRASTRUCTURE_ROLES: UserRole[] = ['system_admin', 'owner', 'manager'];
const DASHBOARD_CREATE_ROLES: UserRole[] = ['system_admin', 'owner', 'manager', 'analyst'];
const UPLOAD_ROLES: UserRole[] = ['system_admin', 'owner', 'manager'];

/**
 * Mock scope data for testing.
 * Maps user email → line IDs they are assigned to.
 * TODO: Replace with real API call to /api/v1/users/me/scopes
 */
const MOCK_USER_SCOPES: Record<string, { type: 'factory' | 'line'; lineIds: string[] }> = {
    // Super Manager has access to ALL lines (factory-level scope)
    'super.manager@linesight.io': { type: 'factory', lineIds: [] },
    // Cross-Factory has access to specific lines in multiple factories
    'cross.factory@linesight.io': { type: 'line', lineIds: [] }, // Will be populated from real data
    // Standard managers have specific line assignments (populated from UserScope)
    // For testing, we use empty array - they'll get access from real UserScope API
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

        // Manager: check scope
        if (role === 'manager') {
            // Check mock scope data
            const scope = MOCK_USER_SCOPES[email];

            // If factory-level scope, allow all lines
            if (scope?.type === 'factory') return true;

            // If line-level scope with specific lines, check membership
            if (scope?.type === 'line' && scope.lineIds.length > 0) {
                return scope.lineIds.includes(lineId);
            }

            // Phase 1 fallback: Allow managers to upload to all lines by default
            // This is permissive for testing; in Phase 2, we'll fetch real scopes
            // TODO: When UserScope API is ready, return false here and rely on API data
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
