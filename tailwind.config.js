/** StockWise Tailwind config. Colors come from the CSS variables so dark/light mode keeps working. */
module.exports = {
  content: ["./*.html", "./*.js"],
  corePlugins: { preflight: false, container: false }, // the base reset lives in src/input.css, so nothing changes on pages
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        ink: "var(--text)",
        muted: "var(--muted)",
        line: "var(--border)",
        accent: "var(--accent)",
        up: "var(--green)",
        down: "var(--red)",
      },
      fontFamily: { sans: ['"Segoe UI"', "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
