"""Validate the frozen experiment and generate thesis tables, prose, and figures.

All numerical content is derived from the frozen CSV files. The script refuses to
run if their SHA-256 hashes change or if aggregate/paired records do not reproduce
from the raw seed-aligned observations.
"""

from __future__ import annotations

import csv
import hashlib
import html
import json
import math
import statistics
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FIGURES = ROOT / "figures"
EXPECTED_HASHES = {
    "raw-results.csv": "A8F17DF40E17C78161BC7D07DC6CC95196763B193D507432A0C0E2E0B8EADFEB",
    "aggregated-results.csv": "7ECF132058E43665222355C9DAD082A24C29B5748693C519C6102D059DF26703",
    "paired-comparisons.csv": "1632E754FA12D18D4DC41A99CC4F0C363DC77AFE611D458B6A19FD0DE5C43C28",
    "experiment-config.json": "CD5EB2E6ED375754A531D81697D200B363A8B248349CC718373A3050ED37A618",
}
PROFILES = ["HOMOGENEOUS", "HETEROGENEOUS"]
WORKFLOWS = ["INDEPENDENT", "PARTIAL", "SEQUENTIAL"]
ALGORITHMS = ["SYSTEM", "SHORTEST_QUEUE", "ROUND_ROBIN", "LEAST_UTILISED", "RANDOM"]
METRICS = ["avgStepWaitSeconds", "p95StepWaitSeconds", "avgLosSeconds", "throughputPerHour", "roomUtilisationPercent"]
PRIMARY_PAIRED = ["avgStepWaitSeconds", "p95StepWaitSeconds", "avgLosSeconds", "throughputPerHour"]
LABELS = {
    "SYSTEM": "SYSTEM", "SHORTEST_QUEUE": "Shortest Queue", "ROUND_ROBIN": "Round Robin",
    "LEAST_UTILISED": "Least Utilised", "RANDOM": "Random (Seeded)",
    "INDEPENDENT": "Independent", "PARTIAL": "Partial Dependency", "SEQUENTIAL": "Sequential",
    "HOMOGENEOUS": "Homogeneous", "HETEROGENEOUS": "Heterogeneous",
}
T29 = 2.04523


def read_csv(name: str) -> list[dict[str, str]]:
    with (ROOT / name).open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def stats(values: list[float]) -> dict[str, float]:
    mean = statistics.fmean(values)
    sd = statistics.stdev(values)
    margin = T29 * sd / math.sqrt(len(values))
    ordered = sorted(values)
    return {
        "n": len(values), "mean": mean, "standardDeviation": sd,
        "median": statistics.median(ordered), "minimum": ordered[0], "maximum": ordered[-1],
        "ci95Low": mean - margin, "ci95High": mean + margin,
    }


def close(actual: float, expected: float, tolerance: float = 1e-8) -> bool:
    return abs(actual - expected) <= tolerance * max(1.0, abs(actual), abs(expected))


def validate() -> tuple[list[dict[str, str]], list[dict[str, str]], list[dict[str, str]], dict]:
    for name, expected in EXPECTED_HASHES.items():
        actual = sha256(ROOT / name)
        if actual != expected:
            raise RuntimeError(f"Frozen evidence hash changed for {name}: {actual}")
    raw, aggregated, paired = read_csv("raw-results.csv"), read_csv("aggregated-results.csv"), read_csv("paired-comparisons.csv")
    config = json.loads((ROOT / "experiment-config.json").read_text(encoding="utf-8"))
    if len(raw) != 900 or len(aggregated) != 30 or len(paired) != 96:
        raise RuntimeError("Unexpected result row count")
    if {int(row["seed"]) for row in raw} != set(range(20261001, 20261031)):
        raise RuntimeError("Seed set mismatch")
    if {row["profile"] for row in raw} != set(PROFILES) or {row["workflow"] for row in raw} != set(WORKFLOWS) or {row["algorithm"] for row in raw} != set(ALGORITHMS):
        raise RuntimeError("Factor-level mismatch")
    keys = [(row["profile"], row["workflow"], row["algorithm"], int(row["seed"])) for row in raw]
    if len(keys) != len(set(keys)):
        raise RuntimeError("Duplicate profile/workflow/algorithm/seed key")
    for row in raw:
        if int(row["patientCount"]) != 100 or int(row["completedPatients"]) != 100:
            raise RuntimeError("Incomplete run")
        if any(not math.isfinite(float(row[metric])) for metric in METRICS):
            raise RuntimeError("Non-finite raw metric")
    for row in aggregated:
        source = [item for item in raw if item["profile"] == row["profile"] and item["workflow"] == row["workflow"] and item["algorithm"] == row["algorithm"]]
        if len(source) != 30:
            raise RuntimeError("Aggregate group does not contain 30 seeds")
        for metric in METRICS:
            calculated = stats([float(item[metric]) for item in source])
            for field, value in calculated.items():
                if not close(float(row[f"{metric}_{field}"]), float(value)):
                    raise RuntimeError(f"Aggregate mismatch: {row['profile']}/{row['workflow']}/{row['algorithm']}/{metric}/{field}")
    for row in paired:
        system = {int(item["seed"]): item for item in raw if item["profile"] == row["profile"] and item["workflow"] == row["workflow"] and item["algorithm"] == "SYSTEM"}
        baseline = {int(item["seed"]): item for item in raw if item["profile"] == row["profile"] and item["workflow"] == row["workflow"] and item["algorithm"] == row["baselineAlgorithm"]}
        if system.keys() != baseline.keys() or len(system) != 30:
            raise RuntimeError("Paired seeds are not aligned")
        metric = row["metric"]
        lower = row["direction"] == "LOWER_IS_BETTER"
        differences, relative = [], []
        for seed in sorted(system):
            system_value, baseline_value = float(system[seed][metric]), float(baseline[seed][metric])
            difference = baseline_value - system_value if lower else system_value - baseline_value
            differences.append(difference)
            relative.append(0.0 if baseline_value == 0 else difference / baseline_value * 100)
        calculated = stats(differences)
        expected_fields = {
            "n": 30, "meanAbsoluteDifference": calculated["mean"],
            "meanRelativeImprovementPercent": statistics.fmean(relative),
            "standardDeviationOfDifference": calculated["standardDeviation"],
            "ci95DifferenceLow": calculated["ci95Low"], "ci95DifferenceHigh": calculated["ci95High"],
        }
        for field, value in expected_fields.items():
            if not close(float(row[field]), float(value)):
                raise RuntimeError(f"Paired mismatch: {row['profile']}/{row['workflow']}/{row['baselineAlgorithm']}/{metric}/{field}")
    return raw, aggregated, paired, config


