# Thesis Tables

> **Data provenance.** All statistics, tables, and figures in this reporting package were generated programmatically from the frozen 900-run dataset (`raw-results.csv`). Aggregates and paired comparisons were independently recomputed and matched the corresponding frozen CSV files; no values were manually transcribed.

## Table 1. Experimental configuration

| Item | Value |
|---|---|
| Patients per run | 100 |
| Seeds | 30: 20261001–20261030 |
| Design | Paired by seed within each profile/workflow |
| Processing profiles | Homogeneous; Heterogeneous |
| Workflows | Independent; Partial Dependency; Sequential |
| Algorithms | SYSTEM; Shortest Queue; Round Robin; Least Utilised; Random (Seeded) |
| Services and rooms | Five services (A–E); two rooms per service |
| Raw runs | 900 |
| Confidence intervals | Two-sided 95% Student-t interval for the mean, df = 29 |

## Table 2. Homogeneous aggregated results

Values are mean ± sample SD across 30 seeds.

| Workflow | Algorithm | Avg step wait (s) | P95 step wait (s) | Avg LOS (s) | Throughput (/h) | Utilisation (%) |
|---|---|---:|---:|---:|---:|---:|
| Independent | SYSTEM | 1378.37 ± 12.12 | 9016.87 ± 209.90 | 8394.72 ± 67.07 | 22.92 ± 0.24 | 95.68 ± 1.04 |
| Independent | Shortest Queue | 1378.37 ± 12.12 | 9016.87 ± 209.90 | 8394.72 ± 67.07 | 22.92 ± 0.24 | 95.68 ± 1.04 |
| Independent | Round Robin | 1424.12 ± 10.95 | 8255.77 ± 312.97 | 8623.45 ± 58.69 | 21.76 ± 0.31 | 90.82 ± 1.18 |
| Independent | Least Utilised | 1724.68 ± 48.57 | 7061.27 ± 661.21 | 10126.26 ± 245.12 | 20.51 ± 0.76 | 85.61 ± 3.25 |
| Independent | Random (Seeded) | 1548.70 ± 46.61 | 7959.37 ± 403.05 | 9246.37 ± 233.48 | 19.68 ± 0.81 | 82.17 ± 3.49 |
| Partial Dependency | SYSTEM | 1461.05 ± 17.53 | 9728.80 ± 171.18 | 8808.13 ± 92.59 | 21.29 ± 0.25 | 88.86 ± 0.83 |
| Partial Dependency | Shortest Queue | 1461.05 ± 17.53 | 9728.80 ± 171.18 | 8808.13 ± 92.59 | 21.29 ± 0.25 | 88.86 ± 0.83 |
| Partial Dependency | Round Robin | 1502.86 ± 20.03 | 9765.23 ± 192.19 | 9017.15 ± 104.54 | 20.97 ± 0.22 | 87.52 ± 0.76 |
| Partial Dependency | Least Utilised | 1761.38 ± 115.46 | 11350.73 ± 1885.51 | 10309.75 ± 577.78 | 16.96 ± 1.35 | 70.81 ± 5.51 |
| Partial Dependency | Random (Seeded) | 1746.63 ± 53.70 | 9462.50 ± 322.09 | 10236.03 ± 271.84 | 18.49 ± 0.56 | 77.18 ± 2.31 |
| Sequential | SYSTEM | 1502.26 ± 16.02 | 10293.33 ± 173.91 | 9014.15 ± 84.04 | 20.91 ± 0.18 | 87.28 ± 0.53 |
| Sequential | Shortest Queue | 1502.26 ± 16.02 | 10293.33 ± 173.91 | 9014.15 ± 84.04 | 20.91 ± 0.18 | 87.28 ± 0.53 |
| Sequential | Round Robin | 1456.24 ± 12.96 | 10302.60 ± 172.77 | 8784.06 ± 69.39 | 21.24 ± 0.19 | 88.65 ± 0.63 |
| Sequential | Least Utilised | 1746.21 ± 60.79 | 12313.67 ± 1051.45 | 10233.91 ± 306.14 | 16.34 ± 0.71 | 68.19 ± 2.91 |
| Sequential | Random (Seeded) | 1807.33 ± 67.02 | 10299.67 ± 179.68 | 10539.50 ± 335.98 | 18.00 ± 0.60 | 75.13 ± 2.50 |

