# Thesis Evaluation Draft

> **Data provenance.** All statistics, tables, and figures in this reporting package were generated programmatically from the frozen 900-run dataset (`raw-results.csv`). Aggregates and paired comparisons were independently recomputed and matched the corresponding frozen CSV files; no values were manually transcribed.

## 1. Experimental Setup

### Objective and research questions

The experiment evaluated five routing algorithms under controlled changes in workflow topology and expected service-time heterogeneity. It examined whether the production Min Estimated Waiting Time strategy (SYSTEM) behaves like Shortest Queue when expected service times are homogeneous, whether heterogeneous times create a measurable advantage, whether any advantage is concentrated in mean or tail waiting, and how dependency structure changes routing performance.

### Benchmark architecture and algorithms

The evaluation used a controlled standalone, in-memory algorithm benchmark with virtual time. It is not an evaluation of a full production hospital deployment. SYSTEM directly instantiated the production `MinEstimatedWaitingTimeStrategy`; the comparators were Shortest Queue, Round Robin, Least Utilised, and seeded Random. Each run used a fresh strategy instance, preventing state leakage between runs.

### Workflows and processing-time profiles

Every workflow contained services A–E, with two equivalent rooms per service. Independent contained no dependency edges. Sequential used A→B→C→D→E. Partial Dependency used A→C, B→D, C→E, and D→E. In the homogeneous profile, every expected service time was 300 seconds. In the heterogeneous profile, expected times were A=300, B=600, C=420, D=900, and E=240 seconds.

### Patient workload and deterministic durations

Each run contained 100 patients arriving at fixed benchmark intervals. Actual duration was deterministic for each seed–patient–service tuple and uniformly distributed from 80% to 120% of the service expectation. Consequently, algorithms compared under the same seed received the same materialized workload.

### Paired-seed design

The final experiment used 30 explicitly recorded seeds (20261001–20261030). Crossing two profiles, three workflows, five algorithms, and 30 seeds produced 900 runs. Pairing algorithms by seed controls workload realization when calculating algorithm differences: a difference for a seed reflects routing behavior rather than a different set of sampled service durations.

### Metrics and statistical aggregation

Step Waiting Time was defined as `SERVICE_STARTED − ROOM_QUEUE_ENTERED`; READY time was not counted as room waiting. Average LOS was `PATIENT_COMPLETED − PATIENT_ARRIVAL`. Throughput was completed patients divided by simulated hours. Per-room utilisation was busy time divided by simulation time, and aggregate utilisation was the arithmetic mean across rooms. P95 was calculated over individual completed-step waiting times.

For each profile–workflow–algorithm combination, the analysis reports N, mean, sample standard deviation, median, minimum, maximum, and a two-sided 95% Student-t confidence interval for the mean with 29 degrees of freedom. Paired comparisons align SYSTEM and each baseline by seed. No hypothesis test or claim of universal dominance was added.

### Reproducibility and scope

The configuration, seed list, raw results, aggregates, paired comparisons, generation script, tables, and figures are stored together. All 900 runs completed 100 patients and passed completeness and finite-value checks. The benchmark isolates routing-algorithm behavior under specified synthetic conditions; it does not reproduce emergency interruptions, clinical-priority variation, staff schedules, room failures, no-shows, or real hospital arrival processes.

## 2. Results

### Homogeneous workload

SYSTEM and Shortest Queue produced identical results for every recorded metric in Independent, Partial Dependency, and Sequential workflows across all 30 paired seeds. This empirical convergence is visible in Figures 1–3 and Table 2. Equal expected processing times remove the service-time distinction used by SYSTEM's workload estimate.

### Heterogeneous workload

Under Independent routing, SYSTEM's mean average step wait was 4100.96 seconds compared with 4124.85 seconds for Shortest Queue. Under Partial Dependency, the corresponding means were 4238.03 and 4268.45 seconds. Sequential results remained identical because only one service was eligible at each decision.

### Mean and tail waiting

SYSTEM reduced mean waiting relative to Shortest Queue by 0.58% in Independent and 0.71% in Partial Dependency. The paired mean differences were 23.89 seconds (95% CI 16.65–31.13) and 30.41 seconds (95% CI 27.05–33.77).

The larger effect occurred in the tail. P95 waiting decreased by 13.27% in Independent, a paired difference of 2065.43 seconds (95% CI 1862.89–2267.98), and by 11.96% in Partial Dependency, a difference of 1824.50 seconds (95% CI 1571.28–2077.72). Figure 4 makes the zero-effect controls and heterogeneous routing-freedom effects explicit.

### Length of stay

Average LOS decreased by 0.52% in heterogeneous Independent, corresponding to 119.46 seconds (95% CI 83.24–155.67). Partial Dependency decreased by 0.64%, or 152.06 seconds (95% CI 135.25–168.86).

### Throughput and utilisation

SYSTEM's throughput difference from Shortest Queue was -0.02/h in heterogeneous Independent (95% CI -0.06 to 0.03) and -0.00/h in Partial Dependency (95% CI -0.03 to 0.02). Both intervals include zero, so these throughput differences are not clearly distinguishable from seed-to-seed variability. Utilisation should be interpreted as a descriptive outcome rather than an objective for which higher is universally preferable.

### Other baselines and trade-offs

The alternative algorithms did not produce a single consistent ordering across metrics. In Homogeneous Independent, Least Utilised had a higher mean average wait (1724.68 seconds) than SYSTEM (1378.37 seconds), but a lower mean P95 (7061.27 versus 9016.87 seconds). Round Robin also had a lower homogeneous Sequential mean wait than SYSTEM. These crossovers preclude a universal winner interpretation.

