/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './components/**/*.{ts,tsx,vue}',
    './app/**/*.{ts,tsx,vue}',
    './src/**/*.{ts,tsx,vue}',
	'./index.html',
	'./src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {},
  plugins: [require("tailwindcss-animate")],
}
