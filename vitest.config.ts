import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['test/**/*.{test,spec}.ts'],
    // 显式使用线程池而非默认的 forks 子进程池。
    // forks 池在 Windows 下 teardown 不干净：全部测试通过后，
    // worker 子进程不会自行退出，导致 `pnpm test` 永久挂起（只能靠超时杀掉）。
    // 切到 threads 池后测试可以正常退出。
    pool: 'threads',
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/core/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
