/// <reference types="vite/client" />

declare module '*.css';

interface ImportMetaEnv {
  readonly [key: string]: string | undefined;
  readonly VITE_DISTRIBUTION_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
