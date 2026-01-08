/**
 * Team Management API client functions.
 * Provides endpoints for managing organization member assignments to production lines.
 */

import { AXIOS_INSTANCE } from '../../axios-client';

// =============================================================================
// Types
// =============================================================================

export interface ScopeRead {
    id: string;
    scope_type: string;
    organization_id: string | null;
    factory_id: string | null;
    production_line_id: string | null;
    role: string;
}

export interface MemberRead {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string;
    is_active: boolean;
    last_login: string | null;
    scopes: ScopeRead[];
}

export interface ScopeAssign {
    production_line_id: string;
    role?: string;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * List all organization members with their scope assignments.
 * Only accessible by organization owners.
 */
export const listOrgMembers = () =>
    AXIOS_INSTANCE.get<MemberRead[]>('/api/v1/organizations/members');

/**
 * Assign a user to a production line.
 * Only accessible by organization owners.
 */
export const assignUserToLine = (userId: string, data: ScopeAssign) =>
    AXIOS_INSTANCE.post<ScopeRead>(`/api/v1/organizations/members/${userId}/scopes`, data);

/**
 * Remove a user's scope assignment.
 * Only accessible by organization owners.
 */
export const removeUserScope = (userId: string, scopeId: string) =>
    AXIOS_INSTANCE.delete(`/api/v1/organizations/members/${userId}/scopes/${scopeId}`);
