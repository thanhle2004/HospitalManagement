# Simulation Architecture — Workflow Regression and Algorithm Benchmark

Ngày cập nhật: **2026-10-02**

## Hai simulation path độc lập

### Production Workflow Simulator

Simulator hiện hữu tiếp tục dùng production services, MySQL/Prisma, Visit/routing/check-in/Doctor workflow và concurrency diagnostics. Mục đích của path này là integration/regression; nó không phải runner để đổi production routing strategy.

### Pure Algorithm Benchmark

Benchmark tại `POST /simulation/benchmark/run` và `POST /simulation/benchmark/compare` chạy hoàn toàn in-memory, không tạo Patient/Visit/Room/Device/Staff hoặc simulation record trong database. Scenario dùng logical IDs, virtual time và seeded RNG.

> The System Algorithm benchmark uses the same production `MinEstimatedWaitingTimeStrategy` implementation for room selection. The benchmark does not reproduce the entire production routing pipeline; candidate projection and execution lifecycle are simulated in-memory.

`SYSTEM` được resolve trực tiếp thành production class `MinEstimatedWaitingTimeStrategy`; không tồn tại implementation comparator/ETA thứ hai. Benchmark còn hỗ trợ `SHORTEST_QUEUE`, `ROUND_ROBIN`, seeded `RANDOM` và `LEAST_UTILISED`. Mỗi algorithm/run có strategy instance mới nên state của Round Robin/Least Utilised không rò giữa run.

## Deterministic scenario

- Patient ID: `P001`, `P002`, ...; arrival cách nhau 10 giây virtual.
- Mỗi service có hai room logical: `ROOM_A_1`, `ROOM_A_2`, ...
- Service duration được materialize một lần từ seed và patient/service key; compare clone cùng immutable scenario cho mọi algorithm.
- Không dùng wall clock, production database ID hoặc uncontrolled `Math.random()` trong benchmark semantics.
- Response event trace được giới hạn 2.000 entries; metrics vẫn tính trên toàn run tối đa 1.000 patients.

Workflow templates:

- `INDEPENDENT`: A, B, C, D không phụ thuộc nhau.
- `SEQUENTIAL`: A → B → C → D.
- `PARTIAL`: A/B song song; C phụ thuộc A; D phụ thuộc B; E phụ thuộc C và D.

## In-memory lifecycle và metrics

Benchmark materialize patient/step/dependency/room/queue/active-service state tối thiểu. Nó unlock dependency, project `RoutingCandidate[]`, gọi shared strategy, enqueue FIFO, start/finish service theo virtual time và hoàn tất patient khi mọi required step completed.

Primary metrics gồm average/P95/max waiting time, average length of stay, throughput per simulated hour, average room utilization và completed patient count. UI không tạo composite score và chỉ highlight System Algorithm để nhận diện, không hard-code winner.

## Boundary và limitations

- Candidate projection là benchmark semantics, không copy hoặc thay thế production candidate construction.
- Benchmark chứng minh dùng cùng production **room-selection strategy implementation**, không chứng minh tương đương toàn bộ routing pipeline/transaction/state machine.
- `LEAST_UTILISED` giữ nguyên semantics observation-ratio của production strategy class; đó không phải time-weighted utilization.
- Production routing configuration/default, transaction, claim/recheck, RoutingQueue, VisitAssignment, VisitToken, check-in, RoomRuntime và events không đổi.
