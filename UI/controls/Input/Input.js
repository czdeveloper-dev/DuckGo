window.DuckControls = window.DuckControls || {};
window.DuckControls.Input = {
    create(options) {
        const wrap = document.createElement('div');
        wrap.className = 'filter-stacked';
        if (options.width) wrap.style.width = options.width;
        
        if (options.label) {
            const head = document.createElement('div');
            head.className = 'filter-stacked-head';
            const label = document.createElement('span');
            label.className = 'ui-label-sm';
            label.textContent = options.label;
            head.appendChild(label);
            wrap.appendChild(head);
        }
        
        const inputWrap = document.createElement('div');
        inputWrap.className = 'search-box search-compact';
        if (options.bgVariant === 'subtle') inputWrap.classList.add('bg-subtle');
        inputWrap.style.width = '100%';
        inputWrap.style.maxWidth = 'none';
        
        if (options.icon) {
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined search-icon';
            icon.textContent = options.icon;
            inputWrap.appendChild(icon);
        }
        
        const input = document.createElement('input');
        input.type = 'text';
        if (options.placeholder) input.placeholder = options.placeholder;
        if (options.value) input.value = options.value;
        if (options.id) input.id = options.id;
        if (options.onInput) input.addEventListener('input', options.onInput);
        
        inputWrap.appendChild(input);
        wrap.appendChild(inputWrap);
        
        return {
            element: wrap,
            input: input,
            getValue: () => input.value,
            setValue: (val) => input.value = val
        };
    }
};
