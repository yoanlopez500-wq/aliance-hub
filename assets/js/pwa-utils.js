// assets/js/pwa-utils.js
// Gestión de PWA: manifest dinámico, install prompt, tema oscuro

// Detectar si es admin (logueado) o público
async function isAdminLogged() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return !!session;
    } catch (e) {
        return false;
    }
}

// Generar manifest dinámico según el contexto
function generateDynamicManifest() {
    const isAdmin = document.body.dataset.role === 'admin';
    const isPublic = document.body.dataset.role === 'public';

    const manifest = {
        name: isAdmin ? 'Alliance Hub Admin' : 'Alliance Hub',
        short_name: isAdmin ? 'AH Admin' : 'AllianceHub',
        description: isAdmin 
            ? 'Panel de administración para Alliance Hub' 
            : 'Rankings y gestión para comunidades de Supremacy 1914',
        start_url: isAdmin ? '/admin/index.html' : '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        orientation: 'portrait-primary',
        icons: [
            { src: '/assets/icons/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'maskable any' },
            { src: '/assets/icons/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'maskable any' },
            { src: '/assets/icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'maskable any' },
            { src: '/assets/icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'maskable any' },
            { src: '/assets/icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'maskable any' },
            { src: '/assets/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
            { src: '/assets/icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'maskable any' },
            { src: '/assets/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' }
        ]
    };

    // Crear blob y actualizar el link del manifest
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'manifest';
        document.head.appendChild(link);
    }
    link.href = url;
}

// Registrar Service Worker
function registerSW() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('SW registrado:', reg.scope))
            .catch(err => console.log('SW error:', err));
    }
}

// Mostrar botón de instalación PWA
let deferredPrompt;
function setupInstallButton() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        hideInstallButton();
    });
}

function showInstallButton() {
    // Solo mostrar si no está ya instalada
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    let btn = document.getElementById('pwa-install-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'pwa-install-btn';
        btn.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-900 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-amber-400 transition animate-bounce';
        btn.innerHTML = '📲 Instalar App';
        btn.onclick = installPWA;
        document.body.appendChild(btn);
    }
    btn.classList.remove('hidden');
}

function hideInstallButton() {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.classList.add('hidden');
}

async function installPWA() {
    if (!deferredPrompt) {
        showToast('La app ya está instalada o no se puede instalar en este navegador', 'info');
        return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
        showToast('¡App instalada!', 'success');
    }
    deferredPrompt = null;
    hideInstallButton();
}

// Inicializar PWA
document.addEventListener('DOMContentLoaded', async () => {
    registerSW();
    setupInstallButton();

    // Detectar rol y generar manifest apropiado
    const isAdminPage = location.pathname.startsWith('/admin');
    const isLoginPage = location.pathname === '/login.html';

    if (isAdminPage || isLoginPage) {
        document.body.dataset.role = 'admin';
    } else {
        document.body.dataset.role = 'public';
    }

    generateDynamicManifest();
});

// Exportar para uso global
window.installPWA = installPWA;
window.showInstallButton = showInstallButton;
