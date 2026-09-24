import { BackgroundWork } from './background-work.service';

describe('BackgroundWork', () => {
  it('returns at once and finishes the task later', async () => {
    const work = new BackgroundWork();
    let done = false;
    work.run('slow', async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      done = true;
    });
    expect(done).toBe(false);
    expect(work.size).toBe(1);
    await work.drain();
    expect(done).toBe(true);
    expect(work.size).toBe(0);
  });

  it('swallows a failing task instead of throwing', async () => {
    const work = new BackgroundWork();
    work.run('broken', () => Promise.reject(new Error('SMTP down')));
    work.run('sync throw', () => {
      throw new Error('render failed');
    });
    await expect(work.drain()).resolves.toBeUndefined();
    expect(work.size).toBe(0);
  });

  it('stops waiting at the timeout on shutdown', async () => {
    const work = new BackgroundWork();
    work.run('stuck', () => new Promise(() => undefined));
    const started = Date.now();
    await work.drain(30);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
