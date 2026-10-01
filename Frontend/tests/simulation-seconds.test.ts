import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCreateSimulationRunPayload,
  formatEstimatedWaitingSeconds,
  formatSimulationPatientName,
} from "../src/features/simulation/presentation.ts";

test("scenario payload sends service duration in seconds and omits walking time", () => {
  const payload = buildCreateSimulationRunPayload({
    name: "Seconds contract",
    seed: 42,
    flowId: 7,
    patientCount: 3,
    arrivalKind: "BURST",
    intervalSeconds: 120,
    noShowPercent: 0,
    selectedRoomIds: [11],
    useRoomTypeAvgProcessTime: false,
    serviceTimeSeconds: 90,
    clockPolicy: "ASAP",
    speed: 1,
  });

  assert.equal(payload.rooms[0]?.serviceTimeMeanSeconds, 90);
  assert.equal("serviceTimeMeanMs" in payload.rooms[0]!, false);
  assert.equal("walkToRoomMs" in payload, false);
});

test("hospital board renders an ETA that is already in seconds without conversion", () => {
  assert.equal(formatEstimatedWaitingSeconds(270), "270 giây");
});

test("simulation patient UUID can be presented as a stable sequential label", () => {
  assert.equal(
    formatSimulationPatientName("Bệnh nhân mô phỏng P0007"),
    "Bệnh nhân 7",
  );
});
