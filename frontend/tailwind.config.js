/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
                    400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
                    800: '#166534', 900: '#14532d',
                },
                pitch: { grass: '#2d8a4e', line: '#ffffff', dark: '#1e6b3a' },
                surface: { DEFAULT: '#0A0A0F', card: '#111118', elevated: '#1A1A24', border: '#1E1E2A' },
                accent: { blue: '#3B82F6', amber: '#F59E0B' },
                muted: '#94A3B8',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
                'float': 'float 6s ease-in-out infinite',
                'shimmer': 'shimmer 2s linear infinite',
                'fade-in': 'fade-in 0.5s ease-out',
            },
            keyframes: {
                'glow-pulse': {
                    '0%, 100%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.15)' },
                    '50%': { boxShadow: '0 0 40px rgba(34, 197, 94, 0.3)' },
                },
                'float': {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                'shimmer': {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                'fade-in': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
}
