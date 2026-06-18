// assets/js/pwa-utils.js
// Gestión de PWA: manifest dinámico, install prompt, tema oscuro

// Detectar la ruta base del proyecto automáticamente
function getBasePath() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(function(p) { return p.length > 0; });

    // Si hay al menos un segmento y no parece ser una página (.html)
    if (parts.length >= 1 && !parts[0].includes('.') && parts[0].length > 0) {
        return '/' + parts[0] + '/';
    }
    return '/';
}

const BASE_PATH = getBasePath();
console.log('Base path detectado:', BASE_PATH);

async function isAdminLogged() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return !!session;
    } catch (e) {
        return false;
    }
}

function generateDynamicManifest() {
    const isAdmin = document.body.dataset.role === 'admin';

    const manifest = {
        name: isAdmin ? 'Alliance Hub Admin' : 'Alliance Hub',
        short_name: isAdmin ? 'AH Admin' : 'AllianceHub',
        description: isAdmin 
            ? 'Panel de administración para Alliance Hub' 
            : 'Rankings y gestión para comunidades de Supremacy 1914',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        orientation: 'portrait-primary',
        icons: [
            { src: BASE_PATH + 'assets/icons/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'maskable any' },
            { src: BASE_PATH + 'assets/icons/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'maskable any' },
            { src: BASE_PATH + 'assets/icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'maskable any' },
            { src: BASE_PATH + 'assets/icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'maskable any' },
            { src: BASE_PATH + 'assets/icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'maskable any' },
            { src: BASE_PATH + 'assets/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable any' },
            { src: BASE_PATH + 'assets/icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'maskable any' },
            { src: BASE_PATH + 'assets/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' }
        ]
    };

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

function registerSW() {
    if ('serviceWorker' in navigator) {
        // El SW debe estar en la raíz del proyecto para controlar todo el scope
        const swPath = BASE_PATH + 'service-worker.js';

        console.log('Registrando SW en:', swPath, 'con scope:', BASE_PATH);

        navigator.serviceWorker.register(swPath, { scope: BASE_PATH })
            .then(function(reg) {
                console.log('SW registrado exitosamente:', reg.scope);
            })
            .catch(function(err) {
                console.log('SW error:', err);
                // Si falla con scope, intentar sin scope (el navegador usará el del script)
                navigator.serviceWorker.register(swPath)
                    .then(function(reg) {
                        console.log('SW registrado (sin scope):', reg.scope);
                    })
                    .catch(function(err2) {
                        console.log('SW fallback error:', err2);
                    });
            });
    }
}

let deferredPrompt;
function setupInstallButton() {
    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
    });

    window.addEventListener('appinstalled', function() {
        deferredPrompt = null;
        hideInstallButton();
    });
}

function showInstallButton() {
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    let btn = document.getElementById('pwa-install-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'pwa-install-btn';
        btn.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-900 px-6 py-3 rounded-full font-bold shadow-lg hover:bg-amber-400 transition';
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

document.addEventListener('DOMContentLoaded', async function() {
    registerSW();
    setupInstallButton();

    const isAdminPage = location.pathname.includes('/admin');
    const isLoginPage = location.pathname.includes('login');

    if (isAdminPage || isLoginPage) {
        document.body.dataset.role = 'admin';
    } else {
        document.body.dataset.role = 'public';
    }

    generateDynamicManifest();
});

window.installPWA = installPWA;
window.showInstallButton = showInstallButton;
