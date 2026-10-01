import { ConflictException } from '@nestjs/common';
import { SimulationRoomLeasesRepository } from './simulation-room-leases.repository';

describe('SimulationRoomLeasesRepository', () => {
  it('rejects a second run that requests an already leased physical room', async () => {
    const tx = {
      simulationRoomLease: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ roomId: 4, runId: 'run-already-active' }]),
      },
    };
    const prisma = {
      transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
    };
    const repository = new SimulationRoomLeasesRepository(prisma as never);

    await expect(repository.acquire('run-2', [4])).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('releases every lease owned by a terminal or torn-down run', async () => {
    const prisma = {
      simulationRoomLease: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const repository = new SimulationRoomLeasesRepository(prisma as never);

    await expect(repository.releaseByRun('run-1')).resolves.toBe(2);
    expect(prisma.simulationRoomLease.deleteMany).toHaveBeenCalledWith({
      where: { runId: 'run-1' },
    });
  });
});
