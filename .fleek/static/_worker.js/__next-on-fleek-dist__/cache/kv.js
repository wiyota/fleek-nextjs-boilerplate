import { CacheAdaptor } from "./adaptor.js";
export default class KVAdaptor extends CacheAdaptor {
  constructor(ctx = {}) {
    super(ctx);
  }
  async retrieve(key) {
    const value = await process.env.__NEXT_ON_PAGES__KV_SUSPENSE_CACHE?.get(
      this.buildCacheKey(key)
    );
    return value ?? null;
  }
  async update(key, value, revalidate) {
    const expiry = revalidate ? {
      expirationTtl: revalidate
    } : {};
    await process.env.__NEXT_ON_PAGES__KV_SUSPENSE_CACHE?.put(
      this.buildCacheKey(key),
      value,
      expiry
    );
  }
}
