const OSRM_API = 'https://router.project-osrm.org/route/v1';
const KAOHSIUNG_CENTER = [22.6228, 120.3014];

const LOCAL_ALIASES = [
    { name: '高師大附中', lat: 22.6260, lon: 120.3236 },
    { name: '高雄榮總', lat: 22.6785, lon: 120.3195 }
];

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
        { name: 'C32 凱旋公園站', lat: 22.6295, lon: 120.3233, line: '環狀輕軌', padding: 2 },
        { name: 'C33 衛生局站', lat: 22.6246, lon: 120.3239, line: '環狀輕軌', padding: 2 },
        { name: 'C24 愛河之心站', lat: 22.6595, lon: 120.3028, line: '環狀輕軌', padding: 2 }
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
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';

    // 💡 防止手機端上下切換時 Leaflet 地圖區塊渲染不完全的關鍵
    setTimeout(() => { map.invalidateSize(); }, 400);
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
    });
});

// 🍎 iOS 寬容度優化定位
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
            setTimeout(() => map.invalidateSize(), 300);
        },
        (err) => { 
            let msg = '定位失敗。';
            if(err.code === 1) msg = '權限被拒絕，請在 iOS 設定 -> 隱私權與安全性 -> 定位服務 中將瀏覽器改為允許位置。';
            if(err.code === 2) msg = 'GPS 訊號不佳，請移至窗邊或室外再試一次。';
            if(err.code === 3) msg = '連線超時，請確認目前網路狀態。';
            alert(msg);
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
    if (!originCoords || !destCoords) return alert('請先輸入起訖點並從選單點選建議地址！');
    document.getElementById('detailView').classList.add('hidden'); document.getElementById('listView').classList.remove('hidden');
    const container = document.getElementById('routesContainer'); const loading = document.getElementById('loadingIndicator');
    loading.classList.remove('hidden'); container.innerHTML = ''; mapLayers.clearLayers(); routeStepLayers = [];

    const outputRoutes = [];

    // 🌟 全自動智慧跨運具混合排程 (固定全開，不受舊篩選按鈕干擾)
    let bestStart = await getTrueBestStation(originCoords, STATIONS_DATABASE.mrt);
    let bestEnd = await getTrueBestStation(destCoords, STATIONS_DATABASE.mrt);
    let st1 = bestStart.station, st2 = bestEnd.station;
    let leg1 = bestStart.walkLeg, leg3 = bestEnd.walkLeg;
    
    if (st1.name !== st2.name && leg1 && leg3) {
        const leg2 = await getRouteOSRM(st1.lat, st1.lon, st2.lat, st2.lon, 'driving');
        if (leg2) {
            let startMode = '🚶'; let startMins = leg1.rawMins; let startTitle = `步行至 ${st1.name}`; let startDetail = `沿人行道步行前往車站。`;
            let isMixed = false;
            if (parseFloat(leg1.km) > 1.5) {
                isMixed = true;
                startMode = '🚲'; startMins = Math.ceil(parseFloat(leg1.km) * 4); startTitle = `搭乘公車或騎 YouBike ➔ ${st1.name}`;
                startDetail = `起點離捷運站較遠 (${leg1.km} 公里)，系統強烈建議轉搭接駁公車或騎乘 YouBike 前往，切勿徒步。`;
            }
            
            let mrtDriveMins = Math.ceil(parseFloat(leg2.km) * 1.5);
            let rawTime = startMins + mrtDriveMins + 4 + st1.padding + st2.padding + leg3.rawMins;
            let bufferedTime = Math.ceil(rawTime * 1.1);
            
            outputRoutes.push({
                type: isMixed ? 'mixed' : 'mrt', 
                badge: isMixed ? '🌟 系統推薦最佳綜合方案' : '🚇 捷運直達最速方案', 
                title: `${startMode} 接駁 ➔ 捷運 ➔ 🚶 抵達`,
                time: bufferedTime, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2), price: '30 元', 
                color: isMixed ? '#f59e0b' : '#E60012',
                steps: [
                    { icon: startMode, title: startTitle, mins: startMins, color: '#0ea5e9', path: leg1.path, nodeName: `${st1.name}`, markerCoord: [st1.lat, st1.lon], detail: startDetail },
                    { icon: '🚇', title: `搭乘高雄捷運 [${st1.line}]`, mins: mrtDriveMins + 4, color: '#E60012', path: leg2.path, nodeName: `${st2.name}`, markerCoord: [st2.lat, st2.lon], detail: `搭乘捷運，車程預計 ${mrtDriveMins} 分鐘。` },
                    { icon: '🚶', title: `出站步行至終點`, mins: leg3.rawMins, color: '#0ea5e9', path: leg3.path, nodeName: `目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: `刷卡出站，步行抵達終點。` }
                ]
            });
        }
    }

    let isTooLong = outputRoutes.length === 0 || outputRoutes.some(rt => rt.time >= 50);
    if (isTooLong) {
        const driveRoute = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (driveRoute) {
            let waitTime = 5;
            let totalUberTime = driveRoute.rawMins + waitTime;
            let price = Math.ceil(85 + (parseFloat(driveRoute.km) * 25));

            outputRoutes.push({
                type: 'uber', badge: '🚕 建議方案：改搭 Uber 直達', title: `多元計程車直達`, color: '#334155',
                time: totalUberTime, dist: driveRoute.km, price: `約 ${price} 元`,
                steps: [
                    { icon: '📱', title: `線上叫車與等候`, mins: waitTime, color: '#334155', path: [], nodeName: null, detail: `因距離較遠或跨運具耗時，建議叫車節省時間。` },
                    { icon: '🚕', title: `專車派送直達`, mins: driveRoute.rawMins, color: '#0f172a', path: driveRoute.path, nodeName: `目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: `車程約 ${driveRoute.rawMins} 分鐘。` }
                ]
            });
        }
    }

    // 排序：不論如何，只要符合綜合(mixed)的優先排在最上面
    outputRoutes.sort((a,b) => {
        if (a.type === 'mixed') return -1;
        if (b.type === 'mixed') return 1;
        return a.time - b.time;
    });
    
    renderRouteList(outputRoutes);
    loading.classList.add('hidden');
    setTimeout(() => map.invalidateSize(), 300);
}

