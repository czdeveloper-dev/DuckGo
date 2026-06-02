window.DuckControls = window.DuckControls || {};
window.DuckControls.Select = {
    create(options) {
        const wrap = document.createElement('div');
        wrap.className = 'filter-stacked';
        if (options.width) wrap.style.minWidth = options.width;
        
        if (options.label) {
            const head = document.createElement('div');
            head.className = 'filter-stacked-head';
            const label = document.createElement('span');
            label.className = 'ui-label-sm';
            label.textContent = options.label;
            head.appendChild(label);
            
            if (options.action) {
                const actionBtn = document.createElement('span');
                actionBtn.className = 'filter-stacked-create';
                actionBtn.textContent = options.action.text;
                actionBtn.addEventListener('click', options.action.onClick);
                head.appendChild(actionBtn);
            }
            wrap.appendChild(head);
        }
        
        let selectValue = options.value || '';
        
        const triggerBtn = document.createElement('button');
        triggerBtn.className = 'input-field-sm duck-custom-select';
        if (options.bgVariant === 'subtle') triggerBtn.classList.add('bg-subtle');
        triggerBtn.style.width = '100%';
        triggerBtn.style.display = 'flex';
        triggerBtn.style.alignItems = 'center';
        triggerBtn.style.justifyContent = 'space-between';
        
        const textSpan = document.createElement('span');
        const selectedOpt = (options.options || []).find(o => o.value === selectValue);
        textSpan.textContent = selectedOpt ? selectedOpt.label : (options.placeholder || 'Select...');
        textSpan.style.overflow = 'hidden';
        textSpan.style.textOverflow = 'ellipsis';
        textSpan.style.whiteSpace = 'nowrap';
        
        const arrow = document.createElement('span');
        arrow.className = 'material-symbols-outlined duck-select-arrow-icon';
        arrow.textContent = 'expand_more';
        arrow.style.fontSize = '18px';
        arrow.style.color = 'var(--text-tertiary)';
        arrow.style.transition = 'transform 0.2s';
        
        triggerBtn.appendChild(textSpan);
        triggerBtn.appendChild(arrow);
        
        let optionsArr = options.options || [];
        if (optionsArr.length === 0) {
            optionsArr = [{ label: 'No records found', icon: 'inbox', isPlaceholder: true }];
        }
        
        const contextItems = optionsArr.map(opt => ({
            label: opt.label,
            value: opt.value,
            icon: opt.icon,
            actions: opt.actions,
            disabled: opt.isPlaceholder,
            selected: selectValue === opt.value,
            onClick: opt.isPlaceholder ? null : () => {
                selectValue = opt.value;
                textSpan.textContent = opt.label;
                if (options.onChange) {
                    // Simulate standard event object
                    options.onChange({ target: { value: opt.value } });
                }
            }
        }));
        
        const menuCtrl = DuckControls.ContextMenu.create(triggerBtn, { items: contextItems });
        
        // Sync arrow and focus state with menu's active class
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                if (m.attributeName === 'class') {
                    const isActive = menuCtrl.element.classList.contains('active');
                    if (isActive) {
                        arrow.style.transform = 'rotate(180deg)';
                        triggerBtn.classList.add('focused');
                        if (menuCtrl.itemButtons) {
                            menuCtrl.itemButtons.forEach(ib => {
                                if (ib.item.value === selectValue) ib.btn.classList.add('selected');
                                else ib.btn.classList.remove('selected');
                            });
                        }
                    } else {
                        arrow.style.transform = 'rotate(0deg)';
                        triggerBtn.classList.remove('focused');
                    }
                }
            });
        });
        observer.observe(menuCtrl.element, { attributes: true });
        
        wrap.appendChild(triggerBtn);
        
        return {
            element: wrap,
            trigger: triggerBtn,
            getValue: () => selectValue,
            setValue: (val) => {
                selectValue = val;
                const opt = (options.options || []).find(o => o.value === val);
                if (opt) textSpan.textContent = opt.label;
            }
        };
    }
};
