/**
 * DuckBridge — Unified JS ↔ C# communication layer (WebView2)
 *
 * Protocol:
 *   JS  → C#   { type: "request", id, action, payload }
 *   C#  → JS   { type: "response", id, success, error, data }
 *   C#  → JS   { type: "push", channel, payload }   (server-initiated, no id)
 *
 * Usage:
 *   const data = await DuckBridge.call('group.list');
 *   const data = await DuckBridge.call('tag.create', { name: 'VIP' });
 *   const data = await DuckBridge.call('profile.list', { groupId: 1 });
 *
 * Push subscriptions:
 *   DuckBridge.on('profile.changed', (payload) => { ... });
 */
(function () {
    'use strict';

    window.DuckBridge = {
        _callbacks: {},
        _callbackId: 0,
        _webViewReady: false,
        _pushHandlers: {},
        _middleware: [],
        _toastContainer: null,
        _activeToasts: new Map(),
        _toastIdCounter: 0,

        /** Add middleware that runs before resolve/reject */
        use(fn) { this._middleware.push(fn); },

        /** Auto-detect WebView2 and set up message routing. */
        init() {
            if (window.chrome && window.chrome.webview) {
                this._webViewReady = true;

                window.chrome.webview.addEventListener('message', (e) => {
                    if (e.data) window.__duckReceive(e.data);
                });

                window.__duckReceive = (payload) => {
                    try {
                        if (typeof payload === 'string') {
                            payload = JSON.parse(payload);
                        }
                    } catch (e) {
                        console.warn('[DuckBridge] Failed to parse __duckReceive payload:', e);
                        return;
                    }
                    this._receive(payload);
                };

                this._initToastContainer();
                console.log('[DuckBridge] WebView2 mode — unified protocol active');
            } else {
                this._webViewReady = false;
                window.__duckReceive = () => {};
                console.log('[DuckBridge] Mock mode — UI dev without backend');
            }
        },

        /**
         * Send a request to C# and return a Promise.
         */
        async call(action, payload = null) {
            if (!this._webViewReady) {
                return this._mockCall(action, payload);
            }

            const id = ++this._callbackId;
            const envelope = { type: 'request', id, action, payload };
            console.log(`[DuckBridge] → ${action}`, payload);

            return new Promise((resolve, reject) => {
                this._callbacks[id] = { resolve, reject };

                try {
                    window.chrome.webview.postMessage(envelope);
                } catch (err) {
                    delete this._callbacks[id];
                    reject(new Error(`WebView send failed: ${err.message}`));
                    return;
                }

                setTimeout(() => {
                    if (this._callbacks[id]) {
                        delete this._callbacks[id];
                        reject(new Error(`Timeout (30s) for: ${action}`));
                    }
                }, 30000);
            });
        },

        /**
         * Receive and dispatch a message from C#.
         */
        _receive(payload) {
            try {
                if (!payload || typeof payload !== 'object') return;

                if (payload.type === 'response') {
                    const { id, success, error, data } = payload;
                    const cb = this._callbacks[id];
                    if (!cb) {
                        console.warn(`[DuckBridge] Response for unknown id=${id}`);
                        return;
                    }

                    delete this._callbacks[id];

                    let finalData = data;
                    let finalError = error;
                    for (const mw of this._middleware) {
                        const result = mw(id, { success, error, data }, 'response');
                        if (result) {
                            if (result.data !== undefined) finalData = result.data;
                            if (result.error !== undefined) finalError = result.error;
                        }
                    }

                    if ((success === undefined || success === true) && !finalError) {
                        console.log(`[DuckBridge] ✓ id=${id} resolved`, finalData);
                        cb.resolve(finalData ?? null);
                    } else {
                        const errMsg = (finalError === null || finalError === undefined || finalError === 'null' || finalError === '') ? 'Unknown error' : String(finalError);
                        const err = new Error(errMsg);
                        const fieldMatch = (finalError || '').match(/^\[([^\]]+)\]\s*(.*)/);
                        if (fieldMatch) {
                            err._field = fieldMatch[1];
                            err._message = fieldMatch[2];
                        }
                        console.error(`[DuckBridge] ✗ id=${id} rejected:`, errMsg);
                        cb.reject(err);
                    }
                    return;
                }

                if (payload.type === 'push') {
                    const { channel, payload: p } = payload;

                    if (channel === 'toast' && p) {
                        this._renderToast(p);
                    }

                    const handler = this._pushHandlers[channel];
                    if (handler) {
                        try { handler(p); } catch (e) {
                            console.error(`[DuckBridge] Push handler error (${channel}):`, e);
                        }
                    }
                    return;
                }

                if (payload.id && payload.action && !payload.type) {
                    if (payload.success !== undefined || payload.error !== undefined) {
                        this._receive({ type: 'response', ...payload });
                    }
                }
            } catch (e) {
                console.warn('[DuckBridge] _receive error (malformed WebView message):', e);
            }
        },

        /**
         * Subscribe to a server-initiated push channel.
         */
        on(channel, handler) {
            this._pushHandlers[channel] = handler;
        },

        /**
         * Unsubscribe from a push channel.
         */
        off(channel) {
            delete this._pushHandlers[channel];
        },

        /**
         * Push a message to C# (fire-and-forget).
         */
        push(channel, payload = null) {
            if (!this._webViewReady) return;
            const envelope = { type: 'push', channel, payload };
            try {
                window.chrome.webview.postMessage(envelope);
            } catch (_) {}
        },

        // ─── Toast rendering ───────────────────────────────────────────────

        _initToastContainer() {
            if (this._toastContainer) return;
            const existing = document.getElementById('duck-toast-container');
            if (existing) {
                this._toastContainer = existing;
                return;
            }

            const container = document.createElement('div');
            container.id = 'duck-toast-container';
            container.style.cssText = [
                'position: fixed',
                'top: 16px',
                'right: 16px',
                'z-index: 99999',
                'display: flex',
                'flex-direction: column',
                'gap: 8px',
                'pointer-events: none',
                'font-family: "Segoe UI", system-ui, sans-serif'
            ].join(';');
            document.body.appendChild(container);
            this._toastContainer = container;
        },

        _renderToast(toast) {
            if (!toast) return;

            if (toast.type === 'progress') {
                this._renderProgressToast(toast);
                return;
            }

            const { title = '', message = '', type = 'info', toastId } = toast;
            const id = toastId || `toast-${++this._toastIdCounter}`;

            if (this._activeToasts.has(id)) {
                const el = this._activeToasts.get(id);
                const titleEl = el.querySelector('[data-toast-title]');
                const msgEl = el.querySelector('[data-toast-message]');
                const progressEl = el.querySelector('[data-toast-progress]');
                const barEl = el.querySelector('[data-toast-bar]');

                if (titleEl) titleEl.textContent = title;
                if (msgEl) msgEl.textContent = message;
                if (progressEl) progressEl.textContent = `${toast.progressValue ?? 0}%`;
                if (barEl) barEl.style.width = `${toast.progressValue ?? 0}%`;

                if (type === 'success' || type === 'error') {
                    el.className = `duck-toast duck-toast-${type}`;
                    setTimeout(() => this._removeToast(id), type === 'error' ? 5000 : 3000);
                }
                return;
            }

            const el = document.createElement('div');
            el.className = `duck-toast duck-toast-${type}`;
            el.dataset.toastId = id;
            el.style.cssText = [
                'display: flex',
                'flex-direction: column',
                'gap: 4px',
                'padding: 12px 16px',
                'border-radius: 8px',
                'min-width: 280px',
                'max-width: 380px',
                'box-shadow: 0 4px 16px rgba(0,0,0,0.2)',
                'pointer-events: auto',
                'animation: duck-toast-in 0.2s ease-out'
            ].join(';');

            const colors = {
                info:    { bg: '#1a1a2e', border: '#4a9eff', icon: 'ℹ' },
                success: { bg: '#1a2e1a', border: '#4aff4a', icon: '✓' },
                error:   { bg: '#2e1a1a', border: '#ff4a4a', icon: '✗' },
                progress:{ bg: '#1a1a2e', border: '#4a9eff', icon: '↓' }
            };
            const c = colors[type] || colors.info;

            el.style.background = c.bg;
            el.style.border = `1px solid ${c.border}`;

            el.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:16px;color:${c.border}">${c.icon}</span>
                    <strong data-toast-title style="color:#fff;font-size:13px;flex:1;">${title}</strong>
                </div>
                <div style="color:#aaa;font-size:12px;padding-left:24px;" data-toast-message>${message}</div>
            `;

            if (toast.persistent || type === 'progress') {
                const closeBtn = document.createElement('button');
                closeBtn.textContent = '×';
                closeBtn.style.cssText = 'background:none;border:none;color:#888;cursor:pointer;font-size:16px;padding:0;line-height:1;';
                closeBtn.onclick = () => this._removeToast(id);
                el.querySelector('div').appendChild(closeBtn);
            }

            this._toastContainer.appendChild(el);
            this._activeToasts.set(id, el);

            if (type !== 'progress' && !toast.persistent) {
                setTimeout(() => this._removeToast(id), type === 'error' ? 5000 : 3000);
            }
        },

        _renderProgressToast(toast) {
            const { toastId, title = '', message = '', progressValue = 0 } = toast;
            const id = toastId || `toast-${++this._toastIdCounter}`;

            if (this._activeToasts.has(id)) {
                const el = this._activeToasts.get(id);
                const titleEl = el.querySelector('[data-toast-title]');
                const msgEl = el.querySelector('[data-toast-message]');
                const progressEl = el.querySelector('[data-toast-progress]');
                const barEl = el.querySelector('[data-toast-bar]');

                if (titleEl) titleEl.textContent = title;
                if (msgEl) msgEl.textContent = message;
                if (progressEl) progressEl.textContent = `${progressValue}%`;
                if (barEl) barEl.style.width = `${progressValue}%`;
                return;
            }

            const el = document.createElement('div');
            el.className = 'duck-toast duck-toast-progress';
            el.dataset.toastId = id;
            el.style.cssText = [
                'display: flex',
                'flex-direction: column',
                'gap: 6px',
                'padding: 12px 16px',
                'border-radius: 8px',
                'min-width: 300px',
                'max-width: 380px',
                'background: #1a1a2e',
                'border: 1px solid #4a9eff',
                'box-shadow: 0 4px 16px rgba(0,0,0,0.2)',
                'pointer-events: auto',
                'animation: duck-toast-in 0.2s ease-out'
            ].join(';');

            el.innerHTML = `
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="font-size:14px;color:#4a9eff">↓</span>
                    <strong data-toast-title style="color:#fff;font-size:13px;flex:1;">${title}</strong>
                    <span data-toast-progress style="color:#4a9eff;font-size:12px;font-weight:600;">${progressValue}%</span>
                </div>
                <div style="color:#aaa;font-size:12px;padding-left:22px;" data-toast-message>${message}</div>
                <div style="height:3px;background:#333;border-radius:2px;overflow:hidden;margin-top:2px;">
                    <div data-toast-bar style="height:100%;background:#4a9eff;width:0%;transition:width 0.3s ease;border-radius:2px;"></div>
                </div>
            `;

            this._toastContainer.appendChild(el);
            this._activeToasts.set(id, el);
        },

        _removeToast(id) {
            const el = this._activeToasts.get(id);
            if (!el) return;
            el.style.animation = 'duck-toast-out 0.2s ease-in forwards';
            setTimeout(() => {
                el.remove();
                this._activeToasts.delete(id);
            }, 200);
        },

        // ─── Mock handlers for dev mode ─────────────────────────────────

        _mockCall(action, payload) {
            const delay = 50 + Math.random() * 150;
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (action === 'group.list' || action === 'tag.list') {
                        resolve([]);
                    } else if (action === 'profile.list') {
                        resolve({ Items: [], Total: 0 });
                    } else if (action === 'profile.get') {
                        resolve(null);
                    } else if (action === 'profile.getFingerprintTemplate') {
                        resolve({
                            Timezones: ['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'],
                            Languages: ['en-US', 'en-GB', 'zh-CN', 'ja-JP'],
                            OS: {
                                'Windows': {
                                    Models: [{ Name: 'Windows 10', PlatformString: 'Win64' }],
                                    Fonts: ['Arial', 'Segoe UI'],
                                    ScreenPresets: [{ Width: 1920, Height: 1080, PixelRatio: 1 }],
                                    HardwareTiers: [{ Concurrency: 8, Memory: 16 }]
                                }
                            },
                            TimezoneGeo: {}
                        });
                    } else if (action === 'browser.listVersions') {
                        resolve({
                            Browsers: [
                                { BrowserType: 'chrome', Versions: [{ Version: '120.0', Description: 'Chrome 120' }] },
                                { BrowserType: 'firefox', Versions: [{ Version: '121.0', Description: 'Firefox 121' }] }
                            ]
                        });
                    } else {
                        resolve(null);
                    }
                }, delay);
            });
        }
    };

    // ─── Toast animations ───────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        @keyframes duck-toast-in {
            from { opacity: 0; transform: translateX(100%); }
            to { opacity: 1; transform: translateX(0); }
        }
        @keyframes duck-toast-out {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(100%); }
        }
    `;
    document.head.appendChild(style);
})();