function renderRouteList(routes) {
    const container = document.getElementById('routesContainer');
    if (routes.length === 0) { container.innerHTML = '<p class="empty-state">查無可行路線，請嘗試更換地址。</p>'; return; }
    routes.forEach((rt, idx) => {
        const card = document.createElement('div'); card.className = 'route-card';
        card.innerHTML = `
            <span class="badge" style="background:${rt.color}15; color:${rt.color}">${rt.badge}</span>
            <div class="card-title">${rt.title}</div>
            <div class="card-meta">⏱️ 總時: <b>${rt.time} 分鐘</b> | 🛣️ ${rt.dist} km</div>
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
        return `
            <div class="step-row">
                <div class="step-circle" style="background:${s.color}">${s.icon}</div>
                <div class="step-body">
                    <div class="clickable-step-header" onclick="toggleSubStepDetail(${index})">
                        <span class="step-title">${s.title} (${s.mins}分)</span>
                        ${s.path && s.path.length > 0 ? `<span class="click-hint">展開路徑 ▾</span>` : `<span class="click-hint" style="color:#8B5CF6">指引 ▾</span>`}
                    </div>
                    <div id="subStep-${index}" class="sub-step-details hidden">${s.detail}</div>
                </div>
            </div>
        `;
    }).join('');

    content.innerHTML = `
        <div class="detail-main-title">${route.title}</div>
        <div class="meta-info-grid">
            <div class="meta-item"><span class="meta-label">⏱️ 推算總時</span><span class="meta-value" style="color:${themeColor}">${route.time} 分鐘</span></div>
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
            let polyline = L.polyline(s.path, { color: s.color, weight: 6, opacity: 0.85, dashArray: s.icon === '🚶' ? '5, 8' : 'none' }).addTo(mapLayers);
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
