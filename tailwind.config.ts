import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        build: ['ES-Build-Medium', 'sans-serif'],
        minion: ['Minion-Pro', 'Georgia', 'serif'],
      },
      colors: {
        via: {
          black: '#1A1A1A',
          gray: '#999999',
          'light-gray': '#CCCCCC',
          'postit': '#F5F0C8',
        },
      },
    },
  },
  plugins: [],
}

export default config
