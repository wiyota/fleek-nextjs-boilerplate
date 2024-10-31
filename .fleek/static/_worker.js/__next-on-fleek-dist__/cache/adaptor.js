export const SUSPENSE_CACHE_URL = "INTERNAL_SUSPENSE_CACHE_HOSTNAME.local";
const NEXT_CACHE_IMPLICIT_TAG_ID = "_N_T_";
const revalidatedTags = /* @__PURE__ */ new Set();
export class CacheAdaptor {
  constructor(ctx = {}) {
    this.ctx = ctx;
  }
  tagsManifest;
  tagsManifestKey = "tags-manifest";
  tagsManifestPromise;
  async retrieve(key) {
    throw new Error(`Method not implemented - ${key}`);
  }
  async update(key, value, revalidate) {
    throw new Error(`Method not implemented - ${key}, ${value}, ${revalidate}`);
  }
  async set(key, value) {
    const newEntry = {
      lastModified: Date.now(),
      value
    };
    const updateOp = this.update(
      key,
      JSON.stringify(newEntry),
      value.revalidate
    );
    switch (newEntry.value?.kind) {
      case "FETCH": {
        const tags = getTagsFromEntry(newEntry);
        await this.setTags(tags, { cacheKey: key });
        const derivedTags = getDerivedTags(tags);
        const implicitTags = derivedTags.map(
          (tag) => `${NEXT_CACHE_IMPLICIT_TAG_ID}${tag}`
        );
        [...derivedTags, ...implicitTags].forEach(
          (tag) => revalidatedTags.delete(tag)
        );
      }
    }
    await updateOp;
  }
  async get(key, { softTags }) {
    const entryPromise = this.retrieve(key);
    const tagsManifestLoad = this.loadTagsManifest();
    const entry = await entryPromise;
    if (!entry)
      return null;
    let data;
    try {
      data = JSON.parse(entry);
    } catch (e) {
      return null;
    }
    switch (data.value?.kind) {
      case "FETCH": {
        await tagsManifestLoad;
        const tags = getTagsFromEntry(data);
        const combinedTags = softTags ? [...tags, ...softTags] : getDerivedTags(tags);
        const isStale = combinedTags.some((tag) => {
          if (revalidatedTags.has(tag))
            return true;
          const tagEntry = this.tagsManifest?.items?.[tag];
          return tagEntry?.revalidatedAt && tagEntry?.revalidatedAt >= (data.lastModified ?? Date.now());
        });
        return isStale ? null : data;
      }
      default: {
        return data;
      }
    }
  }
  async revalidateTag(tag) {
    await this.setTags([tag], { revalidatedAt: Date.now() });
    revalidatedTags.add(tag);
  }
  async loadTagsManifest(force = false) {
    const shouldLoad = force || !this.tagsManifest;
    if (!shouldLoad) {
      return;
    }
    if (!this.tagsManifestPromise) {
      this.tagsManifestPromise = this.loadTagsManifestInternal();
    }
    await this.tagsManifestPromise;
  }
  async loadTagsManifestInternal() {
    try {
      const rawManifest = await this.retrieve(this.tagsManifestKey);
      if (rawManifest) {
        this.tagsManifest = JSON.parse(rawManifest);
      }
    } catch (e) {
    }
    this.tagsManifest ??= { version: 1, items: {} };
    this.tagsManifestPromise = void 0;
  }
  async saveTagsManifest() {
    if (this.tagsManifest) {
      const newValue = JSON.stringify(this.tagsManifest);
      await this.update(this.tagsManifestKey, newValue);
    }
  }
  async setTags(tags, { cacheKey, revalidatedAt }) {
    await this.loadTagsManifest(true);
    const tagsManifest = this.tagsManifest;
    for (const tag of tags) {
      const data = tagsManifest.items[tag] ?? { keys: [] };
      if (cacheKey && !data.keys.includes(cacheKey)) {
        data.keys.push(cacheKey);
      }
      if (revalidatedAt) {
        data.revalidatedAt = revalidatedAt;
      }
      tagsManifest.items[tag] = data;
    }
    await this.saveTagsManifest();
  }
  buildCacheKey(key) {
    return `https://${SUSPENSE_CACHE_URL}/entry/${key}`;
  }
}
export function getDerivedTags(tags) {
  const derivedTags = ["/"];
  for (const tag of tags || []) {
    if (tag.startsWith("/")) {
      const pathnameParts = tag.split("/");
      for (let i = 1; i < pathnameParts.length + 1; i++) {
        const curPathname = pathnameParts.slice(0, i).join("/");
        if (curPathname) {
          derivedTags.push(curPathname);
          if (!derivedTags.includes(curPathname)) {
            derivedTags.push(curPathname);
          }
        }
      }
    } else if (!derivedTags.includes(tag)) {
      derivedTags.push(tag);
    }
  }
  return derivedTags;
}
export function getTagsFromEntry(entry) {
  return entry.value?.tags ?? entry.value?.data?.tags ?? [];
}
