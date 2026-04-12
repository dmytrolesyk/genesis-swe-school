declare module 'ejs' {
  export type EjsData = Record<string, unknown>
  export type EjsOptions = Record<string, unknown>

  export type EjsRenderCallback = (
    error: Error | null,
    rendered: string
  ) => void

  export type EjsCompiledTemplate = (data?: EjsData) => string

  export function compile (
    template: string,
    options?: EjsOptions
  ): EjsCompiledTemplate

  export function renderFile (
    filename: string,
    data: EjsData,
    options: EjsOptions,
    callback: EjsRenderCallback
  ): void

  export function renderFile (
    filename: string,
    data: EjsData,
    callback: EjsRenderCallback
  ): void

  export function renderFile (
    filename: string,
    callback: EjsRenderCallback
  ): void

  const ejs: {
    compile: typeof compile
    renderFile: typeof renderFile
  }

  export default ejs
}
