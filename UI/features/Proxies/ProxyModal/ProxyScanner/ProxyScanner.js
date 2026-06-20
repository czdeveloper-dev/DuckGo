window.ProxyModals = window.ProxyModals || {};

window.ProxyModals.ProxyScanner = {
    _modal: null,
    _scanId: null,
    _selectedIds: null,
    _isScanning: false,
    _results: [],
    _maxThreads: 50,
    _pollInterval: null,
    _onComplete: null,

    show(selectedIds, onComplete) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);
        
        // Store the callback
        this._onComplete = onComplete || null;
        
        if (this._modal) {
            this._cancelScan();
            this._modal.destroy();
            this._modal = null;
        }
        
        if (count === 0) {
            window.DuckControls.Toast?.warning?.('No Proxies Selected', 'Please select at least one proxy to scan.');
            return;
        }

        this._selectedIds = selectedIds;
        this._results = [];
        this._scanId = 'scan_' + Date.now();
        
        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'display:flex;flex-direction:column;gap:16px;';

        // Header info
        const info = document.createElement('div');
        info.style.cssText = 'font-size: 13px; color: var(--text-secondary);';
        info.innerHTML = `<strong>Quick Scan</strong> - Scanning <strong>${count}</strong> proxies (5s timeout per proxy).`;
        modalBody.appendChild(info);

        // Stats cards
        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;';
        
        const createStatCard = (id, label, value, color) => {
            const card = document.createElement('div');
            card.style.cssText = `background:var(--surface-secondary);border-radius:8px;padding:12px;text-align:center;border-left:3px solid ${color};`;
            card.innerHTML = `
                <div style="font-size:24px;font-weight:700;color:${color};" id="scan-stat-${id}">${value}</div>
                <div style="font-size:11px;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">${label}</div>
            `;
            return card;
        };

        statsContainer.appendChild(createStatCard('alive', 'Alive', '0', 'var(--success)'));
        statsContainer.appendChild(createStatCard('dead', 'Dead', '0', 'var(--error)'));
        statsContainer.appendChild(createStatCard('timeout', 'Timeout', '0', 'var(--warning)'));
        statsContainer.appendChild(createStatCard('progress', 'Progress', '0%', 'var(--primary)'));
        modalBody.appendChild(statsContainer);

        // Progress bar
        const progressWrap = document.createElement('div');
        progressWrap.style.cssText = 'background:var(--surface-secondary);border-radius:6px;padding:8px;';
        progressWrap.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:12px;color:var(--text-secondary);" id="scan-status-text">Scanning...</span>
                <span style="font-size:12px;font-weight:600;" id="scan-progress-text">0 / ${count}</span>
            </div>
            <div style="height:6px;background:var(--surface-primary);border-radius:3px;overflow:hidden;">
                <div id="scan-progress-bar" style="height:100%;width:0%;background:var(--primary);transition:width 0.3s ease;border-radius:3px;"></div>
            </div>
        `;
        modalBody.appendChild(progressWrap);

        // Results table
        const tableWrap = document.createElement('div');
        tableWrap.style.cssText = 'max-height:300px;overflow-y:auto;background:var(--surface-secondary);border-radius:8px;';
        
        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
        table.innerHTML = `
            <thead style="position:sticky;top:0;background:var(--surface-secondary);z-index:1;">
                <tr style="border-bottom:1px solid var(--border-color);">
                    <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;">Proxy</th>
                    <th style="padding:10px 12px;text-align:center;width:70px;color:var(--text-secondary);font-weight:600;">Status</th>
                    <th style="padding:10px 12px;text-align:right;width:80px;color:var(--text-secondary);font-weight:600;">Latency</th>
                </tr>
            </thead>
            <tbody id="scan-results-body"></tbody>
        `;
        tableWrap.appendChild(table);
        modalBody.appendChild(tableWrap);

        let cancelBtn = null;
        let closeBtn = null;

        this._modal = DuckControls.Modal.create({
            defaultEnter: false,
            title: 'Proxy Scanner',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">radar</span> Quick Scan - 5s timeout`,
            icon: 'wifi_find',
            content: modalBody,
            size: 'lg',
            closeOnOverlay: false,
            buttons: [
                { 
                    text: 'Cancel', 
                    class: 'duck-btn-surface', 
                    ref: (btn) => cancelBtn = btn,
                    onClick: (e, modal) => { 
                        this._cancelScan();
                        modal.close();
                    }
                },
                { 
                    text: 'Close', 
                    icon: 'close',
                    class: 'duck-btn-primary', 
                    ref: (btn) => closeBtn = btn,
                    disabled: true,
                    onClick: (e, modal) => { modal.close(); }
                }
            ],
            onClose: () => {
                this._cancelScan();
                this._cleanup();
            }
        });

        this._modal.open();
        
        // Start scanning
        this._startScan(count);
    },

    async _startScan(totalCount) {
        this._isScanning = true;
        this._results = [];
        
        const idsArray = Array.isArray(this._selectedIds) ? this._selectedIds : [...this._selectedIds];
        
        try {
            // Start quick scan - returns immediately, scan runs in background
            const result = await DuckBridge.call('proxy.scanQuick', { 
                ids: idsArray,
                maxThreads: this._maxThreads,
                scanId: this._scanId
            });
            
            if (result && result.success) {
                this._results = result.data || [];
                this._updateStatsFromResults();
            }
        } catch (err) {
            console.error('Scan error:', err);
            window.DuckControls.Toast?.error?.('Scan Error', err?.message || 'Failed to start scan');
        }
        
        // Start polling for progress updates
        this._pollProgress(idsArray, totalCount);
    },
    
    async _pollProgress(idsArray, totalCount) {
        let pollCount = 0;
        let lastProcessed = 0;
        
        const poll = async () => {
            if (!this._isScanning) return;
            
            try {
                // Get updated proxy list with statuses
                const result = await DuckBridge.call('proxy.list', { 
                    idStr: idsArray.join(',') 
                });
                
                if (result && result.success && result.data) {
                    const proxies = result.data.items || [];
                    
                    // Count statuses
                    const alive = proxies.filter(p => p.status === 'alive').length;
                    const dead = proxies.filter(p => p.status === 'dead').length;
                    const timeout = proxies.filter(p => p.status === 'timeout').length;
                    const processed = alive + dead + timeout;
                    
                    // Update UI
                    this._updateStats(alive, dead, timeout, processed, totalCount);
                    this._updateResultsTable(proxies);
                    
                    // Check if scan is complete
                    if (processed >= totalCount) {
                        this._finishScan();
                        return;
                    }
                    
                    // If no progress for 15 polls (15 seconds), assume stuck - finish anyway
                    if (processed === lastProcessed) {
                        pollCount++;
                        if (pollCount >= 15) {
                            console.log('[ProxyScanner] No progress for 15s, finishing scan');
                            this._finishScan();
                            return;
                        }
                    } else {
                        pollCount = 0;
                        lastProcessed = processed;
                    }
                }
            } catch (err) {
                console.error('Poll error:', err);
            }
            
            // Poll again after 1 second if still scanning
            if (this._isScanning) {
                this._pollInterval = setTimeout(poll, 1000);
            }
        };
        
        poll();
    },
    
    _updateStats(alive, dead, timeout, processed, total) {
        const aliveEl = document.getElementById('scan-stat-alive');
        const deadEl = document.getElementById('scan-stat-dead');
        const timeoutEl = document.getElementById('scan-stat-timeout');
        const progressEl = document.getElementById('scan-stat-progress');
        const progressText = document.getElementById('scan-progress-text');
        const progressBar = document.getElementById('scan-progress-bar');
        const statusText = document.getElementById('scan-status-text');
        
        if (aliveEl) aliveEl.textContent = alive;
        if (deadEl) deadEl.textContent = dead;
        if (timeoutEl) timeoutEl.textContent = timeout;
        
        const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
        if (progressEl) progressEl.textContent = `${percent}%`;
        if (progressText) progressText.textContent = `${processed} / ${total}`;
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (statusText) statusText.textContent = `Scanning... (${processed}/${total})`;
    },
    
    _updateStatsFromResults() {
        if (!this._results.length) return;
        
        const alive = this._results.filter(r => r.status === 'alive').length;
        const dead = this._results.filter(r => r.status === 'dead').length;
        const timeout = this._results.filter(r => r.status === 'timeout').length;
        const total = this._results.length;
        
        this._updateStats(alive, dead, timeout, total, total);
    },
    
    _updateResultsTable(proxies) {
        const tbody = document.getElementById('scan-results-body');
        if (!tbody) return;
        
        // Sort: alive first, then timeout, then dead, then by latency
        const sorted = [...proxies].sort((a, b) => {
            const order = { alive: 0, timeout: 1, dead: 2 };
            const statusA = order[a.status] || 3;
            const statusB = order[b.status] || 3;
            if (statusA !== statusB) return statusA - statusB;
            return (a.latencyMs || 9999) - (b.latencyMs || 9999);
        });
        
        // Show max 100 items
        const displayProxies = sorted.slice(0, 100);
        
        tbody.innerHTML = '';
        displayProxies.forEach(proxy => {
            const tr = document.createElement('tr');
            tr.style.cssText = 'border-bottom:1px solid var(--border-color);';
            
            const statusColor = proxy.status === 'alive' ? 'var(--success)' : 
                               proxy.status === 'timeout' ? 'var(--warning)' : 'var(--error)';
            const statusIcon = proxy.status === 'alive' ? 'check_circle' : 
                              proxy.status === 'timeout' ? 'schedule' : 'cancel';
            
            tr.innerHTML = `
                <td style="padding:8px 12px;font-family:monospace;font-size:11px;">
                    <span style="color:var(--text-primary);">${this._escapeHtml(proxy.host)}:${proxy.port}</span>
                </td>
                <td style="padding:8px 12px;text-align:center;">
                    <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:${statusColor};">
                        <span class="material-symbols-outlined" style="font-size:14px;">${statusIcon}</span>
                        ${proxy.status || 'unknown'}
                    </span>
                </td>
                <td style="padding:8px 12px;text-align:right;font-family:monospace;font-size:11px;color:var(--text-secondary);">
                    ${proxy.latencyMs ? proxy.latencyMs + 'ms' : '-'}
                </td>
            `;
            tbody.appendChild(tr);
        });
        
        // Show count if more than 100
        if (proxies.length > 100) {
            const footer = document.createElement('tr');
            footer.innerHTML = `
                <td colspan="3" style="padding:8px 12px;text-align:center;font-size:11px;color:var(--text-secondary);">
                    Showing 100 of ${proxies.length} results
                </td>
            `;
            tbody.appendChild(footer);
        }
    },
    
    _finishScan() {
        this._isScanning = false;
        
        // Clear polling
        if (this._pollInterval) {
            clearTimeout(this._pollInterval);
            this._pollInterval = null;
        }
        
        // Update status text
        const statusText = document.getElementById('scan-status-text');
        if (statusText) statusText.textContent = 'Scan completed';
        
        // Update subtitle
        const subtitle = this._modal?.element?.querySelector('.duck-modal-subtitle');
        if (subtitle) {
            subtitle.innerHTML = `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Scan completed`;
        }
        
        // Update progress bar to 100%
        const progressBar = document.getElementById('scan-progress-bar');
        if (progressBar) progressBar.style.width = '100%';
        const progressEl = document.getElementById('scan-stat-progress');
        if (progressEl) progressEl.textContent = '100%';
        
        // Hide cancel button, enable close
        const buttons = this._modal?.element?.querySelectorAll('button');
        if (buttons) {
            buttons.forEach(btn => {
                if (btn.textContent?.includes('Cancel')) {
                    btn.style.display = 'none';
                }
                if (btn.textContent?.includes('Close')) {
                    btn.disabled = false;
                }
            });
        }
        
        // Call the completion callback if provided
        if (this._onComplete) {
            this._onComplete();
            this._onComplete = null;
        }
        
        // Refresh proxy list
        if (window.ProxiesView) {
            window.ProxiesView.loadProxies();
        }
        
        window.DuckControls.Toast?.success?.('Scan Complete', `Scanned ${this._results.length || 0} proxies`);
    },
    
    _cancelScan() {
        this._isScanning = false;
        
        // Clear polling interval
        if (this._pollInterval) {
            clearTimeout(this._pollInterval);
            this._pollInterval = null;
        }
        
        // Notify backend immediately to cancel the scan
        if (this._scanId) {
            DuckBridge.call('proxy.cancelScan', { scanId: this._scanId }).catch(() => {});
            console.log('[ProxyScanner] Cancelled scan:', this._scanId);
        }
        
        // Call the completion callback if provided (with cancelled flag)
        if (this._onComplete) {
            this._onComplete(true);
            this._onComplete = null;
        }
    },
    
    _cleanup() {
        this._modal = null;
        this._scanId = null;
        this._selectedIds = null;
        this._results = [];
        this._pollInterval = null;
        this._onComplete = null;
    },
    
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Check if scanner is running
    isScanning() {
        return this._isScanning;
    }
};
