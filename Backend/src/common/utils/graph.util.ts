/**
 * Thuật toán đồ thị thuần (không phụ thuộc Prisma/NestJS) — dùng chung cho:
 *  - Phase 4: kiểm tra FlowDependency không tạo chu trình (cycle) khi Admin
 *    thiết kế Workflow (DAG ở cấp Flow/FlowStep).
 *  - Phase 5: xác định VisitStep nào đang READY (DAG ở cấp Visit/VisitStep
 *    runtime — cùng thuật toán, khác loại node).
 *
 * Quy ước: edge { from, to } nghĩa là node `from` PHẢI hoàn thành TRƯỚC
 * node `to` (from = tiền nhiệm/prerequisite, to = phụ thuộc/dependent).
 * Đây là chiều ngược với cách lưu trong bảng FlowDependency (stepId phụ
 * thuộc requiredStepId) — khi build input cho hàm ở đây, map:
 *   { from: requiredStepId, to: stepId }
 */

export interface DirectedEdge<T> {
  from: T;
  to: T;
}

/**
 * Topological sort bằng Kahn's Algorithm (BFS dựa trên in-degree).
 * Trả về mảng thứ tự hợp lệ nếu đồ thị là DAG, hoặc `null` nếu có chu trình
 * (đây chính là cách Kahn's algorithm dùng để phát hiện cycle: nếu số node
 * xử lý được < tổng số node, phần còn lại chắc chắn nằm trong 1 chu trình).
 */
export function topologicalSort<T>(
  nodes: T[],
  edges: DirectedEdge<T>[],
): T[] | null {
  const inDegree = new Map<T, number>();
  const adjacency = new Map<T, T[]>();

  for (const node of nodes) {
    inDegree.set(node, 0);
    adjacency.set(node, []);
  }

  for (const edge of edges) {
    // Bỏ qua edge trỏ tới node không nằm trong danh sách nodes (dữ liệu bất nhất)
    if (!adjacency.has(edge.from) || !inDegree.has(edge.to)) continue;
    adjacency.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const queue: T[] = nodes.filter((n) => inDegree.get(n) === 0);
  const order: T[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const next of adjacency.get(current) ?? []) {
      const remaining = inDegree.get(next)! - 1;
      inDegree.set(next, remaining);
      if (remaining === 0) {
        queue.push(next);
      }
    }
  }

  return order.length === nodes.length ? order : null;
}

/** true nếu thêm `candidateEdges` vào đồ thị hiện có sẽ tạo chu trình */
export function wouldCreateCycle<T>(
  nodes: T[],
  existingEdges: DirectedEdge<T>[],
  candidateEdges: DirectedEdge<T>[],
): boolean {
  const result = topologicalSort(nodes, [...existingEdges, ...candidateEdges]);
  return result === null;
}

/**
 * Tìm các node đang ở trạng thái READY: chưa hoàn thành (`completed`) NHƯNG
 * mọi tiền nhiệm (predecessor) đều đã hoàn thành — đúng công thức §8 bước 2
 * của spec Routing Engine. Dùng lại nguyên vẹn ở Phase 5 với node = VisitStep.
 */
export function findReadyNodes<T>(
  nodes: T[],
  edges: DirectedEdge<T>[],
  completed: Set<T>,
): T[] {
  const predecessorsOf = new Map<T, T[]>();
  for (const node of nodes) {
    predecessorsOf.set(node, []);
  }
  for (const edge of edges) {
    predecessorsOf.get(edge.to)?.push(edge.from);
  }

  return nodes.filter((node) => {
    if (completed.has(node)) return false;
    const predecessors = predecessorsOf.get(node) ?? [];
    return predecessors.every((p) => completed.has(p));
  });
}