### Figures

![Figure 1. Mean average step waiting time by algorithm, with 95% confidence intervals.](figures/figure-1-mean-step-wait.png)

![Figure 2. Mean P95 step waiting time by algorithm, with 95% confidence intervals.](figures/figure-2-p95-step-wait.png)

![Figure 3. Mean average length of stay by algorithm, with 95% confidence intervals.](figures/figure-3-average-los.png)

![Figure 4. Paired P95 waiting-time improvement of SYSTEM relative to Shortest Queue.](figures/figure-4-system-vs-shortest-queue-p95.png)

![Figure 5. Workflow-topology comparison for SYSTEM under both processing profiles.](figures/figure-5-system-workflow-topology.png)

## 3. Discussion

The results are consistent with the information available at each routing decision. When expected processing times are homogeneous, multiplying queue workload by expected time does not add a service-specific discriminator. SYSTEM therefore collapses toward the same ordering as Shortest Queue, producing identical outcomes in this benchmark.

Heterogeneous processing times alone are insufficient to create a difference. In Sequential workflow, dependencies expose only one service at a time. Because the two rooms for that service share the same expectation, SYSTEM has no cross-service choice on which to apply heterogeneous workload information. Its results consequently remain identical to Shortest Queue.

Independent and Partial Dependency combine heterogeneous expected times with moments when several services can be eligible. This creates a meaningful choice between queues whose counts may be similar but whose expected workloads differ. Under these evaluated conditions, SYSTEM's mean-wait reduction was modest, whereas its P95 reduction was much larger. This pattern suggests that the strategy primarily mitigated queue imbalance and extreme waits rather than shifting the entire waiting-time distribution by the same proportion. That mechanism is consistent with the benchmark design, but distribution-level diagnostics beyond the recorded aggregate and P95 metrics would be required to establish precisely which patients and services generated the tail change.

Workflow topology also affected absolute performance. For heterogeneous SYSTEM, Independent had the lowest mean average step wait, Partial Dependency was intermediate, and Sequential was highest. Greater routing freedom allowed the strategy to select among more eligible services. This observation is specific to the modeled arrival process, service times, room counts, and one-active-room-per-patient rule.

The Least Utilised counterexample demonstrates why the algorithms should not be ranked by one metric. Its Homogeneous Independent P95 was lower than SYSTEM's even though its mean wait, LOS, throughput, and aggregate utilisation were less favorable. A possible explanation is that its observation-based selection redistributes waiting unevenly in a way that changes the upper percentile without improving the mean; this remains speculative because the experiment did not record distributional decomposition by service or patient cohort. The defensible conclusion is a trade-off, not superiority of either policy.

Throughput and utilisation likewise require caution. Finite-run throughput depends on the final simulated completion time, and utilisation is averaged across all rooms. Neither is a direct substitute for patient waiting outcomes. The SYSTEM–Shortest Queue throughput confidence intervals included zero in the heterogeneous workflows where waiting differed, so the data do not support a clear throughput advantage.

## 4. Threats to Validity

### Internal validity

The deterministic simulator, explicit seeds, paired workload construction, and fresh strategy instances reduce uncontrolled variation. The benchmark underwent a semantic audit confirming that Step Waiting Time begins at room queue entry and that a patient cannot occupy multiple room services concurrently. Regression tests cover lifecycle and metric reconstruction. Nevertheless, the benchmark is an implementation-specific abstraction; defects not exercised by those tests could influence results.

### Construct validity

Step Waiting Time measures only time spent in an assigned room queue. Time during which a workflow step is READY but not selected is intentionally excluded. P95 is calculated over all completed step waits, not patient-level LOS or per-patient worst waits. Throughput is completed patients per finite simulated run hour rather than steady-state capacity. Aggregate room utilisation is the arithmetic mean of room busy-time ratios, which may conceal service-level imbalance.

### External validity

Patients and durations are synthetic, arrivals use the benchmark's fixed process, and service times follow fixed 80%–120% uniform ranges. Every service has exactly two equivalent rooms. The model does not represent real empirical arrival distributions, emergency interruptions, staff breaks, room failures, patient no-shows, or clinical-priority variation beyond behavior explicitly present in the benchmark. Findings therefore apply to the controlled standalone algorithm benchmark and must not be presented as a real hospital deployment evaluation.

### Statistical conclusion validity

The evaluation used 30 deterministic paired seeds. Student-t intervals quantify seed-to-seed variation within this design, but the seeds do not constitute a random sample of all possible hospitals or operating conditions. No multiplicity-adjusted hypothesis-testing framework was applied, and confidence intervals should not be converted into claims of universal significance. Exact equality in control scenarios reflects this implementation and design. Cross-metric trade-offs further prevent a universal dominance claim.

## 5. Conclusion

Across 30 paired deterministic seeds, SYSTEM and Shortest Queue were identical when expected processing times were homogeneous and when Sequential dependencies exposed only one eligible service. Under heterogeneous Independent and Partial Dependency workflows, SYSTEM produced modest mean-wait reductions of 0.58% and 0.71%, respectively, while P95 waiting decreased by the substantially larger amounts of 13.27% and 11.96%. The evaluated evidence therefore indicates that workload-aware routing's principal benefit was tail-wait mitigation when heterogeneous services and routing freedom occurred together. Other algorithms crossed over on individual metrics, so the results do not support universal superiority or optimality claims.
