window.AutomationModals = window.AutomationModals || {};

window.AutomationModals.EditWorkflow = {
    show(id) {
        if (!id) return;
        
        DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Edit Workflow Settings',
            subtitle: \`Workflow ID: \${id}\`,
            icon: 'settings',
            content: \`
                <div style="display: flex; flex-direction: column; gap: 16px; font-size: 13px;">
                    <div>
                        <label style="display: block; font-weight: 500; margin-bottom: 6px; color: var(--text-primary);">Workflow Name</label>
                        <input type="text" class="duck-input" value="Workflow \${id}" style="width: 100%;">
                    </div>
                    <div>
                        <label style="display: block; font-weight: 500; margin-bottom: 6px; color: var(--text-primary);">Description</label>
                        <textarea class="duck-input" style="width: 100%; min-height: 60px; resize: vertical;">Workflow description for \${id}</textarea>
                    </div>
                </div>
            \`,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Save Settings', icon: 'save', class: 'duck-btn-primary', onClick: (e, modal) => {
                    window.DuckControls?.Toast?.success(\`Workflow \${id} settings saved.\`);
                    modal.close();
                }}
            ]
        }).open();
    }
};
