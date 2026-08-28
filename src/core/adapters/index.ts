import type { SiteAdapter } from '../../types/adapter';
import { mokaAdapter } from './moka';
import { beisenAdapter } from './beisen';
import { feishuAdapter } from './feishu';
import { dayeeAdapter } from './dayee';
import { nowcoderAdapter } from './nowcoder';
import { tencentAdapter } from './tencent';
import { alibabaAdapter } from './alibaba';
import { meituanAdapter } from './meituan';
import { workdayAdapter } from './workday';
import { greenhouseAdapter } from './greenhouse';
import { genericAdapter } from './generic';

/**
 * 完整适配器注册列表 (按优先级降序排序)
 */
export const ALL_ADAPTERS: SiteAdapter[] = [
  mokaAdapter,
  beisenAdapter,
  feishuAdapter,
  dayeeAdapter,
  nowcoderAdapter,
  tencentAdapter,
  alibabaAdapter,
  meituanAdapter,
  workdayAdapter,
  greenhouseAdapter,
  genericAdapter,
].sort((a, b) => b.priority - a.priority);

/**
 * 根据当前网页 URL 获取最佳匹配的 Adapter
 */
export function getAdapterForUrl(url: string = window.location.href): SiteAdapter {
  for (const adapter of ALL_ADAPTERS) {
    if (adapter.matches(url)) {
      return adapter;
    }
  }
  return genericAdapter;
}
