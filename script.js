const OSRM_API = 'https://router.project-osrm.org/route/v1';
const KAOHSIUNG_CENTER = [22.6228, 120.3014];

// 🛰️ 擴增高精確軌道交通資料庫 (加入三多商圈等紅線大站，以利測試跨線轉乘)
const STATIONS_DATABASE = {
    mrt: [
        { name: '左營高鐵站', lat: 22.6874, lon: 120.3076, line: '紅線', padding: 5 },
        { name: '巨蛋站', lat: 22.6659, lon: 120.3023, line: '紅線', padding: 3 },
        { name: '凹子底站', lat: 22.6575, lon: 120.3027, line: '紅線', padding: 4 },
        { name: '高雄車站', lat: 22.6405, lon: 120.3022, line: '紅線', padding: 5 },
        { name: '美麗島站', lat: 22.6314, lon: 120.3019, line: '轉乘樞紐', padding: 5 },
        { name: '中央公園站', lat: 22.6247, lon: 120.3018, line: '紅線', padding: 3 },
        { name: '三多商圈站', lat: 22.6139, lon: 120.3046, line: '紅線', padding: 3 },
        { name: '文化中心站', lat: 22.6271, lon: 120.3180, line: '橘線', padding: 3 },
        { name: '五塊厝站', lat: 22.6288, lon: 120.3298, line: '橘線', padding: 3 },
        { name: '衛武營站', lat: 22.6248, lon: 120.3404, line: '橘線', padding: 4 }
    ],
    lightrail: [
        { name: 'C33 衛生局站', lat: 22.6174, lon: 120.3262, line: '環狀輕軌', padding: 2 },
        { name: 'C32 凱旋公園站', lat: 22.6247, lon: 120.3259, line: '環狀輕軌', padding: 2 },
        { name: 'C34 五權國小站', lat: 22.6125, lon: 120.3276, line: '環狀輕軌', padding: 2 },
        { name: 'C35 凱旋武昌站', lat: 22.6074, lon: 120.3270, line: '環狀輕軌', padding: 2 },
        { name: 'C24 愛河之心站', lat: 22.6595, lon: 120.3028, line: '環狀輕軌', padding: 2 },
        { name: 'C14 哈瑪星站', lat: 22.6215, lon: 120.2720, line: '環狀輕軌', padding: 2 }
    ]
};

let map, mapLayers;
let originCoords = null, destCoords = null, userCoords = null;
let activeAvatar = '🧍‍♂️';
let activeFilters = new Set(['mrt', 'lightrail', 'bus', 'bike']);

// ==================== 初始化與介面切換 ====================
function initMap() {
    map = L.map('map', { zoomControl: false }).setView(KAOHSIUNG_CENTER, 13);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapLayers = L.layerGroup().addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
}

document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
});

document.querySelectorAll('.avatar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); activeAvatar = btn.dataset.avatar;
        const toast = document.getElementById('avatarToast');
        toast.textContent = `已切換為 ${activeAvatar} 導航模式`; toast.classList.remove('hidden'); toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.classList.add('hidden'), 200); }, 500);
    });
});

// ==================== 真實地址搜尋聯想與定位 ====================
document.getElementById('useLocationBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('瀏覽器不支援定位');
    const inputField = document.getElementById('originInput');
    inputField.value = "精確定位中...";
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            originCoords = userCoords;
            inputField.value = `📍 我的位置 (${activeAvatar})`;
            map.flyTo([userCoords.lat, userCoords.lon], 15);
        },
        () => { alert('定位失敗'); inputField.value = ""; },
        { enableHighAccuracy: true, timeout: 6000 }
    );
});

