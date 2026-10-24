/**
 * The www rule for toiletpaper.app: www.toiletpaper.app/any/path?q=1 gets a 301 to
 * https://toiletpaper.app/any/path?q=1.
 *
 * scripts/build-inline.mjs copies APEX and redirectTarget into dist-inline/index.js, which is
 * the Worker that is actually deployed.
 */
export const APEX = "toiletpaper.app";

/** Where a request should be redirected, or null when it should be served as is. */
export function redirectTarget(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  if (url.hostname !== `www.${APEX}`) return null;
  return `https://${APEX}${url.pathname}${url.search}`;
}
