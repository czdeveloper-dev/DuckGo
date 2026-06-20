window.ProxyModals = window.ProxyModals || {};

window.ProxyModals.ExportProxies = {
    _modal: null,
    
    show(selectedIds) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);
        
        if (this._modal) {
            this._modal.destroy();
            this._modal = null;
        }

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'display:flex;flex-direction:column;gap:16px;';

        const info = document.createElement('div');
        info.style.cssText = 'font-size: 13px; color: var(--text-secondary);';
        info.innerHTML = `Select the export format for the <strong>${count}</strong> selected proxies.`;
        modalBody.appendChild(info);

        // Format Selection
        const formatWrap = document.createElement('div');
        formatWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

        const formatLabel = document.createElement('div');
        formatLabel.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-primary);text-transform:uppercase;letter-spacing:0.5px;';
        formatLabel.textContent = 'Export Format';
        formatWrap.appendChild(formatLabel);

        const items = [
            { label: '.txt - Plain Text (IP:PORT:USER:PASS)', value: 'txt' },
            { label: '.csv - Comma Separated Values', value: 'csv' },
            { label: '.json - JSON Format', value: 'json' }
        ];

        let selectedFormat = 'txt';

        const formatCtrl = DuckControls.ComboBox.create({
            icon: 'export_notes',
            options: items,
            value: selectedFormat,
            onChange: (e) => {
                selectedFormat = e.target.value;
            }
        });

        formatWrap.appendChild(formatCtrl.element);
        modalBody.appendChild(formatWrap);

        this._modal = DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Export Proxies',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Exporting proxies`,
            icon: 'download',
            content: modalBody,
            size: 'sm',
            closeOnOverlay: false,
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Export', icon: 'file_download', class: 'duck-btn-primary', onClick: async (e, modal) => {
                    modal.setLoading(true, 'Preparing...');

                    const idsArray = Array.isArray(selectedIds) ? selectedIds : [...selectedIds];
                    
                    try {
                        // Get content from backend
                        const result = await DuckBridge.call('proxy.export', { 
                            format: selectedFormat, 
                            ids: idsArray,
                            contentOnly: true 
                        });
                        
                        if (!result || !result.content) {
                            throw new Error(result?.error || 'Failed to prepare export');
                        }
                        
                        const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' });
                        
                        if (window.showSaveFilePicker) {
                            // Modern File System Access API
                            try {
                                const fileHandle = await window.showSaveFilePicker({
                                    suggestedName: result.suggestedName || `proxies_export.${selectedFormat}`,
                                    types: [{
                                        description: `${selectedFormat.toUpperCase()} File`,
                                        accept: { 'text/plain': [`.${selectedFormat}`] },
                                    }],
                                });
                                const writable = await fileHandle.createWritable();
                                await writable.write(blob);
                                await writable.close();
                                modal.setLoading(false);
                                modal.close();
                            } catch (err) {
                                if (err.name === 'AbortError') {
                                    // User cancelled - don't show error
                                    modal.setLoading(false);
                                    return;
                                }
                                throw err;
                            }
                        } else {
                            // Fallback: use download link
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = result.suggestedName || `proxies_export.${selectedFormat}`;
                            a.style.display = 'none';
                            document.body.appendChild(a);
                            a.click();
                            setTimeout(() => {
                                document.body.removeChild(a);
                                URL.revokeObjectURL(a.href);
                            }, 100);
                            modal.setLoading(false);
                            modal.close();
                        }
                    } catch (err) {
                        modal.setLoading(false);
                        window.DuckControls.Toast?.error?.('Export Failed', err?.message || 'An error occurred while exporting');
                    }
                }}
            ],
            onClose: () => {
                this._modal = null;
            }
        });

        this._modal.open();
    }
};
