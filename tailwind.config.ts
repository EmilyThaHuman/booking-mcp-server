import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        booking: {
          blue: '#003b95',
          darkblue: '#002f7a',
        }
      }
    },
  },
  plugins: [],
} satisfies Config;

