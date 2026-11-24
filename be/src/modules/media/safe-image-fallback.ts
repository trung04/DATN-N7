function safeAppImageUrl(value: string): string | undefined {
  if (
    !/^\/images\/[A-Za-z0-9._/-]+$/.test(value) ||
    value.includes('\\') ||
    value.includes('//')
  )
    return undefined;
  const segments = value.split('/');
  if (segments.some((segment) => segment === '.' || segment === '..'))
    return undefined;
  return value;
}

/** Only app-owned paths and reviewed image CDNs may be used as fallbacks. */
export function safeImageFallbackUrl(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const appImage = safeAppImageUrl(value);
  if (appImage) return appImage;

  try {
    const url = new URL(value);
    if (
      url.origin === 'https://upload.wikimedia.org' &&
      !url.username &&
      !url.password &&
      !url.hash &&
      url.pathname.startsWith('/wikipedia/commons/') &&
      !url.search
    )
      return url.toString();
    if (
      url.origin !== 'https://images.unsplash.com' ||
      url.username ||
      url.password ||
      url.hash ||
      !/^\/photo-[A-Za-z0-9-]+$/.test(url.pathname) ||
      [...url.searchParams.keys()].some(
        (key) => !['auto', 'fit', 'w', 'q'].includes(key),
      )
    )
      return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}
