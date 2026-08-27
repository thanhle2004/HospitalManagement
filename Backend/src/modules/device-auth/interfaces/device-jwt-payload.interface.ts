export interface DeviceJwtPayload {
  /** device id (uuid) */
  sub: string;
  tokenVersion?: number;
  /** Chỉ còn để đọc token legacy; token mới không cần nhúng code. */
  code?: string;
}