def aggregate_row(rows: list[dict[str, str]], profile: str, workflow: str, algorithm: str) -> dict[str, str]:
    return next(row for row in rows if row["profile"] == profile and row["workflow"] == workflow and row["algorithm"] == algorithm)


def paired_row(rows: list[dict[str, str]], profile: str, workflow: str, metric: str, baseline: str = "SHORTEST_QUEUE") -> dict[str, str]:
    return next(row for row in rows if row["profile"] == profile and row["workflow"] == workflow and row["metric"] == metric and row["baselineAlgorithm"] == baseline)


def f(value: float) -> str:
    return f"{value:.2f}"


def mean_sd(row: dict[str, str], metric: str) -> str:
    return f"{f(float(row[f'{metric}_mean']))} ± {f(float(row[f'{metric}_standardDeviation']))}"


PROVENANCE = (
    "> **Data provenance.** All statistics, tables, and figures in this reporting package were generated "
    "programmatically from the frozen 900-run dataset (`raw-results.csv`). Aggregates and paired comparisons "
    "were independently recomputed and matched the corresponding frozen CSV files; no values were manually transcribed."
)


def write_tables(aggregated: list[dict[str, str]], paired: list[dict[str, str]], config: dict) -> None:
    lines = ["# Thesis Tables", "", PROVENANCE, "", "## Table 1. Experimental configuration", "", "| Item | Value |", "|---|---|"]
    lines += [
        f"| Patients per run | {config['patientCount']} |", f"| Seeds | {len(config['seeds'])}: {config['seeds'][0]}–{config['seeds'][-1]} |",
        "| Design | Paired by seed within each profile/workflow |", "| Processing profiles | Homogeneous; Heterogeneous |",
        "| Workflows | Independent; Partial Dependency; Sequential |", "| Algorithms | SYSTEM; Shortest Queue; Round Robin; Least Utilised; Random (Seeded) |",
        "| Services and rooms | Five services (A–E); two rooms per service |", "| Raw runs | 900 |",
        "| Confidence intervals | Two-sided 95% Student-t interval for the mean, df = 29 |", "",
    ]
    for number, profile in [(2, "HOMOGENEOUS"), (3, "HETEROGENEOUS")]:
        lines += [f"## Table {number}. {LABELS[profile]} aggregated results", "", "Values are mean ± sample SD across 30 seeds.", "", "| Workflow | Algorithm | Avg step wait (s) | P95 step wait (s) | Avg LOS (s) | Throughput (/h) | Utilisation (%) |", "|---|---|---:|---:|---:|---:|---:|"]
        for workflow in WORKFLOWS:
            for algorithm in ALGORITHMS:
                row = aggregate_row(aggregated, profile, workflow, algorithm)
                lines.append(f"| {LABELS[workflow]} | {LABELS[algorithm]} | {mean_sd(row, 'avgStepWaitSeconds')} | {mean_sd(row, 'p95StepWaitSeconds')} | {mean_sd(row, 'avgLosSeconds')} | {mean_sd(row, 'throughputPerHour')} | {mean_sd(row, 'roomUtilisationPercent')} |")
        lines.append("")
    lines += ["## Table 4. SYSTEM versus Shortest Queue paired comparison", "", "Positive differences and percentages favor SYSTEM. Confidence intervals describe the mean paired absolute difference.", "", "| Profile | Workflow | Metric | Difference | Improvement | 95% CI |", "|---|---|---|---:|---:|---:|"]
    for profile in PROFILES:
        for workflow in WORKFLOWS:
            for metric, label in [("avgStepWaitSeconds", "Avg step wait"), ("p95StepWaitSeconds", "P95 step wait"), ("avgLosSeconds", "Avg LOS"), ("throughputPerHour", "Throughput")]:
                row = paired_row(paired, profile, workflow, metric)
                unit = "/h" if metric == "throughputPerHour" else "s"
                lines.append(f"| {LABELS[profile]} | {LABELS[workflow]} | {label} | {f(float(row['meanAbsoluteDifference']))} {unit} | {f(float(row['meanRelativeImprovementPercent']))}% | [{f(float(row['ci95DifferenceLow']))}, {f(float(row['ci95DifferenceHigh']))}] {unit} |")
    lines += ["", "## Table 5. Workflow-topology comparison for SYSTEM", "", "Values are mean ± sample SD across 30 seeds.", "", "| Profile | Workflow | Avg step wait (s) | P95 step wait (s) | Avg LOS (s) | Throughput (/h) | Utilisation (%) |", "|---|---|---:|---:|---:|---:|---:|"]
    for profile in PROFILES:
        for workflow in WORKFLOWS:
            row = aggregate_row(aggregated, profile, workflow, "SYSTEM")
            lines.append(f"| {LABELS[profile]} | {LABELS[workflow]} | {mean_sd(row, 'avgStepWaitSeconds')} | {mean_sd(row, 'p95StepWaitSeconds')} | {mean_sd(row, 'avgLosSeconds')} | {mean_sd(row, 'throughputPerHour')} | {mean_sd(row, 'roomUtilisationPercent')} |")
    (ROOT / "thesis-tables.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_prose(aggregated: list[dict[str, str]], paired: list[dict[str, str]], config: dict) -> None:
    hi_wait = paired_row(paired, "HETEROGENEOUS", "INDEPENDENT", "avgStepWaitSeconds")
    hp_wait = paired_row(paired, "HETEROGENEOUS", "PARTIAL", "avgStepWaitSeconds")
    hi_p95 = paired_row(paired, "HETEROGENEOUS", "INDEPENDENT", "p95StepWaitSeconds")
    hp_p95 = paired_row(paired, "HETEROGENEOUS", "PARTIAL", "p95StepWaitSeconds")
    hi_los = paired_row(paired, "HETEROGENEOUS", "INDEPENDENT", "avgLosSeconds")
    hp_los = paired_row(paired, "HETEROGENEOUS", "PARTIAL", "avgLosSeconds")
    hi_thr = paired_row(paired, "HETEROGENEOUS", "INDEPENDENT", "throughputPerHour")
    hp_thr = paired_row(paired, "HETEROGENEOUS", "PARTIAL", "throughputPerHour")
    setup = f"""# Experimental Setup

{PROVENANCE}

## Objective and research questions

The experiment evaluated five routing algorithms under controlled changes in workflow topology and expected service-time heterogeneity. It examined whether the production Min Estimated Waiting Time strategy (SYSTEM) behaves like Shortest Queue when expected service times are homogeneous, whether heterogeneous times create a measurable advantage, whether any advantage is concentrated in mean or tail waiting, and how dependency structure changes routing performance.

## Benchmark architecture and algorithms

The evaluation used a controlled standalone, in-memory algorithm benchmark with virtual time. It is not an evaluation of a full production hospital deployment. SYSTEM directly instantiated the production `MinEstimatedWaitingTimeStrategy`; the comparators were Shortest Queue, Round Robin, Least Utilised, and seeded Random. Each run used a fresh strategy instance, preventing state leakage between runs.

## Workflows and processing-time profiles

Every workflow contained services A–E, with two equivalent rooms per service. Independent contained no dependency edges. Sequential used A→B→C→D→E. Partial Dependency used A→C, B→D, C→E, and D→E. In the homogeneous profile, every expected service time was 300 seconds. In the heterogeneous profile, expected times were A=300, B=600, C=420, D=900, and E=240 seconds.

## Patient workload and deterministic durations

Each run contained {config['patientCount']} patients arriving at fixed benchmark intervals. Actual duration was deterministic for each seed–patient–service tuple and uniformly distributed from 80% to 120% of the service expectation. Consequently, algorithms compared under the same seed received the same materialized workload.

## Paired-seed design

The final experiment used {len(config['seeds'])} explicitly recorded seeds ({config['seeds'][0]}–{config['seeds'][-1]}). Crossing two profiles, three workflows, five algorithms, and 30 seeds produced 900 runs. Pairing algorithms by seed controls workload realization when calculating algorithm differences: a difference for a seed reflects routing behavior rather than a different set of sampled service durations.

## Metrics and statistical aggregation

Step Waiting Time was defined as `SERVICE_STARTED − ROOM_QUEUE_ENTERED`; READY time was not counted as room waiting. Average LOS was `PATIENT_COMPLETED − PATIENT_ARRIVAL`. Throughput was completed patients divided by simulated hours. Per-room utilisation was busy time divided by simulation time, and aggregate utilisation was the arithmetic mean across rooms. P95 was calculated over individual completed-step waiting times.

For each profile–workflow–algorithm combination, the analysis reports N, mean, sample standard deviation, median, minimum, maximum, and a two-sided 95% Student-t confidence interval for the mean with 29 degrees of freedom. Paired comparisons align SYSTEM and each baseline by seed. No hypothesis test or claim of universal dominance was added.

## Reproducibility and scope

The configuration, seed list, raw results, aggregates, paired comparisons, generation script, tables, and figures are stored together. All 900 runs completed 100 patients and passed completeness and finite-value checks. The benchmark isolates routing-algorithm behavior under specified synthetic conditions; it does not reproduce emergency interruptions, clinical-priority variation, staff schedules, room failures, no-shows, or real hospital arrival processes.
"""
    results = f"""# Results

{PROVENANCE}

## Homogeneous workload

SYSTEM and Shortest Queue produced identical results for every recorded metric in Independent, Partial Dependency, and Sequential workflows across all 30 paired seeds. This empirical convergence is visible in Figures 1–3 and Table 2. Equal expected processing times remove the service-time distinction used by SYSTEM's workload estimate.

## Heterogeneous workload

Under Independent routing, SYSTEM's mean average step wait was {f(float(aggregate_row(aggregated, 'HETEROGENEOUS', 'INDEPENDENT', 'SYSTEM')['avgStepWaitSeconds_mean']))} seconds compared with {f(float(aggregate_row(aggregated, 'HETEROGENEOUS', 'INDEPENDENT', 'SHORTEST_QUEUE')['avgStepWaitSeconds_mean']))} seconds for Shortest Queue. Under Partial Dependency, the corresponding means were {f(float(aggregate_row(aggregated, 'HETEROGENEOUS', 'PARTIAL', 'SYSTEM')['avgStepWaitSeconds_mean']))} and {f(float(aggregate_row(aggregated, 'HETEROGENEOUS', 'PARTIAL', 'SHORTEST_QUEUE')['avgStepWaitSeconds_mean']))} seconds. Sequential results remained identical because only one service was eligible at each decision.

## Mean and tail waiting

SYSTEM reduced mean waiting relative to Shortest Queue by {f(float(hi_wait['meanRelativeImprovementPercent']))}% in Independent and {f(float(hp_wait['meanRelativeImprovementPercent']))}% in Partial Dependency. The paired mean differences were {f(float(hi_wait['meanAbsoluteDifference']))} seconds (95% CI {f(float(hi_wait['ci95DifferenceLow']))}–{f(float(hi_wait['ci95DifferenceHigh']))}) and {f(float(hp_wait['meanAbsoluteDifference']))} seconds (95% CI {f(float(hp_wait['ci95DifferenceLow']))}–{f(float(hp_wait['ci95DifferenceHigh']))}).

The larger effect occurred in the tail. P95 waiting decreased by {f(float(hi_p95['meanRelativeImprovementPercent']))}% in Independent, a paired difference of {f(float(hi_p95['meanAbsoluteDifference']))} seconds (95% CI {f(float(hi_p95['ci95DifferenceLow']))}–{f(float(hi_p95['ci95DifferenceHigh']))}), and by {f(float(hp_p95['meanRelativeImprovementPercent']))}% in Partial Dependency, a difference of {f(float(hp_p95['meanAbsoluteDifference']))} seconds (95% CI {f(float(hp_p95['ci95DifferenceLow']))}–{f(float(hp_p95['ci95DifferenceHigh']))}). Figure 4 makes the zero-effect controls and heterogeneous routing-freedom effects explicit.

## Length of stay

Average LOS decreased by {f(float(hi_los['meanRelativeImprovementPercent']))}% in heterogeneous Independent, corresponding to {f(float(hi_los['meanAbsoluteDifference']))} seconds (95% CI {f(float(hi_los['ci95DifferenceLow']))}–{f(float(hi_los['ci95DifferenceHigh']))}). Partial Dependency decreased by {f(float(hp_los['meanRelativeImprovementPercent']))}%, or {f(float(hp_los['meanAbsoluteDifference']))} seconds (95% CI {f(float(hp_los['ci95DifferenceLow']))}–{f(float(hp_los['ci95DifferenceHigh']))}).

## Throughput and utilisation

SYSTEM's throughput difference from Shortest Queue was {f(float(hi_thr['meanAbsoluteDifference']))}/h in heterogeneous Independent (95% CI {f(float(hi_thr['ci95DifferenceLow']))} to {f(float(hi_thr['ci95DifferenceHigh']))}) and {f(float(hp_thr['meanAbsoluteDifference']))}/h in Partial Dependency (95% CI {f(float(hp_thr['ci95DifferenceLow']))} to {f(float(hp_thr['ci95DifferenceHigh']))}). Both intervals include zero, so these throughput differences are not clearly distinguishable from seed-to-seed variability. Utilisation should be interpreted as a descriptive outcome rather than an objective for which higher is universally preferable.

## Other baselines and trade-offs

The alternative algorithms did not produce a single consistent ordering across metrics. In Homogeneous Independent, Least Utilised had a higher mean average wait ({f(float(aggregate_row(aggregated, 'HOMOGENEOUS', 'INDEPENDENT', 'LEAST_UTILISED')['avgStepWaitSeconds_mean']))} seconds) than SYSTEM ({f(float(aggregate_row(aggregated, 'HOMOGENEOUS', 'INDEPENDENT', 'SYSTEM')['avgStepWaitSeconds_mean']))} seconds), but a lower mean P95 ({f(float(aggregate_row(aggregated, 'HOMOGENEOUS', 'INDEPENDENT', 'LEAST_UTILISED')['p95StepWaitSeconds_mean']))} versus {f(float(aggregate_row(aggregated, 'HOMOGENEOUS', 'INDEPENDENT', 'SYSTEM')['p95StepWaitSeconds_mean']))} seconds). Round Robin also had a lower homogeneous Sequential mean wait than SYSTEM. These crossovers preclude a universal winner interpretation.

## Figures

![Figure 1. Mean average step waiting time by algorithm, with 95% confidence intervals.](figures/figure-1-mean-step-wait.png)

![Figure 2. Mean P95 step waiting time by algorithm, with 95% confidence intervals.](figures/figure-2-p95-step-wait.png)

![Figure 3. Mean average length of stay by algorithm, with 95% confidence intervals.](figures/figure-3-average-los.png)

![Figure 4. Paired P95 waiting-time improvement of SYSTEM relative to Shortest Queue.](figures/figure-4-system-vs-shortest-queue-p95.png)

![Figure 5. Workflow-topology comparison for SYSTEM under both processing profiles.](figures/figure-5-system-workflow-topology.png)
"""
    discussion = """# Discussion

{provenance}

The results are consistent with the information available at each routing decision. When expected processing times are homogeneous, multiplying queue workload by expected time does not add a service-specific discriminator. SYSTEM therefore collapses toward the same ordering as Shortest Queue, producing identical outcomes in this benchmark.

Heterogeneous processing times alone are insufficient to create a difference. In Sequential workflow, dependencies expose only one service at a time. Because the two rooms for that service share the same expectation, SYSTEM has no cross-service choice on which to apply heterogeneous workload information. Its results consequently remain identical to Shortest Queue.

Independent and Partial Dependency combine heterogeneous expected times with moments when several services can be eligible. This creates a meaningful choice between queues whose counts may be similar but whose expected workloads differ. Under these evaluated conditions, SYSTEM's mean-wait reduction was modest, whereas its P95 reduction was much larger. This pattern suggests that the strategy primarily mitigated queue imbalance and extreme waits rather than shifting the entire waiting-time distribution by the same proportion. That mechanism is consistent with the benchmark design, but distribution-level diagnostics beyond the recorded aggregate and P95 metrics would be required to establish precisely which patients and services generated the tail change.

Workflow topology also affected absolute performance. For heterogeneous SYSTEM, Independent had the lowest mean average step wait, Partial Dependency was intermediate, and Sequential was highest. Greater routing freedom allowed the strategy to select among more eligible services. This observation is specific to the modeled arrival process, service times, room counts, and one-active-room-per-patient rule.

The Least Utilised counterexample demonstrates why the algorithms should not be ranked by one metric. Its Homogeneous Independent P95 was lower than SYSTEM's even though its mean wait, LOS, throughput, and aggregate utilisation were less favorable. A possible explanation is that its observation-based selection redistributes waiting unevenly in a way that changes the upper percentile without improving the mean; this remains speculative because the experiment did not record distributional decomposition by service or patient cohort. The defensible conclusion is a trade-off, not superiority of either policy.

Throughput and utilisation likewise require caution. Finite-run throughput depends on the final simulated completion time, and utilisation is averaged across all rooms. Neither is a direct substitute for patient waiting outcomes. The SYSTEM–Shortest Queue throughput confidence intervals included zero in the heterogeneous workflows where waiting differed, so the data do not support a clear throughput advantage.
""".format(provenance=PROVENANCE)
    threats = f"""# Threats to Validity

{PROVENANCE}

## Internal validity

The deterministic simulator, explicit seeds, paired workload construction, and fresh strategy instances reduce uncontrolled variation. The benchmark underwent a semantic audit confirming that Step Waiting Time begins at room queue entry and that a patient cannot occupy multiple room services concurrently. Regression tests cover lifecycle and metric reconstruction. Nevertheless, the benchmark is an implementation-specific abstraction; defects not exercised by those tests could influence results.

## Construct validity

Step Waiting Time measures only time spent in an assigned room queue. Time during which a workflow step is READY but not selected is intentionally excluded. P95 is calculated over all completed step waits, not patient-level LOS or per-patient worst waits. Throughput is completed patients per finite simulated run hour rather than steady-state capacity. Aggregate room utilisation is the arithmetic mean of room busy-time ratios, which may conceal service-level imbalance.

## External validity

Patients and durations are synthetic, arrivals use the benchmark's fixed process, and service times follow fixed 80%–120% uniform ranges. Every service has exactly two equivalent rooms. The model does not represent real empirical arrival distributions, emergency interruptions, staff breaks, room failures, patient no-shows, or clinical-priority variation beyond behavior explicitly present in the benchmark. Findings therefore apply to the controlled standalone algorithm benchmark and must not be presented as a real hospital deployment evaluation.

## Statistical conclusion validity

The evaluation used 30 deterministic paired seeds. Student-t intervals quantify seed-to-seed variation within this design, but the seeds do not constitute a random sample of all possible hospitals or operating conditions. No multiplicity-adjusted hypothesis-testing framework was applied, and confidence intervals should not be converted into claims of universal significance. Exact equality in control scenarios reflects this implementation and design. Cross-metric trade-offs further prevent a universal dominance claim.
"""
    conclusion = f"""# Conclusion

{PROVENANCE}

Across 30 paired deterministic seeds, SYSTEM and Shortest Queue were identical when expected processing times were homogeneous and when Sequential dependencies exposed only one eligible service. Under heterogeneous Independent and Partial Dependency workflows, SYSTEM produced modest mean-wait reductions of {f(float(hi_wait['meanRelativeImprovementPercent']))}% and {f(float(hp_wait['meanRelativeImprovementPercent']))}%, respectively, while P95 waiting decreased by the substantially larger amounts of {f(float(hi_p95['meanRelativeImprovementPercent']))}% and {f(float(hp_p95['meanRelativeImprovementPercent']))}%. The evaluated evidence therefore indicates that workload-aware routing's principal benefit was tail-wait mitigation when heterogeneous services and routing freedom occurred together. Other algorithms crossed over on individual metrics, so the results do not support universal superiority or optimality claims.
"""
    documents = {"experimental-setup.md": setup, "results.md": results, "discussion.md": discussion, "threats-to-validity.md": threats, "conclusion.md": conclusion}
    for name, content in documents.items():
        (ROOT / name).write_text(content.strip() + "\n", encoding="utf-8")
    def chapter_body(content: str) -> str:
        body = content.split("\n", 2)[2].strip()
        if body.startswith(PROVENANCE):
            body = body[len(PROVENANCE):].strip()
        return body.replace("## ", "### ")

    combined_sections = [
        ("1. Experimental Setup", setup),
        ("2. Results", results),
        ("3. Discussion", discussion),
        ("4. Threats to Validity", threats),
        ("5. Conclusion", conclusion),
    ]
    combined = "# Thesis Evaluation Draft\n\n" + PROVENANCE + "\n\n" + "\n\n".join(
        f"## {title}\n\n{chapter_body(content)}" for title, content in combined_sections
    ) + "\n"
    (ROOT / "thesis-evaluation-draft.md").write_text(combined, encoding="utf-8")


# Drawing uses the same CSV-derived aggregate rows as the tables.
WIDTH, HEIGHT = 1800, 1120
FONT = Path("C:/Windows/Fonts/arial.ttf")
BOLD = Path("C:/Windows/Fonts/arialbd.ttf")
COLORS = ["#176B87", "#64CCC5", "#F4A261", "#8D6A9F", "#D95D39"]
TEXT, MUTED, GRID, BG = "#17202A", "#536471", "#D8DEE4", "#FFFFFF"


class Canvas:
    def __init__(self, width: int = WIDTH, height: int = HEIGHT):
        self.width, self.height = width, height
        self.image = Image.new("RGB", (width, height), BG)
        self.draw = ImageDraw.Draw(self.image)
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">', f'<rect width="100%" height="100%" fill="{BG}"/>']

    def text(self, x, y, value, size=22, color=TEXT, anchor="la", bold=False):
        self.draw.text((x, y), value, font=ImageFont.truetype(str(BOLD if bold else FONT), size), fill=color, anchor=anchor)
        anchors = {"la": "start", "ma": "middle", "ra": "end", "mm": "middle"}
        baseline = "middle" if anchor == "mm" else "auto"
        self.svg.append(f'<text x="{x:.1f}" y="{y:.1f}" fill="{color}" font-family="Arial,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" text-anchor="{anchors[anchor]}" dominant-baseline="{baseline}">{html.escape(value)}</text>')

    def line(self, points, color=GRID, width=2):
        self.draw.line(points, fill=color, width=width)
        self.svg.append(f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x,y in points)}" fill="none" stroke="{color}" stroke-width="{width}"/>')

    def rect(self, xy, fill):
        self.draw.rectangle(xy, fill=fill)
        x1, y1, x2, y2 = xy
        self.svg.append(f'<rect x="{x1:.1f}" y="{y1:.1f}" width="{x2-x1:.1f}" height="{y2-y1:.1f}" fill="{fill}"/>')

    def save(self, stem):
        FIGURES.mkdir(parents=True, exist_ok=True)
        self.image.save(FIGURES / f"{stem}.png", dpi=(300, 300), optimize=True)
        self.svg.append("</svg>")
        (FIGURES / f"{stem}.svg").write_text("\n".join(self.svg), encoding="utf-8")


