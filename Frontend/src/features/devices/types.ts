export type DeviceStatus = "ACTIVE" | "INACTIVE";
export type DeviceType = "QR_SCANNER";

export interface Device {
  id: string;
  code: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  lastHeartbeatAt: string | null;
  appVersion: string | null;
  room: { id: number; roomNumber: string; name: string };
  createdAt: string;
}

export interface DeviceWithSecret extends Device {
  secret: string;
}

export interface CreateDevicePayload {
  code: string;
  name: string;
  roomId: number;
  type?: DeviceType;
}

export interface UpdateDevicePayload {
  name?: string;
  roomId?: number;
  appVersion?: string;
}
