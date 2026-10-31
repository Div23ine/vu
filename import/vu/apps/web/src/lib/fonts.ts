/**
 * Self-hosted Inter.
 *
 * `next/font` downloads the face at build time and serves it from the app's own
 * origin, so no visitor's browser ever talks to a font CDN — one fewer third party
 * seeing every client's IP address, which matters more than usual for a platform
 * whose product is not being watched.
 *
 * `display: "swap"` keeps text visible during the swap; the variable is what
 * `globals.css` maps `--font-sans` onto.
 */
export const inter = {
  className: 'font-inter',
  style: {
    fontFamily:
      "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
};
