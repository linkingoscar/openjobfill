/**
 * 平台差异统一从这个入口暴露。旧版 SiteAdapter/customFill 已退出运行时，
 * 避免“注册表显示已适配、实际填写却走另一套 Pipeline”的双系统漂移。
 */
export {
  ALL_PLATFORM_ENHANCERS,
  getEnhancerMatchTrace,
  getEnhancerForUrl,
} from './enhancers';

export {
  CONTROL_ADAPTER_IDS,
  getControlAdapterCatalog,
  getControlAdapterMatchTrace,
  getMatchingControlAdapters,
} from './controlAdapters';

export {
  SITE_PROFILES,
  createProfileEnhancer,
  getSiteProfileForUrl,
  getSiteProfileMatchTrace,
  validateSiteProfile,
} from './siteProfiles';

export {
  COMPATIBILITY_FIXTURES,
  auditCompatibilityCatalog,
} from './compatibilityLab';
