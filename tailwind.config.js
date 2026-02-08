/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        admin: {
          bg: '#0B1220',
          panel: '#121B2E',
          line: '#1E2A44',
          accent: '#F5B700',
          text: '#EAF0FF',
          muted: '#9FB0D0',
          danger: '#E15858',
          success: '#27AE60'
        }
      }
    },
  },
  plugins: [],
};
