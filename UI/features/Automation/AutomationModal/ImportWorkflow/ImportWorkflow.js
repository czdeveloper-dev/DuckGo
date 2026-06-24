window.AutomationModals = window.AutomationModals || {};

window.AutomationModals.ImportWorkflow = {
    show() {
        DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Import Workflow',
            subtitle: 'Import workflow configuration from file',
            icon: 'download',
            content: `
                <div style="font-size: 13px; color: var(--text-primary); line-height: 1.5;">
                    <div style="border: 2px dashed var(--border-default); border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 16px; cursor: pointer; transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border-default)'" onclick="document.getElementById('import-file-input').click()">
                        <span class="material-symbols-outlined" style="font-size: 32px; color: var(--text-tertiary); margin-bottom: 8px;">upload_file</span>
                        <div style="font-weight: 500; margin-bottom: 4px;">Click to select file or drag and drop</div>
                        <div style="color: var(--text-tertiary); font-size: 12px;">Supports .json workflow files</div>
                        <input type="file" id="import-file-input" style="display: none" accept=".json" onchange="document.getElementById('import-file-name').textContent = this.files[0] ? this.files[0].name : 'No file selected'">
                    </div>
                    <div id="import-file-name" style="text-align: center; color: var(--accent); font-weight: 500; margin-bottom: 8px; min-height: 20px;"></div>
                </div>
            `,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Import', icon: 'download', class: 'duck-btn-primary', onClick: (e, modal) => {
                    window.DuckControls?.Toast?.success('Workflow imported successfully.');
                    modal.close();
                }}
            ]
        }).open();
    }
};
