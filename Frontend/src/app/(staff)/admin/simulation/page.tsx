"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, FlaskConical, Play, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCompareBenchmark, useRunBenchmark, useSimulationRuns } from "@/features/simulation/hooks";
import type { BenchmarkAlgorithm, BenchmarkRunResult, BenchmarkWorkflow } from "@/features/simulation/types";

const ALGORITHMS: Array<{ id: BenchmarkAlgorithm; label: string }> = [
  { id: "SYSTEM", label: "System Algorithm — Min Estimated Waiting Time" },
  { id: "SHORTEST_QUEUE", label: "Shortest Queue" }, { id: "ROUND_ROBIN", label: "Round Robin" },
  { id: "RANDOM", label: "Random (Seeded)" }, { id: "LEAST_UTILISED", label: "Least Utilised" },
];
const WORKFLOWS: Array<{ id: BenchmarkWorkflow; label: string; description: string }> = [
  { id: "INDEPENDENT", label: "Independent", description: "A, B, C, D ready independently" },
  { id: "SEQUENTIAL", label: "Sequential", description: "A → B → C → D" },
  { id: "PARTIAL", label: "Partial Dependency", description: "A/B parallel, converge at E" },
];
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function Comparison({ results }: { results: BenchmarkRunResult[] }) {
  const max = Math.max(...results.map((item) => item.metrics.averageWaitingTimeMs), 1);
  return <div className="space-y-5" data-testid="benchmark-comparison">
    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{["Algorithm", "Avg Wait", "P95 Wait", "Avg LOS", "Throughput", "Room Util."].map((x) => <th className="px-4 py-3" key={x}>{x}</th>)}</tr></thead><tbody>{results.map((item) => <tr key={item.algorithm} className={item.algorithm === "SYSTEM" ? "border-t bg-sky-50" : "border-t"}><td className="px-4 py-3 font-medium">{item.algorithmLabel}{item.algorithm === "SYSTEM" && <span className="ml-2 rounded bg-sky-600 px-2 py-0.5 text-xs text-white">SYSTEM</span>}</td><td className="px-4 py-3">{seconds(item.metrics.averageWaitingTimeMs)}</td><td className="px-4 py-3">{seconds(item.metrics.p95WaitingTimeMs)}</td><td className="px-4 py-3">{seconds(item.metrics.averageLengthOfStayMs)}</td><td className="px-4 py-3">{item.metrics.throughputPerSimHour.toFixed(1)}/h</td><td className="px-4 py-3">{item.metrics.averageRoomUtilizationPct.toFixed(1)}%</td></tr>)}</tbody></table></div>
    <Card><CardHeader><CardTitle>Average Waiting Time by Algorithm</CardTitle></CardHeader><CardContent className="space-y-3">{results.map((item) => <div key={item.algorithm} className="grid grid-cols-[minmax(150px,260px)_1fr_70px] items-center gap-3 text-sm"><span className={item.algorithm === "SYSTEM" ? "font-semibold text-sky-700" : ""}>{item.algorithmLabel}</span><div className="h-5 rounded bg-slate-100"><div className={item.algorithm === "SYSTEM" ? "h-full rounded bg-sky-500" : "h-full rounded bg-slate-400"} style={{ width: `${Math.max(2, item.metrics.averageWaitingTimeMs / max * 100)}%` }} /></div><span className="text-right">{seconds(item.metrics.averageWaitingTimeMs)}</span></div>)}</CardContent></Card>
  </div>;
}

function Single({ result }: { result: BenchmarkRunResult }) {
  return <div className="space-y-5" data-testid="benchmark-single-result"><div className="grid gap-3 md:grid-cols-5">{[["Avg Wait", seconds(result.metrics.averageWaitingTimeMs)], ["P95 Wait", seconds(result.metrics.p95WaitingTimeMs)], ["Avg LOS", seconds(result.metrics.averageLengthOfStayMs)], ["Throughput", `${result.metrics.throughputPerSimHour.toFixed(1)}/h`], ["Completed", `${result.metrics.completedPatientCount}/${result.patientCount}`]].map(([label, value]) => <Card key={label}><CardContent className="pt-5"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></CardContent></Card>)}</div><div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle>Room / Service State</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3">{result.rooms.map((room) => <div key={room.roomId} className="rounded border p-3"><p className="font-medium">{room.roomId}</p><p className="text-xs text-slate-500">{room.serviceId} · {room.patientsServed} patients</p><div className="mt-2 h-2 rounded bg-slate-100"><div className="h-full rounded bg-emerald-500" style={{ width: `${room.utilizationPct}%` }} /></div><p className="mt-1 text-xs text-slate-500">Utilization {room.utilizationPct.toFixed(1)}%</p></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Final replay events</CardTitle></CardHeader><CardContent><div className="max-h-80 space-y-1 overflow-y-auto font-mono text-xs">{result.events.slice(-20).map((event, i) => <div key={`${event.simTimeMs}-${i}`} className="grid grid-cols-[70px_70px_1fr] gap-2 border-b py-1"><span>{seconds(event.simTimeMs)}</span><span>{event.patientId}</span><span>{event.type} {event.serviceId} {event.roomId}</span></div>)}</div></CardContent></Card></div></div>;
}