async function fetchAddressSuggestions(query, type) {
    if (query.length < 2) return;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=120.1,22.4,120.5,23.1&bounded=1&limit=5`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const dropdown = document.getElementById(`${type}Dropdown`);
        dropdown.innerHTML = '';
        if (data.length === 0) { dropdown.classList.add('hidden'); return; }
        
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            const shortName = item.name || item.display_name.split(',')[0];
            div.textContent = `📍 ${shortName}`;
            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                document.getElementById(`${type}Input`).value = shortName;
                if (type === 'origin') originCoords = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) };
                else destCoords = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) };
                dropdown.classList.add('hidden');
            });
            dropdown.appendChild(div);
        });
        dropdown.classList.remove('hidden');
    } catch (e) {}
}

let debounceTimer;
document.querySelectorAll('input[data-location-type]').forEach(input => {
    const type = input.dataset.locationType;
    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchAddressSuggestions(e.target.value.trim(), type), 400);
    });
    input.addEventListener('blur', () => setTimeout(() => document.getElementById(`${type}Dropdown`).classList.add('hidden'), 200));
});

document.getElementById('swapBtn').addEventListener('click', () => {
    const o = document.getElementById('originInput'), d = document.getElementById('destinationInput');
    [o.value, d.value] = [d.value, o.value];
    [originCoords, destCoords] = [destCoords, originCoords];
});

// ==================== 路線計算與路網演算法 ====================
function getDistanceKM(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getRouteOSRM(lat1, lon1, lat2, lon2, profile = 'foot') {
    try {
        const res = await fetch(`${OSRM_API}/${profile}/${lon1},${lat1};${lon2},${lat2}?geometries=geojson`);
        if (!res.ok) return null; const data = await res.json();
        return { path: data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]), km: (data.routes[0].distance / 1000).toFixed(2), rawMins: Math.ceil(data.routes[0].duration / 60) };
    } catch (e) { return null; }
}

async function runRoutePlanning() {
    if (!originCoords || !destCoords) return alert('請確認起訖點皆已輸入並選擇地圖座標！');
    document.getElementById('detailView').classList.add('hidden'); document.getElementById('listView').classList.remove('hidden');
    const container = document.getElementById('routesContainer'); const loading = document.getElementById('loadingIndicator');
    loading.classList.remove('hidden'); container.innerHTML = ''; mapLayers.clearLayers();

    const outputRoutes = [];

    // 🌟 1. 捷運轉乘解與 10% 時間緩衝
    if (activeFilters.has('mrt')) {
        let sortedStart = [...STATIONS_DATABASE.mrt].sort((a,b) => getDistanceKM(originCoords.lat, originCoords.lon, a.lat, a.lon) - getDistanceKM(originCoords.lat, originCoords.lon, b.lat, b.lon));
        let sortedEnd = [...STATIONS_DATABASE.mrt].sort((a,b) => getDistanceKM(destCoords.lat, destCoords.lon, a.lat, a.lon) - getDistanceKM(destCoords.lat, destCoords.lon, b.lat, b.lon));
        let st1 = sortedStart[0], st2 = sortedEnd[0];
        
        if (st1.name !== st2.name) {
            // 判斷是否需要跨線轉乘 (紅線與橘線互換)
            let isTransfer = (st1.line === '紅線' && st2.line === '橘線') || (st1.line === '橘線' && st2.line === '紅線');
            
            if (isTransfer) {
                // ⚠️ 轉車邏輯：需要經過美麗島站
                let hub = STATIONS_DATABASE.mrt.find(s => s.name === '美麗島站');
                const leg1 = await getRouteOSRM(originCoords.lat, originCoords.lon, st1.lat, st1.lon, 'foot');
                const leg2a = await getRouteOSRM(st1.lat, st1.lon, hub.lat, hub.lon, 'driving'); // 第一段捷運
                const leg2b = await getRouteOSRM(hub.lat, hub.lon, st2.lat, st2.lon, 'driving'); // 第二段捷運
                const leg3 = await getRouteOSRM(st2.lat, st2.lon, destCoords.lat, destCoords.lon, 'foot');
                
                if (leg1 && leg2a && leg2b && leg3) {
                    let driveMins1 = Math.ceil(parseFloat(leg2a.km) * 1.5);
                    let driveMins2 = Math.ceil(parseFloat(leg2b.km) * 1.5);
                    let transferWalkMins = 6; // 美麗島站內步行轉乘時間
                    let rawTime = leg1.rawMins + driveMins1 + 4 + transferWalkMins + driveMins2 + 4 + leg3.rawMins + st1.padding + st2.padding;
                    
                    // 🌟 加入 10% 安全緩衝時間
                    let bufferedTime = Math.ceil(rawTime * 1.1);

                    outputRoutes.push({
                        type: 'mrt', badge: '🔄 捷運跨線轉乘', title: `${st1.name} ➔ 美麗島 ➔ ${st2.name}`,
                        time: bufferedTime, dist: (parseFloat(leg1.km) + parseFloat(leg2a.km) + parseFloat(leg2b.km) + parseFloat(leg3.km)).toFixed(2), price: '35 元',
                        steps: [
                            { icon: '🚶', title: `步行至 ${st1.name}`, mins: leg1.rawMins, color: '#38bdf8', path: leg1.path, nodeName: `${st1.name}`, detail: `步行前往進站，預留 ${st1.padding} 分鐘進站時間。` },
                            { icon: '🚇', title: `搭乘 [${st1.line}] 至美麗島站`, mins: driveMins1 + 4, color: st1.line === '紅線' ? '#E60012' : '#F59E0B', path: leg2a.path, nodeName: `美麗島站`, detail: `車程約 ${driveMins1} 分鐘。到站後請下車準備轉乘。` },
                            { icon: '🔄', title: `於 美麗島站 站內轉乘`, mins: transferWalkMins, color: '#8B5CF6', path: [], nodeName: null, detail: `美麗島為紅橘交會站。請依循頭頂橘色/紅色指標，搭乘手扶梯前往另一條路線的月台。` },
                            { icon: '🚇', title: `轉乘 [${st2.line}] 至終點站`, mins: driveMins2 + 4, color: st2.line === '紅線' ? '#E60012' : '#F59E0B', path: leg2b.path, nodeName: `${st2.name}`, detail: `車程約 ${driveMins2} 分鐘，抵達 ${st2.name} 後下車。` },
                            { icon: '🚶', title: `出站步行至目的地`, mins: leg3.rawMins, color: '#38bdf8', path: leg3.path, nodeName: `目的地`, detail: `自捷運閘門出站，依循地面指標抵達終點。` }
                        ]
                    });
                }
            } else {
                // ✅ 直達邏輯
                const leg1 = await getRouteOSRM(originCoords.lat, originCoords.lon, st1.lat, st1.lon, 'foot');
                const leg2 = await getRouteOSRM(st1.lat, st1.lon, st2.lat, st2.lon, 'driving');
                const leg3 = await getRouteOSRM(st2.lat, st2.lon, destCoords.lat, destCoords.lon, 'foot');
                
                if (leg1 && leg2 && leg3) {
                    let mrtDriveMins = Math.ceil(parseFloat(leg2.km) * 1.5);
                    let rawTime = leg1.rawMins + mrtDriveMins + 4 + st1.padding + st2.padding + leg3.rawMins;
                    
                    // 🌟 加入 10% 安全緩衝時間
                    let bufferedTime = Math.ceil(rawTime * 1.1);

                    outputRoutes.push({
                        type: 'mrt', badge: '🚇 捷運直達線', title: `捷運 ${st1.name} ➔ ${st2.name}`,
                        time: bufferedTime, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2), price: '30 元',
                        steps: [
                            { icon: '🚶', title: `步行至 ${st1.name}`, mins: leg1.rawMins, color: '#38bdf8', path: leg1.path, nodeName: `${st1.name}`, detail: `沿人行道步行。進站與等車約需緩衝。` },
                            { icon: '🚇', title: `搭乘高雄捷運 [${st1.line}]`, mins: mrtDriveMins + 4, color: st1.line === '紅線' ? '#E60012' : '#F59E0B', path: leg2.path, nodeName: `${st2.name}`, detail: `直達免轉車，車程預計 ${mrtDriveMins} 分鐘。` },
                            { icon: '🚶', title: `出站步行至終點`, mins: leg3.rawMins, color: '#38bdf8', path: leg3.path, nodeName: `目的地`, detail: `自捷運閘門刷卡出站，步行即可抵達目的地。` }
                        ]
                    });
                }
            }
        }
    }

    // 🌟 2. 輕軌解與 10% 時間緩衝
    if (activeFilters.has('lightrail')) {
        let sortedStart = [...STATIONS_DATABASE.lightrail].sort((a,b) => getDistanceKM(originCoords.lat, originCoords.lon, a.lat, a.lon) - getDistanceKM(originCoords.lat, originCoords.lon, b.lat, b.lon));
        let sortedEnd = [...STATIONS_DATABASE.lightrail].sort((a,b) => getDistanceKM(destCoords.lat, destCoords.lon, a.lat, a.lon) - getDistanceKM(destCoords.lat, destCoords.lon, b.lat, b.lon));
        let st1 = sortedStart[0], st2 = sortedEnd[0];
        
        if (st1.name !== st2.name) {
            const leg1 = await getRouteOSRM(originCoords.lat, originCoords.lon, st1.lat, st1.lon, 'foot');
            const leg2 = await getRouteOSRM(st1.lat, st1.lon, st2.lat, st2.lon, 'driving');
            const leg3 = await getRouteOSRM(st2.lat, st2.lon, destCoords.lat, destCoords.lon, 'foot');
            
            if (leg1 && leg2 && leg3) {
                let lrtDriveMins = Math.ceil(parseFloat(leg2.km) * 2.8); 
                let rawTime = leg1.rawMins + lrtDriveMins + 7 + st1.padding + st2.padding + leg3.rawMins;
                
                // 🌟 加入 10% 安全緩衝時間
                let bufferedTime = Math.ceil(rawTime * 1.1);

                outputRoutes.push({
                    type: 'lightrail', badge: '🍏 環狀輕軌線', title: `輕軌 ${st1.name} ➔ ${st2.name}`,
                    time: bufferedTime, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2), price: '30 元',
                    steps: [
                        { icon: '🚶', title: `步行至輕軌 ${st1.name}`, mins: leg1.rawMins, color: '#38bdf8', path: leg1.path, nodeName: `${st1.name}`, detail: `前往地面開放式輕軌站體。記得在月台黃色刷卡機過卡。` },
                        { icon: '🚃', title: '搭乘環狀輕軌低碳列車', mins: lrtDriveMins + 7, color: '#009E52', path: leg2.path, nodeName: `${st2.name}`, detail: `到站必須主動按壓車門綠色按鈕，車程約 ${lrtDriveMins} 分鐘。` },
                        { icon: '🚶', title: '輕軌出站步行至終點', mins: leg3.rawMins, color: '#38bdf8', path: leg3.path, nodeName: `終點`, detail: `沿著行人穿越道安全離開軌道區步行至目的地。` }
                    ]
                });
            }
        }
    }

    outputRoutes.sort((a,b) => a.time - b.time);
    renderRouteList(outputRoutes);
    loading.classList.add('hidden');
}

function renderRouteList(routes) {
    const container = document.getElementById('routesContainer');
    if (routes.length === 0) { container.innerHTML = '<div class="error-box">查無路線，請試著變更地點。</div>'; return; }
    routes.forEach((rt, idx) => {
        const card = document.createElement('div'); card.className = 'route-card';
        let clr = rt.type === 'mrt' ? (rt.badge.includes('轉乘') ? '#8B5CF6' : '#E60012') : '#009E52';
        card.innerHTML = `
            <span class="badge" style="background:${clr}12; color:${clr}">${rt.badge}</span>
            <div class="card-title">${rt.title}</div>
            <div class="card-meta">⏱️ 精確總時: <b>${rt.time} 分鐘</b> (已含 10% 緩衝) | 🛣️ ${rt.dist} km</div>
        `;
        card.addEventListener('click', () => toggleToDetailView(rt, clr));
        container.appendChild(card);
        if (idx === 0) drawRouteOnMap(rt.steps);
    });
}

function toggleToDetailView(route, themeColor) {
    drawRouteOnMap(route.steps);
    const content = document.getElementById('detailContent');

    let stepsHtml = route.steps.map((s, index) => {
        return `
            <div class="step-row">
                <div class="step-circle" style="background:${s.color}">${s.icon}</div>
                <div class="step-body">
                    <div class="clickable-step-header" onclick="toggleSubStepDetail(${index})">
                        <span class="step-title">${s.title} (${s.mins}分鐘)</span>
                        ${s.path && s.path.length > 0 ? `<span class="click-hint">微觀指引 ▾</span>` : `<span class="click-hint" style="color:#8B5CF6">站內指引 ▾</span>`}
                    </div>
                    <div id="subStep-${index}" class="sub-step-details hidden">${s.detail}</div>
                </div>
            </div>
        `;
    }).join('');

    content.innerHTML = `
        <div class="detail-main-title">${route.title}</div>
        <div class="meta-info-grid">
            <div class="meta-item"><span class="meta-label">⏱️ 預估總時 (含緩衝)</span><span class="meta-value" style="color:${themeColor}">${route.time} 分鐘</span></div>
            <div class="meta-item"><span class="meta-label">💰 票價估算</span><span class="meta-value">${route.price}</span></div>
        </div>
        <div class="detail-timeline">${stepsHtml}</div>
    `;
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('detailView').classList.remove('hidden');
}

window.toggleSubStepDetail = function(index) {
    const el = document.getElementById(`subStep-${index}`);
    if(el) el.classList.toggle('hidden');
};

function drawRouteOnMap(steps) {
    mapLayers.clearLayers(); let boundsPoints = [];
    
    steps.forEach((s) => {
        if(s.path && s.path.length > 0) {
            L.polyline(s.path, { color: s.color, weight: 6, opacity: 0.85, dashArray: s.icon === '🚶' ? '4, 8' : 'none' }).addTo(mapLayers);
            boundsPoints = boundsPoints.concat(s.path);

            if (s.nodeName) {
                const nodeCoord = s.path[0];
                L.circleMarker(nodeCoord, { radius: 6, fillColor: s.color, color: '#ffffff', weight: 2, fillOpacity: 1 }).addTo(mapLayers);
                L.marker(nodeCoord, { icon: L.divIcon({ className: 'hidden' }) }) 
                    .addTo(mapLayers)
                    .bindTooltip(`📍 ${s.nodeName}`, { permanent: true, direction: 'top', className: 'map-node-tooltip', offset: [0, -5] });
            }
        }
    });

    if(boundsPoints.length > 0) {
        const customIcon = L.divIcon({ html: `<div class="dynamic-avatar-icon">${activeAvatar}</div>`, className: '', iconSize: [40, 40], iconAnchor: [20, 35] });
        L.marker(boundsPoints[0], { icon: customIcon }).addTo(mapLayers);
        map.fitBounds(L.latLngBounds(boundsPoints), { padding: [50, 50] });
    }
}

document.querySelectorAll('.filter-tag').forEach(t => t.addEventListener('click', () => {
    t.classList.toggle('active');
    if (t.classList.contains('active')) activeFilters.add(t.dataset.transit); else activeFilters.delete(t.dataset.transit);
}));
document.getElementById('backToListBtn').addEventListener('click', () => {
    document.getElementById('detailView').classList.add('hidden'); document.getElementById('listView').classList.remove('hidden');
});
document.getElementById('searchBtn').addEventListener('click', runRoutePlanning);
window.onload = initMap;