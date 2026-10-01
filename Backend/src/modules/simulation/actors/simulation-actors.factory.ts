import { Injectable } from '@nestjs/common';
import { VisitsService } from '../../visits/visits.service';
import { CheckInService } from '../../check-in/check-in.service';
import { DoctorService } from '../../doctor/doctor.service';
import { VisitStepsRepository } from '../../visits/repositories/visit-steps.repository';
import { RoutingQueueRepository } from '../../visits/repositories/routing-queue.repository';
import { PatientGenerator, PatientGeneratorConfig } from './patient-generator';
import { DoctorSimulator, RoomServiceTimeConfig } from './doctor-simulator';

/**
 * Điểm nối DUY NHẤT giữa DI của NestJS và 2 actor class thuần (plain
 * class — xem docs/simulator-architecture.md §4). PatientGenerator/
 * DoctorSimulator KHÔNG tự là NestJS provider vì mỗi SimulationRun cần 1
 * instance actor RIÊNG (giữ state riêng cho run đó — vd rng, room maps), còn
 * NestJS provider mặc định là singleton dùng chung cho cả ứng dụng.
 *
 * SimulationOrchestrator (Phase 4) sẽ là nơi duy nhất gọi tới factory này —
 * 1 lần cho mỗi lần start() 1 run.
 */
@Injectable()
export class SimulationActorsFactory {
  constructor(
    private readonly visitsService: VisitsService,
    private readonly checkInService: CheckInService,
    private readonly doctorService: DoctorService,
    private readonly visitStepsRepository: VisitStepsRepository,
    private readonly routingQueueRepository: RoutingQueueRepository,
  ) {}

  createPatientGenerator(
    roomIdToDeviceId: ReadonlyMap<number, string>,
    config: PatientGeneratorConfig,
  ): PatientGenerator {
    return new PatientGenerator(
      this.visitsService,
      this.checkInService,
      roomIdToDeviceId,
      config,
      undefined,
      this.routingQueueRepository,
    );
  }

  createDoctorSimulator(
    roomIdToDoctorId: ReadonlyMap<number, string>,
    serviceTimeByRoom?: ReadonlyMap<number, RoomServiceTimeConfig>,
  ): DoctorSimulator {
    return new DoctorSimulator(
      this.doctorService,
      this.visitStepsRepository,
      roomIdToDoctorId,
      serviceTimeByRoom,
    );
  }
}
