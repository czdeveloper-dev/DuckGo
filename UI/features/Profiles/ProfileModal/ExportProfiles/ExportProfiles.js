window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.ExportProfiles = {
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
        info.textContent = 'Select the export format for the selected profiles. Some formats require exactly one profile to be selected.';
        modalBody.appendChild(info);

        // Format Selection
        const formatWrap = document.createElement('div');
        formatWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

        const formatLabel = document.createElement('div');
        formatLabel.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-primary);text-transform:uppercase;letter-spacing:0.5px;';
        formatLabel.textContent = 'Export Format';
        formatWrap.appendChild(formatLabel);

        const items = [
            { label: '.duckprofile - Full Profile & Fingerprint', value: 'duckprofile' },
            { label: '.json - Fingerprint Data Only', value: 'json' },
            { label: '.txt - Netscape Cookies', value: 'txt' }
        ];

        let selectedFormat = 'duckprofile';

        const formatCtrl = DuckControls.ComboBox.create({
            icon: 'export_notes',
            options: items,
            value: selectedFormat,
            onChange: (e) => {
                selectedFormat = e.target.value;
                updateValidation();
            }
        });

        formatWrap.appendChild(formatCtrl.element);
        modalBody.appendChild(formatWrap);

        // Validation Message Container
        this._valMsg = document.createElement('div');
        this._valMsg.style.cssText = 'font-size: 12px; color: #eab308; display: none; align-items: center; gap: 6px; padding: 8px; background: rgba(234, 179, 8, 0.1); border-radius: 4px;';
        modalBody.appendChild(this._valMsg);

        const updateValidation = () => {
            if (!this._modal || !this._modal.element) return;
            const submitBtn = this._modal.element.querySelector('.duck-btn-primary');
            if (!submitBtn) return;

            if ((selectedFormat === 'json' || selectedFormat === 'txt') && count !== 1) {
                submitBtn.disabled = true;
                this._valMsg.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">error</span> This format requires exactly 1 profile to be selected.';
                this._valMsg.style.display = 'flex';
            } else {
                submitBtn.disabled = false;
                this._valMsg.style.display = 'none';
            }
        };

        // Needs slight delay to let modal render buttons
        setTimeout(updateValidation, 50);

        this._modal = DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Export Profiles',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Exporting profiles`,
            icon: 'download',
            content: modalBody,
            size: 'sm',
            closeOnOverlay: true,
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Export', icon: 'file_download', class: 'duck-btn-primary', onClick: async (e, modal) => {
                    modal.setLoading(true, 'Exporting...');

                    try {
                        const idsArray = Array.isArray(selectedIds) ? selectedIds : [...selectedIds];
                        const result = await DuckBridge.call('profile.exportProfiles', { format: selectedFormat, ids: idsArray });
                        
                        if (result && result.success && result.data) {
                            // Save file
                            const blob = new Blob([result.data], { type: 'text/plain;charset=utf-8' });
                            
                            if (window.showSaveFilePicker) {
                                try {
                                    const fileHandle = await window.showSaveFilePicker({
                                        suggestedName: result.fileName || `export.${selectedFormat}`,
                                        types: [{
                                            description: `${selectedFormat.toUpperCase()} File`,
                                            accept: { 'text/plain': [`.${selectedFormat}`] },
                                        }],
                                    });
                                    const writable = await fileHandle.createWritable();
                                    await writable.write(blob);
                                    await writable.close();
                                } catch (err) {
                                    if (err.name !== 'AbortError') throw err;
                                }
                            } else {
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = result.fileName || `export.${selectedFormat}`;
                                a.style.display = 'none';
                                document.body.appendChild(a);
                                a.click();
                                setTimeout(() => {
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(a.href);
                                }, 100);
                            }
                        } else {
                            throw new Error(result?.error || 'Failed to export profiles');
                        }
                        
                        modal.close();
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
