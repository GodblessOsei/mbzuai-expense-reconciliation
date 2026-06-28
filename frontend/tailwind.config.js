/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        mbzuai: {
          navy: "#1B3A6B",
          gold: "#E4C988",
          sand: "#ece0e0",
        },
      },
    },
    fontFamily: {
      sans: ["Inter", "system-ui", "sans-serif"],
    },
  },
  plugins: [],
};
