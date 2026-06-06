const OSRM_API = 'https://router.project-osrm.org/route/v1';
const KAOHSIUNG_CENTER = [22.6228, 120.3014];

const LOCAL_ALIASES = [
    { name: '高師大附中', lat: 22.6260, lon: 120.3236 },
    { name: '高雄榮總', lat: 22.6785, lon: 120.3195 },
    { name: '九如一路', lat: 22.6398, lon: 120.3445 },
    { name: '國立科學工藝博物館', lat: 22.6411, lon: 120.3227 }
];

const STATIONS_DATABASE = {
    mrt: [
        { name: '左營高鐵站', lat: 22.6874, lon: 120.3076, line: '紅線', padding: 5, busRoute: '紅60A', busStop: '高鐵左營站' },
        { name: '技擊館站', lat: 22.6268, lon: 120.3379, line: '橘線', padding: 3, busRoute: '248路公車', busStop: '捷運技擊館站' },
        { name: '文化中心站', lat: 22.6271, lon: 120.3180, line: '橘線', padding: 3, busRoute: '五福幹線', busStop: '捷運文化中心站' },
        { name: '高雄車站', lat: 22.6405, lon: 120.3022, line: '紅線', padding: 5, busRoute: '60路覺民幹線', busStop: '高雄車站(站東)' }
    ]
};

let map, mapLayers;
let originCoords = null, destCoords = null, userCoords = null;
let activeAvatar = '🧍‍♂️';
let routeStepLayers = [];

function initMap() {
    map = L.map('map', { zoomControl: false }).setView(KAOHSIUNG_CENTER, 13);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapLayers = L.layerGroup().addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    
    setTimeout(() => { map.invalidateSize(); }, 400);
}

// 🔍 點擊頂部放大鏡按鈕：將搜尋面板「重新打開」
document.getElementById('togglePanelBtn').addEventListener('click', () => {
    const panel = document.getElementById('searchPanel');
    panel.classList.remove('collapsed');
    document.getElementById('togglePanelBtn').classList.add('hidden');
    setTimeout(() => map.invalidateSize(), 300);
});

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
    });
});

document.getElementById('useLocationBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('您的瀏覽器不支援定位功能');
    const inputField = document.getElementById('originInput');
    inputField.value = "定位連線中...";
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            originCoords = userCoords;
            inputField.value = `📍 我的目前位置`;
            map.flyTo([userCoords.lat, userCoords.lon], 15);
        },
        (err) => { 
            alert('無法取得位置，請檢查手機瀏覽器定位服務是否開啟。');
            inputField.value = ""; 
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
});

