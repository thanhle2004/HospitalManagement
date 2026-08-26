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
});
