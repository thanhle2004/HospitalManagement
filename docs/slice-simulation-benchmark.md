# Owner-approved Simulation Benchmark Exception

Ngày hoàn tất: **2026-10-02**
Trạng thái: **METHODOLOGY CORRECTED — chờ owner review experimental protocol**

## Delivered

- Pure deterministic in-memory scenario generator cho 1–1.000 patients.
- Independent, Sequential và Partial Dependency workflow templates.
- Single/compare runner cho System, Shortest Queue, Round Robin, seeded Random và Least Utilised.
- Shared production `MinEstimatedWaitingTimeStrategy` cho System Algorithm; fresh strategy instance per run.
- Virtual-time workflow lifecycle, bounded event replay, room/service visualization và thesis-focused metrics/comparison charts.
- API riêng `/simulation/benchmark/run|compare`, OpenAPI snapshot/generated frontend types và drift gate.
- Production Workflow Simulator được giữ nguyên như database-backed integration/regression harness.

## Research Benchmark Correction

- Thay hard-coded 90 giây bằng service-level expected processing profiles: homogeneous control và predefined heterogeneous services.
- Actual duration deterministic theo seed/patient/service trong khoảng 80–120% expected; không phụ thuộc room.
- Candidate set gồm các READY service của patient, giữ mỗi patient tối đa một active route; SYSTEM và Shortest Queue có thể khác objective trong heterogeneous condition.
- Round Robin nhận stable benchmark step identity nên không còn reset mỗi decision; shared strategy và production routing không đổi.
- UI công khai workflow, profile, expected times, rooms, seed, deterministic scenario fingerprint và metric labels đúng cấp độ.
- Least Utilised vẫn là observation-based heuristic; benchmark utilization là time-weighted metric riêng.

## Verification boundary

Không sửa `RoutingEngineService`, production strategy implementation, candidate construction, routing transaction/state/schema hoặc Visit/check-in/queue/runtime semantics. Không có Prisma migration.

Benchmark candidate projection và lifecycle là model in-memory tối thiểu; vì vậy claim chính xác là cùng production room-selection strategy implementation, không phải toàn bộ production routing pipeline.

Verification hoàn tất:

- Focused benchmark backend: 2 suites / 23 tests pass.
- Full backend gồm routing và production-integrated simulation: 49 suites / 392 tests pass.
- Frontend unit: 5 tests pass; full Playwright: 9 tests pass, trong đó 5 benchmark UX cases.
- Backend/frontend lint, typecheck và production build pass.
- OpenAPI generation pass; benchmark endpoints nằm trong generated contract drift boundary và frontend response types derive từ artifact đó.
- Prisma schema validate, 11-migration status, zero drift và reconciliation 25 checks/0 errors/0 warnings pass. Không có schema change.

## Roadmap

Đây là exception do owner phê duyệt để phục vụ thesis research, không mở lại Foundation và không tạo platform roadmap mới. Business roadmap, gồm **2A Appointment Foundation**, đang **PAUSED by owner for routing-algorithm research**. Sau correction phải chờ owner review và chốt experimental protocol.
