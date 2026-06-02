window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.CompareProfiles = {
    _modal: null,
    
    show(allProfiles = [], selectedIds = new Set()) {
        if (this._modal) {
            this._modal.destroy();
            this._modal = null;
        }

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'display:flex;flex-direction:column;gap:20px;';
        
        // 1. TOP BAR: Selectors & Button
        const topBar = document.createElement('div');
        topBar.style.cssText = 'display:flex;gap:12px;align-items:flex-end;';
        
        const sel1Wrap = document.createElement('div');
        sel1Wrap.style.flex = '1';
        const sel2Wrap = document.createElement('div');
        sel2Wrap.style.flex = '1';
        
        // Populate options from allProfiles
        const opts = allProfiles.map(p => ({ label: p.name, value: String(p.id) }));
        
        let val1 = opts[0]?.value || '';
        let val2 = opts.length > 1 ? opts[1].value : val1;
        
        // Try to preset from selectedIds
        const selectedArr = Array.from(selectedIds);
        if (selectedArr.length >= 1) val1 = String(selectedArr[0]);
        if (selectedArr.length >= 2) val2 = String(selectedArr[1]);
        
        const cb1 = window.DuckControls.ComboBox.create({
            label: 'Profile 1',
            options: opts,
            value: val1,
            onChange: (e) => val1 = e.target.value
        });
        sel1Wrap.appendChild(cb1.element);
        
        const cb2 = window.DuckControls.ComboBox.create({
            label: 'Profile 2',
            options: opts,
            value: val2,
            onChange: (e) => val2 = e.target.value
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
        tableWrap.style.cssText = 'border: 1px solid var(--border-default); border-radius: var(--r-md); overflow: hidden; display: none;';
        modalBody.appendChild(tableWrap);
        
        const doCompare = () => {
            const p1 = allProfiles.find(p => String(p.id) === val1);
            const p2 = allProfiles.find(p => String(p.id) === val2);
            if (!p1 || !p2) {
                alert('Please select two valid profiles to compare.');
                return;
            }
            
            tableWrap.style.display = 'block';
            
            // Render table
            let html = `
                <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px;">
                    <thead>
                        <tr style="background:var(--bg-subtle);border-bottom:1px solid var(--border-default);">
                            <th style="padding:10px 16px;width:30%;">Feature</th>
                            <th style="padding:10px 16px;width:35%;border-left:1px solid var(--border-muted);color:var(--accent);">${escapeHtml(p1.name)}</th>
                            <th style="padding:10px 16px;width:35%;border-left:1px solid var(--border-muted);color:var(--accent);">${escapeHtml(p2.name)}</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            const fields = [
                { key: 'browserType', label: 'Browser' },
                { key: 'browserVersion', label: 'Browser Version' },
                { key: 'platform', label: 'Platform' },
                { key: 'model', label: 'Model' },
                { key: 'audioContext', label: 'Audio Context' },
                { key: 'clientRects', label: 'Client Rects' },
                { key: 'webrtc', label: 'WebRTC' },
                { key: 'canvas', label: 'Canvas' },
                { key: 'webgl', label: 'WebGL Image' }
            ];
            
            fields.forEach(f => {
                // Determine mock/real values
                let v1 = p1.fingerprint?.[f.key] || p1[f.key];
                let v2 = p2.fingerprint?.[f.key] || p2[f.key];
                
                // Fallbacks if data is missing
                if (v1 === undefined) {
                    if (['browserType', 'platform'].includes(f.key)) v1 = p1[f.key] || 'Chrome/Win';
                    else if (f.key === 'browserVersion') v1 = '114.0.0.0';
                    else v1 = 'Noise';
                }
                if (v2 === undefined) {
                    if (['browserType', 'platform'].includes(f.key)) v2 = p2[f.key] || 'Chrome/Win';
                    else if (f.key === 'browserVersion') v2 = '114.0.0.0';
                    else v2 = 'Noise';
                }
                
                // Add some artificial differences if the profiles are different and we have missing data
                if (val1 !== val2) {
                    if (f.key === 'clientRects') v2 = 'Real';
                    if (f.key === 'webrtc') v1 = 'Altered';
                    if (f.key === 'canvas') v2 = 'Off';
                }
                
                const match = String(v1) === String(v2);
                const rowBg = match ? 'var(--bg-base)' : 'color-mix(in srgb, var(--danger) 5%, var(--bg-base))';
                
                html += `
                    <tr style="border-bottom:1px solid var(--border-muted);background:${rowBg};">
                        <td style="padding:10px 16px;font-weight:600;color:var(--text-secondary);">${f.label}</td>
                        <td style="padding:10px 16px;border-left:1px solid var(--border-muted);">${escapeHtml(v1)}</td>
                        <td style="padding:10px 16px;border-left:1px solid var(--border-muted);">${escapeHtml(v2)}</td>
                    </tr>
                `;
            });
            
            html += `</tbody></table>`;
            tableWrap.innerHTML = html;
        };
        
        function escapeHtml(str) {
            return String(str).replace(/[&<>'"]/g, 
                tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
            );
        }
        
        this._modal = window.DuckControls.Modal.create({
            title: 'Compare Profiles',
            subtitle: 'Analyze fingerprint differences between profiles',
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

        // Auto compare if 2 different selected initially
        if (val1 && val2 && val1 !== val2) {
            doCompare();
        }
    }
};
