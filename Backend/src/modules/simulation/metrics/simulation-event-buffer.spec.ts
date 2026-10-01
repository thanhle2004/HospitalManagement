import { SimulationEventBuffer } from './simulation-event-buffer';

function fakeEvent(seq: number) {
  return { simTimeMs: seq, seq, type: 'X' };
}

describe('SimulationEventBuffer', () => {
  it('starts empty', () => {
    const buffer = new SimulationEventBuffer(10);
    expect(buffer.size).toBe(0);
    expect(buffer.shouldFlush()).toBe(false);
    expect(buffer.drain()).toEqual([]);
  });

  it('accumulates pushed events in order', () => {
    const buffer = new SimulationEventBuffer(10);
    buffer.push(fakeEvent(1));
    buffer.push(fakeEvent(2));
    expect(buffer.size).toBe(2);
    expect(buffer.drain().map((e) => e.seq)).toEqual([1, 2]);
  });

  it('reports shouldFlush once the threshold is reached, not before', () => {
    const buffer = new SimulationEventBuffer(3);
    buffer.push(fakeEvent(1));
    expect(buffer.shouldFlush()).toBe(false);
    buffer.push(fakeEvent(2));
    expect(buffer.shouldFlush()).toBe(false);
    buffer.push(fakeEvent(3));
    expect(buffer.shouldFlush()).toBe(true);
  });

  it('drain() empties the buffer', () => {
    const buffer = new SimulationEventBuffer(10);
    buffer.push(fakeEvent(1));
    buffer.drain();
    expect(buffer.size).toBe(0);
    expect(buffer.shouldFlush()).toBe(false);
  });

  it('restore() puts events back at the front, ahead of anything pushed since', () => {
    const buffer = new SimulationEventBuffer(10);
    buffer.push(fakeEvent(1));
    buffer.push(fakeEvent(2));
    const drained = buffer.drain();
    buffer.push(fakeEvent(3)); // đến trong lúc lô cũ đang "trên đường" ghi DB
    buffer.restore(drained);

    expect(buffer.drain().map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it('rejects a non-positive flushThreshold', () => {
    expect(() => new SimulationEventBuffer(0)).toThrow();
    expect(() => new SimulationEventBuffer(-1)).toThrow();
  });

  it('defaults to a threshold of 500 when none is given', () => {
    const buffer = new SimulationEventBuffer();
    for (let i = 0; i < 499; i++) buffer.push(fakeEvent(i));
    expect(buffer.shouldFlush()).toBe(false);
    buffer.push(fakeEvent(499));
    expect(buffer.shouldFlush()).toBe(true);
  });
});