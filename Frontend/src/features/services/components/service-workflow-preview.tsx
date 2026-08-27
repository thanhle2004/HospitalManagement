import { ArrowRight, CheckCircle2, GitBranch, Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ServiceStep } from "../types";

const NODE_WIDTH = 210;
const NODE_HEIGHT = 96;
const COLUMN_GAP = 110;
const ROW_GAP = 28;
const PADDING_X = 48;
const HEADER_HEIGHT = 50;
const PADDING_BOTTOM = 36;

interface NodePosition {
  x: number;
  y: number;
}

interface WorkflowGraph {
  layers: ServiceStep[][];
  positions: Map<number, NodePosition>;
  width: number;
  height: number;
}

function buildWorkflowGraph(steps: ServiceStep[]): WorkflowGraph {
  const stepsById = new Map(steps.map((step) => [step.id, step]));
  const layerById = new Map<number, number>();
  const visiting = new Set<number>();

  const findLayer = (step: ServiceStep): number => {
    const cached = layerById.get(step.id);
    if (cached !== undefined) return cached;
    if (visiting.has(step.id)) return 0;

    visiting.add(step.id);
    const prerequisiteLayers = step.dependsOn
      .map((id) => stepsById.get(id))
      .filter((required): required is ServiceStep => !!required)
      .map((required) => findLayer(required));
    visiting.delete(step.id);

    const layer = prerequisiteLayers.length > 0 ? Math.max(...prerequisiteLayers) + 1 : 0;
    layerById.set(step.id, layer);
    return layer;
  };

  for (const step of steps) findLayer(step);

  const layerCount = Math.max(0, ...layerById.values()) + 1;
  const layers = Array.from({ length: layerCount }, () => [] as ServiceStep[]);
  for (const step of steps) layers[layerById.get(step.id) ?? 0].push(step);
  for (const layer of layers) layer.sort((a, b) => a.displayOrder - b.displayOrder);

  const maxRows = Math.max(1, ...layers.map((layer) => layer.length));
  const contentHeight = maxRows * NODE_HEIGHT + Math.max(0, maxRows - 1) * ROW_GAP;
  const width = PADDING_X * 2 + layers.length * NODE_WIDTH + (layers.length - 1) * COLUMN_GAP;
  const height = HEADER_HEIGHT + contentHeight + PADDING_BOTTOM;
  const positions = new Map<number, NodePosition>();

  layers.forEach((layer, layerIndex) => {
    const layerHeight = layer.length * NODE_HEIGHT + Math.max(0, layer.length - 1) * ROW_GAP;
    const offsetY = HEADER_HEIGHT + (contentHeight - layerHeight) / 2;
    layer.forEach((step, rowIndex) => {
      positions.set(step.id, {
        x: PADDING_X + layerIndex * (NODE_WIDTH + COLUMN_GAP),
        y: offsetY + rowIndex * (NODE_HEIGHT + ROW_GAP),
      });
    });
  });

  return { layers, positions, width, height };
}

function PreviewStepCard({ step }: { step: ServiceStep }) {
  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800">
            {step.displayOrder}
          </span>
          <p className="truncate font-mono text-xs font-semibold text-slate-900">{step.code}</p>
        </div>
        <span
          className={
            step.isOptional
              ? "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700"
              : "rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700"
          }
        >
          {step.isOptional ? "Tuỳ chọn" : "Bắt buộc"}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-medium leading-5 text-slate-700">
        {step.roomType.name}
      </p>
      {step.dependsOn.length > 0 && (
        <p className="mt-auto pt-1 text-[10px] text-slate-500">
          Chờ {step.dependsOn.length} bước hoàn tất
        </p>
      )}
    </div>
  );
}