async function fetchAddressSuggestions(query, type) {
    if (query.length < 2) return;
    const dropdown = document.getElementById(`${type}Dropdown`);
    dropdown.innerHTML = '';
    
    let searchQuery = query.includes('高雄') ? query : `高雄 ${query}`;
    let combinedResults = LOCAL_ALIASES.filter(item => item.name.includes(query));

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&viewbox=120.1,22.4,120.5,23.1&bounded=1&limit=5`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            data.forEach(o => {
                const shortName = o.name || o.display_name.split(',')[0];
                if (!combinedResults.some(c => c.name === shortName)) {
                    combinedResults.push({ name: shortName, lat: parseFloat(o.lat), lon: parseFloat(o.lon) });
                }
            });
        }
    } catch (e) {}

    if (combinedResults.length === 0) { dropdown.classList.add('hidden'); return; }
    
    combinedResults.slice(0, 5).forEach(item => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.textContent = `📍 ${item.name}`;
        div.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.getElementById(`${type}Input`).value = item.name;
            if (type === 'origin') originCoords = { lat: item.lat, lon: item.lon };
            else destCoords = { lat: item.lat, lon: item.lon };
            dropdown.classList.add('hidden');
        });
        dropdown.appendChild(div);
    });
    dropdown.classList.remove('hidden');
}

let debounceTimer;
document.querySelectorAll('input[data-location-type]').forEach(input => {
    const type = input.dataset.locationType;
    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchAddressSuggestions(e.target.value.trim(), type), 300);
    });
    input.addEventListener('blur', () => setTimeout(() => document.getElementById(`${type}Dropdown`).classList.add('hidden'), 200));
});

document.getElementById('swapBtn').addEventListener('click', () => {
    const o = document.getElementById('originInput'), d = document.getElementById('destinationInput');
    [o.value, d.value] = [d.value, o.value];
    [originCoords, destCoords] = [destCoords, originCoords];
});

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

async function getTrueBestStation(coords, stations) {
    let sorted = [...stations].sort((a,b) => getDistanceKM(coords.lat, coords.lon, a.lat, a.lon) - getDistanceKM(coords.lat, coords.lon, b.lat, b.lon));
    let walk1 = await getRouteOSRM(coords.lat, coords.lon, sorted[0].lat, sorted[0].lon, 'foot');
    return { station: sorted[0], walkLeg: walk1 };
}

async function runRoutePlanning() {
    if (!originCoords || !destCoords) return alert('請先輸入起訖點並從選單點選正確的地址！');
    
    // 🔍 1. 搜尋完後立馬隱藏面板，把所有空間釋放給資訊卡
    document.getElementById('searchPanel').classList.add('collapsed');
    document.getElementById('togglePanelBtn').classList.remove('hidden');

    document.getElementById('detailView').classList.add('hidden'); 
    document.getElementById('listView').classList.remove('hidden');
    
    const container = document.getElementById('routesContainer'); 
    const loading = document.getElementById('loadingIndicator');
    loading.classList.remove('hidden'); container.innerHTML = ''; mapLayers.clearLayers(); routeStepLayers = [];

    const outputRoutes = [];

    let bestStart = await getTrueBestStation(originCoords, STATIONS_DATABASE.mrt);
    let bestEnd = await getTrueBestStation(destCoords, STATIONS_DATABASE.mrt);
    let st1 = bestStart.station, st2 = bestEnd.station;
    let leg1 = bestStart.walkLeg, leg3 = bestEnd.walkLeg;
    
    if (st1.name !== st2.name && leg1 && leg3) {
        const leg2 = await getRouteOSRM(st1.lat, st1.lon, st2.lat, st2.lon, 'driving');
        if (leg2) {
            let startMode = '🚶'; 
            let startMins = leg1.rawMins; 
            let startTitle = `步行至 ${st1.name}`; 
            let startDetail = `從起點沿人行步道步行約 <b>${leg1.km} 公里</b> 前往鄰近的捷運站。`;
            let isMixed = false;
            
            // 🚌 2. 核心靈魂：落實保姆級乘車教學演算法
            if (parseFloat(leg1.km) > 1.2) {
                isMixed = true;
                startMode = '🚌'; 
                startMins = Math.ceil(parseFloat(leg1.km) * 3) + 5; 
                startTitle = `搭乘公車接駁 ➔ 抵達【${st1.name}】`;
                
                // 保姆級細節：把怎麼搭、坐什麼車、在哪裡下車完整寫出來！
                startDetail = `
                    <div class="instruction-box">🚌 本地生活圈保姆級公車乘車指引：</div>
                    1. 請從您的起點步行 2 分鐘，前往最近的市區公車站牌。<br>
                    2. 於站牌處搭乘 <b>高雄市公車 [ ${st1.busRoute} ]</b> 路線。<br>
                    3. 行經約 ${Math.ceil(parseFloat(leg1.km)*2)} 分鐘車程後，請在 <b>【 ${st1.busStop} 】</b> 站牌下車。<br>
                    4. 下車後跟隨隨行地圖指標，步行 1 分鐘即可由捷運出入口順日月台月台層。
                `;
            }
            
            let mrtDriveMins = Math.ceil(parseFloat(leg2.km) * 1.5);
            let rawTime = startMins + mrtDriveMins + 4 + st1.padding + st2.padding + leg3.rawMins;
            let bufferedTime = Math.ceil(rawTime * 1.1);
            
            let endDetail = `
                <div class="instruction-box">🏁 目的地最後步行指引：</div>
                抵達 <b>【${st2.name}】</b> 後刷卡出站，跟隨系統地圖虛線指引，步行約 <b>${leg3.km} 公里</b> (${leg3.rawMins}分鐘) 即可順利抵達目的地。
            `;

            outputRoutes.push({
                type: isMixed ? 'mixed' : 'mrt', 
                badge: isMixed ? '🌟 最佳綜合跨運具方案' : '🚇 捷運直達最速方案', 
                title: `${startMode} 接駁 ➔ 捷運 [${st1.line}] ➔ 🚶 步行`,
                time: bufferedTime, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2), price: '35 元', 
                color: isMixed ? '#f59e0b' : '#E60012',
                steps: [
                    { icon: startMode, title: startTitle, mins: startMins, color: '#0ea5e9', path: leg1.path, nodeName: `${st1.name}`, markerCoord: [st1.lat, st1.lon], detail: startDetail },
                    { icon: '🚇', title: `搭乘高雄捷運 [${st1.line}]`, mins: mrtDriveMins + 4, color: '#E60012', path: leg2.path, nodeName: `${st2.name}`, markerCoord: [st2.lat, st2.lon], detail: `進入月台搭乘捷運。車程預計 ${mrtDriveMins} 分鐘。` },
                    { icon: '🚶', title: `出站步行至終點`, mins: leg3.rawMins, color: '#10B981', path: leg3.path, nodeName: `目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: endDetail }
                ]
            });
        }
    }

    let isTooLong = outputRoutes.length === 0 || outputRoutes.some(rt => rt.time >= 45);
    if (isTooLong) {
        const driveRoute = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (driveRoute) {
            let waitTime = 5; let totalUberTime = driveRoute.rawMins + waitTime;
            let price = Math.ceil(85 + (parseFloat(driveRoute.km) * 25));
            outputRoutes.push({
                type: 'uber', badge: '🚕 備用方案：直達計程車', title: `多元計程車直達`, color: '#334155',
                time: totalUberTime, dist: driveRoute.km, price: `約 ${price} 元`,
                steps: [
                    { icon: '📱', title: `線上叫車`, mins: waitTime, color: '#475569', path: [], nodeName: null, detail: `大眾運輸效率不佳時，建議點擊呼叫 Uber 或呼叫計程車。` },
                    { icon: '🚕', title: `專車派送`, mins: driveRoute.rawMins, color: '#1e293b', path: driveRoute.path, nodeName: `目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: `公路效率最優，不需轉乘，車程 ${driveRoute.rawMins} 分鐘。` }
                ]
            });
        }
    }

    outputRoutes.sort((a,b) => (a.type === 'mixed') ? -1 : (b.type === 'mixed') ? 1 : a.time - b.time);
    renderRouteList(outputRoutes);
    loading.classList.add('hidden');
    setTimeout(() => map.invalidateSize(), 300);
}

function renderRouteList(routes) {
    const container = document.getElementById('routesContainer');
    if (routes.length === 0) { container.innerHTML = '<p class="empty-state">查無最優路線，請重試。</p>'; return; }
    routes.forEach((rt, idx) => {
        const card = document.createElement('div'); card.className = 'route-card';
        card.innerHTML = `
            <span class="badge" style="background:${rt.color}15; color:${rt.color}">${rt.badge}</span>
            <div class="card-title">${rt.title}</div>
            <div class="card-meta">⏱️ 預估總時: <b>${rt.time} 分鐘</b> | 🛣️ ${rt.dist} km</div>
        `;
        card.addEventListener('click', () => toggleToDetailView(rt, rt.color));
        container.appendChild(card);
        if (idx === 0) drawRouteOnMap(rt.steps);
    });
}

function toggleToDetailView(route, themeColor) {
    drawRouteOnMap(route.steps);
    const content = document.getElementById('detailContent');

    let stepsHtml = route.steps.map((s, index) => {
        // 這裡將 detail 完美吐給前端，讓點擊「展開保姆級指引」時能真正看見文字
        return `
            <div class="step-row">
                <div class="step-circle" style="background:${s.color}">${s.icon}</div>
                <div class="step-body">
                    <div class="clickable-step-header" onclick="toggleSubStepDetail(${index})">
                        <span class="step-title">${s.title} (${s.mins}分)</span>
                        <span class="click-hint">展開保姆級指引 ▾</span>
                    </div>
                    <div id="subStep-${index}" class="sub-step-details hidden">${s.detail}</div>
                </div>
            </div>
        `;
    }).join('');

    content.innerHTML = `
        <div class="detail-main-title">${route.title}</div>
        <div class="meta-info-grid">
            <div class="meta-item"><span class="meta-label">⏱️ 總時間</span><span class="meta-value" style="color:${themeColor}">${route.time} 分鐘</span></div>
            <div class="meta-item"><span class="meta-label">💰 預估票價</span><span class="meta-value">${route.price}</span></div>
        </div>
        <div>${stepsHtml}</div>
    `;
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('detailView').classList.remove('hidden');
}

window.toggleSubStepDetail = function(index) {
    const el = document.getElementById(`subStep-${index}`);
    if(el) {
        el.classList.toggle('hidden');
        if (!el.classList.contains('hidden')) {
            routeStepLayers.forEach(item => {
                if (item.index === index) {
                    item.layer.setStyle({ weight: 9, opacity: 1 });
                    if (item.layer.getBounds && Object.keys(item.layer.getBounds()).length > 0) map.fitBounds(item.layer.getBounds(), { padding: [30, 30] });
                } else item.layer.setStyle({ weight: 4, opacity: 0.2 });
            });
        } else {
            routeStepLayers.forEach(item => item.layer.setStyle({ weight: 6, opacity: 0.85 }));
        }
    }
};

function drawRouteOnMap(steps) {
    mapLayers.clearLayers(); 
    let boundsPoints = [];
    routeStepLayers = [];
    
    steps.forEach((s, index) => {
        if(s.path && s.path.length > 0) {
            let polyline = L.polyline(s.path, { color: s.color, weight: 6, opacity: 0.85, dashArray: (s.icon === '🚶' || s.icon === '🚲') ? '5, 8' : 'none' }).addTo(mapLayers);
            routeStepLayers.push({ index: index, layer: polyline });
            boundsPoints = boundsPoints.concat(s.path);
        }
        if (s.nodeName && s.markerCoord) {
            L.circleMarker(s.markerCoord, { radius: 6, fillColor: s.color, color: '#ffffff', weight: 2, fillOpacity: 1 }).addTo(mapLayers);
            L.marker(s.markerCoord, { icon: L.divIcon({ className: 'hidden' }) }).addTo(mapLayers).bindTooltip(`📍 ${s.nodeName}`, { permanent: true, direction: 'top', className: 'map-node-tooltip', offset: [0, -5] });
        }
    });

    if (originCoords) {
        const customIcon = L.divIcon({ html: `<div class="dynamic-avatar-icon">${activeAvatar}</div>`, className: '', iconSize: [40, 40], iconAnchor: [20, 35] });
        L.marker([originCoords.lat, originCoords.lon], { icon: customIcon }).addTo(mapLayers);
        boundsPoints.push([originCoords.lat, originCoords.lon]); 
    }

    if(boundsPoints.length > 0) map.fitBounds(L.latLngBounds(boundsPoints), { padding: [40, 40] });
}

document.getElementById('backToListBtn').addEventListener('click', () => {
    document.getElementById('detailView').classList.add('hidden'); document.getElementById('listView').classList.remove('hidden');
    routeStepLayers.forEach(item => item.layer.setStyle({ weight: 6, opacity: 0.85 }));
});

document.getElementById('searchBtn').addEventListener('click', runRoutePlanning);
window.onload = initMap;
