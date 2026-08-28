/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#ECEDE7",
        paperLine: "#D8D6CC",
        ink: "#1B2A38",
        inkSoft: "#4A5A68",
        teal: {
          DEFAULT: "#1F6F5C",
          dark: "#154D40",
          light: "#E4F0EC",
        },
        amber: {
          DEFAULT: "#C8891C",
          light: "#FBF0DC",
        },
        rust: {
          DEFAULT: "#A83232",
          light: "#F7E4E2",
        },
      },
      fontFamily: {
        slab: ["'Roboto Slab'", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
