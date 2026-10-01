# Simulation Audit

## Executive summary

The simulation layer is implemented as a real flow-driven test harness around the production hospital services rather than as a parallel fake system. The main isolation issue was that teardown relied on an explicit reset/delete path but did not explicitly remove all run-owned routing and room-queue state before deleting the Visit graph. Because RoomRuntime and RoomQueueEntry are keyed by physical room, unfinished state could remain visible when a later run reused that room. Teardown now enumerates run-owned VisitSteps and assignments, deletes their routing and queue rows, and clears only matching RoomRuntime references.

The root cause was in the fake hospital used by the end-to-end simulation test, not in the production service logic itself. The fix preserves the real workflow semantics by keeping the step number for dependency logic while assigning a unique production-style assignment ID per visit step.

## Final phase status summary

- Phase 0: PASS
- Phase 1: PASS
- Phase 2: PASS
- Phase 3: PASS
- Phase 4: PASS
- Phase 5: PASS
- Phase 6: PARTIAL (browser UI and repeated LOCKSTEP workflow passed; live CONCURRENT completion remains unresolved)
- Phase 7: NOT STARTED / future work
- Phase 8: NOT STARTED / future work

## Phase 0 — Simulation fixtures / isolation

- Status: PASS
- Findings:
  - Simulation fixtures are created through dedicated repositories and isolated run-scoped IDs.
  - Cleanup is handled through simulation-run-scoped deletion paths rather than broad production deletes.
  - The simulation uses a bounded fixture allocation so repeated runs do not share the same active synthetic entities.
- Fixes:
  - None required beyond validating isolation boundaries in the simulated run ID model.
- Tests:
  - Existing simulation fixture tests and repository cleanup checks pass.
  - Regression coverage verifies cleanup after completed, failed, and stopped runs, plus safe handling of unlinked legacy Visits.

## Phase 1 — Engine / deterministic scheduler

- Status: PASS
- Findings:
  - `SimulationEngine` is deterministic for the same seed and explicit mode.
  - Event ordering is stable for equal timestamps and scheduler semantics are enforced by sequence ordering and bounded dispatch.
  - The simulation clock is not tied to wall-clock time in the engine core.
- Fixes:
  - No production engine logic change required.
- Tests:
  - `simulation-engine.spec.ts`, `event-scheduler.spec.ts`, `rng.spec.ts`, `simulation-clock.spec.ts` pass.

## Phase 2 — Patient / doctor actors

- Status: PASS
- Findings:
  - Patient generation and doctor polling are implemented as production-service-driven actors.
  - The patient actor waits for routing settlement using `findDetailById()` rather than bypassing the production workflow.
  - The doctor actor calls `getMyQueue()`, `startExam()`, and `completeExam()` through the production doctor service API.
- Fixes:
  - Fixed the fake hospital used by the end-to-end test to assign unique appointment IDs for concurrent patients.
  - Corrected A1 so independent DAG branches may execute concurrently while duplicate same-step or dependent-step service remains a violation.
- Tests:
  - `patient-flow-e2e.spec.ts` passes after the fix.

## Phase 3 — Routing decision recording

- Status: PASS
- Findings:
  - Routing decisions can be persisted to `RoutingDecision` via the routing service repository flow.
  - The production routing engine records the decision point, selected room, and related metadata.
- Fixes:
  - No logic change required in the production layer.
- Tests:
  - Routing strategy tests pass, and the repository layer is present and wired in.

## Phase 4 — Metrics / assertions / API

- Status: PASS
- Findings:
  - Metrics collection, assertion evaluation, and event buffering are implemented as part of the simulation module.
  - Assertions detect the invariant cases described in the project requirements.
- Fixes:
  - No production change required.
- Tests:
  - `simulation-assertions.spec.ts` and `metrics-collector.spec.ts` pass.

## Phase 5 — Concurrency

- Status: PASS (with explicit race-condition guard)
- Findings:
  - The engine supports both lockstep and concurrent execution modes.
  - The in-memory end-to-end harness correctly models FIFO ordering for a single room queue with multiple patients.
  - The concurrency issue was a test-harness bug caused by duplicated assignment IDs, not a production race.
- Fixes:
  - Unique assignment IDs per visit step.
- Tests:
  - Single-room FIFO concurrency test passes.

## Phase 6 — WebSocket + admin simulation UI

