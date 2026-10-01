import { MetricsCollector, RecordableEvent } from './metrics-collector';

function ev(simTimeMs: number, type: string, extra: Partial<RecordableEvent> = {}): RecordableEvent {
  return { simTimeMs, type, ...extra };
}

describe('MetricsCollector', () => {
  it('starts with an all-zero snapshot', () => {
    const collector = new MetricsCollector();
    const snap = collector.snapshot();
    expect(snap.counters).toEqual({
      patientsArrived: 0,
      visitsCreated: 0,
      visitsCompleted: 0,
      noShows: 0,
      stepsWaiting: 0,
      stepsInService: 0,
    });
    expect(snap.waitingTimeMs).toEqual({ count: 0, mean: 0, median: 0, p95: 0, max: 0 });
    expect(snap.throughputPerSimHour).toBe(0);
    expect(snap.perRoom).toEqual({});
  });

  it('counts simple event types', () => {
    const collector = new MetricsCollector();
    collector.recordEvent(ev(0, 'PATIENT_ARRIVED'));
    collector.recordEvent(ev(0, 'PATIENT_ARRIVED'));
    collector.recordEvent(ev(1, 'VISIT_CREATED', { visitId: 'v1' }));
    collector.recordEvent(ev(2, 'PATIENT_NO_SHOW'));

    const snap = collector.snapshot();
    expect(snap.counters.patientsArrived).toBe(2);
    expect(snap.counters.visitsCreated).toBe(1);
    expect(snap.counters.noShows).toBe(1);
  });

  it('ignores unknown/internal event types without throwing', () => {
    const collector = new MetricsCollector();
    expect(() => collector.recordEvent(ev(0, 'DOCTOR_POLL'))).not.toThrow();
    expect(() => collector.recordEvent(ev(0, 'CONTINUE_VISIT'))).not.toThrow();
    expect(() => collector.recordEvent(ev(0, 'SOMETHING_NOBODY_HEARD_OF'))).not.toThrow();
  });

  describe('waiting time (QR_SCANNED -> SERVICE_STARTED)', () => {
    it('computes waiting time per step by matching visitStepId', () => {
      const collector = new MetricsCollector();
      collector.recordEvent(ev(1_000, 'QR_SCANNED', { visitStepId: 10, roomId: 4 }));
      collector.recordEvent(ev(1_500, 'SERVICE_STARTED', { visitStepId: 10, roomId: 4 }));

      const snap = collector.snapshot();
      expect(snap.waitingTimeMs).toMatchObject({ count: 1, mean: 500, median: 500, max: 500 });
      expect(snap.perRoom[4].waitingTimeMs).toMatchObject({ count: 1, mean: 500 });
    });

    it('does not record a waiting sample for SERVICE_STARTED with no matching QR_SCANNED', () => {
      const collector = new MetricsCollector();
      collector.recordEvent(ev(1_500, 'SERVICE_STARTED', { visitStepId: 999, roomId: 4 }));
      expect(collector.snapshot().waitingTimeMs.count).toBe(0);
    });

    it('keeps steps from different rooms in separate waiting-time buckets', () => {
      const collector = new MetricsCollector();
      collector.recordEvent(ev(0, 'QR_SCANNED', { visitStepId: 1, roomId: 10 }));
      collector.recordEvent(ev(100, 'SERVICE_STARTED', { visitStepId: 1, roomId: 10 }));
      collector.recordEvent(ev(0, 'QR_SCANNED', { visitStepId: 2, roomId: 20 }));
      collector.recordEvent(ev(900, 'SERVICE_STARTED', { visitStepId: 2, roomId: 20 }));

      const snap = collector.snapshot();
      expect(snap.perRoom[10].waitingTimeMs.mean).toBe(100);
      expect(snap.perRoom[20].waitingTimeMs.mean).toBe(900);
      expect(snap.waitingTimeMs.mean).toBe(500); // (100+900)/2
    });
  });

  describe('service time (SERVICE_STARTED -> SERVICE_END)', () => {
    it('computes service time and accumulates room utilisation/patientsServed', () => {
      const collector = new MetricsCollector();
      collector.recordEvent(ev(0, 'QR_SCANNED', { visitStepId: 1, roomId: 4 }));
      collector.recordEvent(ev(0, 'SERVICE_STARTED', { visitStepId: 1, roomId: 4 }));
      collector.recordEvent(ev(1_000, 'SERVICE_END', { visitStepId: 1, roomId: 4 }));

      const snap = collector.snapshot();
      expect(snap.serviceTimeMs).toMatchObject({ count: 1, mean: 1_000 });
      expect(snap.perRoom[4].serviceTimeMs).toMatchObject({ count: 1, mean: 1_000 });
      expect(snap.perRoom[4].patientsServed).toBe(1);
      // elapsed = lastSimTimeMs(1000) - firstSimTimeMs(0) = 1000; busyMs = 1000 -> 100%
      expect(snap.perRoom[4].utilisationPct).toBe(100);
    });

    it('computes a room utilisation below 100% when the room was also idle', () => {
      const collector = new MetricsCollector();
      collector.recordEvent(ev(0, 'QR_SCANNED', { visitStepId: 1, roomId: 4 }));
      collector.recordEvent(ev(0, 'SERVICE_STARTED', { visitStepId: 1, roomId: 4 }));
      collector.recordEvent(ev(200, 'SERVICE_END', { visitStepId: 1, roomId: 4 })); // bận 200/1000ms
      collector.recordEvent(ev(1_000, 'VISIT_COMPLETED')); // đẩy lastSimTimeMs lên 1000 để elapsed=1000

      expect(collector.snapshot().perRoom[4].utilisationPct).toBe(20);
    });
  });

  describe('length of stay (VISIT_CREATED -> VISIT_COMPLETED)', () => {
    it('computes length of stay by matching visitId', () => {
      const collector = new MetricsCollector();
      collector.recordEvent(ev(0, 'VISIT_CREATED', { visitId: 'v1' }));
      collector.recordEvent(ev(5_000, 'VISIT_COMPLETED', { visitId: 'v1' }));

      expect(collector.snapshot().lengthOfStayMs).toMatchObject({ count: 1, mean: 5_000 });
    });

    it('keeps 2 concurrent visits length-of-stay separate by visitId', () => {
      const collector = new MetricsCollector();
      collector.recordEvent(ev(0, 'VISIT_CREATED', { visitId: 'v1' }));
      collector.recordEvent(ev(0, 'VISIT_CREATED', { visitId: 'v2' }));
      collector.recordEvent(ev(1_000, 'VISIT_COMPLETED', { visitId: 'v1' }));
      collector.recordEvent(ev(9_000, 'VISIT_COMPLETED', { visitId: 'v2' }));

      const snap = collector.snapshot();
      expect(snap.lengthOfStayMs.mean).toBe(5_000); // (1000+9000)/2
      expect(snap.counters.visitsCompleted).toBe(2);
    });
  });

  describe('stepsWaiting / stepsInService gauges', () => {
    it('reflects steps queued but not yet started, and started but not yet finished', () => {
      const collector = new MetricsCollector();
      collector.recordEvent(ev(0, 'QR_SCANNED', { visitStepId: 1, roomId: 4 }));
      collector.recordEvent(ev(0, 'QR_SCANNED', { visitStepId: 2, roomId: 4 }));
      expect(collector.snapshot().counters).toMatchObject({ stepsWaiting: 2, stepsInService: 0 });

      collector.recordEvent(ev(100, 'SERVICE_STARTED', { visitStepId: 1, roomId: 4 }));
      expect(collector.snapshot().counters).toMatchObject({ stepsWaiting: 1, stepsInService: 1 });

      collector.recordEvent(ev(200, 'SERVICE_END', { visitStepId: 1, roomId: 4 }));
      expect(collector.snapshot().counters).toMatchObject({ stepsWaiting: 1, stepsInService: 0 });
    });
  });

  describe('throughputPerSimHour', () => {
    it('computes completed visits per simulated hour over the elapsed window', () => {
      const collector = new MetricsCollector();
      collector.recordEvent(ev(0, 'VISIT_CREATED', { visitId: 'v1' }));
      // 5 visit hoàn tất (kể cả cái tại t=0) trải trong 1_800_000ms (0.5 giờ mô phỏng) -> 10/giờ
      for (let i = 0; i < 4; i++) {
        collector.recordEvent(ev(i * 450_000, 'VISIT_COMPLETED', { visitId: `v${i}` }));
      }
      collector.recordEvent(ev(1_800_000, 'VISIT_COMPLETED', { visitId: 'v-last' }));

      expect(collector.snapshot().throughputPerSimHour).toBeCloseTo(5 / 0.5, 5); // 5 completed / 0.5h = 10/h
    });

    it('is 0 when no time has elapsed yet (only 1 event recorded)', () => {
      const collector = new MetricsCollector();
      collector.recordEvent(ev(0, 'VISIT_COMPLETED', { visitId: 'v1' }));
      expect(collector.snapshot().throughputPerSimHour).toBe(0);
    });
  });

  describe('quantile summary shape', () => {
    it('computes mean/median/p95/max correctly over a known sample set', () => {
      const collector = new MetricsCollector();
      const samples = [10, 20, 30, 40, 100]; // mean=40, median=30, max=100
      samples.forEach((ms, i) => {
        collector.recordEvent(ev(0, 'QR_SCANNED', { visitStepId: i, roomId: 1 }));
        collector.recordEvent(ev(ms, 'SERVICE_STARTED', { visitStepId: i, roomId: 1 }));
      });

      const summary = collector.snapshot().waitingTimeMs;
      expect(summary.count).toBe(5);
      expect(summary.mean).toBe(40);
      expect(summary.median).toBe(30);
      expect(summary.max).toBe(100);
    });
  });

  it('recordEvent order matters, not call order — feeding events out of simTimeMs order is a caller error, not validated here', () => {
    // Ghi chú: MetricsCollector không tự sắp xếp lại — nó tin tưởng
    // SimulationEngine.onEveryEvent() luôn gọi đúng thứ tự simTimeMs (đúng
    // như engine Phase 1 đảm bảo). Test này chỉ xác nhận collector không
    // crash nếu giả định đó bị vi phạm, không xác nhận kết quả "đúng".
    const collector = new MetricsCollector();
    expect(() => {
      collector.recordEvent(ev(1_000, 'SERVICE_STARTED', { visitStepId: 1 }));
      collector.recordEvent(ev(500, 'QR_SCANNED', { visitStepId: 1 }));
    }).not.toThrow();
  });
});