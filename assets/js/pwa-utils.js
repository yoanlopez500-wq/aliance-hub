// assets/js/pwa-utils.js
// PWA utilities + Push notifications + Install banner + Notification permission button
// Depende de base.js (window.__AH_BASE_PATH)

var deferredPrompt = null;
var isAppInstalled = false;

// Detectar si la app ya esta instalada
function checkIfInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone === true) return true;
    if (localStorage.getItem('ah_v2_app_installed') === 'true') return true;
    return false;
}

// Mostrar/ocultar el banner de instalacion
function updateInstallBanner() {
    var banner = document.getElementById('pwa-install-banner');
    if (!banner) return;
    if (isAppInstalled || !deferredPrompt) {
        banner.classList.add('hidden');
    } else {
        banner.classList.remove('hidden');
    }
}

// Escuchar el evento beforeinstallprompt
window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA] beforeinstallprompt capturado');
    updateInstallBanner();
});

// Escuchar cuando la app se instala
window.addEventListener('appinstalled', function() {
    console.log('[PWA] App instalada');
    deferredPrompt = null;
    isAppInstalled = true;
    localStorage.setItem('ah_v2_app_installed', 'true');
    updateInstallBanner();
    showToast('App instalada correctamente', 'success');
});

// Funcion para instalar la PWA (llamada desde el boton)
async function installPWA() {
    if (!deferredPrompt) {
        showToast('La app ya esta instalada o no se puede instalar', 'info');
        return;
    }
    deferredPrompt.prompt();
    var outcome = await deferredPrompt.userChoice;
    if (outcome && outcome.outcome === 'accepted') {
        console.log('[PWA] Usuario acepto instalacion');
        deferredPrompt = null;
        isAppInstalled = true;
        localStorage.setItem('ah_v2_app_installed', 'true');
        updateInstallBanner();
    } else {
        console.log('[PWA] Usuario rechazo instalacion');
    }
}

// Cerrar el banner (dismiss)
function dismissInstallBanner() {
    var banner = document.getElementById('pwa-install-banner');
    if (banner) banner.classList.add('hidden');
    localStorage.setItem('ah_v2_banner_dismissed', 'true');
}

// ============================================
// BOTON DE AUTORIZAR NOTIFICACIONES PUSH
// ============================================
function updateNotificationButton() {
    var btn = document.getElementById('pwa-notify-btn');
    if (!btn) return;

    // Si ya esta suscrito, mostrar como activado
    if (isPushSubscribed()) {
        btn.innerHTML = '&#128276; Notificaciones activas';
        btn.className = 'px-3 py-1.5 rounded-lg text-sm font-bold bg-green-500 text-white hover:bg-green-400 transition';
        btn.onclick = unsubscribeFromPush;
        btn.title = 'Click para desactivar notificaciones';
    } else {
        btn.innerHTML = '&#128263; Activar notificaciones';
        btn.className = 'px-3 py-1.5 rounded-lg text-sm font-bold bg-blue-500 text-white hover:bg-blue-400 transition';
        btn.onclick = requestNotificationPermission;
        btn.title = 'Recibe alertas de nuevas partidas';
    }
}

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        showToast('Tu navegador no soporta notificaciones', 'warning');
        return;
    }

    var permission = await Notification.requestPermission();
    if (permission === 'granted') {
        var success = await subscribeToPush();
        if (success) {
            updateNotificationButton();
        }
    } else if (permission === 'denied') {
        showToast('Notificaciones bloqueadas. Activalas en la configuracion de tu navegador.', 'error');
    }
}

// Boton flotante legacy (mantener por compatibilidad)
var deferredPromptLegacy;
function setupInstallButton() {
    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        deferredPromptLegacy = e;
        deferredPrompt = e;
        showInstallButton();
    });
    window.addEventListener('appinstalled', function() {
        deferredPromptLegacy = null;
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
        btn.innerHTML = 'Instalar App';
        btn.onclick = installPWA;
        document.body.appendChild(btn);
    }
    btn.classList.remove('hidden');
}

function hideInstallButton() {
    var btn = document.getElementById('pwa-install-btn');
    if (btn) btn.classList.add('hidden');
}

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

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', function() {
    registerSW();
    setupInstallButton();
    isAppInstalled = checkIfInstalled();
    updateInstallBanner();
    updateNotificationButton();

    // Si el usuario cerro el banner previamente, respetar eso
    if (localStorage.getItem('ah_v2_banner_dismissed') === 'true' && !isAppInstalled) {
        setTimeout(function() {
            if (!deferredPrompt) {
                var banner = document.getElementById('pwa-install-banner');
                if (banner) banner.classList.add('hidden');
            }
        }, 3000);
    }
});

window.installPWA = installPWA;
window.dismissInstallBanner = dismissInstallBanner;
window.updateNotificationButton = updateNotificationButton;
window.requestNotificationPermission = requestNotificationPermission;
