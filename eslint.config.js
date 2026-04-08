import neostandard from 'neostandard'
import tseslint from 'typescript-eslint'

const typedStrictConfigs = tseslint.configs.strictTypeCheckedOnly.map((config) => ({
  ...config,
  files: ['**/*.ts'],
  languageOptions: {
    ...config.languageOptions,
    parserOptions: {
      ...config.languageOptions?.parserOptions,
      projectService: true,
      tsconfigRootDir: import.meta.dirname
    }
  }
}))

export default [
  ...neostandard({
    ts: true
  }),
  ...typedStrictConfigs
]
