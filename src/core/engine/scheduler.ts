/**
 * 时间切片非阻塞表单填充调度器
 *
 * 把 N 个表单项的填充分散到多个空闲帧执行，避免单次长任务阻塞主线程，
 * 使页面在填充过程中仍能响应用户滚动与输入。
 *
 * 说明：此处只做时间切片，不做读写分离。
 * 填充操作本身需要「读元素状态 → 写 value → 派发事件」原子完成，
 * 强行拆分读写反而会因为元素在两次帧之间发生变化而引入错填风险。
 */

/**
 * 让出主线程，供浏览器执行 Layout、Paint 与用户输入响应
 */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: 16 });
    } else {
      setTimeout(resolve, 4);
    }
  });
}

export class DomScheduler {
  /**
   * 时间切片分批执行器
   *
   * 每批并发执行 chunkSize 个任务，批次之间让出主线程。
   * 并发而非串行是为了让同批次内的多个 DOM 写入合并到一次Layout，
   * 批次大小控制在 6 是为了保证单批耗时不超过一帧预算。
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

      // 最后一批之后无需再让出主线程
      if (i + chunkSize < items.length) {
        await yieldToBrowser();
      }
    }
  }
}
