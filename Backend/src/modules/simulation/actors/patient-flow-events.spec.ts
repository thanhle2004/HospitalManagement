import { buildRoomFixtureMaps } from './patient-flow-events';

describe('buildRoomFixtureMaps', () => {
  it('maps each room to its device and doctor when both are present', () => {
    const { roomIdToDeviceId, roomIdToDoctorId } = buildRoomFixtureMaps([
      { roomId: 10, doctorUserId: 'doc-1', deviceId: 'dev-1' },
      { roomId: 20, doctorUserId: 'doc-2', deviceId: 'dev-2' },
    ]);

    expect(roomIdToDeviceId.get(10)).toBe('dev-1');
    expect(roomIdToDeviceId.get(20)).toBe('dev-2');
    expect(roomIdToDoctorId.get(10)).toBe('doc-1');
    expect(roomIdToDoctorId.get(20)).toBe('doc-2');
  });

  it('omits a room from a map when that fixture was not provisioned (withDoctor/withDevice: false)', () => {
    const { roomIdToDeviceId, roomIdToDoctorId } = buildRoomFixtureMaps([
      { roomId: 10, doctorUserId: null, deviceId: 'dev-1' },
      { roomId: 20, doctorUserId: 'doc-2', deviceId: null },
    ]);

    expect(roomIdToDeviceId.has(10)).toBe(true);
    expect(roomIdToDoctorId.has(10)).toBe(false);
    expect(roomIdToDeviceId.has(20)).toBe(false);
    expect(roomIdToDoctorId.has(20)).toBe(true);
  });

  it('returns empty maps for an empty room list', () => {
    const { roomIdToDeviceId, roomIdToDoctorId } = buildRoomFixtureMaps([]);
    expect(roomIdToDeviceId.size).toBe(0);
    expect(roomIdToDoctorId.size).toBe(0);
  });
});