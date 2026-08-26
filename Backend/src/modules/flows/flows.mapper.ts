import { Flow, FlowDependency, FlowStep, RoomType } from '@prisma/client';
import { FlowResponseDto } from './dto/flow-response.dto';
import { FlowDetailResponseDto } from './dto/flow-detail-response.dto';
import { FlowWithStepCount } from './repositories/flows.repository';

type FlowStepWithGraph = FlowStep & {
  roomType: RoomType;
  dependencies: FlowDependency[];
};
type FlowWithGraph = Flow & { steps: FlowStepWithGraph[] };

export class FlowsMapper {
  static toResponseDto(flow: FlowWithStepCount): FlowResponseDto {
    return {
      id: flow.id,
      code: flow.code,
      name: flow.name,
      description: flow.description,
      stepCount: flow._count.steps,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
    };
  }

  static toResponseDtoList(flows: FlowWithStepCount[]): FlowResponseDto[] {
    return flows.map((f) => this.toResponseDto(f));
  }

  static toDetailResponseDto(flow: FlowWithGraph): FlowDetailResponseDto {
    return {
      id: flow.id,
      code: flow.code,
      name: flow.name,
      description: flow.description,
      createdAt: flow.createdAt,
      updatedAt: flow.updatedAt,
      steps: flow.steps.map((step) => ({
        id: step.id,
        code: step.code,
        displayOrder: step.displayOrder,
        isOptional: step.isOptional,
        roomType: { id: step.roomType.id, name: step.roomType.name },
        // step.dependencies là các row FlowDependency mà step này là "stepId"
        // -> map ra danh sách requiredStepId, chính là cạnh của DAG
        dependsOn: step.dependencies.map((d) => d.requiredStepId),
      })),
    };
  }
}