def axis_maximum(value: float) -> float:
    magnitude = 10 ** (len(str(int(value))) - 1)
    return math.ceil(value / magnitude * 5) / 5 * magnitude


def grouped_figure(aggregated, stem, title, metric):
    canvas = Canvas()
    canvas.text(900, 45, title, 34, anchor="ma", bold=True)
    canvas.text(900, 82, "Means across 30 paired seeds; whiskers show 95% confidence intervals", 21, MUTED, "ma")
    for r, profile in enumerate(PROFILES):
        for c, workflow in enumerate(WORKFLOWS):
            x0, y0 = 100 + c * 565, 145 + r * 470
            left, top, right, bottom = x0 + 75, y0 + 45, x0 + 525, y0 + 390
            rows = [aggregate_row(aggregated, profile, workflow, algorithm) for algorithm in ALGORITHMS]
            maximum = axis_maximum(max(float(row[f"{metric}_ci95High"]) for row in rows) * 1.08)
            canvas.text((left + right) / 2, y0, f"{LABELS[profile]} — {LABELS[workflow]}", 22, anchor="ma", bold=True)
            for tick in range(5):
                value, y = maximum * tick / 4, bottom - (bottom - top) * tick / 4
                canvas.line([(left, y), (right, y)], GRID, 1)
                canvas.text(left - 10, y, f"{value:,.0f}", 17, MUTED, "ra")
            canvas.line([(left, top), (left, bottom), (right, bottom)], TEXT, 2)
            slot = (right - left) / 5
            for index, row in enumerate(rows):
                mean, low, high = [float(row[f"{metric}_{suffix}"]) for suffix in ["mean", "ci95Low", "ci95High"]]
                center = left + slot * (index + .5)
                ym, yl, yh = [bottom - value / maximum * (bottom - top) for value in [mean, low, high]]
                canvas.rect((center - slot * .29, ym, center + slot * .29, bottom), COLORS[index])
                canvas.line([(center, yl), (center, yh)], TEXT, 3)
                canvas.line([(center - 8, yl), (center + 8, yl)], TEXT, 3)
                canvas.line([(center - 8, yh), (center + 8, yh)], TEXT, 3)
                canvas.text(center, bottom + 13, ["SYSTEM", "Shortest", "Round R.", "Least U.", "Random"][index], 15, anchor="ma")
            if c == 0:
                canvas.text(x0 - 60, (top + bottom) / 2, "Seconds", 18, MUTED, "mm")
    canvas.save(stem)


