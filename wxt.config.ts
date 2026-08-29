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
    permissions: ['storage', 'activeTab'],
    // AI 兜底所需的网络访问：localhost 供本地 Ollama，https 供用户自带 Key 的云端接口
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
