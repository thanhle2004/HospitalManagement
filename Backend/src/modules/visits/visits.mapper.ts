import {
  Flow,
  FlowStep,
  Room,
  RoomType,
  Visit,
  VisitAssignment,
  VisitStep,
  VisitStepDependency,
  VisitToken,
} from '@prisma/client';
import { VisitWithFlow } from './repositories/visits.repository';
import { VisitResponseDto } from './dto/visit-response.dto';
import { VisitDetailResponseDto } from './dto/visit-detail-response.dto';

type AssignmentWithRoomAndToken = VisitAssignment & {
  room: Room;
  qrToken: VisitToken | null;
};
type VisitStepWithGraph = VisitStep & {
  roomType: RoomType;
  flowStep: FlowStep | null;
  dependencies: VisitStepDependency[];
  assignments: AssignmentWithRoomAndToken[];
};
type VisitWithGraph = Visit & { flow: Flow; steps: VisitStepWithGraph[] };

export class VisitsMapper {
  static toResponseDto(visit: VisitWithFlow): VisitResponseDto {
    return {
      id: visit.id,
      status: visit.status,
      flow: { id: visit.flow.id, code: visit.flow.code, name: visit.flow.name },
      createdAt: visit.createdAt,
      startedAt: visit.startedAt,
      completedAt: visit.completedAt,
    };
  }

  static toResponseDtoList(visits: VisitWithFlow[]): VisitResponseDto[] {
    return visits.map((v) => this.toResponseDto(v));
  }

  static toDetailResponseDto(visit: VisitWithGraph): VisitDetailResponseDto {
    return {
      id: visit.id,
      status: visit.status,
      flow: { id: visit.flow.id, code: visit.flow.code, name: visit.flow.name },
      patientId: visit.patientId,
      createdAt: visit.createdAt,
      startedAt: visit.startedAt,
      completedAt: visit.completedAt,
      cancelledAt: visit.cancelledAt,
      steps: visit.steps.map((step) => {
        const currentAssignment = step.assignments[0] ?? null;
        return {
          id: step.id,
          code: step.flowStep?.code ?? null,
          status: step.status,
          isOptional: step.isOptional,
          isAdHoc: step.isAdHoc,
          displayOrder: step.displayOrder,
          roomType: { id: step.roomType.id, name: step.roomType.name },
          dependsOn: step.dependencies.map((d) => d.requiredStepId),
          completedAt: step.completedAt,
          assignment: currentAssignment
            ? {
                room: {
                  id: currentAssignment.room.id,
                  roomNumber: currentAssignment.room.roomNumber,
                  name: currentAssignment.room.name,
                },
                qrToken: currentAssignment.qrToken?.token ?? null,
                qrExpiresAt: currentAssignment.qrToken?.expiresAt ?? null,
              }
            : null,
        };
      }),
    };
  }
}