def paired_p95_figure(paired):
    canvas = Canvas(1800, 980)
    canvas.text(900, 45, "SYSTEM vs Shortest Queue: paired P95 wait improvement", 34, anchor="ma", bold=True)
    canvas.text(900, 82, "Positive differences favor SYSTEM; whiskers show 95% confidence intervals", 21, MUTED, "ma")
    categories = [(p, w) for p in PROFILES for w in WORKFLOWS]
    rows = [paired_row(paired, p, w, "p95StepWaitSeconds") for p, w in categories]
    left, right, top, bottom = 450, 1640, 150, 840
    maximum = max(float(row["ci95DifferenceHigh"]) for row in rows) * 1.18
    for tick in range(6):
        value, x = maximum * tick / 5, left + (right - left) * tick / 5
        canvas.line([(x, top), (x, bottom)], GRID, 1)
        canvas.text(x, bottom + 22, f"{value:,.0f}", 19, MUTED, "ma")
    canvas.line([(left, top), (left, bottom), (right, bottom)], TEXT, 2)
    for index, ((profile, workflow), row) in enumerate(zip(categories, rows)):
        y = top + (bottom - top) / 6 * (index + .5)
        mean, low, high = [float(row[name]) for name in ["meanAbsoluteDifference", "ci95DifferenceLow", "ci95DifferenceHigh"]]
        xm, xl, xh = [left + value / maximum * (right - left) for value in [mean, low, high]]
        color = COLORS[0 if profile == "HOMOGENEOUS" else 4]
        canvas.text(left - 24, y, f"{LABELS[profile]} — {LABELS[workflow]}", 21, anchor="ra")
        canvas.line([(xl, y), (xh, y)], color, 6)
        canvas.line([(xl, y - 9), (xl, y + 9)], TEXT, 3)
        canvas.line([(xh, y - 9), (xh, y + 9)], TEXT, 3)
        canvas.rect((xm - 8, y - 8, xm + 8, y + 8), color)
        canvas.text(min(right - 5, xh + 16), y, f"{float(row['meanRelativeImprovementPercent']):.2f}%", 19, anchor="la", bold=True)
    canvas.text((left + right) / 2, 920, "Paired P95 waiting-time difference (seconds)", 22, anchor="ma")
    canvas.save("figure-4-system-vs-shortest-queue-p95")


