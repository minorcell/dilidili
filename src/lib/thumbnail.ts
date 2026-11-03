/**
 * 让 B 站图片 CDN 直接返回缩略图。
 *
 * 列表里原本加载的是原图（常见 1920×1080），200 条历史记录会带来很高的
 * 解码内存和滚动开销。hdslb 的图片支持 `@宽w_高h_1c.webp` 形式的缩放参数。
 */
export function thumbnailSrc(
  url: string | undefined,
  width = 112,
  height = 63,
): string | undefined {
  if (!url) return undefined;

  // 非 B 站 CDN 或已经带过处理参数的地址保持原样
  if (!/^https?:\/\/([^/]+\.)?hdslb\.com\//i.test(url) || url.includes('@')) {
    return url;
  }

  const [base, query] = url.split('?');
  const suffix = `@${width}w_${height}h_1c.webp`;
  return query ? `${base}${suffix}?${query}` : `${base}${suffix}`;
}
