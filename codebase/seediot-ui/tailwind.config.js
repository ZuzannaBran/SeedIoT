/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'seediot-cream': '#F6F7F1',
        'seediot-cream-light': '#FCFCF8',
        'seediot-cream-muted': '#EEF2E3',
        'seediot-cream-deep': '#E2EAD0',
        'seediot-forest': '#2F4A24',
        'seediot-forest-dark': '#1F2E12',
        'seediot-lime': '#D7E7A7',
        'seediot-moss': '#5B6E45',
        'seediot-moss-soft': '#5D6C4E',
      },
      fontFamily: {
        sora: ['Sora_400Regular'],
        'sora-bold': ['Sora_700Bold'],
      },
    },
  },
  plugins: [],
};
