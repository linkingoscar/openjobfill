/// <reference types="vite/client" />
/// <reference types="wxt/client" />

declare module '*.css?inline' {
  const content: string;
  export default content;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
