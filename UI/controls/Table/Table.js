window.DuckControls = window.DuckControls || {};

let _globalChPx = null;
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { _globalChPx = null; });
}
function getGlobalChPx() {
    if (_globalChPx !== null) return _globalChPx;
    const tmp = document.createElement('span');
    tmp.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:13px;font-family:inherit;';
    tmp.textContent = '0'; // '0' is the reference character for 1ch
    document.body.appendChild(tmp);
    _globalChPx = tmp.getBoundingClientRect().width || 8;
    document.body.removeChild(tmp);
    return _globalChPx;
}

window.DuckControls.Table = {
    create(options) {
        // ── Outer wrapper (flex container that fills parent) ─────────
        const wrap = document.createElement('div');
        wrap.className = 'data-table-wrap';
        wrap.style.position = 'relative';

        let _loaderOverlay, _loaderSpinner, _loaderText;

        // ── Scroll container ─────────────────────────────────────────
        const container = document.createElement('div');
        container.className = 'data-table-container';
        wrap.appendChild(container);

        // ── Unique ID for CSS-injection ───────────────────────────────
        const tableId = options.id || `duck-tbl-${Math.random().toString(36).substr(2, 8)}`;

        // ── Style tag for dynamic column widths & sticky offsets ──────
        const dynStyle = document.createElement('style');
        dynStyle.id = `${tableId}-dyn`;
        container.appendChild(dynStyle);

        // ── Style tag for column visibility (hide/show columns) ──────────
        const visStyle = document.createElement('style');
        visStyle.id = `${tableId}-vis`;
        container.appendChild(visStyle);

        // Set of column IDs that are currently hidden (via CSS)
        const _hiddenColIds = new Set();

        // ── Table element ─────────────────────────────────────────────
        const table = document.createElement('table');
        table.className = 'data-table';
        table.id = tableId;
        container.appendChild(table);

        // ── Colgroup - source of truth for column widths ──────────────
        const colgroup = document.createElement('colgroup');
        const cols = options.columns.map(col => {
            const colEl = document.createElement('col');
            colEl.className = `col-col--${col.id || col.field || 'unknown'}`;
            colgroup.appendChild(colEl);
            return colEl;
        });
        table.appendChild(colgroup);

        // ─────────────────────────────────────────────────────────────
        // Width parsing helpers
        // ch → px: we use a canvas-based measurement for accuracy.
        // parseWidthToPx is used only to seed initial colWidths from
        // column config strings like '15ch', '200px', etc.
        // ─────────────────────────────────────────────────────────────


        function parseWidthToPx(w, chPx) {
            if (!w || w === 'auto' || String(w).endsWith('%')) return 0;
            const s = String(w);
            if (s.endsWith('ch')) return Math.ceil(parseFloat(s) * (chPx || getGlobalChPx()));
            if (s.endsWith('px')) return parseInt(s);
            return parseInt(s) || 0;
        }

        function getMinPx(col, chPx) {
            if (col.minWidth) return parseWidthToPx(col.minWidth, chPx);
            return 40;
        }
        function getMaxPx(col, chPx) {
            if (col.maxWidth) return parseWidthToPx(col.maxWidth, chPx);
            return 9999;
        }

        // ── Find filler index ────────────────────────────────────────
        // Filler = the one column that absorbs all remaining horizontal space.
        let fillerIdx = -1;
        for (let i = 0; i < options.columns.length; i++) {
            if (options.columns[i].fillSpace) {
                fillerIdx = i;
                break;
            }
        }

        // colWidths[i] = current pixel width (0 = filler/auto, set after measurement)
        const colWidths = options.columns.map((col, idx) => {
            if (idx === fillerIdx) return 0;
            return parseWidthToPx(col.width);
        });

        // ── Header ────────────────────────────────────────────────────
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        let selectAllCheckbox = null;

        options.columns.forEach((col, colIdx) => {
            const th = document.createElement('th');
            th.className = `data-col-${col.id || col.field || 'unknown'}`;
            th.dataset.colIndex = colIdx;
            if (col.field) th.dataset.col = col.field;
            if (col.align) th.style.textAlign = col.align;

            if (col.type === 'checkbox') {
                const cbEl = document.createElement('span');
                // Ensure header checkbox has same size class (if any styling targets it)
                cbEl.className = 'header-checkbox-wrap';
                th.appendChild(cbEl);
                const cb = window.DuckControls.Checkbox.create(cbEl, {
                    title: col.title || 'Select all',
                    onChange: e => { 
                        // Synchronize all rows
                        tbody.querySelectorAll('td').forEach(td => {
                            const rowCb = td._duckCheckbox;
                            if (rowCb) {
                                if (e.checked && !rowCb.isChecked()) {
                                    rowCb.check();
                                    td.closest('tr')?.classList.add('selected');
                                } else if (!e.checked && rowCb.isChecked()) {
                                    rowCb.uncheck();
                                    td.closest('tr')?.classList.remove('selected');
                                }
                            }
                        });
                        if (col.onCheckAll) col.onCheckAll(e); 
                    }
                });
                th._duckCheckbox = cb;
                selectAllCheckbox = cb;
            } else if (col.id === 'filler') {
                // Filler: purely empty spacer, no resizer, no label
            } else {
                th.textContent = col.label || '';

                // Resizer handle
                const canResize = col.resizable !== false && !col.locked;
                if (!canResize) {
                    const resizer = document.createElement('div');
                    resizer.className = 'col-resizer col-resizer--locked';
                    th.appendChild(resizer);
                } else {
                    const resizer = document.createElement('div');
                    resizer.className = 'col-resizer';
                    resizer.dataset.colIndex = colIdx;

                    let startX, startW;
                    resizer.addEventListener('mousedown', e => {
                        startX = e.clientX;
                        startW = colWidths[colIdx] || th.offsetWidth;
                        document.body.style.cursor = 'col-resize';
                        document.body.classList.add('is-resizing-cols');
                        resizer.classList.add('is-resizing');

                        const onMove = mv => {
                            const delta = mv.clientX - startX;
                            const min = getMinPx(col);
                            const max = getMaxPx(col);
                            const newW = Math.min(Math.max(min, startW + delta), max);
                            colWidths[colIdx] = newW;
                            applyColumnWidths();
                        };

                        const onUp = () => {
                            document.body.style.cursor = '';
                            document.body.classList.remove('is-resizing-cols');
                            resizer.classList.remove('is-resizing');
                            document.removeEventListener('mousemove', onMove);
                            document.removeEventListener('mouseup', onUp);
                            updateDynCSS();
                            if (col.onResize) col.onResize(colWidths[colIdx]);
                        };

                        document.addEventListener('mousemove', onMove);
                        document.addEventListener('mouseup', onUp);
                        e.preventDefault();
                        e.stopPropagation();
                    });
                    th.appendChild(resizer);
                }
            }
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        table.appendChild(thead);

        // ── Body ──────────────────────────────────────────────────────
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);

        // ── Empty row ─────────────────────────────────────────────────
        const emptyRow = document.createElement('tr');
        const emptyTd = document.createElement('td');
        emptyTd.colSpan = options.columns.length;
        emptyTd.className = 'empty-cell';
        emptyTd.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-tertiary);">
                <span class="material-symbols-outlined" style="font-size:36px;opacity:0.4;margin-bottom:12px;">cloud_off</span>
                <div style="font-size:13px;">${options.emptyText || 'No data'}</div>
            </div>`;
        emptyRow.appendChild(emptyTd);

        // ─────────────────────────────────────────────────────────────
        // measureTextWidth(el)
        // Uses Range API to measure the actual rendered pixel width of
        // all text/content inside an element. This is the ONLY reliable
        // way to measure content width when the containing cell may be
        // smaller than the content (table-layout:fixed clips overflow).
        // 
        // Unlike scrollWidth (which fails on centered text in 1px cells)
        // Range.getBoundingClientRect() measures the real bounding box
        // of the rendered text regardless of the cell's CSS dimensions.
        // ─────────────────────────────────────────────────────────────
        function measureCellContent(cell) {
            if (!cell) return 0;
            // For cells with child elements (custom renders), measure the element
            const child = cell.firstElementChild;
            if (child) {
                return child.getBoundingClientRect().width;
            }
            // For plain text cells, use Range
            const text = cell.firstChild;
            if (text && text.nodeType === Node.TEXT_NODE && text.textContent.trim()) {
                const range = document.createRange();
                range.selectNode(text);
                return range.getBoundingClientRect().width;
            }
            return 0;
        }

        // ─────────────────────────────────────────────────────────────
        // applyColumnWidths()
        // Sets exact pixel widths on <col> elements for fixed layout.
        // Filler column: width = '' (auto) → absorbs remaining space.
        // table.style.minWidth = sum of all fixed cols so scrollbar
        // appears when container is narrower than table content.
        // ─────────────────────────────────────────────────────────────
        function applyColumnWidths() {
            let totalFixed = 0;
            cols.forEach((colEl, idx) => {
                const col = options.columns[idx];
                const colId = col.id || col.field || 'unknown';
                if (_hiddenColIds.has(colId)) {
                    // Hidden columns: hide <col> so it doesn't break table-layout mapping
                    colEl.style.display = 'none';
                    colEl.style.width = '0';
                } else {
                    if (idx === fillerIdx && colWidths[fillerIdx] === 0) {
                        colEl.style.display = 'none';
                        colEl.style.width = '0';
                    } else {
                        colEl.style.display = '';
                        if (idx === fillerIdx) {
                            colEl.style.width = ''; // filler absorbs remaining space
                        } else if (colWidths[idx] > 0) {
                            colEl.style.width = `${colWidths[idx]}px`;
                            totalFixed += colWidths[idx];
                        }
                    }
                }
            });
            if (totalFixed > 0) {
                table.style.minWidth = totalFixed + 'px';
                table.style.width = totalFixed + 'px'; // Prevent browser from stretching columns to 100%
            }
        }

        // ─────────────────────────────────────────────────────────────
        // runAutoSize()
        // For each column with autoSize:true, measures the actual
        // rendered content width of every cell in that column (header
        // + all rows), then sets colWidths[idx] to max(measured, min).
        //
        // Key technique: We temporarily set the <col> width to '' (auto)
        // during measurement so cells are NOT clipped by table-layout:fixed.
        // After measurement we restore to the computed pixel width.
        //
        // The filler column must be set to 0 width during measurement so
        // it doesn't steal space from autoSize columns.
        // ─────────────────────────────────────────────────────────────
        // Canvas 2D context reused across measurements for performance
        let _measureCanvas = null;
        let _measureCtx = null;

        function measureTextPx(text, fontSpec) {
            if (!_measureCanvas) {
                _measureCanvas = document.createElement('canvas');
                _measureCtx = _measureCanvas.getContext('2d');
            }
            _measureCtx.font = fontSpec;
            return _measureCtx.measureText(String(text)).width;
        }

        // Get the computed font string for a real rendered cell.
        // We do this once per autoSize run against the REAL table cells.
        function getCellFont(cell) {
            const cs = window.getComputedStyle(cell);
            return `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        }

        function getCellPadding(cell) {
            const cs = window.getComputedStyle(cell);
            return parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0);
        }

        function runAutoSize() {
            const autoSizeCols = [];
            options.columns.forEach((col, idx) => {
                if (idx === fillerIdx) return;
                
                // Extract column font to calculate exact ch size for this specific column
                let cellFont = null;
                const firstRow = tbody.firstElementChild;
                if (firstRow && firstRow.children.length > 0 && !firstRow.children[0].classList.contains('empty-cell')) {
                    const td = firstRow.children[idx];
                    if (td) cellFont = getCellFont(td);
                }
                const chPx = cellFont ? measureTextPx('0', cellFont) : getGlobalChPx();

                if (!col.autoSize) {
                    // Recalculate fixed widths to ensure they use latest loaded fonts (e.g. latest 1ch value)
                    colWidths[idx] = parseWidthToPx(col.width, chPx);
                } else {
                    autoSizeCols.push({ col, idx, chPx });
                }
            });

            if (autoSizeCols.length > 0) {
                autoSizeCols.forEach((item) => {
                const { col, idx, chPx } = item;
                const th = trHead.children[idx];
                if (!th) return;

                // Measure using real computed font of the header cell
                const headerFont = getCellFont(th);
                const headerPadding = getCellPadding(th);
                // Header text is the label; measure it and add its actual padding
                let maxW = measureTextPx(col.label || '', headerFont) + headerPadding + 8; // +8 safety buffer

                // Measure data cells in real tbody (not a clone)
                tbody.querySelectorAll('tr').forEach(row => {
                    if (row.children.length === 1 && row.children[0].classList.contains('empty-cell')) return;
                    const td = row.children[idx];
                    if (!td) return;

                    // Get the actual text content for measurement
                    const cellFont = getCellFont(td);
                    const cellPadding = getCellPadding(td);

                    // Measure all leaf text nodes or the first child element
                    const child = td.firstElementChild;
                    let w = 0;
                    if (child) {
                        // Temporarily force shrink-wrap to measure true content width
                        const oldW = child.style.width;
                        child.style.width = 'max-content';
                        w = child.offsetWidth + cellPadding + 16; // Add extra buffer for borders/padding inside custom components
                        child.style.width = oldW;
                    } else {
                        w = measureTextPx(td.textContent || '', cellFont) + cellPadding + 8;
                    }
                    if (w > maxW) maxW = w;
                });

                const minW = col.minWidth ? parseWidthToPx(col.minWidth, chPx) : Math.max(parseWidthToPx(col.width || '0', chPx), 40);
                const maxConstraint = getMaxPx(col, chPx);
                colWidths[idx] = Math.round(Math.min(Math.max(minW, maxW), maxConstraint));
                });
            }

            applyColumnWidths();
        }

        // ─────────────────────────────────────────────────────────────
        // updateDynCSS()
        // Injects dynamic CSS for sticky column left/right offsets
        // and shadow effects on the outermost locked columns.
        // ─────────────────────────────────────────────────────────────
        function updateDynCSS() {
            let css = '';

            // ── Left-sticky: compute offsets ──────────────────────────
            let leftPx = 0;
            let lastLeftIdx = -1;
            options.columns.forEach((col, idx) => {
                if (col.locked && col.lockedPosition !== 'right') lastLeftIdx = idx;
            });

            options.columns.forEach((col, idx) => {
                if (!col.locked || col.lockedPosition === 'right') return;
                const cls = `data-col-${col.id || col.field || 'unknown'}`;
                const th = trHead.children[idx];
                const isHidden = _hiddenColIds.has(col.id || col.field || 'unknown');
                const w = isHidden ? 0 : (colWidths[idx] > 0 ? colWidths[idx] : (th ? th.offsetWidth : 0));

                let shadowRule = '';
                if (idx === lastLeftIdx && !isHidden) {
                    shadowRule = `box-shadow: inset -1px 0 0 var(--border-muted), 3px 0 8px -2px rgba(0,0,0,0.14); clip-path: inset(0 -20px 0 0);`;
                }

                css += `
#${tableId} .${cls} {
    position: sticky !important;
    left: ${leftPx}px !important;
    z-index: ${30 - idx} !important;
    background: var(--row-bg, var(--bg-surface)) !important;
    ${shadowRule}
}`;
                leftPx += w;
            });

            // ── Right-sticky: compute offsets ────────────────────────
            let rightPx = 0;
            let firstRightIdx = -1;
            for (let i = 0; i < options.columns.length; i++) {
                const col = options.columns[i];
                if (col.locked && col.lockedPosition === 'right' && !_hiddenColIds.has(col.id || col.field || 'unknown')) {
                    firstRightIdx = i;
                    break;
                }
            }

            for (let i = options.columns.length - 1; i >= 0; i--) {
                const col = options.columns[i];
                if (!col.locked || col.lockedPosition !== 'right') continue;
                const colId = col.id || col.field || 'unknown';
                if (_hiddenColIds.has(colId)) continue;

                const cls = `data-col-${colId}`;
                const w = colWidths[i] > 0 ? colWidths[i] : 80;

                let shadowRule = '';
                if (i === firstRightIdx) {
                    shadowRule = `box-shadow: inset 1px 0 0 var(--border-muted), -3px 0 8px -2px rgba(0,0,0,0.14);`;
                }

                css += `
#${tableId} th.${cls},
#${tableId} td.${cls} {
    position: sticky !important;
    right: ${rightPx}px !important;
    z-index: 100 !important;
    background: var(--row-bg, var(--bg-surface)) !important;
    ${shadowRule}
}`;
                rightPx += w;
            }

            // Filler column: fully invisible — no padding, no border, no background
            if (fillerIdx >= 0) {
                const fillerCol = options.columns[fillerIdx];
                const cls = `data-col-${fillerCol.id || 'filler'}`;
                const hideFiller = colWidths[fillerIdx] === 0;
                css += `
#${tableId} th.${cls},
#${tableId} td.${cls} {
    padding: 0 !important;
    border-bottom: none !important;
    border-right: none !important;
    overflow: hidden !important;
    background: transparent !important;
    ${hideFiller ? 'display: none !important;' : ''}
}`;
            }

            dynStyle.textContent = css;
        }

        // ── Initial layout seed ───────────────────────────────────────
        options.columns.forEach((col, idx) => {
            if (idx === fillerIdx) return;
            if (colWidths[idx] > 0) {
                cols[idx].style.width = `${colWidths[idx]}px`;
            }
        });
        updateDynCSS();

        // ── ResizeObserver: run autoSize ONCE when container first becomes visible ─
        let roDebounce = null;
        let _autoSizeDone = false;

        // Rerun autoSize when web fonts finish loading, to fix any wrong ch-unit measurements
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                if (_autoSizeDone && container.clientWidth > 0) {
                    _autoSizeDone = false; // Allow it to run again
                    runAutoSize();
                    _autoSizeDone = true;
                }
            });
        }

        let _resizeRaf = null;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0 && !_autoSizeDone) {
                    _autoSizeDone = true;
                    runAutoSize();
                    applyColumnWidths();
                    void table.offsetHeight; // Force reflow
                    updateDynCSS();
                } else if (entry.contentRect.width > 0) {
                    // On resize: apply column widths (to toggle scroll state) and sticky positions synchronously
                    if (_resizeRaf) cancelAnimationFrame(_resizeRaf);
                    _resizeRaf = requestAnimationFrame(() => {
                        applyColumnWidths();
                        void table.offsetHeight; // Force reflow
                        updateDynCSS();
                    });
                }
            }
        });
        ro.observe(container);

        // ── Render rows ───────────────────────────────────────────────
        function renderData(data) {
            tbody.innerHTML = '';
            
            // Sync select all checkbox
            if (selectAllCheckbox) {
                selectAllCheckbox.uncheck();
                if (!data || data.length === 0) {
                    selectAllCheckbox.element.style.pointerEvents = 'none';
                    selectAllCheckbox.element.style.opacity = '0.5';
                } else {
                    selectAllCheckbox.element.style.pointerEvents = 'auto';
                    selectAllCheckbox.element.style.opacity = '1';
                }
            }

            if (!data || data.length === 0) {
                wrap.classList.add('is-empty');
                thead.style.display = 'none';
                table.style.height = '100%';
                emptyTd.colSpan = options.columns.length;
                emptyTd.style.height = '100%';
                tbody.appendChild(emptyRow);
                updateDynCSS();
                return;
            } else {
                wrap.classList.remove('is-empty');
                thead.style.display = '';
                table.style.height = '';
            }

            const frag = document.createDocumentFragment();
            data.forEach((row, rowIdx) => {
                const tr = document.createElement('tr');
                if (row.id != null) tr.dataset.id = row.id;
                if (row.status === 'running' || row.status === 'ready') {
                    tr.classList.add('profile-running');
                }

                options.columns.forEach((col, colIdx) => {
                    const td = document.createElement('td');
                    td.className = `data-col-${col.id || col.field || 'unknown'}`;
                    td.dataset.colIndex = colIdx;
                    if (col.align) td.style.textAlign = col.align;

                    if (col.type === 'checkbox') {
                        const cbEl = document.createElement('span');
                        td.appendChild(cbEl);
                        const cb = window.DuckControls.Checkbox.create(cbEl, {
                            title: col.title || 'Select',
                            onChange: e => {
                                if (e.checked) tr.classList.add('selected');
                                else tr.classList.remove('selected');
                                
                                // Update select all checkbox state
                                let allChecked = true;
                                let anyChecked = false;
                                let total = 0;
                                tbody.querySelectorAll('td').forEach(t => {
                                    const rc = t._duckCheckbox;
                                    if (rc) {
                                        total++;
                                        if (rc.isChecked()) anyChecked = true;
                                        else allChecked = false;
                                    }
                                });
                                
                                if (selectAllCheckbox) {
                                    if (total > 0 && allChecked) selectAllCheckbox.check();
                                    else {
                                        selectAllCheckbox.uncheck();
                                        if (anyChecked) selectAllCheckbox.setIndeterminate(true);
                                        else selectAllCheckbox.setIndeterminate(false);
                                    }
                                }

                                if (options.onCheckRow) options.onCheckRow(e, row);
                            }
                        });
                        cb.setValue(row.id);
                        td._duckCheckbox = cb;
                    } else if (col.id === 'filler') {
                        // filler: empty spacer cell, no content
                    } else if (col.render) {
                        const content = col.render(row, rowIdx);
                        if (typeof content === 'string') td.innerHTML = content;
                        else if (content instanceof HTMLElement) td.appendChild(content);
                    } else if (col.field) {
                        td.textContent = row[col.field] ?? '';
                    }

                    tr.appendChild(td);
                });

                if (options.onRowContextMenu) {
                    tr.addEventListener('contextmenu', e => {
                        e.preventDefault();
                        options.onRowContextMenu(e, row, rowIdx);
                    });
                }
                
                // Row click selection
                tr.addEventListener('click', (e) => {
                    // Ignore if clicked on an interactive element or editable columns
                    if (e.target.closest('button, input, a, .duck-checkbox, .duck-btn, .duck-inline-btn, .proxy-panel, .data-col-name, .data-col-note')) {
                        return;
                    }
                    // Find checkbox in this row and click it
                    const firstTd = tr.firstElementChild;
                    if (firstTd && firstTd._duckCheckbox) {
                        firstTd._duckCheckbox.element.click();
                    }
                });

                frag.appendChild(tr);
            });
            tbody.appendChild(frag);

            // After rendering, run autoSize (if needed and visible) and update layout synchronously
            if (!_autoSizeDone && container.clientWidth > 0) {
                runAutoSize();
                _autoSizeDone = true;
            }
            applyColumnWidths();
            void table.offsetHeight; // Force reflow
            updateDynCSS();
        }

        if (options.data) renderData(options.data);
        else renderData([]);

        // ── Public API ────────────────────────────────────────────────
        return {
            element: wrap,
            renderData,
            table,
            tbody,
            updateStickyPositions: updateDynCSS,
            setLoading(loading, content = 'Loading data...') {
                if (loading) {
                    if (!_loaderOverlay) {
                        _loaderOverlay = document.createElement('div');
                        _loaderOverlay.className = 'duck-table-loader active';
                        
                        _loaderSpinner = document.createElement('div');
                        _loaderSpinner.className = 'spinner';
                        
                        _loaderText = document.createElement('div');
                        _loaderText.className = 'duck-table-loader-text';
                        
                        _loaderOverlay.appendChild(_loaderSpinner);
                        _loaderOverlay.appendChild(_loaderText);
                        wrap.appendChild(_loaderOverlay);
                    }
                    _loaderOverlay.classList.add('active');
                    
                    if (typeof content === 'string') {
                        if (content.trim().startsWith('<')) {
                            _loaderSpinner.style.display = 'none';
                            _loaderText.innerHTML = content;
                        } else {
                            _loaderSpinner.style.display = '';
                            _loaderText.textContent = content;
                        }
                    } else if (content instanceof HTMLElement) {
                        _loaderSpinner.style.display = 'none';
                        _loaderText.innerHTML = '';
                        _loaderText.appendChild(content);
                    }
                } else {
                    if (_loaderOverlay) {
                        _loaderOverlay.classList.remove('active');
                    }
                }
            },
            getCheckedValues() {
                const result = [];
                tbody.querySelectorAll('td').forEach(td => {
                    const cb = td._duckCheckbox;
                    if (cb && cb.isChecked()) result.push(cb.getValue());
                });
                return result;
            },
            setChecked(ids) {
                const idSet = new Set(ids);
                let allChecked = true;
                let anyChecked = false;
                let totalCheckboxes = 0;
                
                tbody.querySelectorAll('td').forEach(td => {
                    const cb = td._duckCheckbox;
                    if (cb) {
                        totalCheckboxes++;
                        const val = cb.getValue();
                        if (idSet.has(val)) {
                            cb.check();
                            const tr = td.closest('tr');
                            if (tr) tr.classList.add('selected');
                            anyChecked = true;
                        } else {
                            cb.uncheck();
                            const tr = td.closest('tr');
                            if (tr) tr.classList.remove('selected');
                            allChecked = false;
                        }
                    }
                });
                
                if (selectAllCheckbox) {
                    if (totalCheckboxes > 0 && allChecked) selectAllCheckbox.check();
                    else {
                        selectAllCheckbox.uncheck();
                        if (anyChecked) selectAllCheckbox.setIndeterminate(true);
                        else selectAllCheckbox.setIndeterminate(false);
                    }
                }
            },
            clearChecked() {
                tbody.querySelectorAll('td').forEach(td => {
                    const cb = td._duckCheckbox;
                    if (cb) {
                        cb.uncheck();
                        const tr = td.closest('tr');
                        if (tr) tr.classList.remove('selected');
                    }
                });
                if (selectAllCheckbox) selectAllCheckbox.uncheck();
            },
            showSelectAll(show = true) {
                if (selectAllCheckbox?.element) {
                    selectAllCheckbox.element.style.display = show ? '' : 'none';
                }
            },
            checkAll(checked = true) {
                if (!selectAllCheckbox) return;
                if (checked) selectAllCheckbox.check();
                else selectAllCheckbox.uncheck();
            },
            setSelectAllIndeterminate(indeterminate = true) {
                if (selectAllCheckbox) selectAllCheckbox.setIndeterminate(indeterminate);
            },
            // updateColumnVisibility(visibleColIds: Set<string>)
            // Shows/hides optional columns via CSS without rebuilding the table.
            updateColumnVisibility(visibleColIds) {
                _hiddenColIds.clear();
                let css = '';
                options.columns.forEach((col) => {
                    const colId = col.id || col.field || 'unknown';
                    // Never hide locked columns, filler, or those marked alwaysVisible
                    if (col.alwaysVisible || col.locked || colId === 'filler') return;
                    if (!visibleColIds.has(colId)) {
                        _hiddenColIds.add(colId);
                        css += `#${tableId} th.data-col-${colId}, #${tableId} td.data-col-${colId} { display: none !important; }\n`;
                    }
                });
                visStyle.textContent = css;
                // applyColumnWidths now handles hidden cols (sets their <col> to width:0)
                applyColumnWidths();
                updateDynCSS();
            },
            destroy() {
                ro.disconnect();
                clearTimeout(roDebounce);
            }
        };
    }
};
