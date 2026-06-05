const OSRM_API = 'https://router.project-osrm.org/route/v1';
const KAOHSIUNG_CENTER = [22.6228, 120.3014];

// 🚀 擴增路網資料：加入文化中心與草衙(SKM Park)，並標註所屬路線 (red/orange/lightrail)
const TRANSIT_STATIONS = [
    { name: '左營高鐵站', lat: 22.6879, lon: 120.3080, type: 'mrt', line: 'red', color: '#e11d48' },
    { name: '巨蛋站', lat: 22.6659, lon: 120.3023, type: 'mrt', line: 'red', color: '#e11d48' },
    { name: '高雄車站', lat: 22.6397, lon: 120.3120, type: 'mrt', line: 'red', color: '#e11d48' },
    { name: '美麗島站', lat: 22.6314, lon: 120.3180, type: 'mrt', line: 'transfer', color: '#8b5cf6' }, // 轉乘站
    { name: '文化中心站', lat: 22.6271, lon: 120.3180, type: 'mrt', line: 'orange', color: '#f97316' }, // 新增！
    { name: '中央公園站', lat: 22.6218, lon: 120.3150, type: 'mrt', line: 'red', color: '#e11d48' },
    { name: '三多商圈站', lat: 22.6134, lon: 120.3340, type: 'mrt', line: 'red', color: '#e11d48' },
    { name: '草衙站 (SKM Park)', lat: 22.5802, lon: 120.3275, type: 'mrt', line: 'red', color: '#e11d48' }, // 新增！
    { name: '衛武營站', lat: 22.6248, lon: 120.3404, type: 'mrt', line: 'orange', color: '#f97316' },
    { name: '西子灣站', lat: 22.6210, lon: 120.2725, type: 'mrt', line: 'orange', color: '#f97316' },
    { name: '駁二大義站', lat: 22.6202, lon: 120.2858, type: 'lightrail', line: 'lightrail', color: '#16a34a' },
    { name: '愛河之心站', lat: 22.6595, lon: 120.3028, type: 'lightrail', line: 'lightrail', color: '#16a34a' }
];

let map, mapLayers, userMarker = null;
let originCoords = null, destCoords = null, userCoords = null;
let activeAvatar = '🧍‍♂️';
let activeFilters = new Set(['mrt', 'lightrail', 'bus', 'bike']);

// ==================== 初始化地圖 ====================
function initMap() {
    map = L.map('map', { zoomControl: false }).setView(KAOHSIUNG_CENTER, 13);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapLayers = L.layerGroup().addTo(map);
    
    // 只需載入標準 OSM，夜間模式由 CSS filter 處理！保留所有細節。
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
});

// ==================== 小人偶切換 ====================
document.querySelectorAll('.avatar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeAvatar = btn.dataset.avatar;
    });
});

// ==================== 定位功能 ====================
document.getElementById('useLocationBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('瀏覽器不支援定位功能');
    const inputField = document.getElementById('originInput');
    inputField.value = "正在請求定位權限...";
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            originCoords = userCoords;
            inputField.value = `📍 我的位置 (${activeAvatar})`;
            map.flyTo([userCoords.lat, userCoords.lon], 15);
        },
        () => { alert('定位失敗！'); inputField.value = ""; },
        { enableHighAccuracy: true, timeout: 6000 }
    );
});

