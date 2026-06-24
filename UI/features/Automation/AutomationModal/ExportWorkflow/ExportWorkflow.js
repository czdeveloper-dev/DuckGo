window.AutomationModals = window.AutomationModals || {};

window.AutomationModals.ExportWorkflow = {
    show(selectedIds) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);
        if (count === 0) return;

        const isSingle = count === 1;
        const title = isSingle ? 'Export Workflow' : 'Export Selected Workflows';
        
        DuckControls.Modal.create({
            defaultEnter: true,
            title: title,
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Selected: ${count} workflow${count > 1 ? 's' : ''}`,
            icon: 'upload',
            content: `
                <div style="font-size: 13px; color: var(--text-primary); line-height: 1.5;">
                    <p style="margin-bottom: 12px; font-weight: 500;">Export ${count} workflow${count > 1 ? 's' : ''} to file?</p>
                    <div style="background: var(--surface-2); border: 1px solid var(--border-default); padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                        <ul style="list-style: disc; margin-left: 20px; color: var(--text-secondary); margin-bottom: 0;">
                            <li><strong>Format:</strong> The workflows will be exported as a single JSON file.</li>
                            <li><strong>Included:</strong> Nodes, variables, and logic configurations.</li>
                        </ul>
                    </div>
                </div>
            `,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Export', icon: 'download', class: 'duck-btn-primary', onClick: (e, modal) => {
                    window.DuckControls?.Toast?.success(\`Exported \${count} workflow(s) successfully.\`);
                    modal.close();
                }}
            ]
        }).open();
    }
};
