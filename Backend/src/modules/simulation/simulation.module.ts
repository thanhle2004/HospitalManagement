import { Module } from '@nestjs/common';
import { PatientTypesModule } from '../patient-types/patient-types.module';
import { PatientsModule } from '../patients/patients.module';
import { VisitsModule } from '../visits/visits.module';
import { UsersModule } from '../users/users.module';
import { DoctorAssignmentsModule } from '../doctor-assignments/doctor-assignments.module';
import { RoomsModule } from '../rooms/rooms.module';
import { DevicesModule } from '../devices/devices.module';
import { CheckInModule } from '../check-in/check-in.module';
import { DoctorModule } from '../doctor/doctor.module';
import { RoutingModule } from '../routing/routing.module';
import { SimulationRunsRepository } from './repositories/simulation-runs.repository';
import { SimulationViolationsRepository } from './repositories/simulation-violations.repository';
import { SimulationEventsRepository } from './repositories/simulation-events.repository';
import { SimulationFixturesService } from './fixtures/simulation-fixtures.service';
import { SimulationActorsFactory } from './actors/simulation-actors.factory';
import { SimulationAssertionsRunner } from './metrics/simulation-assertions.runner';
import { SimulationOrchestratorService } from './orchestrator/simulation-orchestrator.service';
import { SimulationGateway } from './orchestrator/simulation.gateway';
import { SimulationController } from './simulation.controller';
import { SimulationRoomLeasesRepository } from './repositories/simulation-room-leases.repository';
import { SimulationEnabledGuard } from './simulation-enabled.guard';

// [Simulator Phase 0-4] Phase 4 thêm: metrics/assertions (DB-touching qua
// SimulationAssertionsRunner — logic THUẦN của assertions nằm ở
// metrics/simulation-assertions.ts, không phụ thuộc DI), orchestrator
// (headless — xem simulation-orchestrator.service.ts) và Controller đầu
// tiên của module này. Engine (Phase 1) vẫn KHÔNG nằm trong DI — plain
// class, `new SimulationEngine(...)` trực tiếp trong orchestrator.
@Module({
  imports: [
    PatientTypesModule, // PatientTypesRepository — tạo/tìm PatientType('SIMULATION')
    PatientsModule, // PatientsRepository — tạo/xoá Patient tổng hợp
    VisitsModule, // VisitsService/VisitStepsRepository/VisitsRepository
    UsersModule, // UsersRepository — tạo/xoá User bác sĩ tổng hợp
    DoctorAssignmentsModule, // DoctorAssignmentsRepository — ca trực cho bác sĩ tổng hợp
    RoomsModule, // RoomsRepository, RoomRuntimeRepository (Phase 4: A6/A7)
    DevicesModule, // DevicesRepository — tạo/xoá Device QR_SCANNER tổng hợp
    CheckInModule, // CheckInService, RoomQueueEntriesRepository (Phase 4: A2/A5/A6)
    DoctorModule, // DoctorService — DoctorSimulator giả lập khám bệnh
    RoutingModule, // [Phase 4] RoutingDecisionsRepository — A10
  ],
  controllers: [SimulationController],
  providers: [
    SimulationRunsRepository,
    SimulationFixturesService,
    SimulationActorsFactory,
    SimulationViolationsRepository, // [Phase 4]
    SimulationEventsRepository, // [Phase 4]
    SimulationAssertionsRunner, // [Phase 4]
    SimulationGateway, // [Phase 6]
    SimulationOrchestratorService, // [Phase 4]
    SimulationRoomLeasesRepository,
    SimulationEnabledGuard,
  ],
  exports: [
    SimulationRunsRepository,
    SimulationFixturesService,
    SimulationActorsFactory,
    SimulationOrchestratorService,
  ],
})
export class SimulationModule {}
