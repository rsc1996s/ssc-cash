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
        surface: "#FFFFFF",
        focus: "#2563EB",
      },
      fontFamily: {
        sans: ["'Noto Sans Thai'", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.25rem" }],
        sm: ["0.9375rem", { lineHeight: "1.375rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
      },
      spacing: {
        "touch": "2.75rem",
      },
      borderRadius: {
        DEFAULT: "0.75rem",
        lg: "0.875rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 3px rgb(23 43 77 / 8%)",
        popover: "0 12px 32px rgb(23 43 77 / 16%)",
      },
    },
  },
  plugins: [],
};
