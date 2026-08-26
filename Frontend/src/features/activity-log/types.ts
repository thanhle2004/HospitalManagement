export interface ActivityLogItem {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  metadata: unknown;
  createdAt: string;
}

export interface PaginatedActivityLogs {
  items: ActivityLogItem[];
  total: number;
  page: number;
  limit: number;
}
