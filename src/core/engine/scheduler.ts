/**
 * 60fps 非阻塞 DOM 批量读写与时间切片调度引擎
 * 遵循现代浏览器高性能渲染规范：集中读、集中写、消除 Layout Thrashing
 */

export class DomScheduler {
  private static readQueue: (() => void)[] = [];
  private static writeQueue: (() => void)[] = [];
  private static isScheduled = false;

  /**
   * 注册只读操作 (读取 computedStyle, clientRect 等)
   */
  static scheduleRead(task: () => void): void {
    this.readQueue.push(task);
    this.requestFlush();
  }

  /**
   * 注册写入操作 (修改 value, 派发 Synthetic Event, 修改 DOM 等)
   */
  static scheduleWrite(task: () => void): void {
    this.writeQueue.push(task);
    this.requestFlush();
  }

  private static requestFlush(): void {
    if (this.isScheduled) return;
    this.isScheduled = true;

    requestAnimationFrame(() => {
      // 1. 优先集中执行所有读操作 (不触发回流)
      const reads = [...this.readQueue];
      this.readQueue = [];
      for (const r of reads) {
        try { r(); } catch (e) { console.error('[DomScheduler Read Error]', e); }
      }

      // 2. 随后集中执行所有写操作
      const writes = [...this.writeQueue];
      this.writeQueue = [];
      for (const w of writes) {
        try { w(); } catch (e) { console.error('[DomScheduler Write Error]', e); }
      }

      this.isScheduled = false;
      if (this.readQueue.length > 0 || this.writeQueue.length > 0) {
        this.requestFlush();
      }
    });
  }

  /**
   * 时间切片分批执行器 (将 N 个表单项的填充分散到空闲帧，保证极端百项大表单下 60fps 不卡顿)
   */
  static async runChunked<T>(
    items: T[],
    processor: (item: T, index: number) => Promise<void> | void,
    chunkSize = 6
  ): Promise<void> {
    if (items.length === 0) return;

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map((item, offset) => processor(item, i + offset)));

      // 让出主线程 4ms，供浏览器执行 Layout, Paint 与用户输入响应
      if (i + chunkSize < items.length) {
        await new Promise(resolve => {
          if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(resolve, { timeout: 16 });
          } else {
            setTimeout(resolve, 4);
          }
        });
      }
    }
  }
}
