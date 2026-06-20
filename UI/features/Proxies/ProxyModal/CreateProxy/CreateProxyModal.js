window.ProxyModals = window.ProxyModals || {};

window.ProxyModals.CreateProxy = {
    _proxyGroups: [],
    _proxyTags: [],
    _proxyTypes: [],
    _onSuccess: null,
    _isLoading: false,
    _validator: null,
    _cancelRequested: false,

    async show(onSuccess, editProxyData = null) {
        if (this._modal) this._modal.destroy();
        this._onSuccess = onSuccess;
        this._editData = editProxyData;
        this._isLoading = true;
        this._cancelRequested = false;

        // Load required data
        await this._loadData();

        const content = document.createElement('div');
        content.className = 'proxy-create-modal';
        content.style.cssText = 'display:flex;flex-direction:column;gap:16px;width:100%;';

        // Loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'create-proxy-loading';
        loadingOverlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;border-radius:inherit;';
        loadingOverlay.innerHTML = '<div style="color:white;font-weight:500;">Loading...</div>';

        // Basic Info (Outside Tabs)
        const basicGroup = document.createElement('div');
        basicGroup.style.cssText = 'display:flex; gap:12px;';
        
        const nameCol = document.createElement('div');
        nameCol.style.flex = '1';
        this._nameCtrl = DuckControls.Input.create({ label: 'PROXY NAME', placeholder: 'Leave empty for auto-generate', icon: 'badge', width: '100%', value: this._editData ? this._editData.name : '' });
        nameCol.appendChild(this._nameCtrl.element);
        basicGroup.appendChild(nameCol);
        
        content.appendChild(basicGroup);

        // Init validator
        this._validator = new FieldValidator();

        // Details Tab
        const detailsTab = document.createElement('div');
        detailsTab.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
        
        // Quick Input Section
        const quickInputGroup = document.createElement('div');
        quickInputGroup.style.cssText = 'padding: 10px; border: 1px dashed var(--border-strong); border-radius: var(--r-sm); display: flex; flex-direction: column; gap: 8px;';
        
        const qiHeader = document.createElement('div');
        qiHeader.innerHTML = '<div style="font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:6px;"><span class="material-symbols-outlined" style="font-size:16px;">flash_on</span> Quick Import</div><div style="font-size:12px; color:var(--text-secondary);">Paste proxy in format type://ip:port:user:pass</div>';
        quickInputGroup.appendChild(qiHeader);

        const quickInput = DuckControls.Input.create({
            placeholder: 'e.g. http://192.168.1.1:8080:admin:pass123',
            icon: 'content_paste',
            width: '100%',
            onInput: (e) => {
                this._validator?.clearAll();
                this._parseQuickInput(e.target.value);
            }
        });
        quickInputGroup.appendChild(quickInput.element);
        detailsTab.appendChild(quickInputGroup);

        // Protocol + Group + Tags Row
        const typeGroupTagsRow = document.createElement('div');
        typeGroupTagsRow.style.cssText = 'display:grid; grid-template-columns:1fr 2fr 2fr; gap:16px;';
        
        const typeCol = document.createElement('div');
        this._typeCtrl = DuckControls.Select.create({
            label: 'PROTOCOL',
            options: this._proxyTypes.map(t => ({ label: t.label, value: t.value })),
            width: '100%',
            required: true,
            value: this._editData ? this._editData.proxy_type : 'http'
        });
        typeCol.appendChild(this._typeCtrl.element);
        
        const groupCol = document.createElement('div');
        this._groupCtrl = DuckControls.Select.create({
            label: 'GROUP',
            placeholder: 'No Group',
            options: [
                { label: 'No Group', value: '' },
                ...this._proxyGroups.map(g => ({ label: g.Name || g.name || '', value: String(g.Id || g.id) }))
            ],
            width: '100%',
            value: this._editData && this._editData.groupId ? String(this._editData.groupId) : ''
        });
        groupCol.appendChild(this._groupCtrl.element);
        
        const tagCol = document.createElement('div');
        this._tagCtrl = DuckControls.MultiSelectComboBox.create({
            label: 'TAGS',
            placeholder: 'Select tags...',
            options: this._proxyTags.map(t => ({ label: t.Name || t.name || '', value: String(t.Id || t.id) })),
            width: '100%',
            values: this._editData && this._editData.tagIds ? this._editData.tagIds.map(String) : []
        });
        tagCol.appendChild(this._tagCtrl.element);
        
        typeGroupTagsRow.appendChild(typeCol);
        typeGroupTagsRow.appendChild(groupCol);
        typeGroupTagsRow.appendChild(tagCol);
        detailsTab.appendChild(typeGroupTagsRow);

        // Connection Group
        const connGroup = document.createElement('div');
        connGroup.style.cssText = 'display:flex; gap:12px;';
        
        const hostCol = document.createElement('div');
        hostCol.style.flex = '1';
        this._hostCtrl = DuckControls.Input.create({ label: 'IP / HOST', placeholder: '127.0.0.1', icon: 'dns', width: '100%', required: true, value: this._editData ? this._editData.host : '' });
        hostCol.appendChild(this._hostCtrl.element);
        
        const portCol = document.createElement('div');
        portCol.style.flex = '1';
        this._portCtrl = DuckControls.Input.create({ label: 'PORT', placeholder: '8080', icon: 'numbers', width: '100%', required: true, value: this._editData ? String(this._editData.port) : '' });
        portCol.appendChild(this._portCtrl.element);

        connGroup.appendChild(hostCol);
        connGroup.appendChild(portCol);
        detailsTab.appendChild(connGroup);

        // Register required fields
        this._validator.register('type', this._typeCtrl);
        this._validator.register('host', this._hostCtrl);
        this._validator.register('port', this._portCtrl);

        // Auth Group
        const authGroup = document.createElement('div');
        authGroup.style.cssText = 'display:flex; gap:12px;';
        
        const userCol = document.createElement('div');
        userCol.style.flex = '1';
        this._userCtrl = DuckControls.Input.create({ label: 'USERNAME', placeholder: 'Optional', icon: 'person', width: '100%', value: this._editData ? this._editData.username : '' });
        userCol.appendChild(this._userCtrl.element);
        
        const passCol = document.createElement('div');
        passCol.style.flex = '1';
        this._passCtrl = DuckControls.Input.create({ label: 'PASSWORD', placeholder: 'Optional', icon: 'key', width: '100%', value: this._editData ? this._editData.password : '' });
        passCol.appendChild(this._passCtrl.element);

        authGroup.appendChild(userCol);
        authGroup.appendChild(passCol);
        detailsTab.appendChild(authGroup);

        // Advanced Group
        const advGroup = document.createElement('div');
        advGroup.style.cssText = 'display:flex; flex-direction:column; gap:8px; border-top: 1px dashed var(--border-light); padding-top: 12px; margin-top: 4px;';
        
        const advHeader = document.createElement('div');
        advHeader.innerHTML = '<div style="font-size:12px; font-weight:600; color:var(--text-secondary); text-transform:uppercase;">Advanced</div>';
        advGroup.appendChild(advHeader);

        this._apiCtrl = DuckControls.Input.create({
            label: 'ROTATE API URL',
            placeholder: 'https://proxy-provider.com/rotate?key=...',
            icon: 'autorenew',
            width: '100%',
            value: this._editData ? this._editData.rotaryApi : ''
        });
        advGroup.appendChild(this._apiCtrl.element);
        detailsTab.appendChild(advGroup);

        // Notes Tab
        const noteTab = document.createElement('div');
        noteTab.style.cssText = 'display:flex;flex-direction:column;gap:12px;padding-top:16px;';
        this._noteCtrl = DuckControls.Textarea.create({
            label: 'NOTE',
            placeholder: 'Add any notes for this proxy...',
            width: '100%',
            height: '100px',
            value: this._editData ? this._editData.note : ''
        });
        noteTab.appendChild(this._noteCtrl.element);

        // Tabs Container
        const tabsContainer = document.createElement('div');
        this._tabControl = DuckControls.TabControl.create({
            variant: 'horizontal',
            tabs: [
                { id: 'details', name: 'Configuration', content: detailsTab },
                { id: 'note', name: 'Notes', content: noteTab }
            ]
        });
        
        this._tabControl.element.style.border = 'none';
        this._tabControl.element.style.background = 'transparent';
        
        const sidebar = this._tabControl.element.querySelector('.duck-tabcontrol-sidebar');
        if (sidebar) {
            sidebar.style.background = 'transparent';
            sidebar.style.padding = '0';
        }
        const tabList = this._tabControl.element.querySelector('.duck-tabcontrol-list');
        if (tabList) tabList.padding = '0';
        const contentArea = this._tabControl.element.querySelector('.duck-tabcontrol-content');
        if (contentArea) {
            contentArea.style.background = 'transparent';
        }
        
        tabsContainer.appendChild(this._tabControl.element);
        content.appendChild(tabsContainer);

        let saveBtn = null;

        this._modal = DuckControls.Modal.create({
            defaultEnter: false,
            title: this._editData ? 'Edit Proxy' : 'Create Proxy',
            subtitle: this._editData ? '<span class="material-symbols-outlined" style="font-size:14px;">edit</span> Update your proxy details.' : '<span class="material-symbols-outlined" style="font-size:14px;">add_circle</span> Add a new proxy connection to your database.',
            icon: 'dns',
            content: content,
            size: 'lg',
            closeOnOverlay: true,
            preventAutoFocus: true,
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => { 
                    modal.close(); 
                }},
                { text: 'Save Proxy', icon: 'save', class: 'duck-btn-primary', ref: (btn) => saveBtn = btn, onClick: async (e, modal) => {
                    await this._handleSave(modal, saveBtn);
                }}
            ],
            onClose: () => {
                this._isLoading = false;
            }
        });

        this._modal.open();
        
        // Remove loading overlay after data is loaded
        const loadingEl = document.getElementById('create-proxy-loading');
        if (loadingEl) {
            setTimeout(() => {
                this._isLoading = false;
                loadingEl.style.display = 'none';
            }, 100);
        }
    },

    async _loadData() {
        try {
            const [groups, tags, types] = await Promise.all([
                DuckBridge.call('proxygroup.list').catch(() => []),
                DuckBridge.call('proxytag.list').catch(() => []),
                DuckBridge.call('proxytype.list').catch(() => [])
            ]);
            
            this._proxyGroups = groups || [];
            this._proxyTags = tags || [];
            
            if (!types || types.length === 0) {
                this._proxyTypes = [
                    { value: 'http', label: 'HTTP' },
                    { value: 'https', label: 'HTTPS' },
                    { value: 'socks4', label: 'SOCKS4' },
                    { value: 'socks5', label: 'SOCKS5' }
                ];
            } else {
                this._proxyTypes = types.map(t => ({
                    value: t.Value || t.value || 'http',
                    label: t.Label || t.label || 'HTTP'
                }));
            }
        } catch (e) {
            console.error('[CreateProxy] Load data failed:', e);
            this._proxyTypes = [
                { value: 'http', label: 'HTTP' },
                { value: 'https', label: 'HTTPS' },
                { value: 'socks4', label: 'SOCKS4' },
                { value: 'socks5', label: 'SOCKS5' }
            ];
        }
    },

    _parseQuickInput(value) {
        if (!value) return;
        
        let remaining = value.trim();
        let type = 'http';
        
        const protocolMatch = remaining.match(/^(https?|socks4|socks5):\/\//i);
        if (protocolMatch) {
            type = protocolMatch[1].toLowerCase();
            remaining = remaining.substring(protocolMatch[0].length);
        }
        
        const parts = remaining.split(':');
        
        if (parts.length >= 2) {
            this._hostCtrl?.setValue(parts[0]);
            this._portCtrl?.setValue(parts[1]);
            
            if (parts.length >= 4) {
                this._userCtrl?.setValue(parts[2]);
                this._passCtrl?.setValue(parts[3]);
            }
            
            if (this._typeCtrl) {
                const typeOption = this._proxyTypes.find(t => t.value === type);
                if (typeOption) {
                    this._typeCtrl.setValue(type);
                }
            }
        }
    },

    async _handleSave(modal, saveBtn) {
        // Clear previous validation
        this._validator?.clearAll();
        
        const host = this._hostCtrl?.getValue?.()?.trim() || this._hostCtrl?.getValue?.() || '';
        const portStr = this._portCtrl?.getValue?.()?.trim() || this._portCtrl?.getValue?.() || '';
        const port = parseInt(portStr, 10);
        
        const errors = {};
        
        // Validation - Type required
        const type = this._typeCtrl?.getValue?.() || '';
        if (!type) {
            errors.type = 'Protocol is required';
        }
        
        // Validation - Host required
        if (!host) {
            errors.host = 'Host is required';
        }
        
        // Validation - Port required and valid range
        if (!portStr) {
            errors.port = 'Port is required';
        } else if (isNaN(port) || port <= 0 || port > 65535) {
            errors.port = 'Port must be between 1 and 65535';
        }
        
        if (!this._validator.validate(errors)) {
            // Focus first error field
            if (errors.type) {
                this._typeCtrl?.trigger?.focus();
            } else if (errors.host) {
                this._hostCtrl?.input?.focus();
            } else if (errors.port) {
                this._portCtrl?.input?.focus();
            }
            return;
        }
        
        // Lock modal
        this._isLoading = true;
        modal.setLoading(true, 'Saving...');
        if (saveBtn) saveBtn.disabled = true;
        
        try {
            const tagValues = this._tagCtrl?.getValues?.() || [];
            const tagIds = tagValues.map(v => parseInt(v)).filter(v => !isNaN(v));
            
            const groupValue = this._groupCtrl?.getValue?.() || '';
            const groupId = groupValue ? parseInt(groupValue) : null;
            
            const data = {
                name: this._nameCtrl?.getValue?.()?.trim() || null,
                type: type || 'http',
                host: host,
                port: port,
                groupId: groupId,
                tagIds: tagIds.length > 0 ? tagIds : null,
                username: this._userCtrl?.getValue?.()?.trim() || null,
                password: this._passCtrl?.getValue?.()?.trim() || null,
                rotaryApi: this._apiCtrl?.getValue?.()?.trim() || null,
                notes: this._noteCtrl?.getValue?.()?.trim() || null
            };
            
            if (this._editData) {
                data.id = this._editData.id;
                await DuckBridge.call('proxy.update', data);
            } else {
                await DuckBridge.call('proxy.create', data);
            }
            
            if (this._onSuccess) this._onSuccess();
            
            if (window.ProxiesView) {
                window.ProxiesView.loadProxyGroups?.();
                window.ProxiesView.loadProxyTags?.();
                window.ProxiesView.loadProxies?.();
            }
            
            modal.setLoading(false);
            modal.close();
        } catch (err) {
            console.error('[CreateProxy] Save failed:', err);
            window.DuckControls.Toast?.error?.('Error', err?.message || 'Failed to create proxy');
            
            this._isLoading = false;
            modal.setLoading(false);
            if (saveBtn) saveBtn.disabled = false;
        }
    }
};
