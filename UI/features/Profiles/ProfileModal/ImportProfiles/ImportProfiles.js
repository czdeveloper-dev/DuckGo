window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.ImportProfiles = {
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

        const infoText = document.createElement('div');
        infoText.style.cssText = 'font-size: 13px; color: var(--text-primary); margin-bottom: 8px; line-height: 1.5;';
        infoText.innerHTML = `
            <strong>Supported Formats:</strong>
            <ul style="margin-top: 6px; margin-bottom: 0; padding-left: 20px; color: var(--text-secondary);">
                <li><strong>.duckprofile</strong>: Imports full profile and fingerprint.</li>
                <li><strong>.json</strong>: Imports fingerprint only (Requires 1 profile selected).</li>
                <li><strong>.txt</strong>: Imports cookies (Requires 1 profile selected).</li>
            </ul>
        `;
        modalBody.appendChild(infoText);

        const uploaderContainer = document.createElement('div');
        modalBody.appendChild(uploaderContainer);

        const valMsg = document.createElement('div');
        valMsg.style.cssText = 'font-size: 12px; color: #eab308; display: none; align-items: center; gap: 6px; padding: 8px; background: rgba(234, 179, 8, 0.1); border-radius: 4px;';
        modalBody.appendChild(valMsg);

        let selectedFile = null;

        const uploader = DuckControls.FileUploader.create(uploaderContainer, {
            accept: '.duckprofile,.json,.txt',
            title: 'Click or drag file here to import',
            subtitle: 'Accepts .duckprofile, .json, or .txt files',
            onFileSelect: (file) => {
                selectedFile = file;
                const submitBtn = this._modal.element.querySelector('.duck-btn-primary');
                if (!submitBtn) return;

                const ext = file.name.split('.').pop().toLowerCase();
                if ((ext === 'json' || ext === 'txt') && count !== 1) {
                    submitBtn.disabled = true;
                    valMsg.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">error</span> Importing .' + ext + ' requires exactly 1 profile to be selected.';
                    valMsg.style.display = 'flex';
                } else {
                    submitBtn.disabled = false;
                    valMsg.style.display = 'none';
                }
            }
        });

        this._modal = DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Import Profiles',
            icon: 'publish',
            content: modalBody,
            size: 'md',
            closeOnOverlay: true,
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Import', icon: 'file_upload', class: 'duck-btn-primary', onClick: async (e, modal) => {
                    if (!selectedFile) return;

                    modal.setLoading(true, 'Importing...');

                    const ext = selectedFile.name.split('.').pop().toLowerCase();
                    const reader = new FileReader();

                    reader.onload = async (event) => {
                        try {
                            const result = event.target.result;
                            const idsArray = Array.isArray(selectedIds) ? selectedIds : [...selectedIds];
                            const targetId = idsArray.length > 0 ? idsArray[0] : null;

                            if (ext === 'duckprofile') {
                                const parsedData = JSON.parse(result);
                                await DuckBridge.call('profile.importProfiles', { format: 'duckprofile', data: parsedData });
                            } else if (ext === 'json') {
                                const parsedData = JSON.parse(result);
                                await DuckBridge.call('profile.importProfiles', { format: 'json', data: parsedData, targetId: targetId });
                            } else if (ext === 'txt') {
                                await DuckBridge.call('profile.importProfiles', { format: 'txt', data: result, targetId: targetId });
                            }

                            if (window.ProfilesView?.loadProfiles) window.ProfilesView.loadProfiles();
                            
                            modal.close();
                        } catch (err) {
                            modal.setLoading(false);
                            window.DuckControls.Toast?.error?.('Import Failed', err?.message || 'Failed to import file');
                        }
                    };

                    reader.onerror = () => {
                        modal.setLoading(false);
                        window.DuckControls.Toast?.error?.('Read Error', 'Failed to read the file');
                    };

                    reader.readAsText(selectedFile);
                }}
            ],
            onClose: () => {
                this._modal = null;
            }
        });

        this._modal.open();

        // Initially disable the submit button
        const submitBtn = this._modal.element.querySelector('.duck-btn-primary');
        if (submitBtn) submitBtn.disabled = true;
    }
};

