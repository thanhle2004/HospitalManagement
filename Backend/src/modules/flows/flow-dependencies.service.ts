import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FlowDependenciesRepository } from './repositories/flow-dependencies.repository';
import { FlowStepsRepository } from './repositories/flow-steps.repository';
import { FlowStepsService } from './flow-steps.service';
import { CreateFlowDependencyDto } from './dto/create-flow-dependency.dto';
import { wouldCreateCycle } from '../../common/utils/graph.util';

@Injectable()
export class FlowDependenciesService {
  constructor(
    private readonly flowDependenciesRepository: FlowDependenciesRepository,
    private readonly flowStepsRepository: FlowStepsRepository,
    private readonly flowStepsService: FlowStepsService,
  ) {}

  async create(flowId: number, dto: CreateFlowDependencyDto) {
    // stepId !== requiredStepId đã validate ở DTO (zod .refine), ở đây chỉ
    // cần xác nhận cả 2 step đều thuộc đúng flowId — 1 dependency GIỮA 2
    // FLOW KHÁC NHAU là vô nghĩa (dù FK vẫn hợp lệ vì FlowStep.id là global).
    await this.flowStepsService.assertBelongsToFlow(flowId, dto.stepId);
    await this.flowStepsService.assertBelongsToFlow(flowId, dto.requiredStepId);

    await this.assertNoCycle(flowId, dto.stepId, dto.requiredStepId);

    return this.flowDependenciesRepository.create({
      step: { connect: { id: dto.stepId } },
      requiredStep: { connect: { id: dto.requiredStepId } },
    });
  }

  async remove(
    flowId: number,
    stepId: number,
    requiredStepId: number,
  ): Promise<void> {
    await this.flowStepsService.assertBelongsToFlow(flowId, stepId);

    const existing = await this.flowDependenciesRepository.findOne(
      stepId,
      requiredStepId,
    );
    if (!existing) {
      throw new NotFoundException('Dependency không tồn tại');
    }

    await this.flowDependenciesRepository.delete(stepId, requiredStepId);
  }

  /**
   * Lấy toàn bộ node (FlowStep) + edge (FlowDependency) hiện có của flow,
   * thêm candidate edge mới vào, chạy topological sort (Kahn's algorithm).
   * Nếu kết quả null => có chu trình => từ chối ngay, KHÔNG ghi DB.
   *
   * Quy ước edge cho graph.util: { from: prerequisite, to: dependent }.
   * FlowDependency lưu {stepId, requiredStepId} nghĩa là "stepId phụ thuộc
   * requiredStepId" => chiều edge cho thuật toán là { from: requiredStepId,
   * to: stepId } (requiredStepId phải xong TRƯỚC stepId).
   */
  private async assertNoCycle(
    flowId: number,
    stepId: number,
    requiredStepId: number,
  ): Promise<void> {
    const [allSteps, allDependencies] = await Promise.all([
      this.flowStepsRepository.findAllByFlow(flowId),
      this.flowDependenciesRepository.findAllByFlow(flowId),
    ]);

    const nodes = allSteps.map((s) => s.id);
    const existingEdges = allDependencies.map((d) => ({
      from: d.requiredStepId,
      to: d.stepId,
    }));
    const candidateEdge = [{ from: requiredStepId, to: stepId }];

    if (wouldCreateCycle(nodes, existingEdges, candidateEdge)) {
      throw new ConflictException(
        `Không thể thêm dependency: step #${stepId} phụ thuộc #${requiredStepId} sẽ tạo chu trình (cycle) trong workflow`,
      );
    }
  }
}
