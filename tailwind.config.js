/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F5F9FF",
        paperLine: "#D7E3F3",
        ink: "#172B4D",
        inkSoft: "#53657A",
        teal: {
          DEFAULT: "#2563EB",
          dark: "#1D4ED8",
          light: "#EFF6FF",
        },
        amber: {
          DEFAULT: "#854D0E",
          light: "#FEF3C7",
        },
        rust: {
          DEFAULT: "#B91C1C",
          light: "#FEF2F2",
        },
        sky: {
          500: "#0EA5E9",
          50: "#F0F9FF",
        },
      },
      fontFamily: {
        slab: ["'Noto Sans Thai'", "system-ui", "sans-serif"],
        sans: ["'Noto Sans Thai'", "system-ui", "sans-serif"],
        mono: ["'Noto Sans Thai'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        lg: "0.875rem",
        xl: "1rem",
      },
    },
  },
  plugins: [],
};
