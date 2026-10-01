# Owner-approved Simulation Benchmark Exception

Ngày hoàn tất: **2026-10-02**
Trạng thái: **COMPLETE — roadmap trở lại Slice 2A**

## Delivered

- Pure deterministic in-memory scenario generator cho 1–1.000 patients.
- Independent, Sequential và Partial Dependency workflow templates.
- Single/compare runner cho System, Shortest Queue, Round Robin, seeded Random và Least Utilised.
- Shared production `MinEstimatedWaitingTimeStrategy` cho System Algorithm; fresh strategy instance per run.
- Virtual-time workflow lifecycle, bounded event replay, room/service visualization và thesis-focused metrics/comparison charts.
- API riêng `/simulation/benchmark/run|compare`, OpenAPI snapshot/generated frontend types và drift gate.
- Production Workflow Simulator được giữ nguyên như database-backed integration/regression harness.

## Verification boundary

Không sửa `RoutingEngineService`, production strategy implementation, candidate construction, routing transaction/state/schema hoặc Visit/check-in/queue/runtime semantics. Không có Prisma migration.

Benchmark candidate projection và lifecycle là model in-memory tối thiểu; vì vậy claim chính xác là cùng production room-selection strategy implementation, không phải toàn bộ production routing pipeline.

Verification hoàn tất:

- Focused benchmark backend: 2 suites / 17 tests pass.
- Full backend gồm routing và production-integrated simulation: 49 suites / 386 tests pass.
- Frontend unit: 5 tests pass; full Playwright: 8 tests pass, trong đó 4 benchmark UX cases.
- Backend/frontend lint, typecheck và production build pass.
- OpenAPI generation pass; benchmark endpoints nằm trong generated contract drift boundary và frontend response types derive từ artifact đó.
- Prisma schema validate, 11-migration status, zero drift và reconciliation 25 checks/0 errors/0 warnings pass. Không có schema change. Local `prisma generate` vẫn bị Windows khóa query-engine DLL do backend `start:dev` đang chạy; không dừng developer process trong slice.

## Roadmap

Đây là exception do owner phê duyệt để phục vụ thesis experiment/demo, không mở lại Foundation và không tạo platform roadmap mới. Sau commit này, next business slice vẫn là **2A Appointment Foundation**, chỉ bắt đầu khi có phê duyệt riêng.
