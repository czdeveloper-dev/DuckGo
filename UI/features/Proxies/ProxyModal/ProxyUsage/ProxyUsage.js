window.ProxyModals = window.ProxyModals || {};

window.ProxyModals.Usage = {
    show() {
        if (this._modal) this._modal.destroy();

        const content = document.createElement('div');
        content.className = 'proxy-usage-modal';
        content.style.cssText = 'display:flex;flex-direction:column;gap:16px;width:600px;';

        const desc = document.createElement('div');
        desc.className = 'ui-label';
        desc.style.color = 'var(--text-secondary)';
        desc.textContent = 'This list shows which profiles are using the proxies in your system.';
        content.appendChild(desc);

        // Table container
        const tableWrap = document.createElement('div');
        tableWrap.className = 'card data-surface';
        tableWrap.style.cssText = 'height:300px;overflow:auto;';

        content.appendChild(tableWrap);

        this._modal = DuckControls.Modal.create({
            title: 'Proxy Usage',
            content: content,
            width: '640px',
            actions: [
                { text: 'Close', variant: 'ghost', onClick: () => this._modal.close() }
            ]
        });

        this._modal.open();

        // Load data and render table
        this._loadData(tableWrap);
    },

    async _loadData(container) {
        try {
            // Mock bridge call or use a real one
            // We assume 'proxy.getUsage' returns { host, profiles: ['Profile 1', 'Profile 2'] }
            let data = await DuckBridge.call('proxy.getUsage').catch(() => []);
            
            // Mocking if no data
            if (!data || data.length === 0) {
                data = [
                    { host: '192.168.1.1:8080', profiles: ['Profile A', 'Profile B'] },
                    { host: '10.0.0.5:1080', profiles: ['My Test Profile'] }
                ];
            }

            const cols = [
                { id: 'proxy', label: 'PROXY HOST', width: '250px', render: (r) => { const el = document.createElement('span'); el.textContent = r.host; return el; } },
                { id: 'profiles', label: 'ATTACHED PROFILES', width: 'auto', render: (r) => { 
                    const el = document.createElement('span'); 
                    el.textContent = (r.profiles || []).join(', ') || 'None'; 
                    return el; 
                }}
            ];

            this._table = DuckControls.Table.create({
                container: container,
                id: 'duck-table-proxy-usage',
                emptyText: 'No proxies are currently attached to any profiles.',
                columns: cols
            });

            this._table.renderData(data);
        } catch (e) {
            console.error(e);
        }
    }
};
