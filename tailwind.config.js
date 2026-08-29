/** @type {import('tailwindcss').Config} */

// Helper: a color backed by a CSS variable holding "R G B" channels, so the
// same Tailwind utility (e.g. bg-ink-850, text-slate-400, border-white/10)
// resolves to a theme-aware value and still honours the /alpha modifier.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral "ink" surfaces + "slate" text + the overlay "white" are all
        // driven by CSS variables defined per-theme in index.css, so the
        // existing dark-mode classes keep their exact values and automatically
        // flip in light mode without per-component rewrites.
        white: v("--c-white"),
        ink: {
          950: v("--c-ink-950"),
          900: v("--c-ink-900"),
          850: v("--c-ink-850"),
          800: v("--c-ink-800"),
          750: v("--c-ink-750"),
          700: v("--c-ink-700"),
          600: v("--c-ink-600"),
        },
        slate: {
          50: v("--c-slate-50"),
          100: v("--c-slate-100"),
          200: v("--c-slate-200"),
          300: v("--c-slate-300"),
          400: v("--c-slate-400"),
          500: v("--c-slate-500"),
          600: v("--c-slate-600"),
        },
        // Premium = green; the Wheel keeps turning
        flux: {
          50: "#ecfdf5",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        // Capital deployed / torque = amber
        torque: {
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
        },
        loss: {
          400: "#fb7185",
          500: "#f43f5e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(16,185,129,0.15), 0 8px 30px -8px rgba(16,185,129,0.25)",
        card: "var(--shadow-card)",
      },
      keyframes: {
        "fade-up": {
          "0%": { transform: "translateY(8px)" },
          "100%": { transform: "translateY(0)" },
        },
        spinslow: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        spinslow: "spinslow 14s linear infinite",
      },
    },
  },
  plugins: [],
};
