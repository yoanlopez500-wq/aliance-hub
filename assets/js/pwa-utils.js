// assets/js/pwa-utils.js
// PWA utilities + Push notifications
// Depende de base.js (window.__AH_BASE_PATH)

function registerSW() {
    if ('serviceWorker' in navigator) {
        var swPath = window.__AH_BASE_PATH + 'service-worker.js';
        navigator.serviceWorker.register(swPath, { scope: window.__AH_BASE_PATH })
            .then(function(reg) { 
                console.log('SW registrado:', reg.scope);
                if (isLazyLoggedIn() && isPushSubscribed()) {
                    subscribeToPush();
                }
            })
            .catch(function(err) { console.log('SW error:', err); });
    }
}

var deferredPrompt;
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
    var btn = document.getElementById('pwa-install-btn');
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
    var btn = document.getElementById('pwa-install-btn');
    if (btn) btn.classList.add('hidden');
}

async function installPWA() {
    if (!deferredPrompt) {
        showToast('La app ya está instalada o no se puede instalar', 'info');
        return;
    }
    deferredPrompt.prompt();
    var outcome = await deferredPrompt.userChoice;
    if (outcome === 'accepted') showToast('¡App instalada!', 'success');
    deferredPrompt = null;
    hideInstallButton();
}

document.addEventListener('DOMContentLoaded', function() {
    registerSW();
    setupInstallButton();
});

window.installPWA = installPWA;
