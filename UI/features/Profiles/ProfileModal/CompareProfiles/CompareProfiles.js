window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.CompareProfiles = {
    _modal: null,
    
    async show(allProfiles = [], selectedIds = new Set()) {
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

            // 1. TOP BAR: Selectors & Button
            const topBar = document.createElement('div');
            topBar.style.cssText = 'display:flex;gap:12px;align-items:flex-end;';
            
            // Wrapper divs - KHÔNG custom style nữa, chỉ dùng class của DuckControls.ComboBox tự động tạo wrapper
            const sel1Wrap = document.createElement('div');
            sel1Wrap.style.cssText = 'flex: 1; min-width: 0; overflow: hidden;';
            const sel2Wrap = document.createElement('div');
            sel2Wrap.style.cssText = 'flex: 1; min-width: 0; overflow: hidden;';
            
            // Populate options from allProfiles
            const opts = [
                { label: 'Select Profile...', value: '', isPlaceholder: true },
                ...allProfiles.map(p => ({ 
                    label: p.name || 'Unnamed', 
                    value: String(p.id),
                    browserType: p.BrowserType || p.browserType || 'Not Set',
                    browserVersion: p.BrowserVersion || p.browserVersion || ''
                }))
            ];
            
            // Always start with empty comboboxes
            let val1 = '';
            let val2 = '';
            
            // ComboBox sẽ tự tạo wrapper div.duck-combobox bên trong sel1Wrap/sel2Wrap
            const cb1 = window.DuckControls.ComboBox.create({
                label: 'Profile 1',
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
                label: 'Profile 2',
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
            // KHÔNG xoay icon, icon compare_arrows giữ nguyên
            window.DuckControls.Button.create(compareBtn, {
                variant: 'primary',
                text: 'Compare',
                icon: 'compare_arrows',  // Giữ nguyên icon, KHÔNG xoay
                onClick: async () => {
                    // Sync with current control values
                    if (typeof cb1.getValue === 'function') val1 = String(cb1.getValue() || '');
                    if (typeof cb2.getValue === 'function') val2 = String(cb2.getValue() || '');
                    
                    // Clear previous errors
                    if (typeof cb1.clearError === 'function') cb1.clearError();
                    if (typeof cb2.clearError === 'function') cb2.clearError();
                    
                    this._modal.setLoading(true, 'Comparing...');
                    
                    try {
                        const result = await window.DuckBridge.call('profile.compare', {
                            profileId1: val1 ? parseInt(val1) : null,
                            profileId2: val2 ? parseInt(val2) : null
                        });
                        
                        this._modal.setLoading(false);
                        
                        if (result && result.profile1 && result.profile2) {
                            // Đảm bảo lấy BrowserType từ kết quả backend
                            const p1Data = { 
                                id: result.profile1.id, 
                                name: result.profile1.name, 
                                browserVersion: result.profile1.browserVersion,
                                profileData: result.profile1.profileData,
                                BrowserType: result.profile1.BrowserType || result.profile1.browserType || 'Not Set',
                            };
                            const p2Data = { 
                                id: result.profile2.id, 
                                name: result.profile2.name, 
                                browserVersion: result.profile2.browserVersion,
                                profileData: result.profile2.profileData,
                                BrowserType: result.profile2.BrowserType || result.profile2.browserType || 'Not Set',
                            };
                            this._renderTable(p1Data, p2Data);
                        }
                    } catch (err) {
                        this._modal.setLoading(false);
                        const msg = err.message || String(err);
                        if (msg.includes('Profile 1')) {
                            if (typeof cb1.setError === 'function') cb1.setError('Required');
                        }
                        if (msg.includes('Profile 2')) {
                            if (typeof cb2.setError === 'function') cb2.setError('Required');
                        }
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
            
            // Cache for parsed profile data
            const profileDataCache = new Map();
            
            const getCachedProfileData = (profile) => {
                const id = String(profile.id || '');
                if (!profileDataCache.has(id)) {
                    try {
                        const rawData = profile.ProfileData || profile.profileData || '{}';
                        profileDataCache.set(id, JSON.parse(rawData));
                    } catch (e) {
                        profileDataCache.set(id, {});
                    }
                }
                return profileDataCache.get(id);
            };
            
            const getFieldValue = (profile, fieldKey) => {
                if (!profile) return 'Not Set';
                const data = getCachedProfileData(profile);
                
                const cap = (s) => s ? (s.charAt(0).toUpperCase() + s.slice(1)) : s;
                
                // Platform mapping
                const platformMap = {
                    'Win32': 'Windows', 'Win64': 'Windows',
                    'Darwin': 'macOS', 'Linux': 'Linux'
                };
                
                const fieldMap = {
                    'browserType': () => {
                        // Đọc BrowserType từ profile - có thể là BrowserType hoặc browserType hoặc nằm trong profileData.System.BrowserType
                        const v = profile.BrowserType || profile.browserType;
                        if (v == null) {
                            // Thử đọc từ profileData
                            try {
                                const pd = getCachedProfileData(profile);
                                return pd?.System?.BrowserType || pd?.browserType || 'Not Set';
                            } catch {
                                return 'Not Set';
                            }
                        }
                        return String(v);
                    },
                    'browserVersion': () => profile.BrowserVersion || profile.browserVersion || '',
                    'platform': () => {
                        const platform = data.System?.Platform?.Value || data.System?.Platform;
                        if (!platform) return 'Not Set';
                        return platformMap[platform] || String(platform);
                    },
                    'model': () => {
                        const model = data.System?.Device?.Model || data.Device?.Model || data.System?.Model?.Value || data.System?.Model;
                        if (!model) return 'Not Set';
                        return String(model);
                    },
                    'audioContext': () => {
                        const audio = data.Fingerprint?.Audio;
                        if (!audio) return 'Not Set';
                        return cap(audio.Mode || audio.mode) || 'Not Set';
                    },
                    'clientRects': () => {
                        const cr = data.Fingerprint?.ClientRects;
                        if (!cr) return 'Not Set';
                        return cap(cr.Mode || cr.mode) || 'Not Set';
                    },
                    'webrtc': () => {
                        const mode = data.Fingerprint?.WebRTcMode || data.Fingerprint?.WebRtcMode || data.Fingerprint?.WebRTC?.Mode;
                        return cap(mode) || 'Not Set';
                    },
                    'canvas': () => {
                        const canvas = data.Fingerprint?.Canvas;
                        if (!canvas) return 'Not Set';
                        return cap(canvas.Mode || canvas.mode) || 'Not Set';
                    },
                    'webgl': () => {
                        const webgl = data.Fingerprint?.WebGL;
                        if (!webgl) return 'Not Set';
                        return cap(webgl.Mode || webgl.mode) || 'Not Set';
                    }
                };
                
                const getter = fieldMap[fieldKey];
                if (getter) {
                    const result = getter();
                    return result == null ? 'Not Set' : String(result);
                }
                
                return profile[fieldKey] || data.Fingerprint?.[fieldKey] || 'Not Set';
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
                                <th style="padding:10px 16px;width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Feature</th>
                                <th style="padding:10px 16px;width:35%;border-left:1px solid var(--border-muted);color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Profile 1</th>
                                <th style="padding:10px 16px;width:35%;border-left:1px solid var(--border-muted);color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Profile 2</th>
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
            
            this._renderTable = (p1, p2) => {
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
                
                const p1Header = p1 ? (p1.name || 'Profile 1') : 'Profile 1';
                const p2Header = p2 ? (p2.name || 'Profile 2') : 'Profile 2';
                
                let html = `
                    <table style="width:100%;border-collapse:collapse;text-align:left;font-size:13px;table-layout:fixed;">
                        <thead>
                            <tr style="background:var(--bg-subtle);border-bottom:1px solid var(--border-default);">
                                <th style="padding:10px 16px;width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Feature</th>
                                <th style="padding:10px 16px;width:35%;border-left:1px solid var(--border-muted);color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(p1Header)}">${escapeHtml(p1Header)}</th>
                                <th style="padding:10px 16px;width:35%;border-left:1px solid var(--border-muted);color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(p2Header)}">${escapeHtml(p2Header)}</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                fields.forEach(f => {
                    const v1 = p1 ? getFieldValue(p1, f.key) : '-';
                    const v2 = p2 ? getFieldValue(p2, f.key) : '-';
                    const match = v1 === v2;
                    const rowBg = match ? 'var(--bg-base)' : 'rgba(239, 68, 68, 0.06)';
                    
                    html += `
                        <tr style="border-bottom:1px solid var(--border-muted);background:${rowBg};">
                            <td style="padding:10px 16px;font-weight:600;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(f.label)}">${escapeHtml(f.label)}</td>
                            <td style="padding:10px 16px;border-left:1px solid var(--border-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(v1)}">${escapeHtml(v1)}</td>
                            <td style="padding:10px 16px;border-left:1px solid var(--border-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(v2)}">${escapeHtml(v2)}</td>
                        </tr>
                    `;
                });
                
                html += '</tbody></table>';
                tableWrap.innerHTML = html;
            };
            
            // Initial state: show table with prompt to select profiles
            renderEmptyState('Select two profiles and click Compare to see differences');
        } catch (err) {
            console.error('[CompareProfiles.show] ERROR:', err);
            window.DuckControls?.Toast?.error('Failed to open Compare Profiles: ' + (err.message || err));
        }
    }
};
