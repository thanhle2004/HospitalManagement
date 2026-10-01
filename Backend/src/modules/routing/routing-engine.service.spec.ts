import { AssignmentStatus, VisitStatus, VisitStepStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VisitStepsRepository } from '../visits/repositories/visit-steps.repository';
import { RoutingQueueRepository } from '../visits/repositories/routing-queue.repository';
import { VisitsRepository } from '../visits/repositories/visits.repository';
import { RoomsRepository } from '../rooms/rooms.repository';
import { RoomTypesRepository } from '../room-types/room-types.repository';
import { VisitAssignmentsRepository } from './repositories/visit-assignments.repository';
import { VisitTokensRepository } from './repositories/visit-tokens.repository';
import { RoutingDecisionsRepository } from './repositories/routing-decisions.repository';
import { RoutingStrategyRegistry } from './strategies/routing-strategy.registry';
import { RoutingEngineService } from './routing-engine.service';

function buildRoutingService(overrides: {
  activeByVisit?: number[];
  workloadByRoom?: Record<number, { inServiceCount: number; waitingCount: number }>;
  averageByRoomType?: Record<number, number>;
  roomOverrides?: Record<number, number | null>;
  visitStatus?: VisitStatus;
  steps?: Array<{
    id: number;
    visitId: string;
    roomTypeId: number;
    displayOrder: number;
    status: VisitStepStatus;
  }>;
} = {}) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'visit-1' }]),
    visitStep: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const visitStepsRepository = {
    findById: jest.fn().mockResolvedValue({ id: 101, visitId: 'visit-1' }),
    findAllByVisit: jest.fn().mockResolvedValue(
      overrides.steps ?? [
        { id: 101, visitId: 'visit-1', roomTypeId: 1, displayOrder: 1, status: VisitStepStatus.READY },
        { id: 102, visitId: 'visit-1', roomTypeId: 2, displayOrder: 2, status: VisitStepStatus.READY },
      ],
    ),
  };
  const visitsRepository = {
    findById: jest.fn().mockResolvedValue({
      id: 'visit-1',
      simulationRunId: null,
      status: overrides.visitStatus ?? VisitStatus.WAITING,
    }),
  };
  const roomTypesRepository = {
    findById: jest.fn().mockImplementation(async (roomTypeId: number) => ({
      id: roomTypeId,
      avgProcessTime: overrides.averageByRoomType?.[roomTypeId] ?? (roomTypeId === 1 ? 10 : 1),
    })),
  };
  const roomsRepository = {
    findRoutingEligibleByRoomType: jest.fn().mockImplementation(async (roomTypeId: number) => {
      const avgProcessTime =
        overrides.averageByRoomType?.[roomTypeId] ?? (roomTypeId === 1 ? 10 : 1);
      const rooms = roomTypeId === 1
        ? [{ id: 11, roomNumber: 'A1', sortOrder: 1, roomTypeId }]
        : [
            { id: 21, roomNumber: 'B1', sortOrder: 1, roomTypeId },
            { id: 22, roomNumber: 'B2', sortOrder: 2, roomTypeId },
          ];
      return rooms.map((room) => ({
        ...room,
        avgProcessTime: overrides.roomOverrides?.[room.id] ?? null,
        roomType: { id: roomTypeId, avgProcessTime },
      }));
    }),
  };
  const activeByVisit = [...(overrides.activeByVisit ?? [0, 0])];
  const workloadByRoom = overrides.workloadByRoom ?? {
    11: { inServiceCount: 0, waitingCount: 2 },
    21: { inServiceCount: 0, waitingCount: 5 },
    22: { inServiceCount: 0, waitingCount: 3 },
  };
  const visitAssignmentsRepository = {
    countActiveByVisit: jest.fn().mockImplementation(async () => activeByVisit.shift() ?? 0),
    countWorkloadByRoom: jest.fn().mockImplementation(async (roomId: number) =>
      workloadByRoom[roomId] ?? { inServiceCount: 0, waitingCount: 0 },
    ),
    create: jest.fn().mockResolvedValue({ id: 900 }),
  };
  const routingQueueRepository = {
    delete: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn(),
  };
  const visitTokensRepository = { create: jest.fn().mockResolvedValue(undefined) };
  const routingDecisionsRepository = { create: jest.fn().mockResolvedValue(undefined) };
  const routingStrategyRegistry = new RoutingStrategyRegistry();
  const configService = {
    get: jest.fn((key: string) => key === 'routing.qrExpiresInSeconds' ? 300 : undefined),
  };
  const eventEmitter = { emit: jest.fn() };
  const prisma = {
    transaction: jest.fn(async (work: (client: typeof tx) => unknown) => work(tx)),
  };
  const service = new RoutingEngineService(
    visitStepsRepository as unknown as VisitStepsRepository,
    routingQueueRepository as unknown as RoutingQueueRepository,
    visitsRepository as unknown as VisitsRepository,
    roomsRepository as unknown as RoomsRepository,
    roomTypesRepository as unknown as RoomTypesRepository,
    visitAssignmentsRepository as unknown as VisitAssignmentsRepository,
    visitTokensRepository as unknown as VisitTokensRepository,
    routingDecisionsRepository as unknown as RoutingDecisionsRepository,
    routingStrategyRegistry,
    prisma as unknown as PrismaService,
    configService as never,
    eventEmitter as never,
  );

  return {
    service,
    tx,
    visitStepsRepository,
    visitAssignmentsRepository,
    routingQueueRepository,
    routingDecisionsRepository,
    eventEmitter,
  };
}

