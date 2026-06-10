// MainLayout.js - Main layout initialization

(function() {
    'use strict';

    window.DuckLayout = {
        _initialized: false,
        _fragmentsLoaded: false,

        /**
         * Initialize layout components.
         */
        async init() {
            if (this._initialized) return;
            this._initialized = true;

            // Load HTML fragments (sidebar, topbar, etc.)
            await this._loadFragments();

            // Initialize sidebar
            this._initSidebar();

            // Restore theme
            this._restoreTheme();
        },

        /**
         * Load HTML fragments via XHR/fetch.
         * Works in both HTTP server and embedded WebView2 contexts.
         */
        async _loadFragments() {
            if (this._fragmentsLoaded) return;

            const hosts = document.querySelectorAll('[data-include]');
            if (hosts.length === 0) {
                this._fragmentsLoaded = true;
                return;
            }

            // Try fetch first (works with HTTP server)
            const useFetch = await this._tryFetch();

            for (const host of hosts) {
                const path = host.getAttribute('data-include');
                if (!path) continue;

                try {
                    let html;
                    if (useFetch) {
                        const resp = await fetch(path + '?v=' + Date.now());
                        if (resp.ok) {
                            html = await resp.text();
                        }
                    } else {
                        // Use ActiveXObject for local file access in IE/Edge Legacy
                        html = await this._loadFragmentLocal(path);
                    }

                    if (html) {
                        const wasActive = host.classList.contains('active');
                        const viewName = host.getAttribute('data-view-name');
                        const hostId = host.id;
                        
                        // Parse fragment HTML
                        const temp = document.createElement('div');
                        temp.innerHTML = html.trim();
                        const fragment = temp.firstElementChild;
                        
                        if (fragment) {
                            // Only apply page-view semantics if this is a view placeholder (has data-view-name)
                            if (viewName) {
                                fragment.classList.add('page-view');
                                if (wasActive) fragment.classList.add('active');
                                fragment.setAttribute('data-view-name', viewName);
                            }
                            if (hostId) fragment.id = hostId;
                            host.replaceWith(fragment);
                        } else {
                            host.outerHTML = html;
                        }
                    }
                } catch (e) { }
            }

            this._fragmentsLoaded = true;
        },

        /**
         * Try fetch to check if HTTP server is available.
         */
        async _tryFetch() {
            try {
                const resp = await fetch('main.css', { method: 'HEAD' });
                return resp.ok;
            } catch (e) {
                return false;
            }
        },

        /**
         * Load fragment from local filesystem (for embedded WebView2).
         * Uses ActiveXObject to read local files.
         */
        _loadFragmentLocal(path) {
            return new Promise((resolve) => {
                try {
                    // Get the base path from current script
                    const basePath = this._getBasePath();
                    const fullPath = basePath + path.replace(/\//g, '\\');

                    const fso = new ActiveXObject('Scripting.FileSystemObject');
                    if (fso.FileExists(fullPath)) {
                        const file = fso.OpenTextFile(fullPath, 1);
                        const content = file.ReadAll();
                        file.Close();
                        fso = null;
                        resolve(content);
                    } else {
                        fso = null;
                        resolve(null);
                    }
                } catch (e) {
                    console.warn(`[DuckLayout] Local file read failed: ${path}`, e.message);
                    resolve(null);
                }
            });
        },

        /**
         * Get base path from current script location.
         */
        _getBasePath() {
            // Try to get path from script element
            const scripts = document.getElementsByTagName('script');
            for (let i = 0; i < scripts.length; i++) {
                const src = scripts[i].src || '';
                if (src.indexOf('MainLayout.js') !== -1) {
                    const lastSlash = src.lastIndexOf('/');
                    if (lastSlash > 0) {
                        return src.substring(0, lastSlash + 1);
                    }
                }
            }
            return '';
        },

        /**
         * Initialize sidebar component.
         */
        _initSidebar() {
            if (window.DuckSidebar) {
                window.DuckSidebar.init();
            } else {
                // Fallback: set up basic navigation if Sidebar.js not loaded
                this._setupBasicNav();
            }
        },

        /**
         * Fallback navigation if Sidebar.js not loaded.
         */
        _setupBasicNav() {
            document.querySelectorAll('.nav-item[data-view]').forEach(el => {
                if (el.id === 'btn-theme-toggle') return;
                el.addEventListener('click', () => {
                    const view = el.dataset.view;
                    if (view && window.DuckApp) {
                        window.DuckApp.showView(view);
                    }
                });
            });

            // Basic theme toggle
            const themeBtn = document.getElementById('btn-theme-toggle');
            if (themeBtn) {
                themeBtn.addEventListener('click', () => {
                    const isDark = document.body.hasAttribute('data-theme-dark');
                    if (isDark) {
                        document.body.removeAttribute('data-theme-dark');
                    } else {
                        document.body.setAttribute('data-theme-dark', '');
                    }
                });
            }
        },

        /**
         * Restore theme from localStorage.
         */
        _restoreTheme() {
            try {
                const saved = localStorage.getItem('theme');
                if (saved === 'dark') {
                    document.body.setAttribute('data-theme-dark', '');
                }
            } catch (e) {}
        }
    };

    // Restore theme immediately (before DOMContentLoaded)
    try {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.setAttribute('data-theme-dark', '');
        }
    } catch (e) {}
})();
