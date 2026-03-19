/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          green: '#25D366',
          teal: '#128C7E',
          dark: '#075E54',
          light: '#DCF8C6',
        },
      },
    },
  },
  plugins: [],
};
