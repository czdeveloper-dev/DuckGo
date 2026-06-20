// DuckSidebar - Sidebar navigation component

(function() {
    'use strict';

    window.DuckSidebar = {
        _isCollapsed: true, // Default collapsed

        /**
         * Initialize sidebar.
         */
        init() {
            this._setupCollapse();
            this._setupNavigation();
            this._setupThemeToggle();
            this._restoreState();
            this._restoreTheme();
        },

        /**
         * Set up collapse/expand functionality.
         */
        _setupCollapse() {
            const sidebar = document.getElementById('sidebar');
            const btn = document.getElementById('sidebar-collapse-btn');
            
            if (!sidebar) return;

            // Optional double click on head
            const head = sidebar.querySelector('.sidebar-head');
            if (head) {
                head.style.cursor = 'pointer';
                head.addEventListener('dblclick', () => {
                    this.toggle();
                });
            }

            // Click on collapse button
            if (btn) {
                btn.addEventListener('click', () => {
                    this.toggle();
                });
            }
        },

        /**
         * Toggle sidebar collapse state.
         */
        toggle() {
            const sidebar = document.getElementById('sidebar');
            if (!sidebar) return;

            this._isCollapsed = !this._isCollapsed;
            sidebar.classList.toggle('collapsed', this._isCollapsed);

            try {
                localStorage.setItem('sidebar-collapsed', this._isCollapsed);
            } catch (e) {}
        },

        /**
         * Restore collapsed state from localStorage.
         */
        _restoreState() {
            const sidebar = document.getElementById('sidebar');
            if (!sidebar) return;

            try {
                if (localStorage.getItem('sidebar-collapsed') === 'true') {
                    this._isCollapsed = true;
                    sidebar.classList.add('collapsed');
                }
            } catch (e) {}
        },

        /**
         * Set up navigation click handlers.
         */
        _setupNavigation() {
            document.querySelectorAll('.nav-item[data-view]').forEach(el => {
                el.addEventListener('click', (e) => {
                    if (el.id === 'btn-theme-toggle') return;

                    const view = el.dataset.view;
                    if (view && window.DuckApp) {
                        window.DuckApp.showView(view);
                    }
                });
            });
        },

        /**
         * Set up theme toggle button.
         */
        _setupThemeToggle() {
            const btn = document.getElementById('btn-theme-toggle');
            if (btn) {
                // Apply fill style for icon button
                btn.style.cssText = 'background: transparent; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 8px 12px; width: 100%; border-radius: 6px; transition: background 0.15s;';
                
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._toggleTheme();
                });
                btn.addEventListener('mouseenter', () => {
                    btn.style.background = 'var(--surface-hover)';
                });
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = 'transparent';
                });
            }
        },

        _toggleTheme() {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            if (isDark) {
                document.documentElement.removeAttribute('data-theme');
                try { localStorage.setItem('theme', 'light'); } catch (e) {}
                this._updateThemeIcon('light');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                try { localStorage.setItem('theme', 'dark'); } catch (e) {}
                this._updateThemeIcon('dark');
            }
        },

        /**
         * Restore theme from localStorage.
         */
        _restoreTheme() {
            try {
                if (localStorage.getItem('theme') === 'dark') {
                    document.documentElement.setAttribute('data-theme', 'dark');
                    this._updateThemeIcon('dark');
                } else {
                    document.documentElement.removeAttribute('data-theme');
                    this._updateThemeIcon('light');
                }
            } catch (e) {}
        },

        /**
         * Update theme button icon based on current theme.
         */
        _updateThemeIcon(theme) {
            const icon = document.querySelector('#btn-theme-toggle .nav-icon');
            if (icon) {
                // If in Dark mode, show Light mode icon (sun) to switch. Otherwise show Dark mode icon (moon).
                icon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
            }
        },

        /**
         * Update active nav item.
         */
        setActiveView(viewName) {
            document.querySelectorAll('.nav-item').forEach(el => {
                el.classList.remove('active');
                if (el.dataset.view === viewName) {
                    el.classList.add('active');
                }
            });
        }
    };
})();