export default function SimulationBenchmarkPage() {
  const [patientCount, setPatientCount] = useState(100), [workflow, setWorkflow] = useState<BenchmarkWorkflow>("SEQUENTIAL"), [mode, setMode] = useState<"SINGLE" | "COMPARE">("SINGLE"), [algorithm, setAlgorithm] = useState<BenchmarkAlgorithm>("SYSTEM"), [algorithms, setAlgorithms] = useState<BenchmarkAlgorithm[]>(["SYSTEM", "SHORTEST_QUEUE", "ROUND_ROBIN"]), [seed, setSeed] = useState(20261002), [advanced, setAdvanced] = useState(false);
  const single = useRunBenchmark(), compare = useCompareBenchmark(), legacy = useSimulationRuns();
  const pending = single.isPending || compare.isPending, error = single.error ?? compare.error;
  const toggle = (id: BenchmarkAlgorithm) => setAlgorithms((xs) => xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]);
  const submit = () => { single.reset(); compare.reset(); const common = { patientCount, workflow, seed }; if (mode === "SINGLE") single.mutate({ ...common, algorithm }); else if (algorithms.length >= 2) compare.mutate({ ...common, algorithms }); };
  const invalid = patientCount < 1 || patientCount > 1000 || (mode === "COMPARE" && algorithms.length < 2);
  return <div className="space-y-6 p-6"><div><div className="flex items-center gap-2"><FlaskConical className="h-6 w-6 text-sky-600" /><h1 className="text-2xl font-semibold">Routing Algorithm Simulation</h1></div><p className="mt-1 text-sm text-slate-500">Deterministic in-memory thesis benchmark. Production workflow simulation remains a regression harness.</p></div>
    <Card><CardHeader><CardTitle>Benchmark scenario</CardTitle></CardHeader><CardContent className="space-y-5"><div className="max-w-xs"><Label htmlFor="benchmark-patients">Patients</Label><Input id="benchmark-patients" type="number" min={1} max={1000} value={patientCount} onChange={(e) => setPatientCount(Number(e.target.value))} /></div><div><Label>Service workflow</Label><div className="mt-2 grid gap-3 md:grid-cols-3">{WORKFLOWS.map((x) => <label key={x.id} className={`cursor-pointer rounded-lg border p-4 ${workflow === x.id ? "border-sky-500 bg-sky-50" : ""}`}><input className="mr-2" type="radio" name="workflow" checked={workflow === x.id} onChange={() => setWorkflow(x.id)} /><b>{x.label}</b><p className="mt-1 text-xs text-slate-500">{x.description}</p></label>)}</div></div><div><Label>Mode</Label><div className="mt-2 flex gap-5 text-sm"><label><input className="mr-2" type="radio" name="mode" checked={mode === "SINGLE"} onChange={() => setMode("SINGLE")} />Single Algorithm</label><label><input className="mr-2" type="radio" name="mode" checked={mode === "COMPARE"} onChange={() => setMode("COMPARE")} />Compare Algorithms</label></div></div>
      {mode === "SINGLE" ? <div className="max-w-lg"><Label htmlFor="benchmark-algorithm">Algorithm</Label><Select id="benchmark-algorithm" value={algorithm} onChange={(e) => setAlgorithm(e.target.value as BenchmarkAlgorithm)}>{ALGORITHMS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></div> : <div><Label>Algorithms</Label><div className="mt-2 grid gap-2 md:grid-cols-2">{ALGORITHMS.map((x) => <label key={x.id} className="rounded border p-3 text-sm"><input className="mr-2" type="checkbox" checked={algorithms.includes(x.id)} onChange={() => toggle(x.id)} />{x.label}</label>)}</div>{algorithms.length < 2 && <p className="mt-2 text-sm text-red-600">Select at least two algorithms.</p>}</div>}
      <button className="flex items-center gap-2 text-sm text-slate-600" onClick={() => setAdvanced((x) => !x)}><Settings2 className="h-4 w-4" />Advanced Settings</button>{advanced && <div className="max-w-xs"><Label htmlFor="benchmark-seed">Deterministic seed</Label><Input id="benchmark-seed" type="number" min={0} value={seed} onChange={(e) => setSeed(Number(e.target.value))} /></div>}<Button onClick={submit} disabled={invalid || pending} isLoading={pending}><Play className="h-4 w-4" />{mode === "SINGLE" ? "Run Simulation" : "Compare Algorithms"}</Button>{error && <div role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">Benchmark failed. Please retry.</div>}</CardContent></Card>
    {single.data && <Single result={single.data} />}{compare.data && <Comparison results={compare.data.results} />}{!single.data && !compare.data && !pending && <Card><CardContent className="flex flex-col items-center py-12 text-slate-500"><BarChart3 className="mb-3 h-9 w-9" />Configure a scenario and run the benchmark.</CardContent></Card>}
    <Card><CardHeader><CardTitle>Production Workflow Simulator</CardTitle></CardHeader><CardContent><p className="text-sm text-slate-600">Database-backed regression runs remain unchanged. Existing runs: {legacy.data?.length ?? 0}.</p>{legacy.data?.slice(0, 5).map((run) => <Link key={run.id} href={`/admin/simulation/${run.id}`} className="mt-2 block text-sm text-sky-700 hover:underline">{run.name} · {run.status}</Link>)}</CardContent></Card>
  </div>;
}
