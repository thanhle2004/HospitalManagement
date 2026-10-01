export interface Permission {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  assignedUserCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateRolePayload {
  code: string;
  name: string;
  description?: string;
  permissionCodes: string[];
}
