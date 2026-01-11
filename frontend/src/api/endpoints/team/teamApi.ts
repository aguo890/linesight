import { AXIOS_INSTANCE } from '../../axios-client';
import type { MemberRead, ScopeRead, ScopeAssign } from '../../model';

export type { MemberRead, ScopeRead };

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
 * Assign a user to a data source.
 * Only accessible by organization owners.
 */
export const assignUserToDataSource = (userId: string, data: ScopeAssign) =>
    AXIOS_INSTANCE.post<ScopeRead>(`/api/v1/organizations/members/${userId}/scopes`, data);

/**
 * Remove a user's scope assignment.
 * Only accessible by organization owners.
 */
export const removeUserScope = (userId: string, scopeId: string) =>
    AXIOS_INSTANCE.delete(`/api/v1/organizations/members/${userId}/scopes/${scopeId}`);
