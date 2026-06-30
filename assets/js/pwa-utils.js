// pwa-utils.js - PWA helpers
function requestPushPermission() { return Notification.requestPermission(); }
async function checkSubscription() { try { var reg = await navigator.serviceWorker.ready; var sub = await reg.pushManager.getSubscription(); return !!sub; } catch(e) { return false; } }
async function unsubscribeFromPush() { try { var reg = await navigator.serviceWorker.ready; var sub = await reg.pushManager.getSubscription(); if (sub) { await supabase.from('push_subscriptions').delete().eq('endpoint', sub.toJSON().endpoint); await sub.unsubscribe(); } localStorage.removeItem('ah_v2_push_subscribed'); return true; } catch(e) { return false; } }
function nuclearCacheClear() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(function(regs) { regs.forEach(function(r) { r.unregister(); }); });
    caches.keys().then(function(names) { names.forEach(function(n) { caches.delete(n); }); });
    localStorage.clear();
}
