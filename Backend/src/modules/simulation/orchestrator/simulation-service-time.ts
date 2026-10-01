/** Resolve a business duration without leaving the seconds domain.  The only
 * seconds -> milliseconds conversion happens when DoctorSimulator puts the
 * resulting SERVICE_END event on the scheduler. */
export function resolveSimulationServiceTimeSeconds(
  roomAvgProcessTimeSeconds: number | null,
  roomTypeAvgProcessTimeSeconds: number | null,
  fixedServiceTimeSeconds: number,
  useRoomTypeAvgProcessTime = true,
): number {
  if (!useRoomTypeAvgProcessTime) return fixedServiceTimeSeconds;
  return (
    roomAvgProcessTimeSeconds ??
    roomTypeAvgProcessTimeSeconds ??
    fixedServiceTimeSeconds
  );
}
