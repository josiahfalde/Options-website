/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Slate-forward dark canvas
        ink: {
          950: "#080b12",
          900: "#0b1018",
          850: "#0f1623",
          800: "#141c2b",
          750: "#1a2436",
          700: "#222e44",
          600: "#2d3b56",
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
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 10px 30px -12px rgba(0,0,0,0.6)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
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
