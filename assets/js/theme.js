// theme.js - Theme toggle + CSS variables
(function() {
    var saved = localStorage.getItem('ah_theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
    var style = document.createElement('style');
    style.textContent = ':root{--ah-bg:#0a0e27;--ah-card:#11183a;--ah-text:#e8eaf6;--ah-muted:#9fa8da;--ah-border:#1a237e;--ah-accent:#ff8f00;} .dark{--ah-bg:#0a0e27;--ah-card:#11183a;--ah-text:#e8eaf6;--ah-muted:#9fa8da;--ah-border:#1a237e;--ah-accent:#ff8f00;} .bg-ah-bg{background:var(--ah-bg)} .bg-ah-card{background:var(--ah-card)} .text-ah-text{color:var(--ah-text)} .text-ah-muted{color:var(--ah-muted)} .border-ah-border{border-color:var(--ah-border)} .text-ah-accent{color:var(--ah-accent)}';
    document.head.appendChild(style);
    window.toggleTheme = function() { document.documentElement.classList.toggle('dark'); localStorage.setItem('ah_theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); };
})();
