// DuckApp - Main application shell

(function() {
    'use strict';

    window.DuckApp = {
        _views: {},
        _currentView: null,

        async init() {
            this._registerViews();
            await this.showView('profiles');

            // Load initial data in background
            this._loadInitialData().then(() => {
                const view = this._views[this._currentView];
                if (view && typeof view.loadProfiles === 'function') {
                    view.loadProfiles();
                } else if (view && typeof view.refresh === 'function') {
                    view.refresh();
                }
            });
        },

        _normalizeProfiles(data) {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            if (data.Items && Array.isArray(data.Items)) return data.Items;
            return [];
        },

        async _loadInitialData() {
            try {
                const results = await Promise.allSettled([
                    DuckBridge.call('group.list'),
                    DuckBridge.call('tag.list'),
                    DuckBridge.call('profile.list')
                ]);
                const [groupsResult, tagsResult, profilesResult] = results;
                DuckStore.merge({
                    groups:   groupsResult.status   === 'fulfilled' && Array.isArray(groupsResult.value)   ? groupsResult.value   : [],
                    tags:     tagsResult.status     === 'fulfilled' && Array.isArray(tagsResult.value)   ? tagsResult.value     : [],
                    profiles: profilesResult.status === 'fulfilled'                                 ? this._normalizeProfiles(profilesResult.value) : [],
                });
            } catch (e) {
                DuckStore.merge({ groups: [], tags: [], profiles: [] });
            }
        },

        _registerViews() {
            if (window.ProfilesView) this._views['profiles'] = window.ProfilesView;
            if (window.ProxiesView)  this._views['proxies']  = window.ProxiesView;
            if (window.GroupsView)    this._views['groups']   = window.GroupsView;
            if (window.TagsView)      this._views['tags']     = window.TagsView;
            if (window.AutomationView) this._views['automation'] = window.AutomationView;
            if (window.LogsView)      this._views['logs']     = window.LogsView;
            if (window.SettingsView)  this._views['settings'] = window.SettingsView;
        },

        async showView(name) {
            document.querySelectorAll('.page-view.active').forEach(el => {
                el.classList.remove('active');
            });

            const target = document.querySelector(`[data-view-name="${name}"]`);
            if (!target) {
                this._currentView = null;
                if (window.DuckSidebar) window.DuckSidebar.setActiveView(name);
                return;
            }
            target.classList.add('active');

            if (window.DuckSidebar) {
                window.DuckSidebar.setActiveView(name);
            }

            this._currentView = name;
            this._updatePageTitle(name);

            const view = this._views[name];
            if (view && typeof view.onShow === 'function') {
                try {
                    await view.onShow();
                } catch (e) {
                    console.error(`[DuckApp] Error in view ${name}.onShow:`, e);
                }
            }
        },

        _updatePageTitle(viewName) {
            const titles = {
                profiles: 'Profiles', proxies: 'Proxies', groups: 'Groups',
                tags: 'Tags', automation: 'Automation', schedule: 'Schedule',
                extensions: 'Extensions', logs: 'Logs', analytics: 'Analytics',
                security: 'Security', settings: 'Settings'
            };
            document.title = `DuckGo - ${titles[viewName] || viewName}`;
        },

        registerView(name, view) {
            this._views[name] = view;
        },

        getCurrentView() {
            return this._currentView;
        },

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
