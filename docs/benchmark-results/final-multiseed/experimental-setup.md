# Experimental Setup

> **Data provenance.** All statistics, tables, and figures in this reporting package were generated programmatically from the frozen 900-run dataset (`raw-results.csv`). Aggregates and paired comparisons were independently recomputed and matched the corresponding frozen CSV files; no values were manually transcribed.

## Objective and research questions

The experiment evaluated five routing algorithms under controlled changes in workflow topology and expected service-time heterogeneity. It examined whether the production Min Estimated Waiting Time strategy (SYSTEM) behaves like Shortest Queue when expected service times are homogeneous, whether heterogeneous times create a measurable advantage, whether any advantage is concentrated in mean or tail waiting, and how dependency structure changes routing performance.

## Benchmark architecture and algorithms

The evaluation used a controlled standalone, in-memory algorithm benchmark with virtual time. It is not an evaluation of a full production hospital deployment. SYSTEM directly instantiated the production `MinEstimatedWaitingTimeStrategy`; the comparators were Shortest Queue, Round Robin, Least Utilised, and seeded Random. Each run used a fresh strategy instance, preventing state leakage between runs.

## Workflows and processing-time profiles

Every workflow contained services A–E, with two equivalent rooms per service. Independent contained no dependency edges. Sequential used A→B→C→D→E. Partial Dependency used A→C, B→D, C→E, and D→E. In the homogeneous profile, every expected service time was 300 seconds. In the heterogeneous profile, expected times were A=300, B=600, C=420, D=900, and E=240 seconds.

## Patient workload and deterministic durations

Each run contained 100 patients arriving at fixed benchmark intervals. Actual duration was deterministic for each seed–patient–service tuple and uniformly distributed from 80% to 120% of the service expectation. Consequently, algorithms compared under the same seed received the same materialized workload.

## Paired-seed design

The final experiment used 30 explicitly recorded seeds (20261001–20261030). Crossing two profiles, three workflows, five algorithms, and 30 seeds produced 900 runs. Pairing algorithms by seed controls workload realization when calculating algorithm differences: a difference for a seed reflects routing behavior rather than a different set of sampled service durations.

## Metrics and statistical aggregation

Step Waiting Time was defined as `SERVICE_STARTED − ROOM_QUEUE_ENTERED`; READY time was not counted as room waiting. Average LOS was `PATIENT_COMPLETED − PATIENT_ARRIVAL`. Throughput was completed patients divided by simulated hours. Per-room utilisation was busy time divided by simulation time, and aggregate utilisation was the arithmetic mean across rooms. P95 was calculated over individual completed-step waiting times.

For each profile–workflow–algorithm combination, the analysis reports N, mean, sample standard deviation, median, minimum, maximum, and a two-sided 95% Student-t confidence interval for the mean with 29 degrees of freedom. Paired comparisons align SYSTEM and each baseline by seed. No hypothesis test or claim of universal dominance was added.

## Reproducibility and scope

The configuration, seed list, raw results, aggregates, paired comparisons, generation script, tables, and figures are stored together. All 900 runs completed 100 patients and passed completeness and finite-value checks. The benchmark isolates routing-algorithm behavior under specified synthetic conditions; it does not reproduce emergency interruptions, clinical-priority variation, staff schedules, room failures, no-shows, or real hospital arrival processes.
