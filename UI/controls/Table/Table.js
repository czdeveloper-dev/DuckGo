window.DuckControls = window.DuckControls || {};
window.DuckControls.Table = {
    create(options) {
        const wrap = document.createElement('div');
        wrap.className = 'table-wrap table-scroll-wrapper';
        wrap.style.flex = '1';
        wrap.style.display = 'flex';
        wrap.style.flexDirection = 'column';
        if (options.height) {
            wrap.style.maxHeight = options.height;
        }
        
        const table = document.createElement('table');
        table.className = 'data-table data-table-container';
        if (options.id) table.id = options.id;
        
        const colgroup = document.createElement('colgroup');
        options.columns.forEach(col => {
            const colEl = document.createElement('col');
            const colName = col.id || col.field || 'select';
            colEl.className = `col-col col-col--${colName}`;
            if (col.field) colEl.dataset.col = col.field;
            colgroup.appendChild(colEl);
        });
        table.appendChild(colgroup);
        
        const thead = document.createElement('thead');
        const trHead = document.createElement('tr');
        
        options.columns.forEach((col, colIndex) => {
            const th = document.createElement('th');
            const colName = col.id || col.field || 'select';
            th.className = `data-col-${colName}`;
            th.dataset.colIndex = colIndex;
            if (col.field) th.dataset.col = col.field;
            if (col.width) th.style.width = col.width;
            if (col.align) th.style.textAlign = col.align;
            
            if (col.type === 'checkbox') {
                // Create custom checkbox container
                const cbContainer = document.createElement('div');
                cbContainer.className = 'table-checkbox';
                
                // Create checkbox using DuckControls.Checkbox if available
                if (window.DuckControls && window.DuckControls.Checkbox) {
                    const cbElement = document.createElement('span');
                    cbContainer.appendChild(cbElement);
                    th.appendChild(cbContainer);
                    
                    const checkbox = DuckControls.Checkbox.create(cbElement, {
                        title: col.title || 'Select all',
                        onChange: (e) => {
                            if (col.onCheckAll) col.onCheckAll({ target: { checked: e.checked } });
                        }
                    });
                    th._duckCheckbox = checkbox;
                } else {
                    // Fallback to native checkbox
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.className = 'table-checkbox-native';
                    if (col.id) cb.id = col.id;
                    cb.title = col.title || 'Select all';
                    if (col.onCheckAll) cb.addEventListener('change', col.onCheckAll);
                    cbContainer.appendChild(cb);
                    th.appendChild(cbContainer);
                }
            } else {
                th.textContent = col.label;
                
                // Resizable columns - only for non-locked columns
                if (col.resizable !== false && col.locked !== true) {
                    const resizer = document.createElement('div');
                    resizer.className = 'col-resizer';
                    resizer.dataset.colIndex = colIndex;
                    
                    let startX, startWidth, startColWidths;
                    
                    resizer.addEventListener('mousedown', (e) => {
                        startX = e.clientX;
                        startWidth = th.offsetWidth;
                        
                        // Store initial widths of all columns
                        startColWidths = [];
                        const allTh = trHead.querySelectorAll('th');
                        allTh.forEach((headerCell, idx) => {
                            startColWidths[idx] = headerCell.offsetWidth;
                        });
                        
                        // Store the next column reference
                        const nextTh = allTh[colIndex + 1];
                        resizer.dataset.nextColWidth = nextTh ? nextTh.offsetWidth : 0;
                        
                        document.body.style.cursor = 'col-resize';
                        resizer.classList.add('is-resizing');
                        document.body.classList.add('is-resizing-cols');
                        
                        const onMouseMove = (moveEvent) => {
                            const deltaX = moveEvent.clientX - startX;
                            const newWidth = Math.max(40, startWidth + deltaX);
                            
                            th.style.width = `${newWidth}px`;
                            th.style.minWidth = `${newWidth}px`;
                            
                            // Update colgroup for proper width sync
                            const colEl = colgroup.children[colIndex];
                            if (colEl) {
                                colEl.style.width = `${newWidth}px`;
                            }
                        };
                        
                        const onMouseUp = () => {
                            document.body.style.cursor = '';
                            resizer.classList.remove('is-resizing');
                            document.body.classList.remove('is-resizing-cols');
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                            
                            // Trigger resize callback if provided
                            if (col.onResize) {
                                col.onResize(th.offsetWidth);
                            }
                        };
                        
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                        e.preventDefault();
                        e.stopPropagation();
                    });
                    th.appendChild(resizer);
                } else if (col.locked === true) {
                    // Locked column - add locked resizer visual
                    const resizer = document.createElement('div');
                    resizer.className = 'col-resizer col-resizer--locked';
                    th.appendChild(resizer);
                }
            }
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        wrap.appendChild(table);
        
        const emptyState = document.createElement('tr');
        const emptyTd = document.createElement('td');
        emptyTd.colSpan = options.columns.length;
        emptyTd.style.textAlign = 'center';
        emptyTd.style.padding = '60px 0';
        emptyTd.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-secondary);">
                <span class="material-symbols-outlined" style="font-size: 36px; opacity: 0.5; margin-bottom: 12px;">cloud_off</span>
                <div style="font-size: 13px;">${options.emptyText || 'No data'}</div>
            </div>
        `;
        emptyState.appendChild(emptyTd);
        
        const renderData = (data) => {
            tbody.innerHTML = '';
            table.style.display = '';
            
            if (!data || data.length === 0) {
                tbody.appendChild(emptyState);
                return;
            }
            

            data.forEach((row, index) => {
                const tr = document.createElement('tr');
                if (row.id) tr.dataset.id = row.id;
                
                if (row.status === 'running' || row.status === 'ready') {
                    tr.classList.add('profile-running');
                }
                
                options.columns.forEach((col, colIndex) => {
                    const td = document.createElement('td');
                    const colName = col.id || col.field || 'select';
                    td.className = `data-col-${colName}`;
                    td.dataset.colIndex = colIndex;
                    if (col.align) td.style.textAlign = col.align;
                    
                    if (col.type === 'checkbox') {
                        // Custom checkbox container for row
                        const cbContainer = document.createElement('div');
                        cbContainer.className = 'table-checkbox';
                        
                        if (window.DuckControls && window.DuckControls.Checkbox) {
                            const cbElement = document.createElement('span');
                            cbContainer.appendChild(cbElement);
                            td.appendChild(cbContainer);
                            
                            const checkbox = DuckControls.Checkbox.create(cbElement, {
                                value: row.id,
                                onChange: (e) => {
                                    if (e.checked) tr.classList.add('selected');
                                    else tr.classList.remove('selected');
                                    if (options.onCheckRow) options.onCheckRow({ target: { checked: e.checked } }, row);
                                }
                            });
                            td._duckCheckbox = checkbox;
                        } else {
                            const cb = document.createElement('input');
                            cb.type = 'checkbox';
                            cb.className = 'table-checkbox-native row-check';
                            cb.value = row.id;
                            if (options.onCheckRow) cb.addEventListener('change', (e) => {
                                if (e.target.checked) tr.classList.add('selected');
                                else tr.classList.remove('selected');
                                options.onCheckRow(e, row);
                            });
                            cbContainer.appendChild(cb);
                            td.appendChild(cbContainer);
                        }
                    } else if (col.render) {
                        const content = col.render(row, index);
                        if (typeof content === 'string') {
                            td.innerHTML = content;
                        } else if (content instanceof HTMLElement) {
                            td.appendChild(content);
                        }
                    } else if (col.field) {
                        td.textContent = row[col.field] || '';
                    }
                    tr.appendChild(td);
                });
                
                // Row Context Menu
                if (options.onRowContextMenu) {
                    tr.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        options.onRowContextMenu(e, row, index);
                    });
                }
                
                tbody.appendChild(tr);
            });
        };
        
        if (options.data) renderData(options.data);
        
        return {
            element: wrap,
            renderData,
            table: table,
            tbody: tbody,
            getCheckedValues: () => {
                const checks = [];
                tbody.querySelectorAll('.duck-checkbox').forEach(el => {
                    const cb = el.querySelector('span')?._duckCheckbox || el._duckCheckbox;
                    if (cb && cb.isChecked()) {
                        checks.push(cb.getValue() || el.querySelector('input')?.value);
                    }
                });
                // Fallback to native checkboxes
                if (checks.length === 0) {
                    const nativeChecks = tbody.querySelectorAll('.row-check:checked');
                    return Array.from(nativeChecks).map(cb => cb.value);
                }
                return checks;
            },
            clearChecked: () => {
                // Clear custom checkboxes
                tbody.querySelectorAll('.duck-checkbox').forEach(el => {
                    const cb = el.querySelector('span')?._duckCheckbox || el._duckCheckbox;
                    if (cb) cb.uncheck();
                    const tr = el.closest('tr');
                    if (tr) tr.classList.remove('selected');
                });
                // Clear native checkboxes
                table.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = false;
                    const tr = cb.closest('tr');
                    if (tr) tr.classList.remove('selected');
                });
            },
            getCheckboxControl: (colIndex = 0) => {
                // Get header checkbox control
                const headerTh = trHead.children[colIndex];
                return headerTh?._duckCheckbox;
            }
        };
    }
};
