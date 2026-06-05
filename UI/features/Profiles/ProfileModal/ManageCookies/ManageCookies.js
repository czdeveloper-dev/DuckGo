window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.ManageCookies = {
    _modal: null,
    
    show(selectedIds) {
        if (this._modal) {
            this._modal.destroy();
            this._modal = null;
        }

        const isSingle = selectedIds && selectedIds.length === 1;
        // In a real app, if multiple are selected, we might disable this or show a combined view.
        // Assuming single selection for cookies to be practical.
        if (!isSingle) {
            console.warn('Manage Cookies: Please select exactly one profile to manage cookies.');
            return;
        }

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'display:flex;flex-direction:column;gap:16px; height:100%;';
        

        // Mock Cookies data
        let cookiesData = [
            { name: 'session_id', domain: '.google.com', value: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0', expires: '2026-12-31T23:59:59.000Z' },
            { name: 'auth_token', domain: 'facebook.com', value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ', expires: 'Session' },
            { name: '_ga', domain: '.example.com', value: 'GA1.2.123456789.123456789', expires: '2027-01-01T00:00:00.000Z' }
        ];

        // Table container
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = 'flex: 1; overflow-y: auto; border: 1px solid var(--border-default); border-radius: var(--r-md); background: var(--bg-elevated);';
        
        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; table-layout: fixed;';
        
        const thead = document.createElement('thead');
        thead.style.cssText = 'position: sticky; top: 0; background: var(--bg-surface); box-shadow: 0 1px 0 var(--border-default); z-index: 10;';
        thead.innerHTML = `
            <tr>
                <th style="padding: 8px 12px; font-weight: 600; color: var(--text-secondary); width: 20%;">Name</th>
                <th style="padding: 8px 12px; font-weight: 600; color: var(--text-secondary); width: 20%;">Domain</th>
                <th style="padding: 8px 12px; font-weight: 600; color: var(--text-secondary); width: 40%;">Value</th>
                <th style="padding: 8px 12px; font-weight: 600; color: var(--text-secondary); width: 20%;">Expires</th>
            </tr>
        `;
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        modalBody.appendChild(tableContainer);
        
        const renderTable = () => {
            tbody.innerHTML = '';
            if (cookiesData.length === 0) {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td colspan="4" style="padding: 20px; text-align: center; color: var(--text-tertiary);">No cookies found</td>`;
                tbody.appendChild(tr);
                return;
            }
            
            cookiesData.forEach(c => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid var(--border-default)';
                
                const escapeHtml = (str) => String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
                
                tr.innerHTML = `
                    <td style="padding: 8px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.name)}</td>
                    <td style="padding: 8px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.domain)}</td>
                    <td style="padding: 8px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: monospace; color: var(--text-secondary);">${escapeHtml(c.value)}</td>
                    <td style="padding: 8px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px;">${escapeHtml(c.expires)}</td>
                `;
                tbody.appendChild(tr);
            });
        };
        
        renderTable();

        this._modal = window.DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Manage Cookies',
            subtitle: 'View, add, or delete cookies for the selected profile.',
            icon: 'cookie',
            content: modalBody,
            size: 'xl',
            buttons: [
                {
                    text: 'Import JSON',
                    icon: 'upload',
                    class: 'duck-btn-surface',
                    position: 'left',
                    onClick: () => {
                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = '.json';
                        fileInput.onchange = (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                try {
                                    const parsed = JSON.parse(ev.target.result);
                                    if (Array.isArray(parsed)) {
                                        cookiesData = parsed;
                                        renderTable();
                                    }
                                } catch(err) {
                                    console.error('Import Error: Invalid JSON format.');
                                }
                            };
                            reader.readAsText(file);
                        };
                        fileInput.click();
                    }
                },
                {
                    text: 'Export JSON',
                    icon: 'download',
                    class: 'duck-btn-surface',
                    position: 'left',
                    onClick: async () => {
                        if (cookiesData.length === 0) {
                            return;
                        }
                        const out = JSON.stringify(cookiesData, null, 2);
                        try {
                            if (window.showSaveFilePicker) {
                                const handle = await window.showSaveFilePicker({
                                    suggestedName: 'cookies.json',
                                    types: [{ description: 'JSON Files', accept: {'application/json': ['.json']} }]
                                });
                                const writable = await handle.createWritable();
                                await writable.write(out);
                                await writable.close();
                            } else {
                                const blob = new Blob([out], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'cookies.json';
                                a.click();
                                URL.revokeObjectURL(url);
                            }
                        } catch (err) {
                            if (err.name !== 'AbortError') console.error('Save error:', err);
                        }
                    }
                },
                {
                    text: 'Clear All',
                    icon: 'delete_sweep',
                    class: 'duck-btn-danger',
                    onClick: () => {
                        if (window.DuckControls && window.DuckControls.Modal) {
                            window.DuckControls.Modal.confirm('Are you sure you want to delete all cookies for this profile? This action cannot be undone.').then(res => {
                                if (res) {
                                    cookiesData = [];
                                    renderTable();
                                }
                            });
                        }
                    }
                },
                { text: 'Close', class: 'duck-btn-primary', onClick: (e, m) => m.close() }
            ],
            closeOnOverlay: false,
            onClose: () => { this._modal = null; }
        });

        this._modal.open();
    }
};
