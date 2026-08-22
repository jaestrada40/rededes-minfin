import { apiGet, apiPatch, apiPost } from './client';

export interface BackendUser {
  id: string;
  email: string;
  name: string;
  department: string | null;
  role: string;
  mfaEnabled: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listUsers(): Promise<BackendUser[]> {
  return apiGet<BackendUser[]>('/users');
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: string;
  department?: string;
}

export function createUser(input: CreateUserInput): Promise<BackendUser> {
  return apiPost<BackendUser>('/users', input);
}

export function updateUserRole(id: string, role: string): Promise<BackendUser> {
  return apiPatch<BackendUser>(`/users/${id}/role`, { role });
}

export interface UpdateUserInput {
  name?: string;
  department?: string;
  email?: string;
}

export function updateUser(id: string, input: UpdateUserInput): Promise<BackendUser> {
  return apiPatch<BackendUser>(`/users/${id}`, input);
}

export function setUserActive(id: string, isActive: boolean): Promise<BackendUser> {
  return apiPatch<BackendUser>(`/users/${id}/status`, { isActive });
}

export function resetUserMfa(id: string): Promise<BackendUser> {
  return apiPatch<BackendUser>(`/users/${id}/reset-mfa`);
}

export function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiPatch<void>('/users/me/password', { currentPassword, newPassword });
}

export function adminSetUserPassword(id: string, newPassword: string): Promise<void> {
  return apiPatch<void>(`/users/${id}/password`, { newPassword });
}
