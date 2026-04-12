export type Cache = {
  getJson: <T>(key: string) => Promise<T | null>
  setJson: (key: string, value: unknown, ttlSeconds: number) => Promise<void>
}

export const nullCache: Cache = {
  getJson () {
    return Promise.resolve(null)
  },
  setJson () {
    return Promise.resolve()
  }
}
