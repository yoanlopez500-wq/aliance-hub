/**
 * rules-pdf.js - Alliance Hub Rules PDF Export Module
 * v18.1: Generates downloadable PDF from rule_sections + rule_precedents
 *
 * Usage:
 *   1. Include this script: <script src="assets/js/rules-pdf.js?v=18"></script>
 *   2. Add button with data attribute: <button data-rules-pdf-btn>
 *   3. Or call directly: downloadRulesPDF()
 */
(function(window) {
    'use strict';

    var H2PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    var isLoadingLib = false;
    var libCallbacks = [];

    // --- Load html2pdf.js dynamically ---
    function loadHtml2PdfLib(callback) {
        if (window.html2pdf) { callback(); return; }
        libCallbacks.push(callback);
        if (isLoadingLib) return;
        isLoadingLib = true;

        var script = document.createElement('script');
        script.src = H2PDF_CDN;
        script.onload = function() {
            isLoadingLib = false;
            libCallbacks.forEach(function(cb) { cb(); });
            libCallbacks = [];
        };
        script.onerror = function() {
            isLoadingLib = false; libCallbacks = [];
            console.error('[RulesPDF] Failed to load html2pdf.js');
            if (typeof showToast === 'function') showToast('Error cargando libreria PDF.', 'error');
        };
        document.head.appendChild(script);
    }

    // --- Helpers ---
    function escapeHtml(text) {
        if (!text) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatContent(content) {
        if (!content) return '';
        var escaped = escapeHtml(content);
        return escaped.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
    }

    function formatDateSpanish(dateStr) {
        if (!dateStr) return '-';
        try { return new Date(dateStr).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }); }
        catch(e) { return dateStr; }
    }

    function getCurrentDateSpanish() {
        return new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function getSeverityInfo(severity) {
        var map = {
            'high':   { label: 'ALTO',  color: '#c62828', bg: '#ffebee' },
            'medium': { label: 'MEDIO', color: '#ef6c00', bg: '#fff3e0' },
            'low':    { label: 'LEVE',  color: '#2e7d32', bg: '#e8f5e9' }
        };
        return map[severity] || { label: 'N/A', color: '#666', bg: '#f5f5f5' };
    }

    function getVisibilityLabel(vis) {
        var map = { 'public': 'Publica', 'training': 'Capacitacion', 'officials_only': 'Solo Oficiales' };
        return map[vis] || 'Publica';
    }

    // --- Build PDF content as DOM element (NOT HTML string with html/body) ---
    function buildPdfElement(sections, precedents) {
        var now = getCurrentDateSpanish();
        var totalSections = sections ? sections.length : 0;
        var totalPrecedents = precedents ? precedents.length : 0;

        // Create root container
        var root = document.createElement('div');
        root.style.cssText = 'font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;font-size:10.5pt;line-height:1.7;color:#1a1a2e;background:#fff;padding:0;margin:0;';

        // Inject styles
        var styleEl = document.createElement('style');
        styleEl.textContent =
            'h1,h2,h3{font-family:Georgia,"Times New Roman",serif;color:#0a0e27;margin:0}' +
            '.cover{text-align:center;padding:60px 30px 40px;page-break-after:always}' +
            '.cover-icon{font-size:64px;margin-bottom:20px}' +
            '.cover h1{font-size:28pt;font-weight:700;color:#0a0e27;margin-bottom:8px;letter-spacing:-0.5px}' +
            '.cover-subtitle{font-size:13pt;color:#555;margin-bottom:30px;font-weight:400}' +
            '.cover-meta{border-top:2px solid #ff8f00;border-bottom:2px solid #ff8f00;padding:18px 0;margin:30px auto;max-width:400px}' +
            '.cover-meta p{margin:4px 0;font-size:10pt;color:#666}' +
            '.cover-meta .meta-label{font-weight:600;color:#333}' +
            '.toc{page-break-after:always;padding-top:20px}' +
            '.toc h2{font-size:18pt;color:#0a0e27;border-bottom:2px solid #ff8f00;padding-bottom:10px;margin-bottom:25px}' +
            '.toc ul{list-style:none;padding:0;margin:0}' +
            '.toc li{padding:10px 0;border-bottom:1px solid #eee;font-size:11pt;display:flex;align-items:baseline}' +
            '.toc li.toc-prec{margin-top:15px;border-top:2px solid #ddd;padding-top:15px;font-weight:600}' +
            '.toc-num{display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;background:#ff8f00;color:#fff;border-radius:50%;font-size:10pt;font-weight:700;margin-right:14px;flex-shrink:0;font-family:Arial,sans-serif}' +
            '.toc-prec .toc-num{background:#1a237e}' +
            '.section{padding:15px 0}' +
            '.section-header{display:flex;align-items:center;gap:14px;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #ff8f00}' +
            '.section-number{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:linear-gradient(135deg,#ff6f00,#ff8f00);color:#fff;border-radius:10px;font-size:18pt;font-weight:700;font-family:Arial,sans-serif;flex-shrink:0}' +
            '.section-title{font-size:16pt;font-weight:700;flex:1}' +
            '.vis-badge{display:inline-block;font-size:8pt;font-weight:600;padding:3px 10px;border-radius:4px;background:#e3f2fd;color:#1565c0;margin-left:10px;vertical-align:middle;font-family:Arial,sans-serif;letter-spacing:0.3px}' +
            '.section-content{padding-left:8px}' +
            '.section-content p{margin:0 0 12px 0;text-align:justify}' +
            '.precedents-section{padding-top:15px}' +
            '.precedents-header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #1a237e}' +
            '.precedents-icon{font-size:36px;display:block;margin-bottom:10px}' +
            '.precedents-header h2{font-size:18pt;color:#0a0e27;margin-bottom:8px}' +
            '.precedents-desc{font-size:10pt;color:#666;margin:0;font-style:italic}' +
            '.precedent-item{padding:20px 0;border-bottom:1px solid #eee;page-break-inside:avoid}' +
            '.precedent-title-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}' +
            '.precedent-title-row h3{font-size:12pt;color:#0a0e27;flex:1;margin-right:10px}' +
            '.severity-badge{display:inline-block;font-size:8pt;font-weight:700;padding:4px 12px;border-radius:4px;letter-spacing:0.5px}' +
            '.precedent-desc{font-size:10pt;color:#333;margin-bottom:10px}' +
            '.precedent-desc p{margin:0;text-align:justify}' +
            '.prec-ref{font-size:9pt;color:#666;font-style:italic;margin-top:6px;padding:4px 10px;background:#f8f9fa;border-radius:4px;border-left:3px solid #ff8f00}' +
            '.prec-strike{font-size:9pt;color:#ef6c00;margin-top:4px;font-weight:600}' +
            '.prec-resolution{font-size:9pt;color:#2e7d32;margin-top:4px;font-weight:500}' +
            '.prec-date{font-size:8.5pt;color:#999;margin-top:8px}' +
            '.empty-state{text-align:center;padding:60px 20px;color:#999;font-style:italic}';
        root.appendChild(styleEl);

        // --- COVER PAGE ---
        var cover = document.createElement('div');
        cover.className = 'cover';
        cover.innerHTML =
            '<div class="cover-icon">&#128220;</div>' +
            '<h1>Reglamento Oficial</h1>' +
            '<p class="cover-subtitle">Alliance Hub - Normativa para partidas, torneos y comportamiento de jugadores</p>' +
            '<div class="cover-meta">' +
            '<p><span class="meta-label">Documento generado:</span> ' + escapeHtml(now) + '</p>' +
            '<p><span class="meta-label">Total secciones:</span> ' + totalSections + '</p>' +
            (totalPrecedents > 0 ? '<p><span class="meta-label">Precedentes registrados:</span> ' + totalPrecedents + '</p>' : '') +
            '</div>' +
            '<p style="font-size:9pt;color:#999;margin-top:40px;">Este documento es una copia oficial del reglamento vigente en Alliance Hub.<br>Los precedentes forman parte integrante del reglamento.</p>';
        root.appendChild(cover);

        // --- TABLE OF CONTENTS ---
        if (totalSections > 0) {
            var toc = document.createElement('div');
            toc.className = 'toc';
            var tocHtml = '<h2>Indice de Contenido</h2><ul>';
            sections.forEach(function(s, i) {
                tocHtml += '<li><span class="toc-num">' + (i + 1) + '</span> ' + escapeHtml(s.title) + '</li>';
            });
            if (totalPrecedents > 0) {
                tocHtml += '<li class="toc-prec"><span class="toc-num">P</span> Precedentes y Jurisprudencia</li>';
            }
            tocHtml += '</ul>';
            toc.innerHTML = tocHtml;
            root.appendChild(toc);
        }

        // --- SECTIONS ---
        if (totalSections > 0) {
            sections.forEach(function(s, i) {
                var sectionDiv = document.createElement('div');
                sectionDiv.className = 'section';
                if (i > 0) sectionDiv.style.pageBreakBefore = 'always';

                var visLabel = getVisibilityLabel(s.visibility);
                var visBadge = s.visibility && s.visibility !== 'public'
                    ? '<span class="vis-badge">' + visLabel + '</span>'
                    : '';

                sectionDiv.innerHTML =
                    '<div class="section-header">' +
                    '<span class="section-number">' + (i + 1) + '</span>' +
                    '<h2 class="section-title">' + escapeHtml(s.title) + visBadge + '</h2>' +
                    '</div>' +
                    '<div class="section-content"><p>' + formatContent(s.content) + '</p></div>';

                root.appendChild(sectionDiv);
            });
        } else {
            var empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = 'No hay secciones de reglamento configuradas.';
            root.appendChild(empty);
        }

        // --- PRECEDENTS ---
        if (totalPrecedents > 0) {
            var precSection = document.createElement('div');
            precSection.className = 'precedents-section';
            precSection.style.pageBreakBefore = 'always';

            var precHeader = document.createElement('div');
            precHeader.className = 'precedents-header';
            precHeader.innerHTML =
                '<span class="precedents-icon">&#9878;</span>' +
                '<h2>Precedentes y Jurisprudencia</h2>' +
                '<p class="precedents-desc">Casos resueltos que forman parte del reglamento y sirven como referencia para futuras decisiones.</p>';
            precSection.appendChild(precHeader);

            precedents.forEach(function(p) {
                var sev = getSeverityInfo(p.severity);
                var sectionRef = '';
                if (p.rule_section_id && sections) {
                    var matched = sections.find(function(s) { return s.id === p.rule_section_id; });
                    if (matched) {
                        var sIdx = sections.indexOf(matched) + 1;
                        sectionRef = '<div class="prec-ref">Referencia: Seccion ' + sIdx + ' - ' + escapeHtml(matched.title) + '</div>';
                    }
                }
                var strikeInfo = p.strike_type ? '<div class="prec-strike">Strike aplicado: ' + escapeHtml(p.strike_type) + '</div>' : '';
                var resolutionInfo = p.resolution ? '<div class="prec-resolution">Resolucion: ' + escapeHtml(p.resolution) + '</div>' : '';
                var dateInfo = '<div class="prec-date">Fecha: ' + formatDateSpanish(p.created_at) + '</div>';

                var item = document.createElement('div');
                item.className = 'precedent-item';
                item.innerHTML =
                    '<div class="precedent-title-row">' +
                    '<h3>' + escapeHtml(p.title) + '</h3>' +
                    '<span class="severity-badge" style="background:' + sev.bg + ';color:' + sev.color + ';">' + sev.label + '</span>' +
                    '</div>' +
                    '<div class="precedent-desc"><p>' + formatContent(p.description) + '</p></div>' +
                    sectionRef + strikeInfo + resolutionInfo + dateInfo;
                precSection.appendChild(item);
            });

            root.appendChild(precSection);
        }

        return root;
    }

    // --- Reset button state ---
    function resetButtonState() {
        document.querySelectorAll('[data-rules-pdf-btn].generating').forEach(function(btn) {
            btn.classList.remove('generating');
            btn.innerHTML = btn.dataset.originalHtml || '&#128196; Descargar PDF';
            btn.disabled = false;
        });
    }

    // --- Main function ---
    function downloadRulesPDF() {
        loadHtml2PdfLib(function() {
            // Fetch data from Supabase
            var sectionsPromise = supabase
                .from('rule_sections')
                .select('*')
                .eq('is_active', true)
                .order('order_index');

            var precedentsPromise = supabase
                .from('rule_precedents')
                .select('*')
                .order('created_at', { ascending: false });

            Promise.all([sectionsPromise, precedentsPromise])
                .then(function(results) {
                    var sectionsData = results[0].data || [];
                    var sectionsError = results[0].error;
                    var precedentsData = results[1].data || [];

                    // Fallback: if is_active filter fails, try without it
                    if (sectionsError) {
                        console.warn('[RulesPDF] Sections query failed, retrying without is_active filter:', sectionsError);
                        return supabase.from('rule_sections').select('*').order('order_index')
                            .then(function(r) {
                                return [r.data || [], precedentsData];
                            });
                    }
                    return [sectionsData, precedentsData];
                })
                .then(function(data) {
                    var sections = data[0];
                    var precedents = data[1];

                    if (!sections || sections.length === 0) {
                        if (typeof showToast === 'function') showToast('No hay secciones de reglamento para exportar', 'warning');
                        resetButtonState();
                        return;
                    }

                    // Build DOM element for PDF
                    var pdfElement = buildPdfElement(sections, precedents);

                    // Append to body temporarily (off-screen) so html2pdf can measure it
                    pdfElement.style.position = 'absolute';
                    pdfElement.style.left = '-9999px';
                    pdfElement.style.top = '0';
                    pdfElement.style.width = '794px'; // A4 width at 96dpi
                    document.body.appendChild(pdfElement);

                    var filename = 'reglamento-alliance-hub-' + new Date().toISOString().split('T')[0] + '.pdf';

                    var opt = {
                        margin: [16, 14, 18, 14], // top, left, bottom, right in mm
                        filename: filename,
                        image: { type: 'jpeg', quality: 0.96 },
                        html2canvas: {
                            scale: 2,
                            useCORS: true,
                            letterRendering: true,
                            logging: false,
                            windowWidth: 794
                        },
                        jsPDF: {
                            unit: 'mm',
                            format: 'a4',
                            orientation: 'portrait',
                            compress: true
                        },
                        pagebreak: {
                            mode: ['css', 'legacy'],
                            before: ['.precedents-section'],
                            avoid: ['.precedent-item', '.toc li', '.section-header']
                        }
                    };

                    html2pdf().set(opt).from(pdfElement).toPdf().get('pdf')
                        .then(function(pdf) {
                            // Add page numbers
                            var totalPages = pdf.internal.getNumberOfPages();
                            for (var i = 1; i <= totalPages; i++) {
                                pdf.setPage(i);
                                pdf.setFontSize(8);
                                pdf.setTextColor(153, 153, 153);
                                pdf.text(
                                    'Reglamento Alliance Hub - Pagina ' + i + ' de ' + totalPages,
                                    pdf.internal.pageSize.getWidth() / 2,
                                    pdf.internal.pageSize.getHeight() - 6,
                                    { align: 'center' }
                                );
                            }
                        })
                        .save()
                        .then(function() {
                            // Cleanup
                            if (pdfElement.parentNode) pdfElement.parentNode.removeChild(pdfElement);
                            if (typeof showToast === 'function') showToast('PDF descargado correctamente', 'success');
                            resetButtonState();
                        })
                        .catch(function(err) {
                            console.error('[RulesPDF] Generation error:', err);
                            if (pdfElement.parentNode) pdfElement.parentNode.removeChild(pdfElement);
                            if (typeof showToast === 'function') showToast('Error generando PDF. Intenta de nuevo.', 'error');
                            resetButtonState();
                        });
                })
                .catch(function(err) {
                    console.error('[RulesPDF] Data fetch error:', err);
                    if (typeof showToast === 'function') showToast('Error obteniendo datos del reglamento', 'error');
                    resetButtonState();
                });
        });
    }

    // --- Auto-init buttons ---
    function initRulesPdfButtons() {
        var buttons = document.querySelectorAll('[data-rules-pdf-btn]');
        buttons.forEach(function(btn) {
            if (btn.dataset.rulesPdfInitialized === 'true') return;
            btn.dataset.rulesPdfInitialized = 'true';

            btn.addEventListener('click', function(e) {
                e.preventDefault();
                if (btn.classList.contains('generating')) return;

                if (!btn.dataset.originalHtml) btn.dataset.originalHtml = btn.innerHTML;

                btn.classList.add('generating');
                btn.disabled = true;
                btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;">' +
                    '<span style="display:inline-block;width:14px;height:14px;border:2px solid currentColor;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></span>' +
                    'Generando PDF...</span>';

                if (!document.getElementById('rules-pdf-spin-style')) {
                    var style = document.createElement('style');
                    style.id = 'rules-pdf-spin-style';
                    style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
                    document.head.appendChild(style);
                }

                downloadRulesPDF();
            });
        });
    }

    window.downloadRulesPDF = downloadRulesPDF;
    window.initRulesPdfButtons = initRulesPdfButtons;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRulesPdfButtons);
    } else {
        initRulesPdfButtons();
    }

})(window);
