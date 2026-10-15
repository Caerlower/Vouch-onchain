/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VOUCH_API: string;
  readonly VITE_DEMO_SELLER_URL: string;
  readonly VITE_CLUSTER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
