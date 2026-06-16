window.ProxyModals = window.ProxyModals || {};

window.ProxyModals.AutoCheckSchedule = {
    show() {
        if (this._modal) this._modal.destroy();

        const content = document.createElement('div');
        content.className = 'proxy-schedule-modal';
        content.style.cssText = 'display:flex;flex-direction:column;gap:16px;width:100%;';

        const checkboxContainer = document.createElement('div');
        this._enableCtrl = DuckControls.Checkbox.create(checkboxContainer, {
            label: 'Enable Auto Check',
            checked: false,
            onChange: (e) => {
                controls.forEach(el => {
                    el.style.opacity = e.checked ? '1' : '0.5';
                    el.style.pointerEvents = e.checked ? 'auto' : 'none';
                });
            }
        });
        content.appendChild(checkboxContainer);

        const timeRow = document.createElement('div');
        timeRow.style.cssText = 'display:flex;align-items:flex-end;gap:12px;margin-bottom:8px;';

        this._hourCtrl = DuckControls.SpinNumber.create({ label: 'HOURS', value: 0, min: 0, max: 23, width: '80px' });
        this._minCtrl = DuckControls.SpinNumber.create({ label: 'MINUTES', value: 0, min: 0, max: 59, width: '80px' });
        this._secCtrl = DuckControls.SpinNumber.create({ label: 'SECONDS', value: 0, min: 0, max: 59, width: '80px' });
        
        timeRow.appendChild(this._hourCtrl.element);
        timeRow.appendChild(this._minCtrl.element);
        timeRow.appendChild(this._secCtrl.element);
        content.appendChild(timeRow);

        const delayRow = document.createElement('div');
        delayRow.style.cssText = 'display:flex;align-items:flex-end;gap:12px;';
        
        this._delayCtrl = DuckControls.SpinNumber.create({ label: 'DELAY BETWEEN CHECKS (MS)', value: 1000, min: 0, max: 60000, width: '264px' });
        delayRow.appendChild(this._delayCtrl.element);
        content.appendChild(delayRow);
        
        // Initial state
        const controls = [this._hourCtrl.element, this._minCtrl.element, this._secCtrl.element, this._delayCtrl.element];
        controls.forEach(el => {
            el.style.opacity = '0.5';
            el.style.pointerEvents = 'none';
        });

        this._modal = DuckControls.Modal.create({
            title: 'Auto Check Schedule',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">info</span> Setup a schedule to automatically verify proxy status at a regular interval.`,
            icon: 'schedule',
            content: content,
            size: 'md',
            onOpen: () => {
                setTimeout(() => {
                    if (document.activeElement && this._modal.container.contains(document.activeElement)) {
                        document.activeElement.blur();
                    }
                }, 150);
            },
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Save Schedule', icon: 'save', class: 'duck-btn-primary', onClick: async (e, modal) => {
                    const data = {
                        enabled: this._enableCtrl.getChecked(),
                        hours: this._hourCtrl.getValue(),
                        minutes: this._minCtrl.getValue(),
                        seconds: this._secCtrl.getValue(),
                        delayMs: this._delayCtrl.getValue()
                    };
                    modal.setLoading(true, 'Saving...');
                    try {
                        await DuckBridge.call('proxy.scheduleAutoCheck', data);
                        window.DuckControls.Toast?.success?.('Schedule updated successfully');
                        modal.close();
                    } catch (err) {
                        modal.setLoading(false);
                        window.DuckControls.Toast?.error?.('Failed to update schedule');
                    }
                }}
            ]
        });

        // Load existing setting if possible (mocked here)
        DuckBridge.call('proxy.getSchedule').then(res => {
            if (res) {
                this._enableCtrl.setChecked(res.enabled);
                this._hourCtrl.setValue(res.hours || 0);
                this._minCtrl.setValue(res.minutes || 0);
                this._secCtrl.setValue(res.seconds || 0);
                this._delayCtrl.setValue(res.delayMs || 1000);

                if (res.enabled) {
                    controls.forEach(el => {
                        el.style.opacity = '1';
                        el.style.pointerEvents = 'auto';
                    });
                }
            }
        }).catch(() => {});

        this._modal.open();
    }
};