function IndependentWorkflowPreview({ steps }: { steps: ServiceStep[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="rounded-lg bg-white p-2 shadow-sm">
          <Shuffle className="h-5 w-5 text-emerald-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-900">Các phòng không phụ thuộc nhau</p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            Bệnh nhân có thể bắt đầu ở bất kỳ phòng nào và thay đổi thứ tự theo tình trạng hàng đợi.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => (
          <div key={step.id} className="h-28">
            <PreviewStepCard step={step} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ServiceWorkflowPreview({ steps }: { steps: ServiceStep[] }) {
  const dependencyCount = steps.reduce((total, step) => total + step.dependsOn.length, 0);

  if (steps.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <GitBranch className="h-9 w-9 text-slate-400" />
        <p className="mt-3 text-sm font-medium text-slate-800">Quy trình chưa có bước khám</p>
        <p className="mt-1 text-xs text-slate-500">
          Chuyển sang chế độ chỉnh sửa để thêm bước đầu tiên.
        </p>
      </div>
    );
  }

  if (dependencyCount === 0) return <IndependentWorkflowPreview steps={steps} />;

  const graph = buildWorkflowGraph(steps);
  const stepsById = new Map(steps.map((step) => [step.id, step]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-white p-2 shadow-sm">
            <GitBranch className="h-5 w-5 text-sky-700" />
          </div>
          <div>
            <p className="text-sm font-semibold text-sky-950">Quy trình có điều kiện trước–sau</p>
            <p className="mt-1 text-xs leading-5 text-sky-800">
              Các bước cùng một cột có thể thực hiện theo bất kỳ thứ tự nào sau khi đủ điều kiện.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="info">{graph.layers.length} giai đoạn</Badge>
          <Badge variant="default">{dependencyCount} ràng buộc</Badge>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50">
        <svg
          width={graph.width}
          height={graph.height}
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          role="img"
          aria-labelledby="workflow-preview-title workflow-preview-description"
          className="block max-w-none"
        >
          <title id="workflow-preview-title">Sơ đồ quy trình dịch vụ khám</title>
          <desc id="workflow-preview-description">
            Mũi tên biểu thị bước nguồn phải hoàn tất trước khi bước đích được mở.
          </desc>
          <defs>
            <pattern id="workflow-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#cbd5e1" opacity="0.45" />
            </pattern>
            <marker
              id="workflow-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#38bdf8" />
            </marker>
          </defs>

          <rect width={graph.width} height={graph.height} fill="url(#workflow-grid)" />

          {graph.layers.map((_, index) => {
            const x = PADDING_X + index * (NODE_WIDTH + COLUMN_GAP) + NODE_WIDTH / 2;
            return (
              <text
                key={index}
                x={x}
                y={28}
                textAnchor="middle"
                className="fill-slate-500 text-[11px] font-semibold uppercase tracking-wider"
              >
                {index === 0 ? "Bắt đầu" : `Giai đoạn ${index + 1}`}
              </text>
            );
          })}

          {steps.flatMap((step) =>
            step.dependsOn.map((requiredId) => {
              const source = graph.positions.get(requiredId);
              const target = graph.positions.get(step.id);
              if (!source || !target || !stepsById.has(requiredId)) return null;

              const startX = source.x + NODE_WIDTH;
              const startY = source.y + NODE_HEIGHT / 2;
              const endX = target.x - 8;
              const endY = target.y + NODE_HEIGHT / 2;
              const curve = Math.max(35, (endX - startX) / 2);

              return (
                <path
                  key={`${requiredId}-${step.id}`}
                  d={`M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  markerEnd="url(#workflow-arrow)"
                />
              );
            }),
          )}

          {steps.map((step) => {
            const position = graph.positions.get(step.id)!;
            return (
              <foreignObject
                key={step.id}
                x={position.x}
                y={position.y}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
              >
                <PreviewStepCard step={step} />
              </foreignObject>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <ArrowRight className="h-4 w-4 text-sky-500" />
          Mũi tên: phải hoàn tất trước
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Xanh: bước bắt buộc
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          Vàng: bước tuỳ chọn
        </span>
      </div>
    </div>
  );
}
