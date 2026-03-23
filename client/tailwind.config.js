/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        pool: {
          base:          '#0d1f15',
          surface:       '#1a3a2a',
          elevated:      '#0f2318',
          rim:           '#2d5a3d',
          primary:       '#f0fdf4',
          secondary:     '#86efac',
          muted:         '#6ee7b7',
          faint:         '#4b7a5e',
          gold:          '#d4af37',
          under:         '#4ade80',
          over:          '#f87171',
          even:          '#9ca3af',
          counting:      '#166534',
          'counting-fg': '#bbf7d0',
          'err-bg':      '#2d1515',
          'err-fg':      '#fca5a5',
        },
      },
    },
  },
  plugins: [],
};
