window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.ChangeLocation = {
    _modal: null,
    
    show(selectedIds) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);
        
        if (this._modal) {
            this._modal.destroy();
            this._modal = null;
        }

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'display:flex;flex-direction:column;gap:16px;';

        // 1. Search Box using Autocomplete
        const searchWrap = document.createElement('div');
        modalBody.appendChild(searchWrap);

        // 2. Map Container
        const mapWrap = document.createElement('div');
        mapWrap.id = 'duck-leaflet-map';
        mapWrap.style.cssText = 'width: 100%; height: 200px; border-radius: 6px; overflow: hidden; border: 1px solid var(--border-light); background: var(--bg-subtle); display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px; z-index:1;';
        mapWrap.textContent = 'No location selected';
        modalBody.appendChild(mapWrap);

        let map = null;
        let marker = null;
        let searchCtrl = null;

        const updateMap = (lat, lng) => {
            if (!lat || !lng) return;
            if (!map) {
                mapWrap.innerHTML = '';
                map = L.map(mapWrap).setView([lat, lng], 14);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19
                }).addTo(map);

                map.on('click', async (e) => {
                    const clickLat = e.latlng.lat.toFixed(6);
                    const clickLng = e.latlng.lng.toFixed(6);
                    
                    if (latCtrl) latCtrl.setValue(clickLat);
                    if (lngCtrl) lngCtrl.setValue(clickLng);
                    
                    if (marker) marker.setLatLng([clickLat, clickLng]);
                    else marker = L.marker([clickLat, clickLng]).addTo(map);

                    try {
                        if (searchCtrl && searchCtrl.input) searchCtrl.input.placeholder = 'Fetching location name...';
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${clickLat}&lon=${clickLng}`);
                        const data = await res.json();
                        if (data && data.display_name && searchCtrl) {
                            searchCtrl.setValue(data.display_name);
                        }
                    } catch (err) {
                        console.error('Reverse geocode error:', err);
                    } finally {
                        if (searchCtrl && searchCtrl.input) searchCtrl.input.placeholder = 'Search city, country...';
                    }
                });
            } else {
                map.setView([lat, lng], 14);
            }
            
            if (marker) marker.remove();
            marker = L.marker([lat, lng]).addTo(map);
        };

        // 3. Coordinates
        const coordsWrap = document.createElement('div');
        coordsWrap.style.cssText = 'display:flex;gap:12px;';

        const latContainer = document.createElement('div');
        latContainer.style.flex = '1';
        const latCtrl = DuckControls.Input.create({
            label: 'Latitude',
            placeholder: 'e.g. 21.0285',
            icon: 'my_location',
            onInput: () => onCoordChange()
        });
        latContainer.appendChild(latCtrl.element);

        const lngContainer = document.createElement('div');
        lngContainer.style.flex = '1';
        const lngCtrl = DuckControls.Input.create({
            label: 'Longitude',
            placeholder: 'e.g. 105.8542',
            icon: 'explore',
            onInput: () => onCoordChange()
        });
        lngContainer.appendChild(lngCtrl.element);

        coordsWrap.appendChild(latContainer);
        coordsWrap.appendChild(lngContainer);
        modalBody.appendChild(coordsWrap);

        const onCoordChange = () => {
            if (this._coordTimeout) clearTimeout(this._coordTimeout);
            this._coordTimeout = setTimeout(() => {
                const lat = parseFloat(latCtrl.getValue());
                const lng = parseFloat(lngCtrl.getValue());
                if (!isNaN(lat) && !isNaN(lng)) {
                    updateMap(lat, lng);
                }
            }, 800);
        };

        // 4. Auto Detect Location Button
        const autoBtnWrap = document.createElement('div');
        const autoDetectBtn = document.createElement('button');
        autoDetectBtn.style.width = '100%';
        autoBtnWrap.appendChild(autoDetectBtn);
        modalBody.appendChild(autoBtnWrap);

        // Geolocation Logic
        const handleGeo = async () => {
            autoDetectBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;margin-right:8px;">sync</span> Locating...';
            autoDetectBtn.disabled = true;

            if (!navigator.geolocation) {
                alert('Geolocation is not supported by your browser.');
                resetBtn();
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    latCtrl.setValue(lat.toFixed(6));
                    lngCtrl.setValue(lng.toFixed(6));
                    updateMap(lat, lng);
                    
                    try {
                        if (searchCtrl && searchCtrl.input) searchCtrl.input.placeholder = 'Fetching location name...';
                        const res2 = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                        const data2 = await res2.json();
                        if (data2 && data2.display_name && searchCtrl) {
                            searchCtrl.setValue(data2.display_name);
                        }
                    } catch (e) {} finally {
                        if (searchCtrl && searchCtrl.input) searchCtrl.input.placeholder = 'Search city, country...';
                    }

                    resetBtn();
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    let msg = 'Unable to retrieve location. ';
                    if (error.code === 1) msg += '(Permission Denied)';
                    else if (error.code === 2) msg += '(Position Unavailable)';
                    else if (error.code === 3) msg += '(Timeout)';
                    alert(msg + '\\n\\nPlease ensure your device has Location enabled and granted permission.');
                    resetBtn();
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );

            function resetBtn() {
                autoDetectBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px;margin-right:8px;">my_location</span> Get Real GPS Location';
                autoDetectBtn.disabled = false;
            }
        };

        DuckControls.Button.create(autoDetectBtn, {
            text: 'Get Real GPS Location',
            icon: 'my_location',
            variant: 'surface',
            onClick: handleGeo
        });

        // Initialize Autocomplete
        searchCtrl = DuckControls.Autocomplete.create(searchWrap, {
            label: 'Search Location',
            placeholder: 'Search city, country...',
            icon: 'search',
            debounce: 800,
            onSearch: async (query) => {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
                const res = await fetch(url);
                const data = await res.json();
                return data.map(item => ({
                    label: item.display_name,
                    value: item.place_id,
                    lat: item.lat,
                    lon: item.lon
                }));
            },
            onSelect: (option) => {
                latCtrl.setValue(parseFloat(option.lat).toFixed(6));
                lngCtrl.setValue(parseFloat(option.lon).toFixed(6));
                updateMap(option.lat, option.lon);
            }
        });

        this._modal = DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Change Profile Location',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Applied to ${count} selected profiles`,
            icon: 'location_on',
            content: modalBody,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Save Location', icon: 'my_location', class: 'duck-btn-primary', onClick: async (e, modal) => {
                    const lat = parseFloat(latCtrl.getValue());
                    const lng = parseFloat(lngCtrl.getValue());
                    
                    if (isNaN(lat) || isNaN(lng)) {
                        if (isNaN(lat)) latCtrl.setError?.('Valid latitude is required (e.g. 21.0285)');
                        if (isNaN(lng)) lngCtrl.setError?.('Valid longitude is required (e.g. 105.8542)');
                        return;
                    }

                    modal.setLoading(true, 'Saving...');

                    try {
                        const idsArray = Array.isArray(selectedIds) ? selectedIds : [...selectedIds];
                        for (let id of idsArray) {
                            let p = await DuckBridge.call('profile.get', { id });
                            if (!p) continue;

                            let profileData = {};
                            try { profileData = JSON.parse(p.profileData || p.ProfileData || '{}'); } catch(e){}
                            profileData.Location = profileData.Location || {};
                            profileData.Location.Mode = 'custom';
                            profileData.Location.Latitude = lat;
                            profileData.Location.Longitude = lng;

                            await DuckBridge.call('profile.update', {
                                id: p.id ?? p.Id,
                                name: p.name ?? p.Name,
                                groupId: p.groupId ?? p.GroupId,
                                tagIds: p.tagIds ?? p.TagIds,
                                proxyId: p.proxyId ?? p.ProxyId,
                                browserType: p.browserType ?? p.BrowserType,
                                browserVersion: p.browserVersion ?? p.BrowserVersion,
                                profileData: JSON.stringify(profileData),
                                notes: p.notes ?? p.Notes,
                                cookies: p.cookies ?? p.Cookies
                            });
                        }
                        
                        if (window.ProfilesView?.loadProfiles) window.ProfilesView.loadProfiles();
                        
                        modal.close();
                    } catch (err) {
                        modal.setLoading(false);
                        window.DuckControls.Toast?.error?.('Update Failed', err?.message || 'Failed to update location');
                    }
                }}
            ],
            onClose: () => {
                if (searchCtrl) searchCtrl.destroy();
                this._modal = null;
            }
        });

        this._modal.open();

        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 100);

        mapWrap.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;"><div class="duck-spinner-ring" style="width:24px;height:24px;margin-bottom:8px;"></div><div>Locating via IP...</div></div>`;
        
        fetch('http://ip-api.com/json/')
            .then(res => res.json())
            .then(async data => {
                if (data.status === 'success') {
                    const lat = parseFloat(data.lat).toFixed(6);
                    const lng = parseFloat(data.lon).toFixed(6);
                    latCtrl.setValue(lat);
                    lngCtrl.setValue(lng);
                    updateMap(lat, lng);

                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                        const revData = await res.json();
                        if (revData && revData.display_name && searchCtrl) {
                            searchCtrl.setValue(revData.display_name);
                        }
                    } catch (e) {}
                } else {
                    mapWrap.textContent = 'IP Location failed.';
                }
            })
            .catch(err => {
                console.error('IP fetch error:', err);
                mapWrap.textContent = 'IP Location failed.';
            });
    }
};
