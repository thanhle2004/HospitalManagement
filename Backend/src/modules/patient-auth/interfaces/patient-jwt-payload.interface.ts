export interface PatientJwtPayload {
  /** patient id (uuid) */
  sub: string;
  phone: string;
}