## Table 3. Heterogeneous aggregated results

Values are mean ± sample SD across 30 seeds.

| Workflow | Algorithm | Avg step wait (s) | P95 step wait (s) | Avg LOS (s) | Throughput (/h) | Utilisation (%) |
|---|---|---:|---:|---:|---:|---:|
| Independent | SYSTEM | 4100.96 ± 57.43 | 13414.23 ± 468.50 | 22970.77 ± 297.62 | 7.75 ± 0.13 | 53.10 ± 0.77 |
| Independent | Shortest Queue | 4124.85 ± 59.87 | 15479.67 ± 632.57 | 23090.23 ± 310.38 | 7.77 ± 0.12 | 53.21 ± 0.72 |
| Independent | Round Robin | 4209.08 ± 60.18 | 21449.80 ± 635.41 | 23511.39 ± 312.13 | 7.77 ± 0.11 | 53.20 ± 0.58 |
| Independent | Least Utilised | 4682.84 ± 343.51 | 24060.67 ± 5387.49 | 25880.19 ± 1721.92 | 6.57 ± 0.79 | 45.00 ± 5.39 |
| Independent | Random (Seeded) | 4272.81 ± 72.73 | 22429.50 ± 1403.90 | 23830.00 ± 373.59 | 7.25 ± 0.37 | 49.67 ± 2.46 |
| Partial Dependency | SYSTEM | 4238.03 ± 61.09 | 13366.43 ± 542.34 | 23656.14 ± 317.07 | 7.77 ± 0.11 | 53.20 ± 0.53 |
| Partial Dependency | Shortest Queue | 4268.45 ± 61.69 | 15190.93 ± 361.94 | 23808.20 ± 319.83 | 7.77 ± 0.11 | 53.23 ± 0.57 |
| Partial Dependency | Round Robin | 4378.13 ± 66.35 | 17688.90 ± 403.51 | 24356.63 ± 342.76 | 7.58 ± 0.11 | 51.90 ± 0.59 |
| Partial Dependency | Least Utilised | 4378.77 ± 118.54 | 24427.97 ± 3448.81 | 24359.84 ± 602.78 | 7.33 ± 0.35 | 50.22 ± 2.25 |
| Partial Dependency | Random (Seeded) | 4428.18 ± 96.34 | 18084.27 ± 1375.76 | 24606.86 ± 486.73 | 7.17 ± 0.33 | 49.14 ± 2.20 |
| Sequential | SYSTEM | 4333.65 ± 62.75 | 13287.17 ± 177.14 | 24134.24 ± 323.86 | 7.65 ± 0.10 | 52.41 ± 0.47 |
| Sequential | Shortest Queue | 4333.65 ± 62.75 | 13287.17 ± 177.14 | 24134.24 ± 323.86 | 7.65 ± 0.10 | 52.41 ± 0.47 |
| Sequential | Round Robin | 4331.69 ± 65.23 | 13298.13 ± 173.15 | 24124.44 ± 336.54 | 7.63 ± 0.10 | 52.29 ± 0.50 |
| Sequential | Least Utilised | 4554.51 ± 171.76 | 17152.60 ± 752.53 | 25238.53 ± 864.41 | 6.70 ± 0.47 | 45.89 ± 3.21 |
| Sequential | Random (Seeded) | 4506.05 ± 125.77 | 14475.90 ± 1113.29 | 24996.25 ± 627.83 | 7.06 ± 0.37 | 48.39 ± 2.55 |

## Table 4. SYSTEM versus Shortest Queue paired comparison

Positive differences and percentages favor SYSTEM. Confidence intervals describe the mean paired absolute difference.

