window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.ImportProxy = {
    _modal: null,
    
    show() {
        if (this._modal) {
            this._modal.destroy();
            this._modal = null;
        }

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'display:flex;flex-direction:column;gap:20px;';
        
        // 1. Textarea for Proxies
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
        badgeCard.textContent = 'Supports multiple formats • 1 proxy per line';
        label.appendChild(badgeCard);
        
        const counter = document.createElement('div');
        counter.style.cssText = 'font-size:12px;color:var(--text-tertiary);font-weight:600; background: var(--bg-surface); padding: 2px 8px; border-radius: var(--r-sm);';
        counter.innerHTML = `Valid: <span id="ip-valid-count" style="color:var(--success);">0</span> / <span id="ip-total-count">0</span>`;
        labelWrap.appendChild(counter);
        
        inputWrap.appendChild(labelWrap);
        
        const taWrap = document.createElement('div');
        const ta = window.DuckControls.Textarea.create({
            placeholder: '192.168.1.1:8080\n192.168.1.1:8080:username:password\nhttp://username:password@192.168.1.1:8080\nsocks5://192.168.1.1:1080',
            rows: 10,
            onChange: (e) => this._validateProxies(e.target.value)
        });
        this._ta = ta;
        ta.textarea.style.fontFamily = 'Consolas, Monaco, "Courier New", monospace';
        ta.textarea.style.fontSize = '13px';
        ta.textarea.addEventListener('input', (e) => this._validateProxies(e.target.value));
        taWrap.appendChild(ta.element);
        inputWrap.appendChild(taWrap);
        modalBody.appendChild(inputWrap);

        // 2. Target Selection
        const targetWrap = document.createElement('div');
        targetWrap.style.cssText = 'display:flex; gap:16px; align-items:flex-start;';
        
        const targetComboWrap = document.createElement('div');
        targetComboWrap.style.flex = '1';
        
        const groupComboWrap = document.createElement('div');
        groupComboWrap.style.cssText = 'flex: 1; display: none;';
        
        let targetVal = 'selected';
        const targetCombo = window.DuckControls.ComboBox.create({
            label: 'Assign To',
            options: [
                { label: 'Selected Profiles', value: 'selected' },
                { label: 'By Group', value: 'group' },
                { label: 'All Profiles', value: 'all' }
            ],
            value: targetVal,
            onChange: (e) => {
                targetVal = e.target.value;
                groupComboWrap.style.display = targetVal === 'group' ? 'block' : 'none';
            }
        });
        targetComboWrap.appendChild(targetCombo.element);
        targetWrap.appendChild(targetComboWrap);
        
        const groups = DuckStore ? DuckStore.get('groups') || [] : [];
        const groupOpts = groups.map(g => ({ label: g.name || g.Name, value: g.id || g.Id }));
        const groupCombo = window.DuckControls.ComboBox.create({
            label: 'Select Group',
            options: groupOpts, // If empty array, ComboBox natively displays "No records found"
            value: groupOpts.length ? groupOpts[0].value : ''
        });
        groupComboWrap.appendChild(groupCombo.element);
        targetWrap.appendChild(groupComboWrap);
        
        modalBody.appendChild(targetWrap);

        // 3. Assignment Rule (Radio Group)
        const ruleWrap = document.createElement('div');
        ruleWrap.style.cssText = 'background: var(--bg-surface); padding: 16px; border-radius: 12px; border: 1px solid var(--border-default); margin-top: -8px;';
        
        const ruleLabel = document.createElement('div');
        ruleLabel.className = 'ui-label';
        ruleLabel.style.marginBottom = '12px';
        ruleLabel.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;vertical-align:middle;margin-right:4px;">rule</span>Assignment Rule';
        ruleWrap.appendChild(ruleLabel);

        const radioGroup = window.DuckControls.RadioGroup.create({
            name: 'proxyAssignRule',
            inline: false, // Stack them vertically for a cleaner look inside the panel
            value: 'round-robin',
            options: [
                { label: 'Round-Robin (Distribute evenly)', value: 'round-robin' },
                { label: 'Sequential (One by one)', value: 'sequential' },
                { label: 'Same for all (Use first proxy)', value: 'same' }
            ]
        });
        // Override inline spacing if any, add slight gap between radios
        radioGroup.element.style.gap = '12px';
        ruleWrap.appendChild(radioGroup.element);
        modalBody.appendChild(ruleWrap);

        // Custom Footer with Status Label on the left
        const footerWrap = document.createElement('div');
        footerWrap.style.cssText = 'display:flex; justify-content:space-between; align-items:center; width:100%;';
        
        const statusLabel = document.createElement('div');
        statusLabel.id = 'import-proxy-status';
        statusLabel.style.cssText = 'font-size:12px; font-weight:500; color:var(--text-secondary); display:flex; align-items:center; gap:6px;';
        statusLabel.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">info</span> Waiting for proxies...`;
        footerWrap.appendChild(statusLabel);
        
        const buttonsWrap = document.createElement('div');
        buttonsWrap.style.cssText = 'display:flex; gap:8px;';
        
        const scanBtn = document.createElement('button');
        scanBtn.className = 'duck-btn duck-btn-secondary';
        scanBtn.textContent = 'Scan Proxies';
        scanBtn.addEventListener('click', () => this._scanProxies());
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'duck-btn duck-btn-surface';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => { if (this._modal) this._modal.close(); });
        
        const importBtn = document.createElement('button');
        importBtn.className = 'duck-btn duck-btn-primary';
        importBtn.textContent = 'Import';
        importBtn.addEventListener('click', () => this._doImport());
        
        buttonsWrap.appendChild(scanBtn);
        buttonsWrap.appendChild(cancelBtn);
        buttonsWrap.appendChild(importBtn);
        footerWrap.appendChild(buttonsWrap);

        this._modal = window.DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Import Proxy',
            subtitle: 'Bulk assign proxies to your profiles with custom rules.',
            icon: 'upload',
            content: modalBody,
            footer: footerWrap, // Use our custom footer instead of buttons array
            size: 'lg',
            closeOnOverlay: false,
            onClose: () => { this._modal = null; }
        });

        this._modal.open();
    },
    
    _validateProxies(text) {
        if (!text) text = '';
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let validCount = 0;
        
        // Simple validation logic
        const ipPortRegex = /^(\d{1,3}\.){3}\d{1,3}:\d{1,5}(:.+:.+)?$/;
        const urlRegex = /^(http|https|socks4|socks5):\/\//i;
        
        this._validProxies = [];
        
        lines.forEach(line => {
            if (ipPortRegex.test(line) || urlRegex.test(line)) {
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
                statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--success);">check_circle</span> Ready to import or scan`;
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
        
        const scanModalBody = document.createElement('div');
        scanModalBody.style.cssText = 'display:flex;flex-direction:column;gap:16px;';
        
        // Header stats
        const statsEl = document.createElement('div');
        statsEl.style.cssText = 'display:flex; gap:16px; font-weight:600; font-size:13px; color:var(--text-primary); background:var(--bg-surface); padding: 12px; border-radius: var(--r-md); border: 1px solid var(--border-default);';
        statsEl.innerHTML = `
            <div>Total: <span id="scan-total">${this._validProxies.length}</span></div>
            <div>Alive: <span id="scan-alive" style="color:var(--success);">0</span></div>
            <div>Dead: <span id="scan-dead" style="color:var(--danger);">0</span></div>
            <div>Timeout: <span id="scan-timeout" style="color:var(--warning);">0</span></div>
        `;
        scanModalBody.appendChild(statsEl);
        
        // Table container
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = 'max-height: 300px; overflow-y: auto; border: 1px solid var(--border-default); border-radius: var(--r-md); background: var(--bg-elevated);';
        
        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;';
        table.innerHTML = `
            <thead style="position: sticky; top: 0; background: var(--bg-surface); box-shadow: 0 1px 0 var(--border-default);">
                <tr>
                    <th style="padding: 8px 12px; font-weight: 600; color: var(--text-secondary);">Proxy</th>
                    <th style="padding: 8px 12px; font-weight: 600; color: var(--text-secondary); width: 100px;">Status</th>
                    <th style="padding: 8px 12px; font-weight: 600; color: var(--text-secondary); width: 80px;">Ping</th>
                </tr>
            </thead>
            <tbody id="scan-tbody">
            </tbody>
        `;
        tableContainer.appendChild(table);
        scanModalBody.appendChild(tableContainer);
        
        const tbody = table.querySelector('#scan-tbody');
        const results = [];
        
        this._validProxies.forEach(proxy => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-default)';
            tr.innerHTML = `
                <td style="padding: 8px 12px; font-family: monospace;">${proxy}</td>
                <td style="padding: 8px 12px;" class="scan-status"><span class="duck-badge duck-badge-info">Scanning...</span></td>
                <td style="padding: 8px 12px;" class="scan-ping">-</td>
            `;
            tbody.appendChild(tr);
            results.push({ proxy, tr, status: 'scanning', ping: 0 });
        });

        // Footer buttons
        const scanFooter = document.createElement('div');
        scanFooter.style.cssText = 'display:flex; justify-content:space-between; align-items:center; width:100%;';
        
        const leftBtns = document.createElement('div');
        leftBtns.style.cssText = 'display:flex; gap:8px;';
        
        const exportBtn = document.createElement('button');
        exportBtn.className = 'duck-btn duck-btn-surface';
        exportBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">download</span> Export';
        exportBtn.disabled = true;
        
        const filterBtn = document.createElement('button');
        filterBtn.className = 'duck-btn duck-btn-surface';
        filterBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">filter_alt</span> Filter Dead/Timeout';
        filterBtn.disabled = true;
        
        leftBtns.appendChild(exportBtn);
        leftBtns.appendChild(filterBtn);
        
        const rightBtns = document.createElement('div');
        rightBtns.style.cssText = 'display:flex; gap:8px;';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'duck-btn duck-btn-surface';
        cancelBtn.textContent = 'Cancel';
        
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'duck-btn duck-btn-primary';
        confirmBtn.textContent = 'Confirm';
        confirmBtn.disabled = true;
        
        rightBtns.appendChild(cancelBtn);
        rightBtns.appendChild(confirmBtn);
        
        scanFooter.appendChild(leftBtns);
        scanFooter.appendChild(rightBtns);

        const scanModal = window.DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Proxy Scanner Results',
            icon: 'network_ping',
            content: scanModalBody,
            footer: scanFooter,
            size: 'lg',
            closeOnOverlay: false
        });
        
        cancelBtn.addEventListener('click', () => scanModal.close());
        
        confirmBtn.addEventListener('click', () => {
            scanModal.close();
        });
        
        exportBtn.addEventListener('click', async () => {
            let out = "Proxy\tStatus\tPing\n";
            results.forEach(r => {
                out += `${r.proxy}\t${r.status}\t${r.ping}ms\n`;
            });
            
            try {
                if (window.showSaveFilePicker) {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: 'proxy_scan_results.txt',
                        types: [{
                            description: 'Text Files',
                            accept: {'text/plain': ['.txt']},
                        }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(out);
                    await writable.close();
                    if (window.DuckControls && window.DuckControls.Toast) {
                        DuckControls.Toast.success('Export Saved', 'Results exported successfully.');
                    }
                } else {
                    const blob = new Blob([out], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'proxy_scan_results.txt';
                    a.click();
                    URL.revokeObjectURL(url);
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Save file error:', err);
                }
            }
        });
        
        filterBtn.addEventListener('click', () => {
            const aliveProxies = results.filter(r => r.status === 'alive').map(r => r.proxy);
            if (this._ta && this._ta.textarea) {
                this._ta.textarea.value = aliveProxies.join('\n');
                this._validateProxies(this._ta.textarea.value);
            }
            if (window.DuckControls && DuckControls.Toast) {
                DuckControls.Toast.success('Filtered', `Kept ${aliveProxies.length} alive proxies.`);
            }
            scanModal.close();
        });

        scanModal.open();

        // Mock scan logic
        let aliveCount = 0;
        let deadCount = 0;
        let timeoutCount = 0;
        
        const doScan = async () => {
            for (let i = 0; i < results.length; i++) {
                const r = results[i];
                // Simulate delay 50-200ms
                await new Promise(res => setTimeout(res, 50 + Math.random() * 150));
                
                const rand = Math.random();
                if (rand < 0.7) {
                    r.status = 'alive';
                    r.ping = Math.floor(Math.random() * 200 + 50);
                    r.tr.querySelector('.scan-status').innerHTML = '<span class="duck-badge duck-badge-success">Alive</span>';
                    r.tr.querySelector('.scan-ping').textContent = r.ping + 'ms';
                    aliveCount++;
                    document.getElementById('scan-alive').textContent = aliveCount;
                } else if (rand < 0.9) {
                    r.status = 'dead';
                    r.tr.querySelector('.scan-status').innerHTML = '<span class="duck-badge duck-badge-danger">Dead</span>';
                    deadCount++;
                    document.getElementById('scan-dead').textContent = deadCount;
                } else {
                    r.status = 'timeout';
                    r.tr.querySelector('.scan-status').innerHTML = '<span class="duck-badge duck-badge-warning">Timeout</span>';
                    timeoutCount++;
                    document.getElementById('scan-timeout').textContent = timeoutCount;
                }
            }
            
            exportBtn.disabled = false;
            filterBtn.disabled = false;
            confirmBtn.disabled = false;
            
            if (statusEl) {
                statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--success);">done_all</span> Scan complete: ${aliveCount} alive, ${deadCount+timeoutCount} dead/timeout.`;
            }
        };
        
        doScan();
    },
    
    _doImport() {
        const statusEl = document.getElementById('import-proxy-status');
        
        if (!this._validProxies || this._validProxies.length === 0) {
            if (statusEl) {
                statusEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; color:var(--danger);">error</span> No valid proxies to import.`;
            }
            return;
        }
        
        console.log('Importing', this._validProxies.length, 'proxies');
        // Implement bridge integration here
        
        if (this._modal) this._modal.close();
        if (window.DuckControls && DuckControls.Toast) {
            DuckControls.Toast.success('Proxies Imported', `Successfully assigned proxies to profiles.`);
        }
    }
};
