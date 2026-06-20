/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        theme: '#0989FF',
        themeLight: '#E1F0FF',
        themeDark: '#056ECE',
        heading: '#010F1C',
        textBody: '#55585B',
        success: '#50CD89',
        danger: '#F1416C',
        gray: '#F2F2F6',
      },
    },
  },
  plugins: [],
};