| Profile | Workflow | Metric | Difference | Improvement | 95% CI |
|---|---|---|---:|---:|---:|
| Homogeneous | Independent | Avg step wait | 0.00 s | 0.00% | [0.00, 0.00] s |
| Homogeneous | Independent | P95 step wait | 0.00 s | 0.00% | [0.00, 0.00] s |
| Homogeneous | Independent | Avg LOS | 0.00 s | 0.00% | [0.00, 0.00] s |
| Homogeneous | Independent | Throughput | 0.00 /h | 0.00% | [0.00, 0.00] /h |
| Homogeneous | Partial Dependency | Avg step wait | 0.00 s | 0.00% | [0.00, 0.00] s |
| Homogeneous | Partial Dependency | P95 step wait | 0.00 s | 0.00% | [0.00, 0.00] s |
| Homogeneous | Partial Dependency | Avg LOS | 0.00 s | 0.00% | [0.00, 0.00] s |
| Homogeneous | Partial Dependency | Throughput | 0.00 /h | 0.00% | [0.00, 0.00] /h |
| Homogeneous | Sequential | Avg step wait | 0.00 s | 0.00% | [0.00, 0.00] s |
| Homogeneous | Sequential | P95 step wait | 0.00 s | 0.00% | [0.00, 0.00] s |
| Homogeneous | Sequential | Avg LOS | 0.00 s | 0.00% | [0.00, 0.00] s |
| Homogeneous | Sequential | Throughput | 0.00 /h | 0.00% | [0.00, 0.00] /h |
| Heterogeneous | Independent | Avg step wait | 23.89 s | 0.58% | [16.65, 31.13] s |
| Heterogeneous | Independent | P95 step wait | 2065.43 s | 13.27% | [1862.89, 2267.98] s |
| Heterogeneous | Independent | Avg LOS | 119.46 s | 0.52% | [83.24, 155.67] s |
| Heterogeneous | Independent | Throughput | -0.02 /h | -0.21% | [-0.06, 0.03] /h |
| Heterogeneous | Partial Dependency | Avg step wait | 30.41 s | 0.71% | [27.05, 33.77] s |
| Heterogeneous | Partial Dependency | P95 step wait | 1824.50 s | 11.96% | [1571.28, 2077.72] s |
| Heterogeneous | Partial Dependency | Avg LOS | 152.06 s | 0.64% | [135.25, 168.86] s |
| Heterogeneous | Partial Dependency | Throughput | -0.00 /h | -0.04% | [-0.03, 0.02] /h |
| Heterogeneous | Sequential | Avg step wait | 0.00 s | 0.00% | [0.00, 0.00] s |
| Heterogeneous | Sequential | P95 step wait | 0.00 s | 0.00% | [0.00, 0.00] s |
| Heterogeneous | Sequential | Avg LOS | 0.00 s | 0.00% | [0.00, 0.00] s |
| Heterogeneous | Sequential | Throughput | 0.00 /h | 0.00% | [0.00, 0.00] /h |

## Table 5. Workflow-topology comparison for SYSTEM

Values are mean ± sample SD across 30 seeds.

| Profile | Workflow | Avg step wait (s) | P95 step wait (s) | Avg LOS (s) | Throughput (/h) | Utilisation (%) |
|---|---|---:|---:|---:|---:|---:|
| Homogeneous | Independent | 1378.37 ± 12.12 | 9016.87 ± 209.90 | 8394.72 ± 67.07 | 22.92 ± 0.24 | 95.68 ± 1.04 |
| Homogeneous | Partial Dependency | 1461.05 ± 17.53 | 9728.80 ± 171.18 | 8808.13 ± 92.59 | 21.29 ± 0.25 | 88.86 ± 0.83 |
| Homogeneous | Sequential | 1502.26 ± 16.02 | 10293.33 ± 173.91 | 9014.15 ± 84.04 | 20.91 ± 0.18 | 87.28 ± 0.53 |
| Heterogeneous | Independent | 4100.96 ± 57.43 | 13414.23 ± 468.50 | 22970.77 ± 297.62 | 7.75 ± 0.13 | 53.10 ± 0.77 |
| Heterogeneous | Partial Dependency | 4238.03 ± 61.09 | 13366.43 ± 542.34 | 23656.14 ± 317.07 | 7.77 ± 0.11 | 53.20 ± 0.53 |
| Heterogeneous | Sequential | 4333.65 ± 62.75 | 13287.17 ± 177.14 | 24134.24 ± 323.86 | 7.65 ± 0.10 | 52.41 ± 0.47 |
