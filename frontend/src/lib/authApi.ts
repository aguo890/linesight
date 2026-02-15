/**
 * Auth API client for LineSight.
 * Handles login, registration, and token management.
 */
import api from './api';
import { authStorage } from './authStorage';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface UserInfo {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    organization_id: string;
    timezone?: string;
    preferences?: UserPreferences;
    avatar_url?: string;
}

export type User = UserInfo;

export interface UserPreferences {
    theme?: 'light' | 'dark' | 'system';
    country_code?: string;
    notifications?: boolean;
    locale?: string;
}

export interface UserUpdate {
    full_name?: string;
    timezone?: string;
    preferences?: UserPreferences;
    avatar_url?: string;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
    user: UserInfo;
}

export interface RegisterRequest {
    email: string;
    password: string;
    full_name: string;
    organization_name: string;
    organization_code: string;
}

export interface RegisterResponse {
    message: string;
    user_id: string;
}

/**
 * Authenticate user and get JWT token.
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
    });

    // Store token and user info
    authStorage.setAuth(response.data.access_token, response.data.user);

    return response.data;
}

/**
 * Register a new user and organization.
 */
export async function register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await api.post<RegisterResponse>('/auth/register', data);
    return response.data;
}

/**
 * Clear auth tokens (logout).
 */
export function logout(): void {
    authStorage.clear();
}

/**
 * Get current user info from localStorage.
 */
export function getCurrentUser(): UserInfo | null {
    return authStorage.getUser();
}

/**
 * Check if user is authenticated.
 */
export function isAuthenticated(): boolean {
    return authStorage.isAuthenticated();
}

/**
 * Update user profile
 */
export async function updateProfile(data: UserUpdate): Promise<UserInfo> {
    const response = await api.patch<UserInfo>('/users/me', data);
    // Update local storage if successful
    const currentUser = authStorage.getUser();
    if (currentUser) {
        authStorage.setUser({ ...currentUser, ...response.data });
    }
    return response.data;
}