describe('RoutingEngineService Visit-level routing', () => {
  it('selects one global minimum across ready steps and their eligible rooms', async () => {
    const { service, tx, visitAssignmentsRepository, routingQueueRepository, routingDecisionsRepository } =
      buildRoutingService();

    await service.routeNextForVisit('visit-1');

    expect(tx.visitStep.updateMany).toHaveBeenCalledWith({
      where: { id: 102, visitId: 'visit-1', status: VisitStepStatus.READY },
      data: { status: VisitStepStatus.ASSIGNED },
    });
    expect(visitAssignmentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        visitStep: { connect: { id: 102 } },
        room: { connect: { id: 22 } },
        status: AssignmentStatus.WAITING,
      }),
      tx,
    );
    expect(routingQueueRepository.delete).toHaveBeenCalledWith(102, tx);
    expect(routingQueueRepository.delete).toHaveBeenCalledTimes(1);
    expect(routingDecisionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        visitStepId: 102,
        selectedRoomId: 22,
        candidates: expect.arrayContaining([
          expect.objectContaining({ visitStepId: 101, roomId: 11 }),
          expect.objectContaining({ visitStepId: 102, roomId: 21 }),
          expect.objectContaining({ visitStepId: 102, roomId: 22 }),
        ]),
      }),
    );
  });

  it('records zero seconds for an idle room', async () => {
    const { service, routingDecisionsRepository } = buildRoutingService({
      steps: [
        { id: 101, visitId: 'visit-1', roomTypeId: 1, displayOrder: 1, status: VisitStepStatus.READY },
      ],
      workloadByRoom: { 11: { inServiceCount: 0, waitingCount: 0 } },
    });

    await service.routeNextForVisit('visit-1');

    expect(routingDecisionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: [expect.objectContaining({ estimatedWaitingSeconds: 0 })],
      }),
    );
  });

  it('computes (1 IN_PROGRESS + 2 WAITING/CHECKED_IN) * 90 seconds as 270 seconds', async () => {
    const { service, routingDecisionsRepository } = buildRoutingService({
      steps: [
        { id: 101, visitId: 'visit-1', roomTypeId: 1, displayOrder: 1, status: VisitStepStatus.READY },
      ],
      averageByRoomType: { 1: 90 },
      workloadByRoom: { 11: { inServiceCount: 1, waitingCount: 2 } },
    });

    await service.routeNextForVisit('visit-1');

    expect(routingDecisionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: [
          expect.objectContaining({
            inServiceCount: 1,
            waitingCount: 2,
            effectiveAverageProcessTimeSeconds: 90,
            estimatedWaitingSeconds: 270,
          }),
        ],
      }),
    );
  });

  it('prefers a Room average-time override over the RoomType default', async () => {
    const { service, tx, routingDecisionsRepository } = buildRoutingService({
      roomOverrides: { 11: 1 },
    });

    await service.routeNextForVisit('visit-1');

    expect(tx.visitStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 101 }) }),
    );
    expect(routingDecisionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: expect.arrayContaining([
          expect.objectContaining({
            roomId: 11,
            effectiveAverageProcessTimeSeconds: 1,
            estimatedWaitingSeconds: 2,
          }),
        ]),
      }),
    );
  });

  it('does not create another assignment when a duplicate trigger sees an active Visit', async () => {
    const { service, visitAssignmentsRepository } = buildRoutingService({ activeByVisit: [0, 0, 1] });

    await service.routeNextForVisit('visit-1');
    await service.routeNextForVisit('visit-1');

    expect(visitAssignmentsRepository.create).toHaveBeenCalledTimes(1);
  });

  it.each([VisitStatus.COMPLETED, VisitStatus.CANCELLED])(
    'does not route READY siblings after the Visit is %s',
    async (visitStatus) => {
      const { service, visitAssignmentsRepository } = buildRoutingService({ visitStatus });

      await service.routeNextForVisit('visit-1');

      expect(visitAssignmentsRepository.create).not.toHaveBeenCalled();
    },
  );

  it('routes only genuinely READY steps and ignores completed or assigned steps', async () => {
    const { service, visitStepsRepository, visitAssignmentsRepository } = buildRoutingService({
      steps: [
        { id: 100, visitId: 'visit-1', roomTypeId: 1, displayOrder: 1, status: VisitStepStatus.COMPLETED },
        { id: 101, visitId: 'visit-1', roomTypeId: 1, displayOrder: 2, status: VisitStepStatus.ASSIGNED },
        { id: 102, visitId: 'visit-1', roomTypeId: 2, displayOrder: 3, status: VisitStepStatus.READY },
      ],
      workloadByRoom: {
        21: { inServiceCount: 0, waitingCount: 0 },
        22: { inServiceCount: 0, waitingCount: 0 },
      },
    });

    await service.routeNextForVisit('visit-1');

    expect(visitStepsRepository.findAllByVisit).toHaveBeenCalled();
    expect(visitAssignmentsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ visitStep: { connect: { id: 102 } } }),
      expect.anything(),
    );
  });
});
