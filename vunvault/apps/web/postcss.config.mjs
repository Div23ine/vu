/**
 * Tailwind v4 runs as a PostCSS plugin. There is no `tailwind.config.js`: the
 * theme lives in CSS (`@theme` inside `@vunvault/ui/styles.css`), which is the v4
 * model and the reason a design token cannot drift from its utility class.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
