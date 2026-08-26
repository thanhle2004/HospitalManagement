export const VISIT_STEP_READY_EVENT = 'visit-step.ready';

/**
 * Pattern Event-driven: VisitsModule emit event này mà KHÔNG biết (và
 * không cần biết) ai đang lắng nghe — tránh phải import RoutingModule vào
 * VisitsModule (sẽ tạo circular dependency vì RoutingModule cần import
 * ngược lại VisitsModule để dùng VisitStepsRepository/VisitsRepository).
 */
export class VisitStepReadyEvent {
  constructor(public readonly visitStepId: number) {}
}
