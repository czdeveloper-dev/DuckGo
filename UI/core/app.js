// DuckApp - Main application shell

(function() {
    'use strict';

    window.DuckApp = {
        _views: {},
        _currentView: null,

        /**
         * Initialize the application.
         */
        async init() {
            console.log('[DuckApp] Starting init...');

            // Register views first (auto-discovers from feature scripts)
            this._registerViews();
            console.log('[DuckApp] Registered views:', Object.keys(this._views));

            // Show default view immediately - don't wait for data
            await this.showView('profiles');
            console.log('[DuckApp] View shown');

            // Load initial data in background
            this._loadInitialData().then(() => {
                // Reload current view after data arrives
                const view = this._views[this._currentView];
                if (view && typeof view.loadProfiles === 'function') {
                    view.loadProfiles();
                } else if (view && typeof view.refresh === 'function') {
                    view.refresh();
                }
            });

            console.log('[DuckApp] Initialized');
        },

        /**
         * Load initial data (groups, tags, profiles) into the store.
         */
        async _loadInitialData() {
            console.log('[DuckApp] Loading initial data in background...');
            try {
                const [groups, tags, profiles] = await Promise.all([
                    DuckBridge.call('group.list'),
                    DuckBridge.call('tag.list'),
                    DuckBridge.call('profile.list')
                ]);
                DuckStore.merge({
                    groups:   groups   || [],
                    tags:     tags     || [],
                    profiles: profiles?.Items || profiles || [],
                });
                console.log('[DuckApp] Initial data loaded:', {
                    groups: DuckStore.get('groups')?.length,
                    tags: DuckStore.get('tags')?.length,
                    profiles: DuckStore.get('profiles')?.length
                });
            } catch (e) {
                console.warn('[DuckApp] Failed to load initial data:', e.message);
                DuckStore.merge({
                    groups: [],
                    tags: [],
                    profiles: [],
                });
            }
        },

        /**
         * Register all available views.
         * Auto-discovers VIEW objects from feature scripts.
         */
        _registerViews() {
            // Auto-discover VIEW objects from feature scripts
            if (window.ProfilesView) {
                this._views['profiles'] = window.ProfilesView;
                console.log('[DuckApp] View auto-registered: profiles');
            }
            if (window.ProxiesView) {
                this._views['proxies'] = window.ProxiesView;
            }
            if (window.GroupsView) {
                this._views['groups'] = window.GroupsView;
            }
            if (window.TagsView) {
                this._views['tags'] = window.TagsView;
            }
            if (window.AutomationView) {
                this._views['automation'] = window.AutomationView;
            }
            if (window.LogsView) {
                this._views['logs'] = window.LogsView;
            }
            if (window.SettingsView) {
                this._views['settings'] = window.SettingsView;
            }
            console.log('[DuckApp] Views registered:', Object.keys(this._views));
        },

        /**
         * Show a view by name.
         */
        async showView(name) {
            console.log('[DuckApp] showView called:', name);

            // Hide ALL currently active views (bulletproof approach)
            document.querySelectorAll('.page-view.active').forEach(el => {
                el.classList.remove('active');
            });

            // Show new view
            const target = document.querySelector(`[data-view-name="${name}"]`);
            if (!target) {
                console.warn(`[DuckApp] View not found: ${name} - screen is blank`);
                this._currentView = null;
                if (window.DuckSidebar) window.DuckSidebar.setActiveView(name);
                return;
            }
            target.classList.add('active');
            console.log('[DuckApp] View activated:', name);

            // Update active nav in sidebar
            if (window.DuckSidebar) {
                window.DuckSidebar.setActiveView(name);
            }

            this._currentView = name;

            // Update page title
            this._updatePageTitle(name);

            // Call view's onShow if available
            const view = this._views[name];
            console.log('[DuckApp] View object:', view);
            if (view && typeof view.onShow === 'function') {
                console.log('[DuckApp] Calling onShow...');
                try {
                    await view.onShow();
                    console.log('[DuckApp] onShow completed');
                } catch (e) {
                    console.error(`[DuckApp] Error in view ${name}.onShow:`, e);
                }
            } else {
                console.warn('[DuckApp] No onShow function found');
            }
        },

        /**
         * Update page title based on current view.
         */
        _updatePageTitle(viewName) {
            const titles = {
                profiles: 'Profiles',
                proxies: 'Proxies',
                groups: 'Groups',
                tags: 'Tags',
                automation: 'Automation',
                schedule: 'Schedule',
                extensions: 'Extensions',
                logs: 'Logs',
                analytics: 'Analytics',
                security: 'Security',
                settings: 'Settings'
            };
            document.title = `DuckGo - ${titles[viewName] || viewName}`;
        },

        /**
         * Register a view module.
         */
        registerView(name, view) {
            this._views[name] = view;
            console.log(`[DuckApp] View registered: ${name}`);
        },

        /**
         * Get current view name.
         */
        getCurrentView() {
            return this._currentView;
        },

        /**
         * Reload data for the current view.
         */
        async refreshCurrentView() {
            await this._loadInitialData();
            const view = this._views[this._currentView];
            if (view && typeof view.refresh === 'function') {
                try {
                    await view.refresh();
                } catch (e) {
                    console.error(`[DuckApp] Error refreshing view ${this._currentView}:`, e);
                }
            }
        }
    };
})();
