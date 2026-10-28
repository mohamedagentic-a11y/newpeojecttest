/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional base URL for the backend API (defaults to same-origin '/api/v1' when unset). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}