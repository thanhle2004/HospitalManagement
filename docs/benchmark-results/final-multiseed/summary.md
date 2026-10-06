# Final Multi-Seed Simulation Benchmark

Generated: 2026-10-05T16:56:36.180Z

Design: 30 paired seeds × 2 profiles × 3 workflows × 5 algorithms; 100 patients per run.

Intervals are two-sided 95% Student-t confidence intervals for the mean (df = n − 1). Values below are mean ± sample SD.

## Homogeneous — Independent

| Algorithm | Avg Wait (s) | P95 Wait (s) | Avg LOS (s) | Throughput (/h) | Utilisation (%) |
|---|---:|---:|---:|---:|---:|
| SYSTEM | 1378.37 ± 12.12 | 9016.87 ± 209.90 | 8394.72 ± 67.07 | 22.92 ± 0.24 | 95.68 ± 1.04 |
| SHORTEST_QUEUE | 1378.37 ± 12.12 | 9016.87 ± 209.90 | 8394.72 ± 67.07 | 22.92 ± 0.24 | 95.68 ± 1.04 |
| ROUND_ROBIN | 1424.12 ± 10.95 | 8255.77 ± 312.97 | 8623.45 ± 58.69 | 21.76 ± 0.31 | 90.82 ± 1.18 |
| LEAST_UTILISED | 1724.68 ± 48.57 | 7061.27 ± 661.21 | 10126.26 ± 245.12 | 20.51 ± 0.76 | 85.61 ± 3.25 |
| RANDOM | 1548.70 ± 46.61 | 7959.37 ± 403.05 | 9246.37 ± 233.48 | 19.68 ± 0.81 | 82.17 ± 3.49 |

## Homogeneous — Sequential

| Algorithm | Avg Wait (s) | P95 Wait (s) | Avg LOS (s) | Throughput (/h) | Utilisation (%) |
|---|---:|---:|---:|---:|---:|
| SYSTEM | 1502.26 ± 16.02 | 10293.33 ± 173.91 | 9014.15 ± 84.04 | 20.91 ± 0.18 | 87.28 ± 0.53 |
| SHORTEST_QUEUE | 1502.26 ± 16.02 | 10293.33 ± 173.91 | 9014.15 ± 84.04 | 20.91 ± 0.18 | 87.28 ± 0.53 |
| ROUND_ROBIN | 1456.24 ± 12.96 | 10302.60 ± 172.77 | 8784.06 ± 69.39 | 21.24 ± 0.19 | 88.65 ± 0.63 |
| LEAST_UTILISED | 1746.21 ± 60.79 | 12313.67 ± 1051.45 | 10233.91 ± 306.14 | 16.34 ± 0.71 | 68.19 ± 2.91 |
| RANDOM | 1807.33 ± 67.02 | 10299.67 ± 179.68 | 10539.50 ± 335.98 | 18.00 ± 0.60 | 75.13 ± 2.50 |

## Homogeneous — Partial Dependency

| Algorithm | Avg Wait (s) | P95 Wait (s) | Avg LOS (s) | Throughput (/h) | Utilisation (%) |
|---|---:|---:|---:|---:|---:|
| SYSTEM | 1461.05 ± 17.53 | 9728.80 ± 171.18 | 8808.13 ± 92.59 | 21.29 ± 0.25 | 88.86 ± 0.83 |
| SHORTEST_QUEUE | 1461.05 ± 17.53 | 9728.80 ± 171.18 | 8808.13 ± 92.59 | 21.29 ± 0.25 | 88.86 ± 0.83 |
| ROUND_ROBIN | 1502.86 ± 20.03 | 9765.23 ± 192.19 | 9017.15 ± 104.54 | 20.97 ± 0.22 | 87.52 ± 0.76 |
| LEAST_UTILISED | 1761.38 ± 115.46 | 11350.73 ± 1885.51 | 10309.75 ± 577.78 | 16.96 ± 1.35 | 70.81 ± 5.51 |
| RANDOM | 1746.63 ± 53.70 | 9462.50 ± 322.09 | 10236.03 ± 271.84 | 18.49 ± 0.56 | 77.18 ± 2.31 |

## Heterogeneous — Independent

| Algorithm | Avg Wait (s) | P95 Wait (s) | Avg LOS (s) | Throughput (/h) | Utilisation (%) |
|---|---:|---:|---:|---:|---:|
| SYSTEM | 4100.96 ± 57.43 | 13414.23 ± 468.50 | 22970.77 ± 297.62 | 7.75 ± 0.13 | 53.10 ± 0.77 |
| SHORTEST_QUEUE | 4124.85 ± 59.87 | 15479.67 ± 632.57 | 23090.23 ± 310.38 | 7.77 ± 0.12 | 53.21 ± 0.72 |
| ROUND_ROBIN | 4209.08 ± 60.18 | 21449.80 ± 635.41 | 23511.39 ± 312.13 | 7.77 ± 0.11 | 53.20 ± 0.58 |
| LEAST_UTILISED | 4682.84 ± 343.51 | 24060.67 ± 5387.49 | 25880.19 ± 1721.92 | 6.57 ± 0.79 | 45.00 ± 5.39 |
| RANDOM | 4272.81 ± 72.73 | 22429.50 ± 1403.90 | 23830.00 ± 373.59 | 7.25 ± 0.37 | 49.67 ± 2.46 |

## Heterogeneous — Sequential

