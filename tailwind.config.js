/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",
        paperLine: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        inkSoft: "rgb(var(--ink-soft) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          dark: "rgb(var(--primary-dark) / <alpha-value>)",
          light: "rgb(var(--primary-light) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--warning) / <alpha-value>)",
          light: "rgb(var(--warning-light) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--danger) / <alpha-value>)",
          light: "rgb(var(--danger-light) / <alpha-value>)",
        },
        income: "rgb(var(--income) / <alpha-value>)",
        expense: "rgb(var(--expense) / <alpha-value>)",
        glass: "rgb(var(--glass) / <alpha-value>)",
        glow: "rgb(var(--glow) / <alpha-value>)",
        sky: {
          500: "#0EA5E9",
          50: "#F0F9FF",
        },
        surface: "rgb(var(--surface) / <alpha-value>)",
        focus: "rgb(var(--primary) / <alpha-value>)",
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
        DEFAULT: "var(--radius-control)",
        lg: "var(--radius-control)",
        xl: "var(--radius-card)",
        "2xl": "var(--radius-card)",
        card: "var(--radius-card)",
        hero: "2rem",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        popover: "var(--shadow-overlay)",
        glass: "0 12px 40px rgb(23 43 77 / 10%)",
        glow: "0 8px 32px rgb(37 99 235 / 25%)",
      },
    },
  },
  plugins: [],
};
