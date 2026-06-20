window.ProxyModals = window.ProxyModals || {};

window.ProxyModals.CompareProxies = {
    _modal: null,
    
    async show(allProxies = [], selectedIds = new Set()) {
        try {
            // Destroy old modal if exists
            if (this._modal) {
                this._modal.destroy();
                this._modal = null;
            }

            const modalBody = document.createElement('div');
            modalBody.style.cssText = 'display:flex;flex-direction:column;gap:20px;';

            this._modal = window.DuckControls.Modal.create({
                defaultEnter: true,
                title: 'Compare Proxies',
                subtitle: 'Analyze differences between proxies',
                icon: 'compare_arrows',
                content: modalBody,
                size: 'lg',
                closeOnOverlay: true,
                buttons: [
                    { text: 'Close', class: 'duck-btn-surface', onClick: (e, m) => m.close() }
                ],
                onClose: () => { this._modal = null; }
            });

            this._modal.open();

            // 1. TOP BAR: Selectors & Button
            const topBar = document.createElement('div');
            topBar.style.cssText = 'display:flex;gap:12px;align-items:flex-end;';
            
            const sel1Wrap = document.createElement('div');
            sel1Wrap.style.cssText = 'flex: 1; min-width: 0; overflow: hidden;';
            const sel2Wrap = document.createElement('div');
            sel2Wrap.style.cssText = 'flex: 1; min-width: 0; overflow: hidden;';
            
            // Populate options from allProxies - show proxy name or host:port format
            const opts = [
                { label: 'Select Proxy...', value: '', isPlaceholder: true },
                ...allProxies.map(p => {
                    const id = p.id || p.Id;
                    const name = p.name || p.Name;
                    const host = p.host || p.Host;
                    const port = p.port || p.Port;
                    const proxyType = p.proxy_type || p.Type || 'http';
                    let label = name || (host ? `${proxyType}://${host}:${port}` : `Proxy ${id}`);
                    return { label: label, value: String(id) };
                })
            ];
            
            let val1 = '';
            let val2 = '';

            // If user already selected exactly 2 proxies, pre-select them
            const selArray = Array.isArray(selectedIds) ? selectedIds : Array.from(selectedIds);
            if (selArray.length >= 1) val1 = String(selArray[0]);
            if (selArray.length >= 2) val2 = String(selArray[1]);

            const cb1 = window.DuckControls.ComboBox.create({
                label: 'Proxy 1',
                options: opts,
                value: val1,
                onChange: (val) => {
                    const newVal = (val && typeof val === 'object') ? val.value : val;
                    val1 = newVal == null ? '' : String(newVal);
                    if (typeof cb1.clearError === 'function') cb1.clearError();
                }
            });
            sel1Wrap.appendChild(cb1.element);
            
            const cb2 = window.DuckControls.ComboBox.create({
                label: 'Proxy 2',
                options: opts,
                value: val2,
                onChange: (val) => {
                    const newVal = (val && typeof val === 'object') ? val.value : val;
                    val2 = newVal == null ? '' : String(newVal);
                    if (typeof cb2.clearError === 'function') cb2.clearError();
                }
            });
            sel2Wrap.appendChild(cb2.element);
            
            const compareBtnWrap = document.createElement('div');
            const compareBtn = document.createElement('button');
            compareBtnWrap.appendChild(compareBtn);
            
            window.DuckControls.Button.create(compareBtn, {
                variant: 'primary',
                text: 'Compare',
                icon: 'compare_arrows',
                onClick: () => {
                    // Sync with current control values
                    if (typeof cb1.getValue === 'function') val1 = String(cb1.getValue() || '');
                    if (typeof cb2.getValue === 'function') val2 = String(cb2.getValue() || '');
                    
                    // Clear previous errors
                    if (typeof cb1.clearError === 'function') cb1.clearError();
                    if (typeof cb2.clearError === 'function') cb2.clearError();
                    
                    // Validation
                    let hasError = false;
                    if (!val1) { 
                        if (typeof cb1.setError === 'function') cb1.setError('Required');
                        hasError = true; 
                    }
                    if (!val2) { 
                        if (typeof cb2.setError === 'function') cb2.setError('Required');
                        hasError = true; 
                    }
                    if (val1 && val2 && val1 === val2) {
                        if (typeof cb2.setError === 'function') cb2.setError('Select a different proxy');
                        hasError = true;
                    }
                    
                    if (hasError) return;
                    
                    // Find proxy data
                    const p1 = allProxies.find(proxy => String(proxy.id || proxy.Id) === val1) || null;
                    const p2 = allProxies.find(proxy => String(proxy.id || proxy.Id) === val2) || null;
                    
                    if (p1 && p2) {
                        renderComparisonTable(p1, p2);
                    }
                }
            });
            
            topBar.appendChild(sel1Wrap);
            topBar.appendChild(sel2Wrap);
            topBar.appendChild(compareBtnWrap);
            modalBody.appendChild(topBar);
            
            // 2. COMPARISON TABLE
            const tableWrap = document.createElement('div');
            tableWrap.style.cssText = 'border: 1px solid var(--border-default); border-radius: var(--r-md); overflow: hidden; display: block;';
            modalBody.appendChild(tableWrap);
            
            const getProxyDisplayName = (p) => {
                if (!p) return '-';
                const name = p.name || p.Name;
                const host = p.host || p.Host;
                const port = p.port || p.Port;
                const proxyType = p.proxy_type || p.Type || 'http';
                return name || (host ? `${proxyType}://${host}:${port}` : `Proxy ${p.id || p.Id}`);
            };
            
            // Format proxy as masked string type://host:port:username:password
            const formatProxyMasked = (p) => {
                if (!p) return '-';
                const proxyType = p.proxy_type || p.Type || 'http';
                const host = p.host || p.Host || '';
                const port = p.port || p.Port || '';
                const username = p.username || p.Username || '';
                const hasPassword = !!(p.password || p.Password);
                
                let proxy = `${proxyType}://${host}:${port}`;
                if (username) {
                    proxy += `:${username}`;
                    if (hasPassword) {
                        proxy += `:********`; // Mask password
                    } else {
                        proxy += `:`;
                    }
                }
                return proxy;
            };
            
            // Format date as HH:mm:ss dd/MM/yyyy
            const formatDateTime = (dateStr) => {
                if (!dateStr) return '-';
                try {
                    const d = new Date(dateStr);
                    if (isNaN(d.getTime())) return dateStr;
                    const pad = n => String(n).padStart(2, '0');
                    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                } catch {
                    return dateStr;
                }
            };
            
            const escapeHtml = (str) => {
                if (str == null) return '';
                return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            };
            
            const renderEmptyState = (message) => {
                tableWrap.innerHTML = `
                    <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px;table-layout:fixed;">
                        <thead>
                            <tr style="background:var(--bg-subtle);border-bottom:1px solid var(--border-default);">
                                <th style="padding:10px 16px;width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">ATTRIBUTE</th>
                                <th style="padding:10px 16px;width:35%;border-left:1px solid var(--border-muted);color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">PROXY 1</th>
                                <th style="padding:10px 16px;width:35%;border-left:1px solid var(--border-muted);color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">PROXY 2</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="border-bottom:1px solid var(--border-muted);">
                                <td colspan="3" style="padding:40px 16px;text-align:center;color:var(--text-tertiary);">
                                    ${escapeHtml(message)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                `;
            };
            
            const renderComparisonTable = (p1, p2) => {
                const p1Name = getProxyDisplayName(p1);
                const p2Name = getProxyDisplayName(p2);
                
                // Get field values
                const type1 = p1?.proxy_type || p1?.Type || '';
                const type2 = p2?.proxy_type || p2?.Type || '';
                const proxy1 = formatProxyMasked(p1);
                const proxy2 = formatProxyMasked(p2);
                const rot1 = p1?.rotateApi || p1?.RotateApi || '';
                const rot2 = p2?.rotateApi || p2?.RotateApi || '';
                const created1 = formatDateTime(p1?.created || p1?.CreatedAt);
                const created2 = formatDateTime(p2?.created || p2?.CreatedAt);
                
                // Helper to build row
                const buildRow = (label, v1, v2) => {
                    const match = v1 === v2;
                    const bg = match ? 'var(--bg-base)' : 'rgba(239, 68, 68, 0.06)';
                    return `
                        <tr style="border-bottom:1px solid var(--border-muted);background:${bg};">
                            <td style="padding:10px 16px;font-weight:600;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(label)}</td>
                            <td style="padding:10px 16px;border-left:1px solid var(--border-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-family:var(--font-mono, monospace);">${escapeHtml(v1) || '-'}</td>
                            <td style="padding:10px 16px;border-left:1px solid var(--border-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-family:var(--font-mono, monospace);">${escapeHtml(v2) || '-'}</td>
                        </tr>
                    `;
                };
                
                let html = `
                    <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px;table-layout:fixed;">
                        <thead>
                            <tr style="background:var(--bg-subtle);border-bottom:1px solid var(--border-default);">
                                <th style="padding:10px 16px;width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">ATTRIBUTE</th>
                                <th style="padding:10px 16px;width:35%;border-left:1px solid var(--border-muted);color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(p1Name)}">${escapeHtml(p1Name)}</th>
                                <th style="padding:10px 16px;width:35%;border-left:1px solid var(--border-muted);color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(p2Name)}">${escapeHtml(p2Name)}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${buildRow('Type', type1, type2)}
                            ${buildRow('Proxy', proxy1, proxy2)}
                            ${buildRow('Rotate Api', rot1, rot2)}
                            ${buildRow('Created', created1, created2)}
                        </tbody>
                    </table>
                `;
                
                tableWrap.innerHTML = html;
            };
            
            // Initial state: show prompt
            renderEmptyState('Select two proxies and click Compare to see differences');
            
        } catch (err) {
            console.error('[CompareProxies.show] ERROR:', err);
            window.DuckControls?.Toast?.error('Failed to open Compare Proxies: ' + (err.message || err));
        }
    }
};
