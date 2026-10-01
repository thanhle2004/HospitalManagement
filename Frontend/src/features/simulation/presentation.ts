import type {
  CreateSimulationRunPayload,
  SimulationClockPolicy,
  SimulationSpeed,
} from "./types";

export interface ScenarioPayloadInput {
  name: string;
  seed: number;
  flowId: number;
  patientCount: number;
  arrivalKind: "FIXED" | "BURST";
  intervalSeconds: number;
  noShowPercent: number;
  selectedRoomIds: number[];
  useRoomTypeAvgProcessTime: boolean;
  serviceTimeSeconds: number;
  clockPolicy: SimulationClockPolicy;
  speed: SimulationSpeed;
}

/**
 * Build the API payload at the UI boundary. Business durations stay in seconds;
 * only simulation clock/event fields (for example arrival.intervalMs) use ms.
 */
export function buildCreateSimulationRunPayload(
  input: ScenarioPayloadInput,
): CreateSimulationRunPayload {
  return {
    name: input.name.trim(),
    seed: input.seed,
    flowId: input.flowId,
    patientCount: input.patientCount,
    arrival:
      input.arrivalKind === "FIXED"
        ? { kind: "FIXED", intervalMs: input.intervalSeconds * 1000 }
        : { kind: "BURST", atMs: 0 },
    noShowProbability: input.noShowPercent / 100,
    rooms: input.selectedRoomIds.map((roomId) => ({
      roomId,
      useRoomTypeAvgProcessTime: input.useRoomTypeAvgProcessTime,
      serviceTimeMeanSeconds: input.serviceTimeSeconds,
    })),
    clockPolicy: input.clockPolicy,
    speed: input.clockPolicy === "PACED" ? input.speed : undefined,
  };
}

/** ETA from the simulation room-state API is already expressed in seconds. */
export function formatEstimatedWaitingSeconds(seconds: number): string {
  return `${Math.max(0, Math.round(seconds))} giây`;
}

/** Synthetic names end in P0001, P0002...; keep UUIDs as technical keys
 * while presenting a compact, stable label to operators. */
export function formatSimulationPatientName(patientName: string): string {
  const match = patientName.match(/P0*(\d+)$/i);
  return match ? `Bệnh nhân ${Number(match[1])}` : patientName;
}
