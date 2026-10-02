import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import * as request from 'supertest';
import { BenchmarkController } from './benchmark.controller';
import { BenchmarkService } from './benchmark.service';
import { SimulationEnabledGuard } from '../simulation-enabled.guard';

describe('Benchmark API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BenchmarkController],
      providers: [BenchmarkService],
    })
      .overrideGuard(SimulationEnabledGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  });

  afterAll(() => app.close());

  it('runs one deterministic benchmark', async () => {
    const payload = { patientCount: 5, workflow: 'SEQUENTIAL', processingProfile: 'HETEROGENEOUS', algorithm: 'SYSTEM', seed: 17 };
    const first = await request(app.getHttpServer()).post('/simulation/benchmark/run').send(payload).expect(201);
    const second = await request(app.getHttpServer()).post('/simulation/benchmark/run').send(payload).expect(201);
    expect(first.body).toEqual(second.body);
    expect(first.body.metrics.completedPatientCount).toBe(5);
    expect(first.body).toMatchObject({ processingProfile: 'HETEROGENEOUS', scenarioId: expect.stringMatching(/^SCN-/) });
  });

  it('compares algorithms on one config', async () => {
    const response = await request(app.getHttpServer())
      .post('/simulation/benchmark/compare')
      .send({ patientCount: 4, workflow: 'PARTIAL', processingProfile: 'HOMOGENEOUS', algorithms: ['SYSTEM', 'ROUND_ROBIN'], seed: 9 })
      .expect(201);
    expect(response.body.results.map((result: { algorithm: string }) => result.algorithm)).toEqual(['SYSTEM', 'ROUND_ROBIN']);
    expect(response.body.scenario).toMatchObject({ patientCount: 4, workflow: 'PARTIAL', processingProfile: 'HOMOGENEOUS', seed: 9, schemaVersion: 1, scenarioId: expect.stringMatching(/^SCN-/) });
    expect(response.body.scenario.services).toHaveLength(5);
  });

  it.each([
    [{ patientCount: 0, workflow: 'SEQUENTIAL', algorithm: 'SYSTEM', seed: 1 }],
    [{ patientCount: 5, workflow: 'SEQUENTIAL', algorithm: 'UNKNOWN', seed: 1 }],
    [{ patientCount: 5, workflow: 'SEQUENTIAL', algorithms: ['SYSTEM'], seed: 1 }],
  ])('rejects invalid input %#', async (payload) => {
    const path = 'algorithms' in payload ? 'compare' : 'run';
    await request(app.getHttpServer()).post(`/simulation/benchmark/${path}`).send(payload).expect(400);
  });
});
