window.ProxyModals = window.ProxyModals || {};

window.ProxyModals.AutoCheckSchedule = {
    _modal: null,

    show() {
        if (this._modal) this._modal.destroy();

        const content = document.createElement('div');
        content.className = 'proxy-schedule-modal';
        content.style.cssText = 'display:flex;flex-direction:column;gap:16px;width:100%;';

        // Status indicator
        const statusWrap = document.createElement('div');
        statusWrap.id = 'schedule-status';
        statusWrap.style.cssText = 'display:flex;align-items:center;gap:8px;padding:12px;background:var(--bg-subtle);border-radius:8px;';
        statusWrap.innerHTML = `
            <span id="schedule-status-dot" class="material-symbols-outlined" style="font-size:12px;color:var(--text-tertiary);">circle</span>
            <span id="schedule-status-text" style="font-size:12px;color:var(--text-secondary);">Loading status...</span>
        `;
        content.appendChild(statusWrap);

        // Enable checkbox
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

        // Time interval controls
        const timeRow = document.createElement('div');
        timeRow.style.cssText = 'display:flex;align-items:flex-end;gap:12px;';

        this._hourCtrl = DuckControls.SpinNumber.create({ label: 'HOURS', value: 0, min: 0, max: 23, width: '80px' });
        this._minCtrl = DuckControls.SpinNumber.create({ label: 'MINUTES', value: 0, min: 0, max: 59, width: '80px' });
        this._secCtrl = DuckControls.SpinNumber.create({ label: 'SECONDS', value: 0, min: 0, max: 59, width: '80px' });
        
        timeRow.appendChild(this._hourCtrl.element);
        timeRow.appendChild(this._minCtrl.element);
        timeRow.appendChild(this._secCtrl.element);
        content.appendChild(timeRow);

        // Delay control
        const delayRow = document.createElement('div');
        delayRow.style.cssText = 'display:flex;align-items:flex-end;gap:12px;';
        
        this._delayCtrl = DuckControls.SpinNumber.create({ label: 'DELAY BETWEEN CHECKS (MS)', value: 1000, min: 0, max: 60000, width: '264px' });
        delayRow.appendChild(this._delayCtrl.element);
        content.appendChild(delayRow);
        
        // Initial state - controls disabled until enabled
        const controls = [this._hourCtrl.element, this._minCtrl.element, this._secCtrl.element, this._delayCtrl.element];
        controls.forEach(el => {
            el.style.opacity = '0.5';
            el.style.pointerEvents = 'none';
        });

        // Helper to update status display
        const updateStatusDisplay = (statusObj) => {
            const dot = document.getElementById('schedule-status-dot');
            const text = document.getElementById('schedule-status-text');
            if (dot && text) {
                if (statusObj && statusObj.isRunning) {
                    dot.style.color = 'var(--success)';
                    dot.textContent = 'circle';
                    
                    if (statusObj.message) {
                        text.textContent = statusObj.message;
                    } else {
                        text.textContent = statusObj.nextRun ? `Running. Next check: ${statusObj.nextRun}` : 'Running';
                    }
                } else {
                    dot.style.color = 'var(--text-tertiary)';
                    dot.textContent = 'circle';
                    text.textContent = 'Schedule is not active';
                }
            }
        };

        let statusInterval = null;

        this._modal = DuckControls.Modal.create({
            title: 'Auto Check Schedule',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">info</span> Setup a schedule to automatically verify proxy status at a regular interval.`,
            icon: 'schedule',
            content: content,
            size: 'md',
            closeOnOverlay: false,
            onOpen: () => {
                setTimeout(() => {
                    if (document.activeElement && this._modal.container.contains(document.activeElement)) {
                        document.activeElement.blur();
                    }
                }, 150);

                // Start polling status
                statusInterval = setInterval(async () => {
                    try {
                        const status = await DuckBridge.call('proxy.getScheduleStatus');
                        updateStatusDisplay(status);
                    } catch (e) {
                        // ignore errors during polling
                    }
                }, 1000);
            },
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Save Schedule', icon: 'save', class: 'duck-btn-primary', onClick: async (e, modal) => {
                    const enabled = this._enableCtrl.isChecked ? this._enableCtrl.isChecked() : (this._enableCtrl.checked || false);
                    const hours = this._hourCtrl.getValue ? this._hourCtrl.getValue() : (this._hourCtrl.value || 0);
                    const minutes = this._minCtrl.getValue ? this._minCtrl.getValue() : (this._minCtrl.value || 0);
                    const seconds = this._secCtrl.getValue ? this._secCtrl.getValue() : (this._secCtrl.value || 0);
                    const delayMs = this._delayCtrl.getValue ? this._delayCtrl.getValue() : (this._delayCtrl.value || 1000);
                    
                    if (enabled && hours === 0 && minutes === 0 && seconds === 0) {
                        window.DuckControls.Toast?.warning?.('Invalid Interval', 'Please set an interval greater than 0');
                        return;
                    }
                    
                    const data = {
                        enabled: enabled,
                        hours: hours,
                        minutes: minutes,
                        seconds: seconds,
                        delayMs: delayMs
                    };
                    
                    modal.setLoading(true, 'Saving...');
                    
                    try {
                        await DuckBridge.call('proxy.scheduleAutoCheck', data);
                        window.DuckControls.Toast?.success?.('Schedule saved', enabled ? 'Auto check is now active' : 'Auto check has been disabled');
                        modal.close();
                    } catch (err) {
                        modal.setLoading(false);
                        window.DuckControls.Toast?.error?.('Failed to save schedule', err?.message || 'Unknown error');
                    }
                }}
            ],
            onClose: () => { 
                if (statusInterval) clearInterval(statusInterval);
                this._modal = null; 
            }
        });

        this._modal.open();

        // Load existing schedule and status from backend
        Promise.all([
            DuckBridge.call('proxy.getSchedule').catch(() => null),
            DuckBridge.call('proxy.getScheduleStatus').catch(() => null)
        ]).then(([schedule, status]) => {
            if (schedule) {
                if (this._enableCtrl.setChecked) {
                    this._enableCtrl.setChecked(!!schedule.enabled);
                } else if (this._enableCtrl.check) {
                    if (schedule.enabled) {
                        this._enableCtrl.check();
                    } else {
                        this._enableCtrl.uncheck();
                    }
                }
                this._hourCtrl.setValue(schedule.hours || 0);
                this._minCtrl.setValue(schedule.minutes || 0);
                this._secCtrl.setValue(schedule.seconds || 0);
                this._delayCtrl.setValue(schedule.delayMs || 1000);

                if (schedule.enabled) {
                    controls.forEach(el => {
                        el.style.opacity = '1';
                        el.style.pointerEvents = 'auto';
                    });
                }
            }
            
            updateStatusDisplay(status);
        }).catch(() => {
            updateStatusDisplay(null);
        });
    }
};
