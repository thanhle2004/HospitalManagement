export interface ActivityLogItem {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown | null;
  createdAt: string;
}

export interface PaginatedActivityLogs {
  items: ActivityLogItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ActivityLogFilters {
  entity?: string;
  entityId?: string;
  userId?: string;
  page: number;
  limit: number;
}