- Status: PARTIAL
- Findings:
  - Backend simulation gateway and orchestration service exist and expose live state, status, and event channels.
  - The simulation module is wired to the NestJS WebSocket gateway and controller layer.
  - Browser validation completed: login, dashboard load, scenario creation, live metrics, and RUNNING -> PAUSED -> RUNNING -> STOPPED controls all worked.
  - A clean seeded `CARDIOVASCULAR_SCREENING` run reached `SimulationRun = COMPLETED` and its Visit reached `Visit = COMPLETED` through five production routing decisions, assignments, check-ins, service starts, and service completions.
  - A repeated run using the same five physical rooms also completed with zero violations after the first run was torn down through the application API.
  - A separate live `CONCURRENT` run did not reach a persisted terminal summary within the bounded verification window and was stopped and torn down. Concurrent mode therefore remains unresolved for Phase 6.
- Fixes:
  - Simulation routing is scoped to the rooms configured by the owning SimulationRun.
  - Production-created simulation Visits now persist `simulationRunId` so routing decisions and assertions remain run-scoped.
  - Patient actor walk scheduling is deduplicated per VisitStep to prevent duplicate QR scans when multiple prerequisite completions resume the same Visit.
  - Simulation teardown now explicitly deletes run-owned RoomQueueEntry and RoutingQueue rows, clears matching RoomRuntime references, and handles legacy Visits reachable through run-owned synthetic Patients.
  - A1 now distinguishes illegal dependent overlap from supported independent DAG fan-out.
- Tests:
  - Browser workflow executed against the live backend.
  - Live Run A and repeated Run B each completed with 5/5 routing decisions, assignments, check-ins, service starts, and service completions; both had zero violations.
  - Teardown verification found zero simulation runs, zero room queue entries, and no non-null RoomRuntime pointers for the shared rooms.
  - Final backend regression pass: 31/31 suites, 257/257 tests.

## Production Flow Verification

The live seeded workflow exercised the real production flow through the following persisted sequence:

- Visit creation: yes
- Workflow creation: yes
- DAG resolution: yes
- Routing: yes
- Assignment: yes
- Check-in: yes
- Doctor queue: yes
- Service start: yes
- Service completion: yes
- Next-step routing: yes
- Final completion: yes for run `5408a985-6c0c-4a49-9b28-31652928f563`

Run evidence:

- Scenario: seeded `Tầm soát tim mạch` / `CARDIOVASCULAR_SCREENING`
- Patients: 1
- VisitSteps: 5; completed: 5
- Routing decisions: 5
- Assignments: 5; check-ins: 5; service starts: 5; service completions: 5
- Final Visit status: `COMPLETED`
- DAG order: Vitals first; ECG, Lab, and Ultrasound after Vitals; Cardiology after all three prerequisites
- Violations: 0 for the clean Run A and repeated Run B; the earlier 11-violation result remains invalid historical evidence because it was run before the teardown isolation fix.
- Browser: dashboard loaded, run started, live metrics updated, and final `COMPLETED` metrics were visible

The only issue found was the duplicate assignment ID in the in-memory test harness, which could make two queued patients look like the same assignment in a single-room scenario.

## Known production issues

- The production workflow reached `Visit.COMPLETED` in the live seeded run.
- The simulation isolation/teardown path is now covered by explicit cleanup tests and a live same-room A -> teardown -> B verification.
- The duplicate assignment-ID issue in the in-memory harness was fixed and its focused suite passes.

## Known limitations

- A clean repeated LOCKSTEP verification passed. A separate clean CONCURRENT run was not accepted because it did not reach a persisted terminal summary within the bounded live verification window and required STOP plus teardown.
- The corrected A1 assertion explicitly allows independent ECG/Lab/Ultrasound fan-out after Vitals while retaining dependent-overlap detection.
- Large-load performance profiling (300–500 patients) was not run beyond the project’s unit/integration simulation checks because the core functional issues were resolved first and the repository’s smaller scenario set is the current reliable proving ground.

## Verification evidence

Validation commands and evidence:

```powershell
cd "d:/IU IT/Y5-S1/Thesis/HospitalManagement/Backend"; npm run typecheck
cd "d:/IU IT/Y5-S1/Thesis/HospitalManagement/Backend"; npm run test:ci
cd "d:/IU IT/Y5-S1/Thesis/HospitalManagement/Frontend"; npm run typecheck
cd "d:/IU IT/Y5-S1/Thesis/HospitalManagement/Frontend"; npm run lint
```

Backend regression: 31 suites and 257 tests passed. Backend/frontend typechecks and frontend lint passed. Two clean same-room LOCKSTEP runs reached `Visit.COMPLETED` with zero violations and complete five-step persisted evidence. The live CONCURRENT run did not reach a persisted terminal summary and was stopped and torn down, so the final Phase 6 decision remains **PARTIAL**. Phase 7 remains **NOT STARTED**.
