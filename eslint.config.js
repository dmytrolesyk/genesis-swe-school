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
  ...typedStrictConfigs,
  {
    files: ['static/scripts/**/*.js'],
    languageOptions: {
      globals: {
        alert: 'readonly',
        confirm: 'readonly',
        console: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        requestAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        window: 'readonly'
      }
    }
  }
]
