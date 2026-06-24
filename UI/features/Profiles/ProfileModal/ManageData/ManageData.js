// ManageData.js

(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};

    window.ProfileModals.ManageData = {
        _modal: null,
        _profileId: null,
        _tabsData: [], // e.g. [{ id: 'tab1', name: 'Table 1', format: ['Username', 'Password'], mode: 'list', rows: [{Username: 'admin', Password: '123'}] }]
        
        async show(profileId) {
            this._profileId = profileId;
            
            if (this._modal) {
                this._modal.destroy();
                this._modal = null;
            }

            const modalBody = document.createElement('div');
            modalBody.style.cssText = 'display: flex; flex-direction: column; gap: 16px; height: 100%;'; 

            // Banner removed

            const tabContainer = document.createElement('div');
            tabContainer.style.cssText = 'flex: 1; min-height: 0; display: flex; border: 1px solid var(--border-default); border-radius: var(--r-md); overflow: hidden;';

            this._tabControl = window.DuckControls.TabControl.create({
                allowAdd: true,
                onAdd: () => {
                    this._showTableConfigModal(null, (config) => {
                        const newId = 'tab_' + Date.now();
                        this._tabsData.push({
                            id: newId,
                            name: config.name,
                            format: config.format,
                            mode: 'list',
                            rows: []
                        });
                        this._refreshTabs();
                        this._tabControl.selectTab(newId);
                    });
                },
                onDelete: (id) => this._deleteTab(id)
            });

            tabContainer.appendChild(this._tabControl.element);
            modalBody.appendChild(tabContainer);

            this._refreshTabs();

            this._modal = window.DuckControls.Modal.create({
            defaultEnter: true,
                title: 'Data Resource Manager',
                subtitle: 'Manage and structure data resources associated with this profile.',
                icon: 'database',
                content: modalBody,
                size: 'xl',
                buttons: [
                    { text: 'Close', class: 'duck-btn-surface', onClick: (e, m) => m.close() },
                    { text: 'Save', icon: 'save', class: 'duck-btn-primary', onClick: () => this._saveData() }
                ],
                closeOnOverlay: false,
                onClose: () => { this._modal = null; }
            });

            this._modal.container.style.height = '80vh';
            this._modal.open();

            // Load data
            try {
                this._modal.setLoading(true, 'Loading data...');
                const res = await DuckBridge.call('profile.getResource', { id: profileId });
                let dataStr = res?.resource || res?.data?.resource;
                if (!dataStr) dataStr = '[]';
                this._tabsData = JSON.parse(dataStr);
                if (!Array.isArray(this._tabsData)) this._tabsData = [];
                this._refreshTabs();
            } catch (err) {
                this._tabsData = [];
                this._refreshTabs();
            } finally {
                this._modal.setLoading(false);
            }
        },

        _showTableConfigModal(tabData, onSave) {
            const isEdit = !!tabData;
            const content = document.createElement('div');
            content.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

            const nameInput = window.DuckControls.Input.create({
                label: 'Table Name',
                placeholder: 'e.g. Account Info',
                icon: 'table_chart',
                value: isEdit ? tabData.name : ''
            });

            const formatInput = window.DuckControls.TagInput.create({
                label: 'Data Format',
                placeholder: 'Type format and press Enter',
                icon: 'label',
                values: isEdit ? tabData.format : []
            });

            content.appendChild(nameInput.element);
            content.appendChild(formatInput.element);

            const buttons = [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, m) => m.close() },
                { text: isEdit ? 'Save Changes' : 'Create Table', class: 'duck-btn-primary', onClick: (e, m) => {
                    const name = nameInput.getValue().trim();
                    const format = formatInput.getValues();
                    
                    let hasError = false;
                    if (!name) {
                        nameInput.setError?.('Table name is required');
                        hasError = true;
                    }
                    if (format.length === 0) {
                        formatInput.setError?.('At least one column format is required');
                        hasError = true;
                    }
                    if (hasError) return;
                    
                    onSave({ name, format });
                    m.close();
                }}
            ];

            const cfgModal = window.DuckControls.Modal.create({
            defaultEnter: true,
                title: isEdit ? 'Edit Table Config' : 'Create New Table',
                icon: isEdit ? 'edit' : 'add_box',
                content: content,
                size: 'md',
                buttons: buttons,
                closeOnOverlay: false
            });
            cfgModal.open();
        },

        _deleteTab(id) {
            if (window.DuckControls && window.DuckControls.Modal) {
                window.DuckControls.Modal.confirm('Are you sure you want to delete this table?').then(res => {
                    if (res) {
                        this._tabsData = this._tabsData.filter(t => t.id !== id);
                        this._refreshTabs();
                    }
                });
            }
        },

        _refreshTabs() {
            let emptyState = this._tabControl.element.parentElement.querySelector('.duck-empty-state-manage-data');
            if (this._tabsData.length === 0) {
                if (!emptyState) {
                    emptyState = document.createElement('div');
                    emptyState.className = 'duck-empty-state-manage-data';
                    emptyState.style.cssText = 'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-tertiary);';
                    emptyState.innerHTML = '<span class="material-symbols-outlined" style="font-size: 36px; opacity: 0.5;">database</span><span style="font-size: 14px; font-weight: 500;">No data resources found</span>';
                    
                    const createBtn = document.createElement('button');
                    createBtn.className = 'duck-btn duck-btn-primary';
                    createBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">add</span> Create Data Resource';
                    createBtn.addEventListener('click', () => {
                        this._showTableConfigModal(null, (config) => {
                            const newId = 'tab_' + Date.now();
                            this._tabsData.push({ id: newId, name: config.name, format: config.format, mode: 'list', rows: [] });
                            this._refreshTabs();
                            this._tabControl.selectTab(newId);
                        });
                    });
                    emptyState.appendChild(createBtn);
                    
                    this._tabControl.element.parentElement.appendChild(emptyState);
                }
                this._tabControl.element.style.display = 'none';
            } else {
                if (emptyState) emptyState.remove();
                this._tabControl.element.style.display = '';
            }

            const tabs = this._tabsData.map(tabData => {
                const content = this._createTabContent(tabData);
                return {
                    id: tabData.id,
                    name: tabData.name,
                    canDelete: true,
                    content: content
                };
            });
            this._tabControl.setTabs(tabs);
        },

        _createTabContent(tabData) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex; flex-direction:column; gap:16px; height:100%;';

            // 1. Header (Format Info + Edit Button)
            const headerWrap = document.createElement('div');
            headerWrap.style.cssText = 'display: flex; flex-direction: column; gap: 8px; border-bottom: 1px solid var(--border-default); padding-bottom: 12px;';
            
            const formatTitle = document.createElement('div');
            formatTitle.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;';
            formatTitle.textContent = 'Data Format';
            headerWrap.appendChild(formatTitle);

            const bottomRow = document.createElement('div');
            bottomRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;';

            const badgesWrap = document.createElement('div');
            badgesWrap.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;';
            tabData.format.forEach(f => {
                const b = document.createElement('span');
                b.style.cssText = 'font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 14px; background: color-mix(in srgb, var(--accent) 8%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent); color: var(--accent);';
                b.textContent = f;
                badgesWrap.appendChild(b);
            });

            const rightActions = document.createElement('div');
            rightActions.style.cssText = 'display: flex; align-items: center; gap: 8px; height: 32px;';
            
            const modeSelect = window.DuckControls.ChipSelect.create({
                name: 'mode_' + tabData.id,
                options: [
                    { label: 'List', value: 'list' },
                    { label: 'Raw Text', value: 'raw' }
                ],
                value: tabData.mode,
                onChange: (val) => {
                    if (tabData.mode === 'raw' && val === 'list') {
                        if (tabData._rawBuffer !== undefined) {
                            const lines = tabData._rawBuffer.split('\n').filter(l => l.trim() !== '');
                            tabData.rows = lines.map(line => {
                                const parts = line.split('|');
                                const rowObj = {};
                                tabData.format.forEach((f, i) => {
                                    rowObj[f] = parts[i] || '';
                                });
                                return rowObj;
                            });
                            tabData._rawBuffer = undefined;
                        }
                    }
                    tabData.mode = val;
                    this._renderDataArea(tabData, dataAreaWrap);
                }
            });

            const editBtn = document.createElement('button');
            editBtn.style.height = '32px';
            window.DuckControls.Button.create(editBtn, {
                text: 'Edit',
                icon: 'edit',
                variant: 'surface',
                onClick: () => {
                    this._showTableConfigModal(tabData, (config) => {
                        tabData.name = config.name;
                        tabData.format = config.format;
                        this._refreshTabs(); 
                        this._tabControl.selectTab(tabData.id);
                    });
                }
            });

            rightActions.appendChild(modeSelect.element);
            rightActions.appendChild(editBtn);

            bottomRow.appendChild(badgesWrap);
            bottomRow.appendChild(rightActions);
            headerWrap.appendChild(bottomRow);
            wrap.appendChild(headerWrap);

            // 2. Data Area (List or Raw)
            const dataAreaWrap = document.createElement('div');
            dataAreaWrap.style.cssText = 'flex:1; overflow-y:auto; overflow-x:hidden; min-height:0; border-radius:8px; border: 1px solid var(--border-default); background: var(--bg-subtle); display:flex; flex-direction:column;';
            wrap.appendChild(dataAreaWrap);

            this._renderDataArea(tabData, dataAreaWrap);

            return wrap;
        },

        _renderDataArea(tabData, container) {
            container.innerHTML = '';
            
            const format = tabData.format || [];

            if (tabData.mode === 'list') {
                container.style.padding = '8px';
                container.style.gap = '8px';
                container.style.background = 'var(--bg-subtle)';

                if (format.length === 0) {
                    container.innerHTML = '<div style="color:var(--text-tertiary); text-align:center; padding:20px;">Please define Data Format first.</div>';
                    return;
                }

                // Render rows
                tabData.rows.forEach((row, rowIndex) => {
                    const card = this._createRowCard(tabData, row, rowIndex, format, container);
                    container.appendChild(card);
                });

                // Add row button
                const addRowBtn = document.createElement('button');
                window.DuckControls.Button.create(addRowBtn, {
                    text: 'Add Row',
                    icon: 'add',
                    variant: 'surface',
                    style: { width: '100%', justifyContent: 'center' },
                    onClick: () => {
                        const newRow = {};
                        format.forEach(f => newRow[f] = '');
                        tabData.rows.push(newRow);
                        this._renderDataArea(tabData, container);
                        // scroll to bottom
                        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 10);
                    }
                });
                container.appendChild(addRowBtn);

            } else {
                // Raw mode
                container.style.padding = '0';
                container.style.gap = '0';
                
                // Convert rows to raw text
                let rawText = '';
                if (format.length > 0) {
                    rawText = tabData.rows.map(row => {
                        return format.map(f => row[f] || '').join('|');
                    }).join('\n'); // using real newline
                }

                const textarea = window.DuckControls.Textarea.create({
                icon: 'data_object',
                    placeholder: 'Enter raw data, one record per line. Format: ' + format.join('|'),
                    value: rawText,
                    fullHeight: true,
                    onChange: (val) => {
                        tabData._rawBuffer = val; 
                    }
                });
                
                textarea.textarea.style.fontFamily = 'monospace';
                textarea.textarea.style.height = '100%';
                textarea.textarea.style.border = 'none';
                textarea.textarea.style.borderRadius = '0';
                textarea.element.style.height = '100%';
                textarea.element.style.flex = '1';

                container.appendChild(textarea.element);
            }
        },

        _createRowCard(tabData, row, rowIndex, format, container) {
            const card = document.createElement('div');
            card.style.cssText = 'background: var(--bg-base); border: 1px solid var(--border-default); border-radius: 6px; padding: 10px; display: flex; flex-direction: column; gap: 8px; position: relative;';

            // Header
            const header = document.createElement('div');
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;';
            
            const badge = document.createElement('div');
            badge.style.cssText = 'font-size: 11px; font-weight: 600; color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent); border-radius: 12px; padding: 2px 10px;';
            badge.textContent = 'Row ' + (rowIndex + 1);
            header.appendChild(badge);

            const delBtn = document.createElement('span');
            delBtn.className = 'material-symbols-outlined';
            delBtn.textContent = 'delete';
            delBtn.style.cssText = 'font-size: 18px; color: var(--danger); cursor: pointer; opacity: 0.7; transition: opacity 0.2s;';
            delBtn.onmouseover = () => delBtn.style.opacity = '1';
            delBtn.onmouseout = () => delBtn.style.opacity = '0.7';
            delBtn.addEventListener('click', () => {
                tabData.rows.splice(rowIndex, 1);
                this._renderDataArea(tabData, container);
            });
            header.appendChild(delBtn);

            card.appendChild(header);

            // Inputs
            format.forEach(field => {
                const inputWrap = document.createElement('div');
                const inputCtrl = window.DuckControls.Input.create({
                    label: field,
                    value: row[field] || '',
                    icon: 'edit_document',
                    onInput: () => {
                        row[field] = inputCtrl.getValue();
                    }
                });
                
                const box = inputCtrl.element.querySelector('.search-box');
                if (box) {
                    box.style.height = '32px';
                    box.style.lineHeight = '32px';
                    const innerInput = box.querySelector('input');
                    if (innerInput) innerInput.style.fontSize = '13px';
                }
                
                const lbl = inputCtrl.element.querySelector('.ui-label-sm');
                if(lbl) {
                    lbl.style.color = 'var(--text-tertiary)'; 
                    lbl.style.marginBottom = '2px';
                    lbl.style.fontSize = '10px';
                }
                
                inputWrap.appendChild(inputCtrl.element);
                card.appendChild(inputWrap);
            });

            return card;
        },

        async _saveData() {
            // First, sync any raw text back to rows
            this._tabsData.forEach(tab => {
                if (tab.mode === 'raw' && tab._rawBuffer !== undefined) {
                    const lines = tab._rawBuffer.split('\n').filter(l => l.trim() !== '');
                    const newRows = lines.map(line => {
                        const parts = line.split('|');
                        const rowObj = {};
                        tab.format.forEach((f, i) => {
                            rowObj[f] = parts[i] || '';
                        });
                        return rowObj;
                    });
                    tab.rows = newRows;
                }
            });

            if (this._modal) {
                this._modal.setLoading(true, 'Saving...');
            }

            try {
                const resourceStr = JSON.stringify(this._tabsData);
                await DuckBridge.call('profile.updateResource', { id: this._profileId, resource: resourceStr });
                if (this._modal) {
                    this._modal.setLoading(false);
                    this._modal.close();
                }
            } catch (err) {
                if (this._modal) {
                    this._modal.setLoading(false);
                }
                const msg = err?.message || String(err);
                console.error('[ManageData] Save failed:', msg);
                window.DuckControls.Toast?.error?.('Save Failed', msg);
            }
        }
    };
})();