// ==================== 地址推薦 ====================
async function fetchAddressSuggestions(query, type) {
    if (query.length < 2) return;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=120.1,22.4,120.5,23.1&bounded=1&limit=5&countrycodes=tw`;
        const res = await fetch(url, { headers: { 'User-Agent': 'KaohsiungTransitV5/1.0' } });
        if (!res.ok) return;
        const data = await res.json();
        
        const dropdown = document.getElementById(`${type}Dropdown`);
        dropdown.innerHTML = '';
        if (data.length === 0) { dropdown.classList.add('hidden'); return; }
        
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            const shortName = item.name || item.display_name.split(',')[0];
            div.innerHTML = `<div class="autocomplete-item-main">📍 ${shortName}</div><div class="autocomplete-item-sub">${item.display_name}</div>`;
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
    } catch (err) {}
}

let debounceTimer;
document.querySelectorAll('input[data-location-type]').forEach(input => {
    const type = input.dataset.locationType;
    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchAddressSuggestions(e.target.value.trim(), type), 400);
    });
    input.addEventListener('focus', (e) => { if (e.target.value.trim().length >= 2) fetchAddressSuggestions(e.target.value.trim(), type); });
    input.addEventListener('blur', () => setTimeout(() => document.getElementById(`${type}Dropdown`).classList.add('hidden'), 200));
});

// ==================== 路線計算引擎 ====================
function getDistanceKM(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getRouteOSRM(lat1, lon1, lat2, lon2, profile = 'foot') {
    try {
        const res = await fetch(`${OSRM_API}/${profile}/${lon1},${lat1};${lon2},${lat2}?geometries=geojson`);
        if (!res.ok) return null;
        const data = await res.json();
        return { path: data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]), km: (data.routes[0].distance / 1000).toFixed(2), mins: Math.ceil(data.routes[0].duration / 60) };
    } catch (e) { return null; }
}

async function runRoutePlanning() {
    if (!originCoords || !destCoords) return alert('請確認起訖點！');
    
    // 切換回列表視圖
    document.getElementById('detailView').classList.remove('active');
    document.getElementById('resultsView').classList.remove('hidden-left');
    
    const container = document.getElementById('routesContainer');
    const loading = document.getElementById('loadingIndicator');
    loading.classList.remove('hidden'); container.innerHTML = ''; mapLayers.clearLayers();

    const outputRoutes = [];
    const directKM = getDistanceKM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon);

    // 1. 捷運與輕軌 (含跨線轉乘邏輯)
    if (activeFilters.has('mrt') || activeFilters.has('lightrail')) {
        let sortedStart = [...TRANSIT_STATIONS].sort((a,b) => getDistanceKM(originCoords.lat, originCoords.lon, a.lat, a.lon) - getDistanceKM(originCoords.lat, originCoords.lon, b.lat, b.lon));
        let sortedEnd = [...TRANSIT_STATIONS].sort((a,b) => getDistanceKM(destCoords.lat, destCoords.lon, a.lat, a.lon) - getDistanceKM(destCoords.lat, destCoords.lon, b.lat, b.lon));
        
        let st1 = sortedStart[0], st2 = sortedEnd[0];
        if (st1.name !== st2.name) {
            const leg1 = await getRouteOSRM(originCoords.lat, originCoords.lon, st1.lat, st1.lon, 'foot');
            const leg2 = await getRouteOSRM(st1.lat, st1.lon, st2.lat, st2.lon, 'driving'); // 模擬捷運軌跡
            const leg3 = await getRouteOSRM(st2.lat, st2.lon, destCoords.lat, destCoords.lon, 'foot');
            
            if (leg1 && leg2 && leg3) {
                // 🚀 跨線邏輯判斷：如果起點和終點不在同一條線，加上轉乘美麗島的時間與提示
                let waitTime = 4;
                let transferText = "";
                if (st1.line !== st2.line && st1.line !== 'transfer' && st2.line !== 'transfer') {
                    waitTime += 6; // 跨線轉乘懲罰時間
                    transferText = " (需於美麗島站轉乘)";
                }

                const totalMins = leg1.mins + waitTime + leg2.mins + leg3.mins;
                outputRoutes.push({
                    type: 'transit', badge: '🚇 軌道最速優先', title: `${st1.name} ➔ ${st2.name}`,
                    time: totalMins, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2),
                    steps: [
                        { icon: '🚶', title: `步行至 ${st1.name}`, desc: `約 ${leg1.mins} 分鐘 (${leg1.km} km)`, color: '#0ea5e9', path: leg1.path },
                        { icon: '🚇', title: `搭乘捷運/輕軌${transferText}`, desc: `候車與轉乘約 ${waitTime} 分 + 乘車 ${leg2.mins} 分鐘`, color: st1.color, path: leg2.path },
                        { icon: '🚶', title: `出站步行至目的地`, desc: `約 ${leg3.mins} 分鐘 (${leg3.km} km)`, color: '#0ea5e9', path: leg3.path }
                    ]
                });
            }
        }
    }

    // 2. 公車
    if (activeFilters.has('bus')) {
        const busDrive = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (busDrive) {
            const realBusMins = Math.ceil(busDrive.mins * 1.4) + 8;
            outputRoutes.push({
                type: 'bus', badge: '🚌 市區公車', title: '市區公車直達方案', time: realBusMins, dist: busDrive.km,
                steps: [{ icon: '🚌', title: '搭乘市區公車', desc: `包含停靠等候約 ${realBusMins} 分鐘`, color: '#9333ea', path: busDrive.path }]
            });
        }
    }

    // 3. YouBike
    if (activeFilters.has('bike') && directKM < 6) {
        const bikeDrive = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (bikeDrive) {
            const bikeMins = Math.ceil(bikeDrive.mins * 2.2);
            outputRoutes.push({
                type: 'bike', badge: '🚲 YouBike', title: '低碳單車騎行', time: bikeMins, dist: bikeDrive.km,
                steps: [{ icon: '🚴', title: '租借 YouBike 騎行', desc: `全程約 ${bikeMins} 分鐘`, color: '#475569', path: bikeDrive.path }]
            });
        }
    }

    outputRoutes.sort((a,b) => a.time - b.time);
    renderRouteCards(outputRoutes);
    loading.classList.add('hidden');
}

// ==================== 渲染與側滑面板 ====================
function renderRouteCards(routes) {
    const container = document.getElementById('routesContainer');
    if (routes.length === 0) { container.innerHTML = '<div class="error-box">查無結果</div>'; return; }

    routes.forEach((rt, idx) => {
        const card = document.createElement('div');
        card.className = 'route-card';
        const accentColor = rt.steps.find(s => s.icon !== '🚶')?.color || '#0ea5e9';

        card.innerHTML = `
            <span class="badge" style="background:${accentColor}15; color:${accentColor}">${rt.badge}</span>
            <div class="card-title">${rt.title}</div>
            <div class="card-meta">⏱️ ${rt.time} 分鐘 | 🛣️ ${rt.dist} km</div>
        `;

        card.addEventListener('click', () => showDetailPanel(rt, accentColor));
        container.appendChild(card);
        if (idx === 0) drawRouteOnMap(rt.steps); // 預設畫第一條
    });
}

function showDetailPanel(route, color) {
    drawRouteOnMap(route.steps);
    const detailContent = document.getElementById('detailContent');
    
    let stepsHtml = route.steps.map(s => `
        <div class="step-item">
            <div class="step-badge" style="background:${s.color}">${s.icon}</div>
            <div class="step-info">
                <div class="step-text">${s.title}</div>
                <div class="step-subtext">${s.desc}</div>
            </div>
        </div>
    `).join('');

    detailContent.innerHTML = `
        <div class="detail-header">
            <span class="badge" style="background:${color}15; color:${color}">${route.badge}</span>
            <div class="detail-title">${route.title}</div>
            <div class="card-meta">預估耗時: <b>${route.time} 分鐘</b> | 總距離: ${route.dist} km</div>
        </div>
        <div class="detail-steps">${stepsHtml}</div>
    `;

    document.getElementById('resultsView').classList.add('hidden-left');
    document.getElementById('detailView').classList.add('active');
}

// 返回按鈕
document.getElementById('backToListBtn').addEventListener('click', () => {
    document.getElementById('detailView').classList.remove('active');
    document.getElementById('resultsView').classList.remove('hidden-left');
});

// ==================== 繪製地圖與修復人偶 ====================
function drawRouteOnMap(steps) {
    mapLayers.clearLayers();
    let boundsPoints = [];
    
    steps.forEach(s => {
        L.polyline(s.path, { color: s.color, weight: 6, opacity: 0.85, dashArray: s.icon === '🚶' ? '6, 8' : 'none' }).addTo(mapLayers);
        boundsPoints = boundsPoints.concat(s.path);
    });

    // 🚀 修復 Bug：起點一律使用目前選擇的「小人偶」造型，絕不變回綠點！
    const startAvatar = L.divIcon({ html: `<div class="dynamic-avatar-icon">${activeAvatar}</div>`, className: '', iconSize: [40, 40], iconAnchor: [20, 35] });
    L.marker(boundsPoints[0], { icon: startAvatar }).addTo(mapLayers).bindPopup('出發點');
    
    // 終點保持紅色標記
    L.circleMarker(boundsPoints[boundsPoints.length - 1], { radius: 8, fillColor: '#e11d48', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(mapLayers).bindPopup('目的地');
    
    map.fitBounds(L.latLngBounds(boundsPoints), { padding: [40, 40] });
}

// 事件綁定
document.querySelectorAll('.filter-tag').forEach(t => t.addEventListener('click', () => {
    t.classList.toggle('active');
    if (t.classList.contains('active')) activeFilters.add(t.dataset.transit); else activeFilters.delete(t.dataset.transit);
}));
document.getElementById('swapBtn').addEventListener('click', () => {
    const o = document.getElementById('originInput'), d = document.getElementById('destinationInput');
    [o.value, d.value] = [d.value, o.value];
    [originCoords, destCoords] = [destCoords, originCoords];
});
document.getElementById('searchBtn').addEventListener('click', runRoutePlanning);

window.onload = initMap;