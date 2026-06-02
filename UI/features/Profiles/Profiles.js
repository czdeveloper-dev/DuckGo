// Profiles View - Using existing DuckControls properly

(function() {
    'use strict';

    const VIEW = {
        _initialized: false,
        _selectedIds: new Set(),
        _filters: { search: '', id: '', group: '', tag: '', status: '' },
        _profilesData: [],
        _visibleCols: new Set(['seq', 'name', 'resource', 'group', 'tags', 'proxy', 'note', 'status', 'message', 'created', 'lastopened', 'action']),

        async onShow() {
            if (!this._initialized) {
                this._loadColPreferences();
                this.initUI();
                this._initialized = true;
            }
            await this.loadProfiles();
        },

        _loadColPreferences() {
            const saved = localStorage.getItem('duck_profile_visible_cols');
            if (saved) {
                try {
                    const arr = JSON.parse(saved);
                    if (Array.isArray(arr)) {
                        this._visibleCols = new Set(arr);
                    }
                } catch(e){}
            }
        },

        initUI() {
            // Manually init header buttons (data-btn-options elements are NOT auto-init by initAll, which only targets [data-btn])
            const refreshEl = document.getElementById('ctrl-refresh');
            if (refreshEl) {
                this._refreshBtn = DuckControls.Button.create(refreshEl, {
                    variant: 'surface',
                    icon: 'refresh',
                    onClick: () => {
                        if (this._refreshBtn) this._refreshBtn.setSpinning(true);
                        this.loadProfiles().finally(() => {
                            if (this._refreshBtn) this._refreshBtn.setSpinning(false);
                        });
                    }
                });
            }

            const colsEl = document.getElementById('ctrl-cols');
            if (colsEl) {
                this._colsBtn = DuckControls.Button.create(colsEl, {
                    variant: 'surface',
                    icon: 'view_column',
                    onClick: () => {
                        if (window.ProfileModals && window.ProfileModals.CustomizeColumn) {
                            window.ProfileModals.CustomizeColumn.show(this._visibleCols, () => {
                                // Use CSS hide/show instead of rebuilding the table
                                if (this._table) {
                                    this._table.updateColumnVisibility(this._visibleCols);
                                }
                            });
                        }
                    }
                });
            }

            const createEl = document.getElementById('ctrl-create');
            if (createEl) {
                this._createBtn = DuckControls.Button.create(createEl, {
                    variant: 'primary',
                    icon: 'add',
                    text: 'Create Profile',
                    onClick: () => this._openModal(null)
                });
            }

            this._initSearchControls();
            this._initSelectControls();
            this._initActionChips();
            this._initBulkActions();
            this._buildTable();
        },

        _initColModal() {
            const modalBody = document.createElement('div');
            const checkboxesEl = document.createElement('div');
            checkboxesEl.id = 'col-visibility-checkboxes';
            modalBody.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
            modalBody.appendChild(checkboxesEl);

            this._colModal = DuckControls.Modal.create({
                title: 'Customize Columns',
                content: modalBody,
                size: 'sm',
                closeOnOverlay: true
            });
            this._buildColVisibilityCheckboxes();
        },

        _initSearchControls() {
            // Search by Name - Using DuckControls.Input
            const searchContainer = document.getElementById('ctrl-search');
            if (searchContainer) {
                this._searchCtrl = DuckControls.Input.create({
                    label: 'SEARCH',
                    placeholder: 'Search by Name...',
                    icon: 'search',
                    width: '200px',
                    bgVariant: 'subtle',
                    onInput: (e) => {
                        this._filters.search = e.target.value;
                        this.loadProfiles();
                    }
                });
                searchContainer.appendChild(this._searchCtrl.element);
            }

            // Search by ID - Using DuckControls.Input
            const idContainer = document.getElementById('ctrl-id');
            if (idContainer) {
                this._idCtrl = DuckControls.Input.create({
                    label: 'ID',
                    placeholder: '1,2,3 or 1-5',
                    icon: 'tag',
                    width: '140px',
                    bgVariant: 'subtle',
                    onInput: (e) => {
                        this._filters.id = e.target.value;
                        this.loadProfiles();
                    }
                });
                idContainer.appendChild(this._idCtrl.element);
            }
        },

        _initSelectControls() {
            // Group Select - Using DuckControls.Select
            const groupContainer = document.getElementById('ctrl-group');
            if (groupContainer) {
                this._groupCtrl = DuckControls.Select.create({
                    label: 'GROUP',
                    placeholder: 'All Groups',
                    width: '180px',
                    bgVariant: 'subtle',
                    action: {
                        text: '+ Create',
                        onClick: () => this._createGroup()
                    },
                    options: [],
                    onChange: (e) => {
                        this._filters.group = e.target.value;
                        this.loadProfiles();
                    }
                });
                groupContainer.appendChild(this._groupCtrl.element);
            }

            // Tag Select - Using DuckControls.Select
            const tagContainer = document.getElementById('ctrl-tag');
            if (tagContainer) {
                this._tagCtrl = DuckControls.Select.create({
                    label: 'TAG',
                    placeholder: 'All Tags',
                    width: '180px',
                    bgVariant: 'subtle',
                    action: {
                        text: '+ Create',
                        onClick: () => this._createTag()
                    },
                    options: [],
                    onChange: (e) => {
                        this._filters.tag = e.target.value;
                        this.loadProfiles();
                    }
                });
                tagContainer.appendChild(this._tagCtrl.element);
            }

            // Status Select - Using DuckControls.Select
            const statusContainer = document.getElementById('ctrl-status');
            if (statusContainer) {
                this._statusCtrl = DuckControls.Select.create({
                    label: 'STATUS',
                    placeholder: 'All',
                    width: '120px',
                    bgVariant: 'subtle',
                    options: [
                        { label: 'All', value: '' },
                        { label: 'Ready', value: 'ready' },
                        { label: 'Running', value: 'running' },
                        { label: 'Stopped', value: 'stopped' }
                    ],
                    onChange: (e) => {
                        this._filters.status = e.target.value;
                        this.loadProfiles();
                    }
                });
                statusContainer.appendChild(this._statusCtrl.element);
            }

            // Stat Panel - Custom align to match other filters
            const statContainer = document.getElementById('ctrl-stat');
            if (statContainer) {
                const wrap = document.createElement('div');
                wrap.className = 'filter-stacked';
                
                const head = document.createElement('div');
                head.className = 'filter-stacked-head';
                const label = document.createElement('span');
                label.className = 'ui-label-sm';
                label.textContent = 'TOTAL PROFILES';
                head.appendChild(label);
                wrap.appendChild(head);
                
                this._statEl = document.createElement('div');
                this._statEl.className = 'input-field-sm bg-subtle';
                this._statEl.style.display = 'flex';
                this._statEl.style.alignItems = 'center';
                this._statEl.style.justifyContent = 'center';
                this._statEl.style.width = '100%';
                this._statEl.style.minWidth = '80px';
                this._statEl.style.boxSizing = 'border-box';
                this._statEl.style.cursor = 'default';
                this._statEl.id = 'stat-total-profiles';
                this._statEl.textContent = '0';
                
                wrap.appendChild(this._statEl);
                statContainer.appendChild(wrap);
            }
        },

        _initActionChips() {
            const chipsContainer = document.getElementById('ctrl-chips');
            if (!chipsContainer) return;

            // Automation Button
            const automationEl = document.createElement('button');
            automationEl.type = 'button';
            chipsContainer.appendChild(automationEl);
            DuckControls.Button.create(automationEl, {
                variant: 'chip',
                icon: 'account_tree',
                text: 'Automation',
                onClick: () => console.log('Automation clicked')
            });

            // Proxy Button (with ContextMenu dropdown)
            const proxyEl = document.createElement('button');
            proxyEl.type = 'button';
            chipsContainer.appendChild(proxyEl);
            DuckControls.Button.create(proxyEl, {
                variant: 'chip',
                icon: 'dns',
                text: 'Proxy',
                dropdownArrow: true,
                onClick: () => {}
            });
            DuckControls.ContextMenu.create(proxyEl, {
                items: [
                    { label: 'Check Proxy', icon: 'wifi_tethering', onClick: () => console.log('Check proxy') },
                    { label: 'Import Proxy', icon: 'upload', onClick: () => console.log('Import proxy') },
                    { label: 'Copy Proxy', icon: 'content_copy', onClick: () => console.log('Copy proxy') },
                    'divider',
                    { label: 'Remove Proxy', icon: 'link_off', danger: true, onClick: () => console.log('Remove proxy') }
                ]
            });

            // Sync Actions Button
            const syncEl = document.createElement('button');
            syncEl.type = 'button';
            chipsContainer.appendChild(syncEl);
            DuckControls.Button.create(syncEl, {
                variant: 'chip',
                icon: 'sync',
                text: 'Sync Actions',
                onClick: () => console.log('Sync Actions clicked')
            });

            // Actions Button (with ContextMenu dropdown)
            const actionsEl = document.createElement('button');
            actionsEl.type = 'button';
            chipsContainer.appendChild(actionsEl);
            DuckControls.Button.create(actionsEl, {
                variant: 'chip',
                icon: 'bolt',
                text: 'Actions',
                dropdownArrow: true,
                onClick: () => {}
            });
            DuckControls.ContextMenu.create(actionsEl, {
                items: [
                    { label: 'Import Profiles', icon: 'publish', onClick: () => {
                        if (window.ProfileModals && window.ProfileModals.ImportProfiles) {
                            window.ProfileModals.ImportProfiles.show(this._selectedIds);
                        }
                    }},
                    { label: 'Export Profiles', icon: 'download', onClick: () => {
                        if (window.ProfileModals && window.ProfileModals.ExportProfiles) {
                            window.ProfileModals.ExportProfiles.show(this._selectedIds);
                        }
                    }},
                    { label: 'Compare Profiles', icon: 'compare_arrows', onClick: () => {
                        if (window.ProfileModals && window.ProfileModals.CompareProfiles) {
                            window.ProfileModals.CompareProfiles.show(this._profilesData, this._selectedIds);
                        }
                    }},
                    'divider',
                    { label: 'Delete Selected', icon: 'delete_sweep', danger: true, onClick: () => console.log('Delete selected') }
                ]
            });

            // Browser Config Button (with ContextMenu dropdown)
            const browserEl = document.createElement('button');
            browserEl.type = 'button';
            chipsContainer.appendChild(browserEl);
            DuckControls.Button.create(browserEl, {
                variant: 'chip',
                icon: 'build',
                text: 'Browser Config',
                dropdownArrow: true,
                onClick: () => {}
            });
            DuckControls.ContextMenu.create(browserEl, {
                items: [
                    { type: 'label', label: 'Bulk Operations' },
                    { label: 'Clear Cache', icon: 'cleaning_services', onClick: () => {
                        if (window.ProfileModals && window.ProfileModals.ClearCache) {
                            window.ProfileModals.ClearCache.show(this._selectedIds);
                        }
                    } },
                    { label: 'Set Browser Version', icon: 'manage_history', onClick: () => {
                        if (window.ProfileModals && window.ProfileModals.SetBrowserVersion) {
                            window.ProfileModals.SetBrowserVersion.show(this._selectedIds);
                        }
                    } },
                    { label: 'New Fingerprint', icon: 'casino', onClick: () => {
                        if (window.ProfileModals && window.ProfileModals.NewFingerprint) {
                            window.ProfileModals.NewFingerprint.show(this._selectedIds);
                        }
                    } },
                    { label: 'Change Location', icon: 'location_on', onClick: () => {
                        if (window.ProfileModals && window.ProfileModals.ChangeLocation) {
                            window.ProfileModals.ChangeLocation.show(this._selectedIds);
                        }
                    } },
                    { label: 'Change Bookmarks', icon: 'bookmark_add', onClick: () => {
                        if (window.ProfileModals && window.ProfileModals.ChangeBookmark) {
                            window.ProfileModals.ChangeBookmark.show(this._selectedIds);
                        }
                    } },
                    { label: 'Update Start URL', icon: 'link', onClick: () => {
                        if (window.ProfileModals && window.ProfileModals.UpdateStartUrl) {
                            window.ProfileModals.UpdateStartUrl.show(this._selectedIds);
                        }
                    }}
                ]
            });

            // Arrange Button
            const arrangeEl = document.createElement('button');
            arrangeEl.type = 'button';
            chipsContainer.appendChild(arrangeEl);
            DuckControls.Button.create(arrangeEl, {
                variant: 'chip',
                icon: 'grid_view',
                text: 'Arrange',
                onClick: () => console.log('Arrange clicked')
            });
        },

        _initBulkActions() {
            // Launch Button
            const launchContainer = document.getElementById('ctrl-bulk-launch');
            if (launchContainer) {
                this._bulkLaunchBtn = DuckControls.Button.create(launchContainer, {
                    variant: 'secondary', size: 'sm',
                    icon: 'play_arrow', text: 'Run Profile',
                    onClick: () => this._bulkLaunch()
                });
            }

            // Stop Button
            const stopContainer = document.getElementById('ctrl-bulk-stop');
            if (stopContainer) {
                this._bulkStopBtn = DuckControls.Button.create(stopContainer, {
                    variant: 'secondary', size: 'sm',
                    icon: 'stop_circle', text: 'Stop Profile',
                    onClick: () => this._bulkStop()
                });
            }

            // Rename Button
            const renameContainer = document.getElementById('ctrl-bulk-rename');
            if (renameContainer) {
                this._bulkRenameBtn = DuckControls.Button.create(renameContainer, {
                    variant: 'secondary', size: 'sm',
                    icon: 'drive_file_rename_outline', text: 'Bulk Rename',
                    onClick: () => this._bulkRename()
                });
            }

            // Delete Button
            const deleteContainer = document.getElementById('ctrl-bulk-delete');
            if (deleteContainer) {
                this._bulkDeleteBtn = DuckControls.Button.create(deleteContainer, {
                    variant: 'danger', size: 'sm',
                    icon: 'delete', text: 'Delete Profile',
                    onClick: () => this._bulkDelete()
                });
            }

            // Close (Cancel Selection) Button
            const closeContainer = document.getElementById('ctrl-bulk-close');
            if (closeContainer) {
                this._bulkCloseBtn = DuckControls.Button.create(closeContainer, {
                    variant: 'ghost', size: 'sm',
                    icon: 'close',
                    onClick: () => {
                        this._table.clearChecked();
                        this._selectedIds.clear();
                        this._updateBulkActions();
                    }
                });
            }
        },

        _buildTable() {
            // Destroy old table (cleanup ResizeObserver)
            if (this._table && typeof this._table.destroy === 'function') {
                this._table.destroy();
            }
            const card = document.querySelector('.table-card--profiles');
            const existingWrap = card?.querySelector('.data-table-wrap');
            if (existingWrap) existingWrap.remove();

            const _this = this;

            const cols = [
                {
                    id: 'select', type: 'checkbox', title: 'Select all',
                    locked: true, lockedPosition: 'left', resizable: false, width: '52px',
                    onCheckAll: (e) => { _this._handleCheckAll(e); }
                },
                {
                    // # - autoSize based on record count, locked left, no resize, center aligned
                    id: 'seq', label: '#', width: '3ch', minWidth: '3ch', maxWidth: '5ch',
                    locked: true, lockedPosition: 'left', resizable: false, autoSize: true, align: 'center',
                    render: (row) => { const el = document.createElement('span'); el.textContent = row.seq; return el; }
                },
                {
                    // NAME - max 30ch, no resize, locked left, double-click edit
                    id: 'name', label: 'NAME', width: '30ch', maxWidth: '30ch',
                    locked: true, lockedPosition: 'left', resizable: false,
                    render: (row) => _this._renderNameCell(row)
                },
                {
                    // RESOURCE - auto-sizes to longest record, seed 8ch, no resize, capped at 14ch
                    id: 'resource', label: 'RESOURCE', width: '8ch', minWidth: '8ch', maxWidth: '14ch',
                    resizable: false, autoSize: true, field: 'browserType',
                    render: (row) => _this._renderResourceCell(row)
                },
                {
                    // GROUP - default 20ch, min 20ch, max 30ch
                    id: 'group', label: 'GROUP', width: '20ch', minWidth: '20ch', maxWidth: '30ch',
                    render: (row) => _this._renderGroupCell(row)
                },
                {
                    // TAGS - default 20ch, min 20ch, max 30ch
                    id: 'tags', label: 'TAGS', width: '20ch', minWidth: '20ch', maxWidth: '30ch',
                    render: (row) => _this._renderTagsCell(row)
                },
                {
                    // PROXY - custom panel+eye, default 30ch, min 30ch, max 35ch
                    id: 'proxy', label: 'PROXY', width: '30ch', minWidth: '30ch', maxWidth: '35ch',
                    render: (row) => _this._renderProxyCell(row)
                },
                {
                    // STATUS - default 15ch, auto-sizes to longest record, no resize, pill badge, capped at 18ch
                    id: 'status', label: 'STATUS', width: '15ch', minWidth: '15ch', maxWidth: '18ch',
                    resizable: false, autoSize: true,
                    render: (row) => _this._renderStatusBadge(row)
                },
                {
                    // MESSAGE - default 35ch, min 35ch, max 50ch
                    id: 'message', label: 'MESSAGE', width: '35ch', minWidth: '35ch', maxWidth: '50ch',
                    render: (row) => _this._renderMessageCell(row)
                },
                {
                    // NOTE - default 30ch, min 30ch, max 40ch, double-click edit
                    id: 'note', label: 'NOTE', width: '30ch', minWidth: '30ch', maxWidth: '40ch',
                    render: (row) => _this._renderNoteCell(row)
                },
                {
                    // CREATED TIME - fixed 25ch, no resize (same size as Last Opened)
                    id: 'created', label: 'CREATED TIME', width: '25ch', minWidth: '25ch',
                    resizable: false,
                    render: (row) => _this._renderDateCell(row.createdAt)
                },
                {
                    // LAST OPENED - fixed 25ch, no resize (same size as Created Time)
                    id: 'lastopened', label: 'LAST OPENED', width: '25ch', minWidth: '25ch',
                    resizable: false,
                    render: (row) => _this._renderDateCell(row.lastOpened)
                },
                { id: 'filler', width: 'auto' },
                {
                    // CONTROL - locked right, shadow on left edge
                    id: 'action', label: 'CONTROL', width: '130px',
                    locked: true, lockedPosition: 'right', resizable: false,
                    render: (row) => _this._renderActionCell(row)
                }
            ].filter(c =>
                // All columns are always built; visibility is managed via CSS (updateColumnVisibility)
                c.id !== undefined || c.field !== undefined
            );

            // No filler column needed: table width: 100% fills the container.
            // The browser distributes any remaining space to columns without explicit <col> width.
            // We intentionally leave no column unspecified — Table.js handles min-width on container
            // so sticky-right (CONTROL) always sits at the visual right edge.

            const tableContainer = document.getElementById('table-profiles-container');
            this._table = DuckControls.Table.create({
                container: tableContainer,
                id: 'duck-table-profiles',
                emptyText: 'No profiles found',
                onCheckRow: (e, row) => {
                    if (e.checked) _this._selectedIds.add(row.id);
                    else _this._selectedIds.delete(row.id);
                    _this._updateBulkActions();
                },
                onRowContextMenu: (e, row, index) => {
                    if (_this._showRowContextMenu) _this._showRowContextMenu(e, row);
                },
                columns: cols
            });

            if (card) {
                card.style.cssText = 'flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;';
                card.appendChild(this._table.element);
            }
            // Apply initial column visibility via CSS (hides optional columns not in _visibleCols)
            this._table.updateColumnVisibility(this._visibleCols);
        },

        _loadTableData(profiles) {
            if (this._table) this._table.renderData(profiles);
        },

        // ── Cell renderers ─────────────────────────────────────────

        _renderNameCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:100%;';
            
            const nameContainer = document.createElement('div');
            nameContainer.style.cssText = 'display:flex;align-items:center;';

            const label = document.createElement('span');
            label.style.cssText = 'font-weight:500;font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:text;';
            label.textContent = (row.name && row.name.trim() !== '') ? this._escapeHtml(row.name) : '-';

            const input = document.createElement('input');
            input.type = 'text';
            input.value = row.name;
            input.style.cssText = 'display:none;font-weight:500;font-size:13px;width:100%;border:1px solid var(--accent);border-radius:4px;padding:2px 4px;background:var(--bg-base);color:var(--text-primary);outline:none;';
            
            label.addEventListener('dblclick', () => {
                label.style.display = 'none';
                input.style.display = 'block';
                input.focus();
            });
            
            const finishEdit = () => {
                input.style.display = 'none';
                label.style.display = 'block';
                if (input.value !== row.name) {
                    row.name = input.value;
                    label.textContent = (row.name && row.name.trim() !== '') ? this._escapeHtml(row.name) : '-';
                }
            };
            
            input.addEventListener('blur', finishEdit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishEdit();
                if (e.key === 'Escape') {
                    input.value = row.name;
                    finishEdit();
                }
            });

            nameContainer.appendChild(label);
            nameContainer.appendChild(input);

            // Prevent row selection when clicking on the name area
            nameContainer.addEventListener('click', (e) => e.stopPropagation());

            wrap.appendChild(nameContainer);
            return wrap;
        },

        _renderResourceCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;';
            const btn = document.createElement('button');
            DuckControls.Button.create(btn, {
                text: 'Data',
                icon: 'category',
                variant: 'secondary',
                size: 'sm',
                onClick: (e) => {
                    e.stopPropagation();
                    if (window.DuckApp && window.DuckApp.showView) window.DuckApp.showView('resourceManager', { profileId: row.id });
                }
            });
            wrap.appendChild(btn);
            return wrap;
        },

        _renderGroupCell(row) {
            const el = document.createElement('span');
            el.style.cssText = 'color:var(--text-primary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;width:100%;';
            el.textContent = row.groupName || '-';
            return el;
        },

        _renderTagsCell(row) {
            const tags = Array.isArray(row.tags) ? row.tags : [];
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-wrap:nowrap;gap:4px;overflow:hidden;align-items:center;width:100%;';
            
            if (tags.length === 0) {
                const empty = document.createElement('span');
                empty.style.cssText = 'color:var(--text-primary);font-size:12px;';
                empty.textContent = '-';
                wrap.appendChild(empty);
                return wrap;
            }
            
            const MAX_TAGS = 3;
            const visibleTags = tags.slice(0, MAX_TAGS);
            const hasMore = tags.length > MAX_TAGS;
            
            visibleTags.forEach(t => {
                const el = document.createElement('span');
                el.style.cssText = 'flex-shrink:0;';
                DuckControls.Badge.create(el, { text: this._escapeHtml(t) });
                el.classList.add('duck-badge-info'); // "cho tôi badge cho nó đẹp tí đi"
                wrap.appendChild(el);
            });
            
            if (hasMore) {
                const el = document.createElement('span');
                el.style.cssText = 'color:var(--text-tertiary);font-weight:700;font-size:12px;letter-spacing:1px;padding-left:2px;';
                el.textContent = '...';
                wrap.appendChild(el);
            }
            
            return wrap;
        },

        _renderProxyCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;';
            
            const proxyString = row.proxy || 'Direct';
            
            if (proxyString === 'Direct') {
                wrap.textContent = '-';
                return wrap;
            }

            const panel = document.createElement('div');
            panel.className = 'proxy-panel';
            panel.style.cssText = 'flex:1;min-width:0;display:flex;align-items:center;background:var(--bg-surface);border:1px solid var(--border-default);border-radius:6px;padding:4px 8px;transition:border-color 0.2s;';
            
            const textEl = document.createElement('span');
            textEl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-primary);width:100%;';
            textEl.textContent = '********';
            panel.appendChild(textEl);
            
            panel.addEventListener('click', (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(proxyString);
                panel.style.borderColor = 'var(--success)';
                setTimeout(() => panel.style.borderColor = 'var(--border-default)', 300);
            });
            wrap.appendChild(panel);
            
            // Tooltip for copy action
            if (window.DuckControls && window.DuckControls.Tooltip) {
                DuckControls.Tooltip.create(panel, { text: 'Click to copy proxy' });
            }
            
            let isHidden = true;
            const btnEye = document.createElement('button');
            DuckControls.Button.create(btnEye, {
                icon: 'visibility',
                variant: 'secondary',
                size: 'sm'
            });
            btnEye.style.flexShrink = '0';
            btnEye.style.borderRadius = '6px';
            
            btnEye.onclick = (e) => {
                e.stopPropagation();
                isHidden = !isHidden;
                textEl.textContent = isHidden ? '********' : proxyString;
                btnEye.innerHTML = `<span class="material-symbols-outlined duck-btn-icon">${isHidden ? 'visibility' : 'visibility_off'}</span>`;
            };
            wrap.appendChild(btnEye);
            
            return wrap;
        },

        _renderNoteCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:100%;display:flex;align-items:center;';
            
            const label = document.createElement('span');
            label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:text;width:100%;color:var(--text-tertiary);font-size:12px;';
            label.textContent = this._escapeHtml(row.notes || '-');

            const input = document.createElement('input');
            input.type = 'text';
            input.value = row.notes || '';
            input.style.cssText = 'display:none;width:100%;border:1px solid var(--accent);border-radius:4px;padding:2px 4px;background:var(--bg-base);color:var(--text-primary);outline:none;font-size:12px;';
            
            label.addEventListener('dblclick', () => {
                label.style.display = 'none';
                input.style.display = 'block';
                input.focus();
            });
            
            const finishEdit = () => {
                input.style.display = 'none';
                label.style.display = 'block';
                if (input.value !== (row.notes || '')) {
                    row.notes = input.value;
                    label.textContent = this._escapeHtml(row.notes || '-');
                }
            };
            
            input.addEventListener('blur', finishEdit);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishEdit();
                if (e.key === 'Escape') {
                    input.value = row.notes || '';
                    finishEdit();
                }
            });

            wrap.appendChild(label);
            wrap.appendChild(input);
            return wrap;
        },

        _renderMessageCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:100%;display:flex;align-items:center;gap:4px;';
            
            const msgStr = row.message && row.message !== '-' ? row.message : '';
            
            if (msgStr) {
                const btnCopy = document.createElement('button');
                btnCopy.style.cssText = 'flex-shrink:0;background:none;border:none;cursor:pointer;padding:0 2px;color:var(--text-muted);line-height:1;display:flex;align-items:center;';
                btnCopy.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px;">content_copy</span>';
                btnCopy.onclick = (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(msgStr);
                };
                
                if (window.DuckControls && window.DuckControls.Tooltip) {
                    DuckControls.Tooltip.create(btnCopy, { text: 'Copy message' });
                }
                
                wrap.appendChild(btnCopy);
            }
            
            const label = document.createElement('span');
            label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;color:var(--text-tertiary);font-size:12px;';
            label.textContent = this._escapeHtml(row.message || '-');
            wrap.appendChild(label);
            
            return wrap;
        },

        _renderStatusBadge(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;';
            
            const status = (row.status || 'stopped').toLowerCase();
            const statusText = status.charAt(0).toUpperCase() + status.slice(1);
            
            const pill = document.createElement('span');
            pill.style.cssText = 'display:inline-block;width:14px;height:6px;border-radius:3px;margin-right:6px;';
            
            if (status === 'running') {
                pill.style.background = '#10b981';
            } else if (status === 'ready') {
                pill.style.background = '#3b82f6';
            } else {
                pill.style.background = '#ef4444'; // Error or stopped
            }
            
            const text = document.createElement('span');
            text.style.cssText = 'font-size:12px;font-weight:500;';
            text.textContent = statusText;
            
            wrap.appendChild(pill);
            wrap.appendChild(text);
            return wrap;
        },

        _renderDateCell(value) {
            const el = document.createElement('span');
            el.style.cssText = 'font-size:12px;';
            el.textContent = this._formatDate(value);
            return el;
        },

        _renderActionCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;gap:2px;justify-content:flex-end;';

            // Start/Stop
            const isRunning = row.status === 'running';
            const btnPlay = document.createElement('button');
            DuckControls.Button.create(btnPlay, {
                icon: isRunning ? 'stop' : 'play_arrow',
                text: isRunning ? 'Stop' : 'Run',
                variant: isRunning ? 'danger' : 'success',
                size: 'sm'
            });
            btnPlay.style.width = '70px';
            btnPlay.style.justifyContent = 'center';
            btnPlay.onclick = (e) => {
                e.stopPropagation();
                if (isRunning) this._stopProfile(row.id);
                else this._startProfile(row.id);
            };
            if (window.DuckControls && window.DuckControls.Tooltip) {
                DuckControls.Tooltip.create(btnPlay, { text: isRunning ? 'Stop Profile' : 'Start Profile' });
            }
            
            // Settings
            const btnGear = document.createElement('button');
            DuckControls.Button.create(btnGear, {
                icon: 'settings',
                variant: 'ghost',
                size: 'sm'
            });
            btnGear.classList.add('duck-btn-icon-only');
            btnGear.onclick = (e) => {
                e.stopPropagation();
                this._openModal(row.id);
            };
            if (window.DuckControls && window.DuckControls.Tooltip) {
                DuckControls.Tooltip.create(btnGear, { text: 'Edit Profile' });
            }
            
            // 3-dots ContextMenu
            const btnMore = document.createElement('button');
            DuckControls.Button.create(btnMore, {
                icon: 'more_vert',
                variant: 'ghost',
                size: 'sm'
            });
            btnMore.classList.add('duck-btn-icon-only');
            btnMore.onclick = (e) => e.stopPropagation();
            if (window.DuckControls && window.DuckControls.Tooltip) {
                DuckControls.Tooltip.create(btnMore, { text: 'More Actions' });
            }
            
            if (window.DuckControls && window.DuckControls.ContextMenu) {
                window.DuckControls.ContextMenu.create(btnMore, {
                    items: [
                        { type: 'label', label: 'Profile Actions' },
                        { label: 'Start Profile', icon: 'play_arrow', onClick: () => this._startProfile(row.id) },
                        { label: 'Stop Profile', icon: 'stop_circle', onClick: () => this._stopProfile(row.id) },
                        'divider',
                        { label: 'Check Proxy', icon: 'dns', onClick: () => {} },
                        { label: 'Manage Cookies', icon: 'cookie', onClick: () => {} },
                        { label: 'Set Browser Version', icon: 'laptop', onClick: () => {} },
                        'divider',
                        { label: 'Detect Screen', icon: 'monitor', onClick: () => {} },
                        { label: 'Duplicate', icon: 'content_copy', onClick: () => {} },
                        { label: 'Delete Profile', icon: 'delete', danger: true, onClick: () => this._deleteProfile(row.id) }
                    ]
                });
            }
            
            wrap.appendChild(btnPlay);
            wrap.appendChild(btnGear);
            wrap.appendChild(btnMore);
            return wrap;
        },

        _handleCheckAll(e) {
            if (e.checked) {
                this._profilesData.forEach(p => this._selectedIds.add(p.id));
            } else {
                this._selectedIds.clear();
            }
            this._updateBulkActions();
        },

        _updateBulkActions() {
            const bulkBar = document.getElementById('bulk-actions');
            const bulkCount = document.getElementById('bulk-count');
            if (bulkBar && bulkCount) {
                if (this._selectedIds.size > 0) {
                    bulkBar.classList.add('visible');
                    bulkCount.textContent = `${this._selectedIds.size} selected`;
                } else {
                    bulkBar.classList.remove('visible');
                }
            }
        },

        async loadProfiles() {
            let items = [];
            try {
                const resp = await _duckBridge.call('profile.list', this._filters);
                if (resp && resp.success !== false) {
                    items = resp.items || resp.data || [];
                }
            } catch (err) {
                console.warn('Bridge unavailable, using mock data:', err);
            }

            // --- MOCK DATA FOR TESTING (remove when backend is ready) ---
            if (!Array.isArray(items) || items.length === 0) {
                items = [
                    { id: 101, name: 'Google Account Farm - 01', GroupName: 'Farm Google', tagNames: ['farm', 'google'], proxy: '192.168.1.1:8080', notes: 'Main seed account', status: 'ready', browserType: 'Chrome/Win', CreatedAt: new Date(Date.now() - 86400000 * 2).toISOString(), LastOpened: new Date(Date.now() - 3600000).toISOString() },
                    { id: 102, name: 'Facebook Ads Manager - 02', GroupName: 'Ads Facebook', tagNames: ['ads', 'fb'], proxy: '10.0.0.5:3128', notes: 'BM verified', status: 'running', browserType: 'Firefox/Mac', CreatedAt: new Date(Date.now() - 86400000 * 5).toISOString(), LastOpened: new Date(Date.now() - 7200000).toISOString() },
                    { id: 103, name: 'TikTok Creator - 03', GroupName: 'TikTok', tagNames: ['tiktok'], proxy: 'Direct', notes: 'Requires US proxy', status: 'stopped', browserType: 'Edge/Win', CreatedAt: new Date(Date.now() - 86400000 * 10).toISOString(), LastOpened: null },
                ];
            }
            // -------------------------------------------------------------

            items = items.map((p, idx) => ({
                ...p,
                id: p.Id ?? p.id ?? 0,
                seq: idx + 1,
                name: p.Name ?? p.name ?? 'Unknown',
                groupName: p.GroupName ?? p.Group?.Name ?? p.group ?? '',
                tags: p.TagNames ?? p.tagNames ?? (p.Tags ? p.Tags.split(',') : []),
                proxyName: p.ProxyId ?? p.proxyId ?? p.proxy ?? 'Direct',
                notes: p.Notes ?? p.notes ?? '',
                status: p.Status ?? p.status ?? 'stopped',
                message: p.Message ?? p.message ?? '-',
                createdAt: p.CreatedAt ?? p.createdAt,
                lastOpened: p.LastOpened ?? p.lastOpened,
                browserType: p.BrowserType ?? p.browserType ?? 'Chromium'
            }));

            this._profilesData = items;
            this._loadTableData(items);
            this._updateStats(items);
        },

        _updateStats(profiles) {
            if (this._statEl) {
                this._statEl.textContent = `${profiles.length}`;
            }
        },

        async _startProfile(id) {
            try {
                await _duckBridge.call('profile.start', { id });
                await this.loadProfiles();
            } catch (e) {
                console.error('Failed to start profile:', e);
            }
        },

        async _stopProfile(id) {
            try {
                await _duckBridge.call('profile.stop', { id });
                await this.loadProfiles();
            } catch (e) {
                console.error('Failed to stop profile:', e);
            }
        },

        async _deleteProfile(id) {
            if (!confirm('Delete this profile?')) return;
            try {
                await _duckBridge.call('profile.delete', { id });
                this._selectedIds.delete(id);
                await this.loadProfiles();
            } catch (e) {
                console.error('Failed to delete profile:', e);
            }
        },

        _openModal(profileId) {
            console.log('[Profiles] Open modal for profile:', profileId);
        },

        _createGroup() {
            console.log('Create group clicked');
        },

        _createTag() {
            console.log('Create tag clicked');
        },

        _bulkLaunch() {
            console.log('Bulk launch:', [...this._selectedIds]);
        },

        _bulkStop() {
            console.log('Bulk stop:', [...this._selectedIds]);
        },

        _bulkRename() {
            console.log('Bulk rename:', [...this._selectedIds]);
        },

        _bulkHealth() {
            console.log('Bulk health check:', [...this._selectedIds]);
        },

        _bulkDelete() {
            if (this._selectedIds.size === 0) return;
            if (!confirm(`Delete ${this._selectedIds.size} selected profiles?`)) return;
            console.log('Bulk delete:', [...this._selectedIds]);
        },

        _escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        _formatDate(dateStr) {
            if (!dateStr) return '-';
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            } catch {
                return dateStr;
            }
        }
    };

    // Register view
    window.DuckApp?.registerView('profiles', VIEW);
    window.ProfilesView = VIEW;
})();