| Algorithm | Avg Wait (s) | P95 Wait (s) | Avg LOS (s) | Throughput (/h) | Utilisation (%) |
|---|---:|---:|---:|---:|---:|
| SYSTEM | 4333.65 ± 62.75 | 13287.17 ± 177.14 | 24134.24 ± 323.86 | 7.65 ± 0.10 | 52.41 ± 0.47 |
| SHORTEST_QUEUE | 4333.65 ± 62.75 | 13287.17 ± 177.14 | 24134.24 ± 323.86 | 7.65 ± 0.10 | 52.41 ± 0.47 |
| ROUND_ROBIN | 4331.69 ± 65.23 | 13298.13 ± 173.15 | 24124.44 ± 336.54 | 7.63 ± 0.10 | 52.29 ± 0.50 |
| LEAST_UTILISED | 4554.51 ± 171.76 | 17152.60 ± 752.53 | 25238.53 ± 864.41 | 6.70 ± 0.47 | 45.89 ± 3.21 |
| RANDOM | 4506.05 ± 125.77 | 14475.90 ± 1113.29 | 24996.25 ± 627.83 | 7.06 ± 0.37 | 48.39 ± 2.55 |

## Heterogeneous — Partial Dependency

| Algorithm | Avg Wait (s) | P95 Wait (s) | Avg LOS (s) | Throughput (/h) | Utilisation (%) |
|---|---:|---:|---:|---:|---:|
| SYSTEM | 4238.03 ± 61.09 | 13366.43 ± 542.34 | 23656.14 ± 317.07 | 7.77 ± 0.11 | 53.20 ± 0.53 |
| SHORTEST_QUEUE | 4268.45 ± 61.69 | 15190.93 ± 361.94 | 23808.20 ± 319.83 | 7.77 ± 0.11 | 53.23 ± 0.57 |
| ROUND_ROBIN | 4378.13 ± 66.35 | 17688.90 ± 403.51 | 24356.63 ± 342.76 | 7.58 ± 0.11 | 51.90 ± 0.59 |
| LEAST_UTILISED | 4378.77 ± 118.54 | 24427.97 ± 3448.81 | 24359.84 ± 602.78 | 7.33 ± 0.35 | 50.22 ± 2.25 |
| RANDOM | 4428.18 ± 96.34 | 18084.27 ± 1375.76 | 24606.86 ± 486.73 | 7.17 ± 0.33 | 49.14 ± 2.20 |

## Research findings

- **RQ1 — homogeneous control:** SYSTEM and Shortest Queue were exactly equal for all recorded metrics in all three workflows across all 30 paired seeds. This is empirical convergence under equal expected processing times, not a test-enforced ranking.
- **RQ2/RQ3 — heterogeneous workloads:** Against Shortest Queue, SYSTEM reduced mean step wait by 0.58% in Independent (paired difference 23.89s; 95% CI 16.65 to 31.13s) and 0.71% in Partial (30.41s; 95% CI 27.05 to 33.77s). The tail effect was larger: P95 reductions were 13.27% (2065.43s; 95% CI 1862.89 to 2267.98s) and 11.96% (1824.50s; 95% CI 1571.28 to 2077.72s).
- **LOS:** Corresponding mean LOS reductions were 0.52% in Independent (95% CI for paired difference 83.24 to 155.67s) and 0.64% in Partial (135.25 to 168.86s).
- **Sequential topology:** SYSTEM and Shortest Queue were exactly equal even under heterogeneous processing times because only one service is eligible at each decision and both rooms for that service have the same expected time.
- **Throughput uncertainty:** SYSTEM's paired throughput difference versus Shortest Queue was -0.017/h in Independent (95% CI -0.065 to 0.030) and -0.004/h in Partial (-0.027 to 0.020); both intervals include zero.
- **Topology:** For heterogeneous SYSTEM, mean step wait increased from 4100.96s (Independent) to 4238.03s (Partial) and 4333.65s (Sequential). Routing freedom reduced mean wait, while the SYSTEM-vs-Shortest Queue benefit appeared only where more than one service could be eligible.
- **Counterexample to a single-metric ranking:** In Homogeneous Independent, Least Utilised had worse mean wait than SYSTEM (1724.68s vs 1378.37s) but a lower mean P95 (7061.27s vs 9016.87s). Other algorithms also cross over by metric, so no universal winner claim is supported.

## SYSTEM vs Shortest Queue

Positive percentages favor SYSTEM. Lower waiting/LOS is better.

| Profile | Workflow | Avg Wait Δ% | P95 Wait Δ% | LOS Δ% |
|---|---|---:|---:|---:|
| HOMOGENEOUS | INDEPENDENT | 0.00% | 0.00% | 0.00% |
| HOMOGENEOUS | SEQUENTIAL | 0.00% | 0.00% | 0.00% |
| HOMOGENEOUS | PARTIAL | 0.00% | 0.00% | 0.00% |
| HETEROGENEOUS | INDEPENDENT | 0.58% | 13.27% | 0.52% |
| HETEROGENEOUS | SEQUENTIAL | 0.00% | 0.00% | 0.00% |
| HETEROGENEOUS | PARTIAL | 0.71% | 11.96% | 0.64% |

## Interpretation notes

- Paired differences use the same seed and materialized workload for SYSTEM and each baseline.
- A positive paired difference favors SYSTEM; a confidence interval containing zero is not clearly distinguishable from seed-to-seed variability.
- These results describe the standalone in-memory benchmark, not the complete production routing pipeline.
