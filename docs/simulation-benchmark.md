# Simulation Architecture — Workflow Regression and Research Benchmark

Ngày cập nhật: **2026-10-02**

## Hai simulation path độc lập

Production Workflow Simulator dùng production services, MySQL/Prisma, Visit/routing/check-in/Doctor workflow và concurrency diagnostics. Đây là integration/regression harness.

Pure Algorithm Benchmark (`POST /simulation/benchmark/run|compare`) chạy in-memory với logical IDs, virtual time và seeded RNG. Nó không tạo production record. `SYSTEM` resolve trực tiếp tới production `MinEstimatedWaitingTimeStrategy`; benchmark không có bản copy của comparator này.

> The benchmark shares the production room-selection strategy implementation but does not reproduce the complete production routing pipeline.

## Scenario và processing profiles

Mỗi Service định nghĩa dependencies, expected average processing time và hai room. Business assumption bắt buộc: các room thuộc cùng Service/RoomType dùng cùng expected processing time.

- `HOMOGENEOUS`: A/B/C/D/E đều 300 giây. Đây là control condition; với cùng candidate set và tie-break tương thích, `SYSTEM` và `SHORTEST_QUEUE` có cùng objective ordering.
- `HETEROGENEOUS`: A=300, B=600, C=420, D=900, E=240 giây. Khác biệt chỉ nằm giữa service, không nằm giữa room cùng service.

Expected time là thông tin strategy biết. SYSTEM tối thiểu hóa proxy:

```text
estimatedWaitingSeconds =
  (inServiceCount + waitingCount)
  × expectedAverageProcessTimeSeconds(service)
```

Actual duration là workload ẩn được materialize một lần cho mỗi `(seed, patient, service)` theo uniform range `[80%, 120%]` quanh expected time, làm tròn tới giây. Nó không phụ thuộc room và strategy không được nhìn trước actual duration.

Patient đến cách nhau 10 giây virtual. Workflow giữ nguyên:

- `INDEPENDENT`: A, B, C, D, E cùng sẵn sàng.
- `SEQUENTIAL`: A → B → C → D → E.
- `PARTIAL`: A → C và B → D, sau đó C/D hội tụ tại E.

Một patient chỉ có một queued/in-service step tại một thời điểm; khi nhiều step READY, chúng cùng xuất hiện trong candidate set. Điều này cho phép heterogeneous service characteristics ảnh hưởng objective mà không tạo room heterogeneity.

## Reproducibility và fair compare

Cùng config + seed tạo đúng cùng materialized scenario, actual durations, deterministic result và SHA-256-derived `SCN-…` fingerprint. Compare materialize scenario một lần rồi deep-clone cho mọi algorithm; arrival, workflow, profile và durations giống nhau. Không dùng wall clock hoặc uncontrolled `Math.random()`.

Mỗi run dùng strategy instance mới. Round Robin dùng stable service/step identity cùng eligible-room set, vì vậy stable two-room set quay `1 → 2 → 1 → 2`; transient per-decision identity cũ đã làm vòng quay reset. `LEAST_UTILISED` vẫn là observation-based busy ratio tại các routing decision, không phải time-weighted utilization và chưa được redesign.

## Metric definitions

- **Average/P95/Max Step Waiting Time**: phân phối trên step, `serviceStartedAt - roomQueueEnteredAt`. Trạng thái READY chỉ biểu thị dependency đã thỏa và không bắt đầu room waiting time.
- **Average Length of Stay**: patient-level, `patient completion - patient arrival`.
- **Throughput**: `completed patients / total simulated elapsed time`; đây là observed finite-run completion throughput, không phải steady-state hospital capacity.
- **Room Utilization**: từng room `busy time / simulation elapsed time`; aggregate là trung bình các room. Đây là time-weighted result metric, độc lập với observation heuristic của Least Utilised.
- **Completed Patient Count**: số patient hoàn tất toàn bộ required steps.

Event trace response giới hạn 2.000 entries; metrics vẫn tính toàn run (tối đa 1.000 patients).

## Research boundary và limitations

UI hiển thị patient count, workflow graph, processing profile, expected time/rooms, seed và scenario fingerprint; System chỉ được nhận diện là production algorithm, không được gắn nhãn winner. Slice này không có custom tuning, multi-seed replication, confidence interval, significance testing hoặc composite score.

Candidate projection và lifecycle là benchmark semantics, không phải production candidate construction/transaction/state machine. Production `RoutingEngineService`, default strategy, priority/FIFO, RoutingQueue, VisitAssignment, VisitToken, RoomRuntime, QR/check-in và events không đổi.
