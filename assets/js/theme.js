// assets/js/theme.js - Alliance Hub Theme System
// Paleta de colores inspirada en AllianceHub Academy
// Incluir ESTE archivo ANTES de cargar Tailwind CDN para activar la paleta ah-*

(function() {
    window.__AH_THEME = {
        colors: {
            bg: '#0a0e27',
            card: '#11183a',
            'card-hover': '#1a2347',
            primary: '#1a237e',
            'primary-light': '#283593',
            accent: '#ff6f00',
            'accent-light': '#ff8f00',
            gold: '#ffd700',
            text: '#e8eaf6',
            'text-light': '#9fa8da',
            border: '#1a237e',
            success: '#2e7d32',
            danger: '#c62828',
        }
    };

    window.tailwind = window.tailwind || {};
    window.tailwind.config = {
        theme: {
            extend: {
                colors: {
                    ah: window.__AH_THEME.colors
                },
                fontFamily: {
                    sans: ['Inter', 'system-ui', 'sans-serif'],
                },
                animation: {
                    'fade-in': 'fadeIn 0.4s ease-out',
                    'slide-up': 'slideUp 0.3s ease-out',
                },
                keyframes: {
                    fadeIn: {
                        '0%': { opacity: '0', transform: 'translateY(12px)' },
                        '100%': { opacity: '1', transform: 'translateY(0)' },
                    },
                    slideUp: {
                        '0%': { opacity: '0', transform: 'translateY(20px)' },
                        '100%': { opacity: '1', transform: 'translateY(0)' },
                    }
                }
            }
        }
    };
})();