def topology_figure(aggregated):
    canvas = Canvas(1800, 920)
    canvas.text(900, 45, "Workflow topology comparison for SYSTEM", 34, anchor="ma", bold=True)
    canvas.text(900, 82, "Means across 30 seeds; whiskers show 95% confidence intervals", 21, MUTED, "ma")
    for panel, (metric, title) in enumerate([("avgStepWaitSeconds", "Average step wait (seconds)"), ("avgLosSeconds", "Average LOS (seconds)")]):
        left, right, top, bottom = 115 + panel * 855, 800 + panel * 855, 180, 755
        rows = [aggregate_row(aggregated, p, w, "SYSTEM") for w in WORKFLOWS for p in PROFILES]
        maximum = axis_maximum(max(float(row[f"{metric}_ci95High"]) for row in rows) * 1.08)
        canvas.text((left + right) / 2, 135, title, 25, anchor="ma", bold=True)
        for tick in range(6):
            value, y = maximum * tick / 5, bottom - (bottom - top) * tick / 5
            canvas.line([(left, y), (right, y)], GRID, 1)
            canvas.text(left - 10, y, f"{value:,.0f}", 18, MUTED, "ra")
        canvas.line([(left, top), (left, bottom), (right, bottom)], TEXT, 2)
        group = (right - left) / 3
        bar = group * .27
        for wi, workflow in enumerate(WORKFLOWS):
            center = left + group * (wi + .5)
            for pi, profile in enumerate(PROFILES):
                row = aggregate_row(aggregated, profile, workflow, "SYSTEM")
                mean, low, high = [float(row[f"{metric}_{suffix}"]) for suffix in ["mean", "ci95Low", "ci95High"]]
                x = center + (pi - .5) * bar
                ym, yl, yh = [bottom - value / maximum * (bottom - top) for value in [mean, low, high]]
                canvas.rect((x - bar / 2, ym, x + bar / 2, bottom), [COLORS[0], COLORS[4]][pi])
                canvas.line([(x, yl), (x, yh)], TEXT, 3)
                canvas.line([(x - 7, yl), (x + 7, yl)], TEXT, 3)
                canvas.line([(x - 7, yh), (x + 7, yh)], TEXT, 3)
            canvas.text(center, bottom + 20, LABELS[workflow], 19, anchor="ma")
    canvas.rect((660, 835, 690, 865), COLORS[0]); canvas.text(705, 850, "Homogeneous", 20, anchor="la")
    canvas.rect((925, 835, 955, 865), COLORS[4]); canvas.text(970, 850, "Heterogeneous", 20, anchor="la")
    canvas.save("figure-5-system-workflow-topology")


def main():
    raw, aggregated, paired, config = validate()
    write_tables(aggregated, paired, config)
    write_prose(aggregated, paired, config)
    grouped_figure(aggregated, "figure-1-mean-step-wait", "Mean average step waiting time by algorithm", "avgStepWaitSeconds")
    grouped_figure(aggregated, "figure-2-p95-step-wait", "Mean P95 step waiting time by algorithm", "p95StepWaitSeconds")
    grouped_figure(aggregated, "figure-3-average-los", "Mean average length of stay by algorithm", "avgLosSeconds")
    paired_p95_figure(paired)
    topology_figure(aggregated)
    print(f"Validated {len(raw)} raw rows, {len(aggregated)} aggregate rows, and {len(paired)} paired rows")
    print("Generated 7 Markdown documents and 5 PNG/SVG figure pairs")


if __name__ == "__main__":
    main()
