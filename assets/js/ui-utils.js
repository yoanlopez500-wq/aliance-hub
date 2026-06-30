// ui-utils.js - UI helpers
function debounce(fn, ms) { var t; return function() { var a = arguments; clearTimeout(t); t = setTimeout(function() { fn.apply(null, a); }, ms); }; }
function throttle(fn, ms) { var l = 0; return function() { var n = Date.now(); if (n - l >= ms) { l = n; fn.apply(null, arguments); } }; }
function copyToClipboard(text) { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); showToast('Copiado al portapapeles', 'success'); }
