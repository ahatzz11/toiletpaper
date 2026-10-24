// Site-wide settings for the build.

export const ORIGIN = "https://toiletpaper.app";
export const SITE_NAME = "Toilet Paper Math";

// Date the content last changed, for sitemap.xml <lastmod>. Bump it when a page changes.
// It's a constant instead of the build time so the same source always builds the same Worker.
export const UPDATED = "2026-10-24";

// IndexNow key. Public by design: search engines fetch it from /<key>.txt to confirm we own the
// site. It is not a secret.
export const INDEXNOW_KEY = "dd43f08bc0fcb2908ae3772672fc474d";

export const SHARE = {
  image: "/media/share.png",
  imageAlt: "A smiling toilet paper roll unspooling next to the words Toilet Paper Math: Which pack is actually the better deal?",
  video: "/media/share.mp4",
  width: 1200,
  height: 630,
};
