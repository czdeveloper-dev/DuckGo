window.ProxyModals = window.ProxyModals || {};

window.ProxyModals.CompareProxies = {
    _modal: null,
    
    show(allProxies = [], selectedIds = new Set()) {
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
        
        // Populate options from allProxies
        const opts = [
            { label: 'Select Proxy...', value: '' },
            ...allProxies.map(p => ({ label: p.host || p.Host || p.id || p.Id, value: String(p.id || p.Id) }))
        ];
        
        let val1 = '';
        let val2 = '';

        // If user already selected exactly 2 proxies, pre-select them
        const selArray = Array.from(selectedIds);
        if (selArray.length >= 1) val1 = String(selArray[0]);
        if (selArray.length >= 2) val2 = String(selArray[1]);
        
        const cb1 = window.DuckControls.Select.create({
            label: 'Proxy 1',
            options: opts,
            value: val1,
            onChange: (val) => val1 = val
        });
        sel1Wrap.appendChild(cb1.element);
        
        const cb2 = window.DuckControls.Select.create({
            label: 'Proxy 2',
            options: opts,
            value: val2,
            onChange: (val) => val2 = val
        });
        sel2Wrap.appendChild(cb2.element);
        
        const compareBtnWrap = document.createElement('div');
        const compareBtn = document.createElement('button');
        compareBtnWrap.appendChild(compareBtn);
        window.DuckControls.Button.create(compareBtn, {
            variant: 'primary',
            text: 'Compare',
            icon: 'compare_arrows',
            onClick: () => doCompare()
        });
        
        topBar.appendChild(sel1Wrap);
        topBar.appendChild(sel2Wrap);
        topBar.appendChild(compareBtnWrap);
        modalBody.appendChild(topBar);
        
        // 2. COMPARISON TABLE
        const tableWrap = document.createElement('div');
        tableWrap.style.cssText = 'border: 1px solid var(--border-default); border-radius: var(--r-md); overflow: hidden; display: block;';
        modalBody.appendChild(tableWrap);
        
        const doCompare = () => {
            if (cb1.setError) cb1.setError(null);
            if (cb2.setError) cb2.setError(null);

            const p1 = allProxies.find(p => String(p.id || p.Id) === val1) || { host: '-', _empty: true };
            const p2 = allProxies.find(p => String(p.id || p.Id) === val2) || { host: '-', _empty: true };

            let p1Name = p1.host || p1.Host || p1.id || p1.Id || '-';
            let p2Name = p2.host || p2.Host || p2.id || p2.Id || '-';
            
            const fields = [
                { key: 'type', label: 'Type' },
                { key: 'host', label: 'Host' },
                { key: 'port', label: 'Port' },
                { key: 'username', label: 'Username' },
                { key: 'password', label: 'Password' },
                { key: 'status', label: 'Status' },
                { key: 'latency', label: 'Latency' },
                { key: 'rotateApi', label: 'Rotate API' },
                { key: 'note', label: 'Note' }
            ];
            
            const tableData = fields.map(f => {
                let v1 = p1[f.key] ?? p1[f.key.charAt(0).toUpperCase() + f.key.slice(1)];
                let v2 = p2[f.key] ?? p2[f.key.charAt(0).toUpperCase() + f.key.slice(1)];
                
                if (p1._empty) v1 = '-';
                else if (v1 === undefined || v1 === null) v1 = '';

                if (p2._empty) v2 = '-';
                else if (v2 === undefined || v2 === null) v2 = '';
                
                return {
                    attr: f.label,
                    val1: String(v1),
                    val2: String(v2),
                    match: String(v1) === String(v2)
                };
            });
            
            tableWrap.innerHTML = ''; // Clear existing table
            const tableControl = DuckControls.Table.create({
                container: tableWrap,
                id: 'duck-table-compare',
                columns: [
                    { id: 'attr', label: 'ATTRIBUTE', width: '30%', render: r => `<span style="font-weight:600;color:var(--text-secondary);">${escapeHtml(r.attr)}</span>` },
                    { id: 'val1', label: p1Name, width: '35%', render: r => `<span style="color:${r.match ? 'var(--text-primary)' : 'var(--danger)'};">${escapeHtml(r.val1)}</span>` },
                    { id: 'val2', label: p2Name, width: '35%', render: r => `<span style="color:${r.match ? 'var(--text-primary)' : 'var(--danger)'};">${escapeHtml(r.val2)}</span>` }
                ]
            });

            tableControl.renderData(tableData);
        };
        
        function escapeHtml(str) {
            return String(str).replace(/[&<>'"]/g, 
                tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
            );
        }
        
        doCompare();
    }
};
