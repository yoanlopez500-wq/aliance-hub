// assets/js/pwa-utils.js
// PWA: Service Worker + Install button (manifest es estático)

function getBasePath() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(function(p) { return p.length > 0; });
    if (parts.length >= 1 && !parts[0].includes('.') && parts[0].length > 0) {
        return '/' + parts[0] + '/';
    }
    return '/';
}

const BASE_PATH = getBasePath();

function registerSW() {
    if ('serviceWorker' in navigator) {
        const swPath = BASE_PATH + 'service-worker.js';
        navigator.serviceWorker.register(swPath, { scope: BASE_PATH })
            .then(function(reg) { console.log('SW registrado:', reg.scope); })
            .catch(function(err) { console.log('SW error:', err); });
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
        showToast('La app ya está instalada o no se puede instalar', 'info');
        return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') showToast('¡App instalada!', 'success');
    deferredPrompt = null;
    hideInstallButton();
}

document.addEventListener('DOMContentLoaded', function() {
    registerSW();
    setupInstallButton();
});

window.installPWA = installPWA;
