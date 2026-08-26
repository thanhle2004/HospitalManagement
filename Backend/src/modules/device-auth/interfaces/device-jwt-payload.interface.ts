export interface DeviceJwtPayload {
  /** device id (uuid) */
  sub: string;
  code: string;
}
