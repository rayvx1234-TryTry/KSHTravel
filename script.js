const OSRM_API = 'https://router.project-osrm.org/route/v1';
const KAOHSIUNG_CENTER = [22.6228, 120.3014];

const LOCAL_ALIASES = [
    { name: '高師大附中', lat: 22.6260, lon: 120.3236 },
    { name: '高雄榮總', lat: 22.6785, lon: 120.3195 },
    { name: '九如一路', lat: 22.6398, lon: 120.3445 },
    { name: '國立科學工藝博物館', lat: 22.6411, lon: 120.3227 }
];

// 擴充的高雄軌道與公車轉乘資料庫
const STATIONS_DATABASE = {
    mrt: [
        { name: '左營高鐵站', lat: 22.6874, lon: 120.3076, line: '紅線', padding: 5, busRoute: '紅60A', busStop: '高鐵左營站' },
        { name: '技擊館站', lat: 22.6268, lon: 120.3379, line: '橘線', padding: 3, busRoute: '248路公車', busStop: '捷運技擊館站' },
        { name: '文化中心站', lat: 22.6271, lon: 120.3180, line: '橘線', padding: 3, busRoute: '五福幹線', busStop: '捷運文化中心站' },
        { name: '高雄車站', lat: 22.6405, lon: 120.3022, line: '紅線', padding: 5, busRoute: '60路覺民幹線', busStop: '高雄車站(站東)' },
        { name: '巨蛋站', lat: 22.6658, lon: 120.3024, line: '紅線', padding: 4, busRoute: '24區間車', busStop: '捷運巨蛋站' },
        { name: '五塊厝站', lat: 22.6288, lon: 120.3301, line: '橘線', padding: 3, busRoute: '0北', busStop: '捷運五塊厝站' }
    ],
    lrt: [
        { name: '凱旋公園站(C32)', lat: 22.6284, lon: 120.3245, line: '輕軌', padding: 3 },
        { name: '衛生局站(C33)', lat: 22.6212, lon: 120.3255, line: '輕軌', padding: 3 },
        { name: '愛河之心站(C24)', lat: 22.6565, lon: 120.3028, line: '輕軌', padding: 4 },
        { name: '高雄展覽館站(C8)', lat: 22.6105, lon: 120.3005, line: '輕軌', padding: 3 }
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
        const div = document.createElement('div'); div.className = 'autocomplete-item'; div.textContent = `📍 ${item.name}`;
        div.addEventListener('mousedown', (e) => {
            e.preventDefault(); document.getElementById(`${type}Input`).value = item.name;
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
    [o.value, d.value] = [d.value, o.value]; [originCoords, destCoords] = [destCoords, originCoords];
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

async function getBestStationFromSet(coords, stations) {
    let sorted = [...stations].sort((a,b) => getDistanceKM(coords.lat, coords.lon, a.lat, a.lon) - getDistanceKM(coords.lat, coords.lon, b.lat, b.lon));
    if (sorted.length === 0) return null;
    let walk = await getRouteOSRM(coords.lat, coords.lon, sorted[0].lat, sorted[0].lon, 'foot');
    return { station: sorted[0], walkLeg: walk };
}

async function runRoutePlanning() {
    if (!originCoords || !destCoords) return alert('請先輸入起訖點並從選單點選正確的地址！');
    
    document.getElementById('searchPanel').classList.add('collapsed');
    document.getElementById('togglePanelBtn').classList.remove('hidden');
    document.getElementById('detailView').classList.add('hidden'); 
    document.getElementById('listView').classList.remove('hidden');
    
    const container = document.getElementById('routesContainer'); 
    const loading = document.getElementById('loadingIndicator');
    loading.classList.remove('hidden'); container.innerHTML = ''; mapLayers.clearLayers(); routeStepLayers = [];

    const outputRoutes = [];

    // ==================== 1. 捷運專屬版方案 ====================
    let mrtStart = await getBestStationFromSet(originCoords, STATIONS_DATABASE.mrt);
    let mrtEnd = await getBestStationFromSet(destCoords, STATIONS_DATABASE.mrt);
    if (mrtStart && mrtEnd && mrtStart.station.name !== mrtEnd.station.name && mrtStart.walkLeg && mrtEnd.walkLeg) {
        // 智慧檢查：若兩邊步行皆小於 20 分鐘（約1.5公里內），才輸出純捷運方案
        if (parseFloat(mrtStart.walkLeg.km) <= 1.5 && parseFloat(mrtEnd.walkLeg.km) <= 1.5) {
            let leg2 = await getRouteOSRM(mrtStart.station.lat, mrtStart.station.lon, mrtEnd.station.lat, mrtEnd.station.lon, 'driving');
            if (polylineValid(leg2)) {
                let mrtTime = Math.ceil((mrtStart.walkLeg.rawMins + leg2.rawMins + mrtEnd.walkLeg.rawMins + 6) * 1.05);
                outputRoutes.push({
                    type: 'mrt', badge: '🚇 捷運直達/轉乘方案', title: `🚶 步行 ➔ 捷運 [${mrtStart.station.line}] ➔ 🚶 目的地`,
                    time: mrtTime, dist: (parseFloat(mrtStart.walkLeg.km) + parseFloat(leg2.km) + parseFloat(mrtEnd.walkLeg.km)).toFixed(2), price: '30 元', color: '#E60012',
                    steps: [
                        { icon: '🚶', title: `步行至捷運 ${mrtStart.station.name}`, mins: mrtStart.walkLeg.rawMins, color: '#64748b', path: mrtStart.walkLeg.path, nodeName: mrtStart.station.name, markerCoord: [mrtStart.station.lat, mrtStart.station.lon], detail: `從起點步行約 ${mrtStart.walkLeg.km} 公里抵達捷運站進站。` },
                        { icon: '🚇', title: `搭乘捷運隨行車程`, mins: leg2.rawMins + 4, color: '#E60012', path: leg2.path, nodeName: mrtEnd.station.name, markerCoord: [mrtEnd.station.lat, mrtEnd.station.lon], detail: `進入捷運月台搭乘。車程與轉乘月台移動預計 ${leg2.rawMins + 4} 分鐘。` },
                        { icon: '🚶', title: `出站步行至終點`, mins: mrtEnd.walkLeg.rawMins, color: '#10B981', path: mrtEnd.walkLeg.path, nodeName: `目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: `由捷運站出口刷卡出站，跟隨隨行地圖步行約 ${mrtEnd.walkLeg.km} 公里抵達終點。` }
                    ]
                });
            }
        }
    }

    // ==================== 2. 🍏 輕軌優先版方案 (滿足使用者喜好) ====================
    let lrtStart = await getBestStationFromSet(originCoords, STATIONS_DATABASE.lrt);
    let lrtEnd = await getBestStationFromSet(destCoords, STATIONS_DATABASE.lrt);
    if (lrtStart && lrtEnd && lrtStart.station.name !== lrtEnd.station.name && lrtStart.walkLeg && lrtEnd.walkLeg) {
        // 同樣實施智慧過濾：如果步行太遠，就不暴力顯示純輕軌卡片
        if (parseFloat(lrtStart.walkLeg.km) <= 1.5 && parseFloat(lrtEnd.walkLeg.km) <= 1.5) {
            let leg2 = await getRouteOSRM(lrtStart.station.lat, lrtStart.station.lon, lrtEnd.station.lat, lrtEnd.station.lon, 'driving');
            if (polylineValid(leg2)) {
                let lrtTime = Math.ceil((lrtStart.walkLeg.rawMins + leg2.rawMins + lrtEnd.walkLeg.rawMins + 5) * 1.05);
                outputRoutes.push({
                    type: 'lrt', badge: '🍏 輕軌愜意漫遊方案', title: `🚶 步行 ➔ 高雄環狀輕軌 ➔ 🚶 目的地`,
                    time: lrtTime, dist: (parseFloat(lrtStart.walkLeg.km) + parseFloat(leg2.km) + parseFloat(lrtEnd.walkLeg.km)).toFixed(2), price: '20 元', color: '#009E52',
                    steps: [
                        { icon: '🚶', title: `步行至輕軌 ${lrtStart.station.name}`, mins: lrtStart.walkLeg.rawMins, color: '#64748b', path: lrtStart.walkLeg.path, nodeName: lrtStart.station.name, markerCoord: [lrtStart.station.lat, lrtStart.station.lon], detail: `漫步跟隨導航走往輕軌地面開放式月台。` },
                        { icon: '🍏', title: `搭乘環狀輕軌列車`, mins: leg2.rawMins + 2, color: '#009E52', path: leg2.path, nodeName: lrtEnd.station.name, markerCoord: [lrtEnd.station.lat, lrtEnd.station.lon], detail: `列車進站後「手動按壓車門鈕」上下車。沿途可欣賞城市綠廊風景。` },
                        { icon: '🚶', title: `出站步行至目的地`, mins: lrtEnd.walkLeg.rawMins, color: '#10B981', path: lrtEnd.walkLeg.path, nodeName: `目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: `下車同樣按壓車門鈕出站，於月台刷卡機完成刷卡後，步行抵達目的地。` }
                    ]
                });
            }
        }
    }

    // ==================== 3. 🌟 綜合跨運具方案 (保姆公車接駁) ====================
    // 若起點距離任何軌道都很遠，則觸發公車接駁捷運的綜合方案
    let bestStart = mrtStart; 
    let leg1 = bestStart ? bestStart.walkLeg : null;
    if (bestStart && leg1 && parseFloat(leg1.km) > 1.2) {
        let st1 = bestStart.station;
        let leg2 = await getRouteOSRM(st1.lat, st1.lon, mrtEnd.station.lat, mrtEnd.station.lon, 'driving');
        if (polylineValid(leg2) && mrtEnd.walkLeg) {
            let busMins = Math.ceil(parseFloat(leg1.km) * 3) + 6;
            let mrtDriveMins = Math.ceil(parseFloat(leg2.km) * 1.4);
            let totalMixedTime = Math.ceil((busMins + mrtDriveMins + mrtEnd.walkLeg.rawMins + 8) * 1.05);
            
            outputRoutes.push({
                type: 'mixed', badge: '🌟 最佳跨運具綜合方案', title: `🚌 公車接駁 ➔ 捷運 [${st1.line}] ➔ 🚶 步行`,
                time: totalMixedTime, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(mrtEnd.walkLeg.km)).toFixed(2), price: '35 元', color: '#f59e0b',
                steps: [
                    { 
                        icon: '🚌', title: `搭乘公車接駁至【${st1.name}】`, mins: busMins, color: '#0ea5e9', path: leg1.path, nodeName: st1.name, markerCoord: [st1.lat, st1.lon],
                        detail: `<div class="instruction-box">🚌 本地生活圈保姆級公車乘車指引：</div>
                                 1. 請前往起點鄰近市區公車站牌。<br>
                                 2. 隨後搭乘高捷接駁公車 <b>[ ${st1.busRoute} ]</b>。<br>
                                 3. 於 <b>【 ${st1.busStop} 】</b> 站牌下車。<br>
                                 4. 下車後過馬路跟隨指標即可直接順入捷運地下月台。`
                    },
                    { icon: '🚇', title: `搭乘捷運高效率移動`, mins: mrtDriveMins, color: '#E60012', path: leg2.path, nodeName: mrtEnd.station.name, markerCoord: [mrtEnd.station.lat, mrtEnd.station.lon], detail: `搭乘捷運市區核心段，車程與過站預計 ${mrtDriveMins} 分鐘。` },
                    { icon: '🚶', title: `最後一哩路步行`, mins: mrtEnd.walkLeg.rawMins, color: '#10B981', path: mrtEnd.walkLeg.path, nodeName: `目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: `刷卡出站，沿林蔭人行道步行約 ${mrtEnd.walkLeg.km} 公里抵達目的地。` }
                ]
            });
        }
    }

    // ==================== 4. 🚕 多元計程車方案 (精準紅綠燈加權版) ====================
    const driveRoute = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
    if (polylineValid(driveRoute)) {
        let waitTime = 5;
        // 🎯 重點優化：將公路原始車程時間乘上 1.10（即加計 10% 的都市紅綠燈與塞車時間）
        let adjustedDriveMins = Math.ceil(driveRoute.rawMins * 1.10);
        let totalUberTime = adjustedDriveMins + waitTime;
        let price = Math.ceil(85 + (parseFloat(driveRoute.km) * 25));

        outputRoutes.push({
            type: 'uber', badge: '🚕 快速直達：多元計程車', title: `呼叫小黃 / 多元計程車直達`, color: '#475569',
            time: totalUberTime, dist: driveRoute.km, price: `約 ${price} 元`,
            steps: [
                { icon: '📱', title: `手機 App 線上叫車與等候`, mins: waitTime, color: '#64748b', path: [], nodeName: null, detail: `開啟叫車軟體，司機接單後預計等候 5 分鐘抵達起點接送。` },
                { icon: '🚕', title: `專車派送 (已計入市區紅綠燈加權)`, mins: adjustedDriveMins, color: '#334155', path: driveRoute.path, nodeName: `目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: `走最佳公路幹線。<b>本系統已自動為您加計 10% 的沿途紅綠燈停等時間</b>，呈現最準確的預估抵達時效。` }
            ]
        });
    }

    // 如果沒有任何大眾運輸方案過濾留存，則塞入一個最基本的步行方案保底
    if (outputRoutes.length <= 1) {
        let directWalk = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'foot');
        if (directWalk && directWalk.rawMins < 45) {
            outputRoutes.push({
                type: 'walk', badge: '🚶 健康步行方案', title: `全程散步前往`, color: '#10B981',
                time: directWalk.rawMins, dist: directWalk.km, price: '0 元',
                steps: [{ icon: '🚶', title: `散步至目的地`, mins: directWalk.rawMins, color: '#10B981', path: directWalk.path, nodeName: `目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: `距離尚近，直接步行即可抵達。` }]
            });
        }
    }

    // 依據時間效率排序，但讓特色大眾運輸方案與綜合方案置頂
    outputRoutes.sort((a, b) => {
        const priority = { mixed: 1, lrt: 2, mrt: 3, uber: 4, walk: 5 };
        return (priority[a.type] || 99) - (priority[b.type] || 99);
    });

    renderRouteList(outputRoutes);
    loading.classList.add('hidden');
    setTimeout(() => map.invalidateSize(), 300);
}

function polylineValid(leg) { return leg && leg.path && leg.path.length > 0; }

function renderRouteList(routes) {
    const container = document.getElementById('routesContainer');
    if (routes.length === 0) { container.innerHTML = '<p class="empty-state">查無最適大眾運輸路線，請微調起訖點重試。</p>'; return; }
    routes.forEach((rt, idx) => {
        const card = document.createElement('div'); card.className = `route-card card-flavor-${rt.type}`;
        card.innerHTML = `
            <span class="badge-tag" style="background:${rt.color}15; color:${rt.color}; border: 1px solid ${rt.color}40">${rt.badge}</span>
            <div class="card-title">${rt.title}</div>
            <div class="card-meta">⏱️ 預估總時: <b>${rt.time} 分鐘</b> | 🛣️ ${rt.dist} km | 💰 ${rt.price}</div>
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
                        <span class="click-hint">展開詳細指引 ▾</span>
                    </div>
                    <div id="subStep-${index}" class="sub-step-details hidden">${s.detail}</div>
                </div>
            </div>
        `;
    }).join('');

    content.innerHTML = `
        <div class="detail-main-title">${route.title}</div>
        <div class="meta-info-grid">
            <div class="meta-item"><span class="meta-label">⏱️ 預估總需時</span><span class="meta-value" style="color:${themeColor}">${route.time} 分鐘</span></div>
            <div class="meta-item"><span class="meta-label">💰 預估票價</span><span class="meta-value">${route.price}</span></div>
            <div class="meta-item"><span class="meta-label">🛣️ 總公里數</span><span class="meta-value">${route.dist} km</span></div>
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
    mapLayers.clearLayers(); let boundsPoints = []; routeStepLayers = [];
    steps.forEach((s, index) => {
        if(s.path && s.path.length > 0) {
            let polyline = L.polyline(s.path, { color: s.color, weight: 6, opacity: 0.85, dashArray: (s.icon === '🚶') ? '5, 8' : 'none' }).addTo(mapLayers);
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
