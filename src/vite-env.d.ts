/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Leave both unset to keep data in this browser only. */
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
