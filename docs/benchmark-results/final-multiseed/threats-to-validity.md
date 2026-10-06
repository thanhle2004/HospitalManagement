# Threats to Validity

> **Data provenance.** All statistics, tables, and figures in this reporting package were generated programmatically from the frozen 900-run dataset (`raw-results.csv`). Aggregates and paired comparisons were independently recomputed and matched the corresponding frozen CSV files; no values were manually transcribed.

## Internal validity

The deterministic simulator, explicit seeds, paired workload construction, and fresh strategy instances reduce uncontrolled variation. The benchmark underwent a semantic audit confirming that Step Waiting Time begins at room queue entry and that a patient cannot occupy multiple room services concurrently. Regression tests cover lifecycle and metric reconstruction. Nevertheless, the benchmark is an implementation-specific abstraction; defects not exercised by those tests could influence results.

## Construct validity

Step Waiting Time measures only time spent in an assigned room queue. Time during which a workflow step is READY but not selected is intentionally excluded. P95 is calculated over all completed step waits, not patient-level LOS or per-patient worst waits. Throughput is completed patients per finite simulated run hour rather than steady-state capacity. Aggregate room utilisation is the arithmetic mean of room busy-time ratios, which may conceal service-level imbalance.

## External validity

Patients and durations are synthetic, arrivals use the benchmark's fixed process, and service times follow fixed 80%–120% uniform ranges. Every service has exactly two equivalent rooms. The model does not represent real empirical arrival distributions, emergency interruptions, staff breaks, room failures, patient no-shows, or clinical-priority variation beyond behavior explicitly present in the benchmark. Findings therefore apply to the controlled standalone algorithm benchmark and must not be presented as a real hospital deployment evaluation.

## Statistical conclusion validity

The evaluation used 30 deterministic paired seeds. Student-t intervals quantify seed-to-seed variation within this design, but the seeds do not constitute a random sample of all possible hospitals or operating conditions. No multiplicity-adjusted hypothesis-testing framework was applied, and confidence intervals should not be converted into claims of universal significance. Exact equality in control scenarios reflects this implementation and design. Cross-metric trade-offs further prevent a universal dominance claim.
