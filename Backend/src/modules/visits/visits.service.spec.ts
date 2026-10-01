import { EventEmitter2 } from '@nestjs/event-emitter';
import { VisitStatus, VisitStepStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FlowsRepository } from '../flows/repositories/flows.repository';
import { RoomTypesRepository } from '../room-types/room-types.repository';
import { RoutingQueueRepository } from './repositories/routing-queue.repository';
import { VisitStepDependenciesRepository } from './repositories/visit-step-dependencies.repository';
import { VisitStepsRepository } from './repositories/visit-steps.repository';
import { VisitsRepository } from './repositories/visits.repository';
import { VisitsService } from './visits.service';

describe('VisitsService characterization', () => {
  it('copies a one-step flow and queues the initial ready step atomically', async () => {
    const tx = { transaction: 'test' };
    const visitsRepository = {
      create: jest.fn().mockResolvedValue({ id: 'visit-1' }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    const visitStepsRepository = {
      create: jest.fn().mockResolvedValue({ id: 101 }),
      updateManyStatus: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const dependenciesRepository = {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const routingQueueRepository = {
      enqueueMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const flowsRepository = {
      findByIdWithGraph: jest.fn().mockResolvedValue({
        id: 7,
        steps: [
          {
            id: 11,
            roomTypeId: 3,
            displayOrder: 0,
            isOptional: false,
            dependencies: [],
          },
        ],
      }),
    };
    const prisma = {
      transaction: jest.fn(async (work: (transaction: unknown) => unknown) =>
        work(tx),
      ),
    };
    const eventEmitter = { emit: jest.fn() };
    const service = new VisitsService(
      visitsRepository as unknown as VisitsRepository,
      visitStepsRepository as unknown as VisitStepsRepository,
      dependenciesRepository as unknown as VisitStepDependenciesRepository,
      routingQueueRepository as unknown as RoutingQueueRepository,
      flowsRepository as unknown as FlowsRepository,
      {} as RoomTypesRepository,
      prisma as unknown as PrismaService,
      eventEmitter as unknown as EventEmitter2,
    );
    jest
      .spyOn(service, 'findDetailById')
      .mockResolvedValue({ id: 'visit-1' } as never);

    await service.create('patient-1', { flowId: 7 });

    expect(prisma.transaction).toHaveBeenCalledTimes(1);
    expect(visitStepsRepository.updateManyStatus).toHaveBeenCalledWith(
      [101],
      VisitStepStatus.READY,
      tx,
    );
    expect(routingQueueRepository.enqueueMany).toHaveBeenCalledWith([101], tx);
    expect(visitsRepository.updateStatus).toHaveBeenCalledWith(
      'visit-1',
      VisitStatus.WAITING,
      expect.objectContaining({ startedAt: expect.any(Date) }),
      tx,
    );
    expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
  });

  async function resolveGraph(
    steps: Array<{ id: number; status: VisitStepStatus }>,
    dependencies: Array<{ stepId: number; requiredStepId: number }>,
  ) {
    const tx = { transaction: 'dependency-test' };
    const visitsRepository = { updateStatus: jest.fn().mockResolvedValue(undefined) };
    const visitStepsRepository = {
      findAllByVisit: jest.fn().mockResolvedValue(steps),
      updateManyStatus: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const dependenciesRepository = {
      findAllByVisit: jest.fn().mockResolvedValue(dependencies),
    };
    const routingQueueRepository = {
      enqueueMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const service = new VisitsService(
      visitsRepository as unknown as VisitsRepository,
      visitStepsRepository as unknown as VisitStepsRepository,
      dependenciesRepository as unknown as VisitStepDependenciesRepository,
      routingQueueRepository as unknown as RoutingQueueRepository,
      {} as FlowsRepository,
      {} as RoomTypesRepository,
      {} as PrismaService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );

    const newlyReady = await service.resolveDependenciesAndCheckCompletion(
      'visit-1',
      tx as never,
    );
    return { newlyReady, visitStepsRepository, routingQueueRepository };
  }

  it('service 2 keeps independent A and C READY after B completes so routing can choose globally again', async () => {
    const result = await resolveGraph(
      [
        { id: 1, status: VisitStepStatus.READY },
        { id: 2, status: VisitStepStatus.COMPLETED },
        { id: 3, status: VisitStepStatus.READY },
      ],
      [],
    );

    expect(result.newlyReady).toEqual([]);
    expect(result.visitStepsRepository.updateManyStatus).not.toHaveBeenCalled();
  });

  it('service 3 unlocks C after B completes while independent A remains available', async () => {
    const result = await resolveGraph(
      [
        { id: 1, status: VisitStepStatus.READY },
        { id: 2, status: VisitStepStatus.COMPLETED },
        { id: 3, status: VisitStepStatus.LOCKED },
      ],
      [{ stepId: 3, requiredStepId: 2 }],
    );

    expect(result.newlyReady).toEqual([3]);
    expect(result.routingQueueRepository.enqueueMany).toHaveBeenCalledWith([3], expect.anything());
  });

  it('service 4 opens C only after both A and B complete', async () => {
    const dependencies = [
      { stepId: 3, requiredStepId: 1 },
      { stepId: 3, requiredStepId: 2 },
    ];
    const afterOnlyA = await resolveGraph(
      [
        { id: 1, status: VisitStepStatus.COMPLETED },
        { id: 2, status: VisitStepStatus.READY },
        { id: 3, status: VisitStepStatus.LOCKED },
      ],
      dependencies,
    );
    const afterOnlyB = await resolveGraph(
      [
        { id: 1, status: VisitStepStatus.READY },
        { id: 2, status: VisitStepStatus.COMPLETED },
        { id: 3, status: VisitStepStatus.LOCKED },
      ],
      dependencies,
    );
    const afterBoth = await resolveGraph(
      [
        { id: 1, status: VisitStepStatus.COMPLETED },
        { id: 2, status: VisitStepStatus.COMPLETED },
        { id: 3, status: VisitStepStatus.LOCKED },
      ],
      dependencies,
    );

    expect(afterOnlyA.newlyReady).toEqual([]);
    expect(afterOnlyB.newlyReady).toEqual([]);
    expect(afterBoth.newlyReady).toEqual([3]);
  });

  it('does not treat CANCELLED as satisfying a required dependency', async () => {
    const result = await resolveGraph(
      [
        { id: 1, status: VisitStepStatus.CANCELLED },
        { id: 2, status: VisitStepStatus.LOCKED },
      ],
      [{ stepId: 2, requiredStepId: 1 }],
    );

    expect(result.newlyReady).toEqual([]);
  });
});
