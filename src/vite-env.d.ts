interface ImportMetaEnv {
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.mp4?url' {
  const src: string;
  export default src;
}
declare module '*.mp4' {
  const src: string;
  export default src;
}
