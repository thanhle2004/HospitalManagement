export interface PatientJwtPayload {
  /** patient id (uuid) */
  sub: string;
  tokenVersion?: number;
  /** Chỉ còn để đọc token legacy; token mới không nhúng số điện thoại. */
  phone?: string;
}
