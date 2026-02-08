export type AdminRole = 'superadmin' | 'editor' | 'operator';

export interface AdminUser {
  id: number;
  email: string;
  role: AdminRole;
  is_active: boolean;
}
