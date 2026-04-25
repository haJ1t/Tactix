/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f3faf5', 100: '#e2f3e7', 200: '#c7e6d1', 300: '#9dccad',
                    400: '#6baf7a', 500: '#4f8f65', 600: '#31774e', 700: '#275f40',
                    800: '#214d35', 900: '#1b3f2d',
                },
                pitch: { grass: '#5e9f72', line: '#f7fff8', dark: '#31774e' },
                surface: { DEFAULT: '#f7f8f4', card: '#ffffff', elevated: '#fffdf8', border: '#dce4dc' },
                accent: { blue: '#426f8f', amber: '#b88735' },
                muted: '#64707D',
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
