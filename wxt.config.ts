import { defineConfig } from 'wxt';

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
    // 静态探测器覆盖所有页面，确认招聘页后由 scripting 按需注入重型运行时；
    // 因此这里保留 https 主机权限以支持未知招聘站点和用户自带 AI 接口，默认不会上传简历内容。
    host_permissions: ['http://localhost/*', 'https://*/*'],
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
