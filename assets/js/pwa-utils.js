// assets/js/pwa-utils.js v10 - PWA utilities
// Instalacion, notificaciones push, banner de instalacion

var deferredPrompt = null;
var isAppInstalled = false;

// ============================================
// DETECCION DE INSTALACION
// ============================================
function checkIfInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone === true) return true;
    if (localStorage.getItem('ah_app_installed') === 'true') return true;
    return false;
}

// ============================================
// BANNER DE INSTALACION
// ============================================
function updateInstallBanner() {
    var banner = document.getElementById('pwa-install-banner');
    if (!banner) return;
    if (isAppInstalled || !deferredPrompt) {
        banner.classList.add('hidden');
    } else {
        banner.classList.remove('hidden');
    }
}

function dismissInstallBanner() {
    var banner = document.getElementById('pwa-install-banner');
    if (banner) banner.classList.add('hidden');
    localStorage.setItem('ah_banner_dismissed', 'true');
}

// ============================================
// EVENTOS DE INSTALACION
// ============================================
window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[PWA v10] beforeinstallprompt capturado');
    updateInstallBanner();
});

window.addEventListener('appinstalled', function() {
    console.log('[PWA v10] App instalada');
    deferredPrompt = null;
    isAppInstalled = true;
    localStorage.setItem('ah_app_installed', 'true');
    updateInstallBanner();
    if (typeof showToast === 'function') showToast('App instalada correctamente', 'success');
});

// ============================================
// FUNCION PARA INSTALAR LA PWA
// ============================================
async function installPWA() {
    if (!deferredPrompt) {
        // Si no hay prompt, dar instrucciones al usuario
        var ua = navigator.userAgent.toLowerCase();
        if (ua.includes('android')) {
            alert('Para instalar:\n1. Toca el menu (3 puntos) en Chrome\n2. Selecciona "Agregar a pantalla de inicio"');
        } else if (ua.includes('iphone') || ua.includes('ipad')) {
            alert('Para instalar:\n1. Toca el boton Compartir en Safari\n2. Selecciona "Agregar a pantalla de inicio"');
        } else {
            alert('Busca la opcion "Instalar" en el menu de tu navegador');
        }
        return;
    }
    deferredPrompt.prompt();
    try {
        var outcome = await deferredPrompt.userChoice;
        if (outcome && outcome.outcome === 'accepted') {
            console.log('[PWA v10] Usuario acepto instalacion');
            deferredPrompt = null;
            isAppInstalled = true;
            localStorage.setItem('ah_app_installed', 'true');
            updateInstallBanner();
        } else {
            console.log('[PWA v10] Usuario rechazo instalacion');
        }
    } catch (err) {
        console.log('[PWA v10] Error en prompt:', err);
    }
}

// ============================================
// BOTON DE NOTIFICACIONES PUSH
// ============================================
function updateNotificationButton() {
    var btn = document.getElementById('pwa-notify-btn');
    if (!btn) return;

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
        if (typeof showToast === 'function') showToast('Tu navegador no soporta notificaciones', 'warning');
        return;
    }
    try {
        var permission = await Notification.requestPermission();
        if (permission === 'granted') {
            var success = await subscribeToPush();
            if (success) updateNotificationButton();
        } else if (permission === 'denied') {
            if (typeof showToast === 'function') showToast('Notificaciones bloqueadas. Activalas en configuracion.', 'error');
        }
    } catch (err) {
        console.log('[PWA v10] Error permiso notificacion:', err);
    }
}

// ============================================
// REGISTRO DEL SERVICE WORKER
// ============================================
function registerSW() {
    if (!('serviceWorker' in navigator)) {
        console.log('[PWA v10] Service Worker no soportado');
        return;
    }

    var swPath = (window.__AH_BASE_PATH || '/') + 'service-worker.js';

    navigator.serviceWorker.register(swPath, { scope: window.__AH_BASE_PATH || '/' })
        .then(function(reg) {
            console.log('[PWA v10] SW registrado:', reg.scope);

            // Forzar update si hay nueva version
            reg.addEventListener('updatefound', function() {
                var newWorker = reg.installing;
                newWorker.addEventListener('statechange', function() {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('[PWA v10] Nueva version disponible');
                        if (typeof showToast === 'function') {
                            showToast('Nueva version disponible. Recarga la pagina.', 'info');
                        }
                    }
                });
            });

            // Re-subscribir push si ya estaba suscrito
            if (isLazyLoggedIn && isLazyLoggedIn() && isPushSubscribed && isPushSubscribed()) {
                subscribeToPush();
            }
        })
        .catch(function(err) {
            console.log('[PWA v10] SW error:', err);
        });
}

// ============================================
// INICIALIZACION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    registerSW();
    isAppInstalled = checkIfInstalled();
    updateInstallBanner();
    updateNotificationButton();

    // Si el usuario cerro el banner previamente, respetar eso
    if (localStorage.getItem('ah_banner_dismissed') === 'true' && !isAppInstalled) {
        setTimeout(function() {
            if (!deferredPrompt) {
                var banner = document.getElementById('pwa-install-banner');
                if (banner) banner.classList.add('hidden');
            }
        }, 3000);
    }
});

// Exponer funciones globales
window.installPWA = installPWA;
window.dismissInstallBanner = dismissInstallBanner;
window.updateNotificationButton = updateNotificationButton;
window.requestNotificationPermission = requestNotificationPermission;
