/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        berkeleyBlue: "#003262",
        berkeleyGold: "#FDB515"
      }
    }
  },
  plugins: []
};
