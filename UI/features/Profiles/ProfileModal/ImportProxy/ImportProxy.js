window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.ImportProxy = {
    _modal: null,
    _isScanning: false,
    _scanAbortController: null,
    _fileUploader: null,
    _file: null,
    _selectedIds: [],
    _onComplete: null,
    
    show(selectedIds = [], onComplete = null) {
        this._selectedIds = selectedIds;
        this._onComplete = onComplete;
        this._scanResults = null;
        this._isImporting = false;
        this._file = null;
        if (this._modal) {
            this._modal.destroy();
            this._modal = null;
        }

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'display:flex;flex-direction:column;gap:20px;';
        
        // 1. File Upload Section
        const fileSection = document.createElement('div');
        fileSection.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
        
        const fileLabel = document.createElement('div');
        fileLabel.className = 'ui-label';
        fileLabel.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;margin-right:4px;">folder_open</span> Import from File';
        fileSection.appendChild(fileLabel);
        
        const fileUploaderWrap = document.createElement('div');
        fileUploaderWrap.id = 'profile-proxy-file-uploader-wrap';
        this._fileUploaderWrap = fileUploaderWrap;
        fileSection.appendChild(fileUploaderWrap);
        
        modalBody.appendChild(fileSection);
        
        // 2. Divider with OR
        const divider = document.createElement('div');
        divider.style.cssText = 'display:flex;align-items:center;gap:12px;';
        divider.innerHTML = `
            <div style="flex:1;height:1px;background:var(--border-default);"></div>
            <span style="font-size:12px;color:var(--text-tertiary);font-weight:500;">OR</span>
            <div style="flex:1;height:1px;background:var(--border-default);"></div>
        `;
        modalBody.appendChild(divider);
        
        // 3. Textarea Section
        const inputWrap = document.createElement('div');
        
        const labelWrap = document.createElement('div');
        labelWrap.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:8px;';
        
        const label = document.createElement('label');
        label.className = 'ui-label';
        label.textContent = 'Paste Proxies';
        labelWrap.appendChild(label);
        
        const badgeCard = document.createElement('div');
        badgeCard.className = 'duck-badge duck-badge-info';
        badgeCard.style.cssText = 'font-weight:500; font-size:11px; margin-left: 8px;';
        badgeCard.textContent = 'Multiple formats supported';
        label.appendChild(badgeCard);
        
        const counter = document.createElement('div');
        counter.style.cssText = 'font-size:12px;color:var(--text-tertiary);font-weight:600; background: var(--bg-surface); padding: 2px 8px; border-radius: var(--r-sm);';
        counter.innerHTML = `Valid: <span id="ip-valid-count" style="color:var(--success);">0</span> / <span id="ip-total-count">0</span>`;
        labelWrap.appendChild(counter);
        
        inputWrap.appendChild(labelWrap);
        
        const taWrap = document.createElement('div');
        const ta = window.DuckControls.Textarea.create({
            icon: 'list',
            placeholder: '192.168.1.1:8080\n192.168.1.1:8080:username:password\nhttp://username:password@192.168.1.1:8080\nsocks5://192.168.1.1:1080',
            rows: 10,
            onChange: (e) => this._validateProxies(e.target.value)
        });
        this._ta = ta;
        ta.textarea.style.fontFamily = 'Consolas, Monaco, "Courier New", monospace';
        ta.textarea.style.fontSize = '13px';
        ta.textarea.addEventListener('input', (e) => {
            this._scanResults = null;
            this._validateProxies(e.target.value);
        });
        taWrap.appendChild(ta.element);

        this._valMsg = document.createElement('div');
        this._valMsg.style.cssText = 'font-size: 12px; color: #eab308; display: none; align-items: center; gap: 6px; padding: 8px; background: rgba(234, 179, 8, 0.1); border-radius: 4px; margin-top: 8px;';
        taWrap.appendChild(this._valMsg);

        this._showValMsg = (msg) => {
            this._valMsg.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">error</span> ${msg}`;
            this._valMsg.style.display = 'flex';
        };

        inputWrap.appendChild(taWrap);
        modalBody.appendChild(inputWrap);

        // 4. Target Selection
        const targetWrap = document.createElement('div');
        targetWrap.style.cssText = 'display:flex; gap:16px; align-items:flex-start;';
        
        const targetComboWrap = document.createElement('div');
        targetComboWrap.style.flex = '1';
        
        const groupComboWrap = document.createElement('div');
        groupComboWrap.style.cssText = 'flex: 1; display: none;';
        
        this._targetVal = 'selected';
        const targetCombo = window.DuckControls.ComboBox.create({
            icon: 'public',
            label: 'Assign To',
            options: [
                { label: 'Selected Profiles', value: 'selected' },
                { label: 'By Group', value: 'group' },
                { label: 'All Profiles', value: 'all' }
            ],
            value: this._targetVal,
            onChange: (e) => {
                this._targetVal = e.target.value;
                groupComboWrap.style.display = this._targetVal === 'group' ? 'block' : 'none';
            }
        });
        targetComboWrap.appendChild(targetCombo.element);
        targetWrap.appendChild(targetComboWrap);
        
        const groups = DuckStore ? DuckStore.get('groups') || [] : [];
        const groupOpts = groups.map(g => ({ label: g.name || g.Name, value: g.id || g.Id }));
        this._groupVal = groupOpts.length ? groupOpts[0].value : '';
        const groupCombo = window.DuckControls.ComboBox.create({
            icon: 'public',
            label: 'Select Group',
            options: groupOpts,
            value: this._groupVal,
            onChange: (e) => this._groupVal = e.target.value
        });
        groupComboWrap.appendChild(groupCombo.element);
        targetWrap.appendChild(groupComboWrap);
        
        modalBody.appendChild(targetWrap);

        // 5. Assignment Rule
        const ruleWrap = document.createElement('div');
        ruleWrap.style.cssText = 'background: var(--bg-surface); padding: 16px; border-radius: 12px; border: 1px solid var(--border-default);';
        
        const ruleLabel = document.createElement('div');
        ruleLabel.className = 'ui-label';
        ruleLabel.style.marginBottom = '12px';
        ruleLabel.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;margin-right:4px;">rule</span>Assignment Rule';
        ruleWrap.appendChild(ruleLabel);

        this._ruleVal = 'round-robin';
        const radioGroup = window.DuckControls.RadioGroup.create({
            name: 'proxyAssignRule',
            inline: false,
            value: this._ruleVal,
            onChange: (val) => this._ruleVal = val,
            options: [
                { label: 'Round-Robin (Distribute evenly)', value: 'round-robin' },
                { label: 'Sequential (One by one)', value: 'sequential' },
                { label: 'Same for all (Use first proxy)', value: 'same' }
            ]
        });
        radioGroup.element.style.gap = '12px';
        ruleWrap.appendChild(radioGroup.element);
        modalBody.appendChild(ruleWrap);

        const statusLabel = document.createElement('div');
        statusLabel.id = 'import-proxy-status';
        statusLabel.style.cssText = 'font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:6px;';
        statusLabel.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">info</span> Enter proxies to assign`;

        this._modal = window.DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Import Proxy',
            subtitle: 'Bulk assign proxies to your profiles with custom rules.',
            icon: 'upload',
            content: modalBody,
            footer: statusLabel, 
            size: 'lg',
            closeOnOverlay: true,
            buttons: [
                { text: 'Scan Proxies', class: 'duck-btn-secondary', position: 'left', icon: 'search', onClick: () => this._scanProxies() },
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, m) => m.close() },
                { text: 'Import', class: 'duck-btn-primary', icon: 'public', onClick: () => this._doImport() }
            ],
            onClose: () => { this._modal = null; }
        });

        // Initialize FileUploader after modal is created
        setTimeout(() => this._initFileUploader(), 0);
        this._modal.open();
    },
    
    _initFileUploader() {
        if (!this._fileUploaderWrap) return;
        
        this._fileUploader = window.DuckControls.FileUploader.create(this._fileUploaderWrap, {
            accept: '.txt,.csv,.json,text/plain,text/csv,application/json',
            title: 'Click or drag file to upload',
            subtitle: 'Supports .txt, .csv, .json - parsed proxies will fill textarea below',
            onFileSelect: async (file) => {
                this._file = file;
                await this._handleFileSelected(file);
            }
        });
    },
    
    async _handleFileSelected(file) {
        const statusEl = document.getElementById('import-proxy-status');
        if (statusEl) {
            statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;color:var(--accent);animation:duck-spin 1s linear infinite;">sync</span> Parsing file...`;
        }
        
        try {
            const content = await file.text();
            const result = await DuckBridge.call('profile.parseFile', { content: content });
            
            if (result && result.proxies && result.proxies.length > 0) {
                if (this._ta && this._ta.textarea) {
                    this._ta.textarea.value = result.proxies.map(p => p.proxyString).join('\n');
                    this._validateProxies(this._ta.textarea.value);
                }
                if (statusEl) {
                    statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;color:var(--success);">check_circle</span> Parsed ${result.total} proxies from file`;
                }
            } else if (result && result.total === 0) {
                if (statusEl) {
                    statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;color:var(--warning);">warning</span> No valid proxies found in file`;
                }
            } else {
                console.error('[ProfileImportProxy] Parse error:', result);
                if (statusEl) {
                    statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;color:var(--danger);">error</span> ${result?.error || 'Failed to parse file'}`;
                }
            }
        } catch (err) {
            console.error('[ProfileImportProxy] File parse error:', err);
            if (statusEl) {
                statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;color:var(--danger);">error</span> Failed to parse file: ${err.message}`;
            }
        }
    },
    
    _parseProxyString(str) {
        let type = null, host = '', port = 0, username = null, password = null;
        let s = str.trim();
        
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/;
        
        const typeMatch = s.match(/^(http|https|socks4|socks5):\/\//i);
        if (typeMatch) {
            type = typeMatch[1].toLowerCase();
            s = s.substring(typeMatch[0].length);
            
            const atIndex = s.indexOf('@');
            if (atIndex > -1) {
                const auth = s.substring(0, atIndex).split(':');
                username = auth[0];
                if (auth.length > 1) password = auth[1];
                s = s.substring(atIndex + 1);
            }
        }
        
        const parts = s.split(':');
        if (parts.length >= 2) {
            host = parts[0];
            port = parseInt(parts[1], 10);
            
            if (!typeMatch && parts.length >= 4) {
                username = parts[2];
                password = parts[3];
            }
        }
        
        const isValidIPv4 = ipv4Regex.test(host);
        const isValidIPv6 = ipv6Regex.test(host);
        
        return { type, host, port, username, password, isValidIP: isValidIPv4 || isValidIPv6 };
    },
    
    _validateProxies(text) {
        if (!text) text = '';
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let validCount = 0;
        
        this._validProxies = [];
        
        lines.forEach(line => {
            const parsed = this._parseProxyString(line);
            if (parsed.host && parsed.port > 0 && parsed.port <= 65535 && parsed.isValidIP) {
                validCount++;
                this._validProxies.push(line);
            }
        });
        
        const validEl = document.getElementById('ip-valid-count');
        const totalEl = document.getElementById('ip-total-count');
        if (validEl) validEl.textContent = validCount;
        if (totalEl) totalEl.textContent = lines.length;
        
        const statusEl = document.getElementById('import-proxy-status');
        if (statusEl) {
            if (validCount > 0) {
                statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--success);">check_circle</span> Ready to import ${validCount} proxy${validCount > 1 ? 'ies' : ''}`;
            } else {
                statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">info</span> Waiting for proxies...`;
            }
        }
    },
    
    _scanProxies() {
        const statusEl = document.getElementById('import-proxy-status');
        
        if (!this._validProxies || this._validProxies.length === 0) {
            if (statusEl) {
                statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--danger);">error</span> Please enter valid proxies.`;
            }
            return;
        }
        
        if (statusEl) {
            statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--accent); animation: duck-spin 1s linear infinite;">sync</span> Scanning ${this._validProxies.length} proxies...`;
        }
        
        this._isScanning = true;
        this._scanAbortController = new AbortController();
        
        const scanModalBody = document.createElement('div');
        scanModalBody.style.cssText = 'display:flex;flex-direction:column;gap:16px;';
        
        const statsEl = document.createElement('div');
        statsEl.style.cssText = 'display:flex; gap:24px; font-weight:600; font-size:13px; color:var(--text-primary); background:var(--bg-surface); padding: 12px 16px; border-radius: var(--r-md); border: 1px solid var(--border-default);';
        statsEl.innerHTML = `
            <div>Total: <span id="proxy-scan-total">0</span></div>
            <div>Alive: <span id="proxy-scan-alive" style="color:var(--success);">0</span></div>
            <div>Dead: <span id="proxy-scan-dead" style="color:var(--danger);">0</span></div>
            <div>Timeout: <span id="proxy-scan-timeout" style="color:var(--warning);">0</span></div>
        `;
        scanModalBody.appendChild(statsEl);
        
        const infoEl = document.createElement('div');
        infoEl.style.cssText = 'font-size: 12px; color: var(--text-secondary); background: var(--bg-surface); padding: 12px 16px; border-radius: var(--r-md); border: 1px solid var(--border-default);';
        infoEl.innerHTML = `
            <strong>Quick Scan</strong> (5s timeout) - TCP connect only, fast for checking proxy availability.
            <br><span style="color:var(--accent);">Deep Scan</span> (15s timeout) - Full HTTP validation, used when importing.
        `;
        scanModalBody.insertBefore(infoEl, scanModalBody.firstChild);
        
        const updateStats = () => {
            const total = this._scanResults.length;
            const alive = this._scanResults.filter(r => r.status === 'alive').length;
            const dead = this._scanResults.filter(r => r.status === 'dead').length;
            const timeout = this._scanResults.filter(r => r.status === 'timeout').length;
            
            const totalEl = document.getElementById('proxy-scan-total');
            const aliveEl = document.getElementById('proxy-scan-alive');
            const deadEl = document.getElementById('proxy-scan-dead');
            const timeoutEl = document.getElementById('proxy-scan-timeout');
            
            if (totalEl) totalEl.textContent = total;
            if (aliveEl) aliveEl.textContent = alive;
            if (deadEl) deadEl.textContent = dead;
            if (timeoutEl) timeoutEl.textContent = timeout;
        };
        
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = 'max-height: 400px; overflow-y: auto; border: 1px solid var(--border-default); border-radius: var(--r-md); background: var(--bg-elevated);';
        scanModalBody.appendChild(tableContainer);
        
        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;';
        table.innerHTML = `
            <thead style="position: sticky; top: 0; background: var(--bg-surface); box-shadow: 0 1px 0 var(--border-default); z-index: 1;">
                <tr>
                    <th style="padding: 10px 12px; font-weight: 600; color: var(--text-secondary);">Proxy</th>
                    <th style="padding: 10px 12px; font-weight: 600; color: var(--text-secondary); width: 90px;">Status</th>
                    <th style="padding: 10px 12px; font-weight: 600; color: var(--text-secondary); width: 70px;">Ping</th>
                    <th style="padding: 10px 12px; font-weight: 600; color: var(--text-secondary); width: 70px;">Type</th>
                </tr>
            </thead>
            <tbody id="proxy-scan-tbody">
            </tbody>
        `;
        tableContainer.appendChild(table);
        
        const tbody = table.querySelector('#proxy-scan-tbody');
        this._scanResults = [];
        
        this._validProxies.forEach(proxy => {
            const parsed = this._parseProxyString(proxy);
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-default)';
            tr.innerHTML = `
                <td style="padding: 10px 12px; font-family: monospace; word-break: break-all;">${proxy}</td>
                <td style="padding: 10px 12px;" class="scan-status"><span class="duck-badge duck-badge-info">Scanning...</span></td>
                <td style="padding: 10px 12px;" class="scan-ping">-</td>
                <td style="padding: 10px 12px;" class="scan-type">${parsed.type ? parsed.type.toUpperCase() : '-'}</td>
            `;
            tbody.appendChild(tr);
            this._scanResults.push({ proxy, tr, status: 'scanning', ping: 0, type: parsed.type, host: parsed.host, port: parsed.port, username: parsed.username, password: parsed.password });
        });
        
        updateStats();

        const scanFooter = document.createElement('div');
        scanFooter.style.cssText = 'display:flex; justify-content:flex-end; align-items:center; gap:12px; width:100%;';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'duck-btn duck-btn-surface';
        cancelBtn.textContent = 'Cancel';
        
        const filterBtn = document.createElement('button');
        filterBtn.className = 'duck-btn duck-btn-primary';
        filterBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">filter_alt</span> Filter Alive';
        filterBtn.disabled = true;
        
        const exportBtn = document.createElement('button');
        exportBtn.className = 'duck-btn duck-btn-surface';
        exportBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">download</span> Export';
        
        scanFooter.appendChild(exportBtn);
        scanFooter.appendChild(cancelBtn);
        scanFooter.appendChild(filterBtn);

        const scanModal = window.DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Proxy Scanner Results',
            icon: 'network_ping',
            content: scanModalBody,
            footer: scanFooter,
            size: 'xl',
            closeOnOverlay: false
        });
        
        cancelBtn.addEventListener('click', () => {
            if (this._isScanning) {
                this._cancelScan();
                cancelBtn.disabled = true;
                cancelBtn.innerHTML = `<span class="duck-spinner-ring" style="width:14px;height:14px;border-width:2px;"></span> Stopping...`;
                filterBtn.disabled = true;
                exportBtn.disabled = true;
            } else {
                scanModal.close();
            }
        });
        
        scanModal.onClose = () => {
            if (this._isScanning) {
                this._cancelScan();
                cancelBtn.disabled = true;
                cancelBtn.innerHTML = `<span class="duck-spinner-ring" style="width:14px;height:14px;border-width:2px;"></span> Stopping...`;
                filterBtn.disabled = true;
                exportBtn.disabled = true;
                this._pendingClose = true;
                return false;
            }
            this._cancelScan();
            if (statusEl) {
                const alive = this._scanResults?.filter(r => r.status === 'alive').length || 0;
                const dead = this._scanResults?.filter(r => r.status === 'dead').length || 0;
                const timeout = this._scanResults?.filter(r => r.status === 'timeout').length || 0;
                statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--warning);">cancel</span> Scan cancelled. ${alive} alive, ${dead+timeout} dead/timeout.`;
            }
            return true;
        };
        
        filterBtn.addEventListener('click', () => {
            const aliveProxies = this._scanResults.filter(r => r.status === 'alive').map(r => r.proxy);
            if (this._ta && this._ta.textarea) {
                this._ta.textarea.value = aliveProxies.join('\n');
                this._scanResults = null;
                this._validateProxies(this._ta.textarea.value);
            }
            scanModal.close();
        });
        
        exportBtn.addEventListener('click', () => {
            const lines = this._scanResults.map(r => r.proxy);
            const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `proxies-${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        });

        scanModal.open();
        scanModal._locked = true;

        const doScan = async () => {
            const BATCH_SIZE = 20;
            let activeTasks = 0;

            const waitForAllTasks = async () => {
                while (activeTasks > 0) {
                    await new Promise(r => setTimeout(r, 50));
                }
            };

            for (let i = 0; i < this._scanResults.length && this._isScanning; i += BATCH_SIZE) {
                if (!this._isScanning) break;

                const batch = this._scanResults.slice(i, i + BATCH_SIZE);
                const batchPromises = batch.map(async (r) => {
                    if (!this._isScanning) return;
                    activeTasks++;

                    const req = {
                        type: r.type || 'http',
                        host: r.host,
                        port: r.port,
                        username: r.username,
                        password: r.password
                    };

                    try {
                        const res = await DuckBridge.call('proxy.check', req, { signal: this._scanAbortController?.signal });
                        if (!this._isScanning) { activeTasks--; return; }

                        if (res && res.status === 'alive') {
                            r.status = 'alive';
                            r.ping = res.latencyMs || 0;

                            const stEl = r.tr.querySelector('.scan-status');
                            if (stEl) stEl.innerHTML = '<span class="duck-badge duck-badge-success">Alive</span>';
                            const pEl = r.tr.querySelector('.scan-ping');
                            if (pEl) pEl.textContent = r.ping + 'ms';
                        } else {
                            r.status = res?.status || 'dead';
                            const stEl = r.tr.querySelector('.scan-status');
                            if (stEl) stEl.innerHTML = `<span class="duck-badge duck-badge-${r.status === 'timeout' ? 'warning' : 'danger'}">${r.status === 'timeout' ? 'Timeout' : 'Dead'}</span>`;
                        }
                    } catch (e) {
                        if (e.name === 'AbortError' || !this._isScanning) { activeTasks--; return; }
                        r.status = 'dead';
                        const stEl = r.tr.querySelector('.scan-status');
                        if (stEl) stEl.innerHTML = '<span class="duck-badge duck-badge-danger">Error</span>';
                    }
                    
                    activeTasks--;
                    if (this._isScanning) updateStats();
                });

                await Promise.all(batchPromises);
            }

            await waitForAllTasks();
            this._isScanning = false;
            scanModal._locked = false;
            
            cancelBtn.disabled = false;
            cancelBtn.innerHTML = 'Cancel';
            exportBtn.disabled = false;

            if (this._pendingClose) {
                this._pendingClose = false;
                scanModal.close();
                return;
            }

            filterBtn.disabled = false;

            if (statusEl) {
                const alive = this._scanResults.filter(r => r.status === 'alive').length;
                const dead = this._scanResults.filter(r => r.status === 'dead').length;
                const timeout = this._scanResults.filter(r => r.status === 'timeout').length;
                statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--success);">done_all</span> Scan complete: ${alive} alive, ${dead+timeout} dead/timeout.`;
            }
        };

        doScan();
    },
    
    _cancelScan() {
        this._isScanning = false;
        if (this._scanAbortController) {
            this._scanAbortController.abort();
            this._scanAbortController = null;
        }
    },
    
    async _doImport() {
        const val = this._ta?.textarea?.value?.trim();
        if (!val) {
            return this._showValMsg('Field is required');
        }
        if (this._valMsg) this._valMsg.style.display = 'none';

        const statusEl = document.getElementById('import-proxy-status');
        
        if (!this._validProxies || this._validProxies.length === 0) {
            if (statusEl) {
                statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--danger);">error</span> No valid proxies to import.`;
            }
            return;
        }
        
        const importBtn = this._modal.element.querySelector('.duck-btn-primary');
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.innerHTML = `<span class="duck-spinner-ring" style="width:14px;height:14px;border-width:2px;"></span> Importing...`;
        }

        try {
            if (statusEl) {
                statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--accent); animation: duck-spin 1s linear infinite;">sync</span> Importing proxies...`;
            }
            
            const res = await DuckBridge.call('profile.importProxies', {
                proxies: this._validProxies,
                targetVal: this._targetVal,
                ruleVal: this._ruleVal,
                groupVal: this._groupVal,
                selectedIds: [...(this._selectedIds || [])]
            });

            if (res && res.success) {
                window.DuckControls.Toast?.success?.('Success', `Imported ${res.imported} proxies successfully`);
                if (this._onComplete) await this._onComplete();
                this._modal?.close();
            } else {
                window.DuckControls.Toast?.error?.('Error', res?.error || 'Failed to import proxies');
                if (statusEl) {
                    statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--danger);">error</span> ${res?.error || 'Import failed'}`;
                }
            }
        } catch (e) {
            console.error('[ProfileImportProxy] Error:', e);
            window.DuckControls.Toast?.error?.('Error', e?.message || 'An error occurred during proxy import');
        }
        
        if (importBtn) {
            importBtn.disabled = false;
            importBtn.innerHTML = 'Import';
        }
    }
};
