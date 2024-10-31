import { CacheAdaptor } from "./adaptor.js";
export default class CacheApiAdaptor extends CacheAdaptor {
  cacheName = "suspense-cache";
  constructor(ctx = {}) {
    super(ctx);
  }
  async retrieve(key) {
    const cache = await caches.open(this.cacheName);
    const response = await cache.match(this.buildCacheKey(key));
    return response ? response.text() : null;
  }
  async update(key, value, revalidate) {
    const cache = await caches.open(this.cacheName);
    const maxAge = revalidate ?? "31536000";
    const response = new Response(value, {
      headers: new Headers({
        "cache-control": `max-age=${maxAge}`
      })
    });
    await cache.put(this.buildCacheKey(key), response);
  }
}
