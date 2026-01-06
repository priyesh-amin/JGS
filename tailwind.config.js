/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'midnight-navy': '#0A1929',
                'trophy-gold': '#C5A059',
                'jaguar-green': '#004225',
                'charity-crimson': '#DC143C',
                'surface-light': '#F3F4F6',
                'border-light': '#E5E7EB',
                'border-dark': '#374151',
            },
            fontFamily: {
                serif: ['Times New Roman', 'serif'],
                body: ['Inter', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
