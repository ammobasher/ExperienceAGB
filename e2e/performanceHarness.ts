import type { Page } from '@playwright/test';

export async function observePerformance(page: Page) {
  await page.addInitScript(() => {
    const tasks: Array<{ startTime: number; duration: number }> = [];
    const transfers: Array<{ kind: string; at: number; entries?: number }> = [];
    const observer = new PerformanceObserver(list => {
      tasks.push(...list.getEntries().map(({ startTime, duration }) => ({ startTime, duration })));
    });
    observer.observe({ type: 'longtask', buffered: true });
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener('message', ({ data }) => {
          transfers.push({ kind: data.kind, at: performance.now(), entries: data.entries?.length });
        });
      }
    };
    Object.assign(window, {
      performanceEvidence: { tasks, transfers },
      flushPerformanceEvidence: () => {
        tasks.push(...observer.takeRecords().map(({ startTime, duration }) => ({ startTime, duration })));
      },
    });
  });
}

export async function settlePerformance(page: Page) {
  await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 0));
    Reflect.get(window, 'flushPerformanceEvidence')();
  });
}

export async function readPerformance(page: Page) {
  return page.evaluate(() => Reflect.get(window, 'performanceEvidence') as {
    tasks: Array<{ startTime: number; duration: number }>;
    transfers: Array<{ kind: string; at: number; entries?: number }>;
  });
}
