import { defineConfig } from 'wxt';
import { BUILTIN_RECRUITMENT_MATCHES } from './src/core/recruitmentPermissions';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'OpenJobFill - 简历自动填写助手',
    description: '智能求职网申简历自动填写助手，一键秒填主流招聘网站（Moka、北森、飞书招聘等）',
    version: '1.0.0',
    icons: {
      '16': 'icon-16.png',
      '32': 'icon-32.png',
      '48': 'icon-48.png',
      '128': 'icon-128.png',
    },
    permissions: ['storage', 'activeTab', 'webNavigation', 'scripting'],
    // Built-in recruitment/ATS origins can run the lightweight detector automatically.
    // Unknown sites and custom AI endpoints are requested only after an explicit user gesture.
    host_permissions: BUILTIN_RECRUITMENT_MATCHES,
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: {
      default_icon: {
        '16': 'icon-16.png',
        '32': 'icon-32.png',
        '48': 'icon-48.png',
        '128': 'icon-128.png',
      },
    },
    commands: {
      trigger_autofill: {
        suggested_key: {
          default: 'Alt+Shift+F',
          mac: 'Alt+Shift+F',
        },
        description: '一键自动填写当前网页网申表单',
      },
    },
  },
});
