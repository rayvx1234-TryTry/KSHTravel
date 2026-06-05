const OSRM_API = 'https://router.project-osrm.org/route/v1';
const KAOHSIUNG_CENTER = [22.6228, 120.3014];

// 🛰️ 1. 自建精準在地地標庫：防止開源圖資定位偏移 (解決高師大附中被定到本部的Bug)
const LOCAL_ALIASES = [
    { name: '高師大附中大門', lat: 22.6190, lon: 120.3263 },
    { name: '高師大附屬高級中學', lat: 22.6190, lon: 120.3263 },
    { name: '高雄榮民總醫院 (榮總)', lat: 22.6785, lon: 120.3195 }
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
        { name: '草衙站', lat: 22.5807, lon: 120.3275, line: '紅線', padding: 3 },
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
        { name: 'C14 哈瑪星站', lat: 22.6215, lon: 120.2720, line: '環狀輕軌', padding: 2 },
        { name: 'C3 前鎮之星站', lat: 22.5966, lon: 120.3150, line: '環狀輕軌', padding: 2 },
        { name: 'C5 夢時代站', lat: 22.5954, lon: 120.3045, line: '環狀輕軌', padding: 2 },
        { name: 'C11 真愛碼頭站', lat: 22.6195, lon: 120.2885, line: '環狀輕軌', padding: 2 }
    ]
};

let map, mapLayers;
let originCoords = null, destCoords = null, userCoords = null;
let activeAvatar = '🧍‍♂️';
let activeFilters = new Set(['mrt', 'lightrail', 'bus', 'bike']);
let routeStepLayers = [];

function initMap() {
    map = L.map('map', { zoomControl: false }).setView(KAOHSIUNG_CENTER, 13);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapLayers = L.layerGroup().addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';
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
        toast.textContent = `已切換為 ${activeAvatar} 角色`; toast.classList.remove('hidden'); toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.classList.add('hidden'), 300); }, 800);
    });
});

document.getElementById('useLocationBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('瀏覽器不支援定位');
    const inputField = document.getElementById('originInput');
    inputField.value = "精確定位中...";
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            originCoords = userCoords;
            inputField.value = `📍 我的位置`;
            map.flyTo([userCoords.lat, userCoords.lon], 15);
        },
        () => { alert('定位失敗，請確認位置權限。'); inputField.value = ""; },
        { enableHighAccuracy: true, timeout: 6000 }
    );
});

async function fetchAddressSuggestions(query, type) {
    if (query.length < 2) return;
    const dropdown = document.getElementById(`${type}Dropdown`);
    dropdown.innerHTML = '';
    
    // 🛰️ 攔截：先比對在地精確資料庫
    let combinedResults = LOCAL_ALIASES.filter(item => item.name.includes(query) || query.includes(item.name));

    // 呼叫 OSM API
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=120.1,22.4,120.5,23.1&bounded=1&limit=5`;
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

// 🚀 核心升級：真實步行權重對決演算法 (解決只看直線距離的 Bug)
async function getTrueBestStation(coords, stations) {
    // 先抓出「直線距離」最近的 2 個站點
    let sorted = [...stations].sort((a,b) => getDistanceKM(coords.lat, coords.lon, a.lat, a.lon) - getDistanceKM(coords.lat, coords.lon, b.lat, b.lon));
    let top2 = sorted.slice(0, 2);

    // 分別去計算「實際走過去的時間」
    let walk1 = await getRouteOSRM(coords.lat, coords.lon, top2[0].lat, top2[0].lon, 'foot');
    let walk2 = await getRouteOSRM(coords.lat, coords.lon, top2[1].lat, top2[1].lon, 'foot');

    // 誰真的走比較快，就回傳誰！
    if (walk1 && walk2 && walk2.rawMins < walk1.rawMins) {
        return { station: top2[1], walkLeg: walk2 };
    }
    return { station: top2[0], walkLeg: walk1 };
}

async function runRoutePlanning() {
    if (!originCoords || !destCoords) return alert('請確認起訖點皆已輸入並從選單選擇！');
    document.getElementById('detailView').classList.add('hidden'); document.getElementById('listView').classList.remove('hidden');
    const container = document.getElementById('routesContainer'); const loading = document.getElementById('loadingIndicator');
    loading.classList.remove('hidden'); container.innerHTML = ''; mapLayers.clearLayers(); routeStepLayers = [];

    const outputRoutes = [];

    if (activeFilters.has('mrt')) {
        let bestStart = await getTrueBestStation(originCoords, STATIONS_DATABASE.mrt);
        let bestEnd = await getTrueBestStation(destCoords, STATIONS_DATABASE.mrt);
        let st1 = bestStart.station, st2 = bestEnd.station;
        let leg1 = bestStart.walkLeg, leg3 = bestEnd.walkLeg;
        
        if (st1.name !== st2.name && leg1 && leg3) {
            let isTransfer = (st1.line === '紅線' && st2.line === '橘線') || (st1.line === '橘線' && st2.line === '紅線');
            
            if (isTransfer) {
                let hub = STATIONS_DATABASE.mrt.find(s => s.name === '美麗島站');
                const leg2a = await getRouteOSRM(st1.lat, st1.lon, hub.lat, hub.lon, 'driving');
                const leg2b = await getRouteOSRM(hub.lat, hub.lon, st2.lat, st2.lon, 'driving');
                
                if (leg2a && leg2b) {
                    let driveMins1 = Math.ceil(parseFloat(leg2a.km) * 1.5);
                    let driveMins2 = Math.ceil(parseFloat(leg2b.km) * 1.5);
                    let rawTime = leg1.rawMins + driveMins1 + 4 + 6 + driveMins2 + 4 + leg3.rawMins + st1.padding + st2.padding;
                    let bufferedTime = Math.ceil(rawTime * 1.1);

                    outputRoutes.push({
                        type: 'mrt', badge: '🔄 捷運跨線轉乘', title: `${st1.name} ➔ 美麗島 ➔ ${st2.name}`,
                        time: bufferedTime, dist: (parseFloat(leg1.km) + parseFloat(leg2a.km) + parseFloat(leg2b.km) + parseFloat(leg3.km)).toFixed(2), price: '35 元',
                        steps: [
                            { icon: '🚶', title: `步行至 ${st1.name}`, mins: leg1.rawMins, color: '#0ea5e9', path: leg1.path, nodeName: `${st1.name}`, markerCoord: [st1.lat, st1.lon], detail: `預留 ${st1.padding} 分鐘進站下樓時間。` },
                            { icon: '🚇', title: `搭乘 [${st1.line}] 至美麗島站`, mins: driveMins1 + 4, color: st1.line === '紅線' ? '#E60012' : '#F59E0B', path: leg2a.path, nodeName: `美麗島站`, markerCoord: [hub.lat, hub.lon], detail: `車程約 ${driveMins1} 分鐘，到站後請下車轉乘。` },
                            { icon: '🔄', title: `美麗島站 站內轉乘`, mins: 6, color: '#8B5CF6', path: [], nodeName: null, detail: `依循頭頂指標，搭乘手扶梯換線。` },
                            { icon: '🚇', title: `轉乘 [${st2.line}] 至 ${st2.name}`, mins: driveMins2 + 4, color: st2.line === '紅線' ? '#E60012' : '#F59E0B', path: leg2b.path, nodeName: `${st2.name}`, markerCoord: [st2.lat, st2.lon], detail: `車程約 ${driveMins2} 分鐘。` },
                            { icon: '🚶', title: `出站步行至目的地`, mins: leg3.rawMins, color: '#0ea5e9', path: leg3.path, nodeName: `目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: `刷卡出站，沿地面指標抵達終點。` }
                        ]
                    });
                }
            } else {
                const leg2 = await getRouteOSRM(st1.lat, st1.lon, st2.lat, st2.lon, 'driving');
                if (leg2) {
                    let mrtDriveMins = Math.ceil(parseFloat(leg2.km) * 1.5);
                    let rawTime = leg1.rawMins + mrtDriveMins + 4 + st1.padding + st2.padding + leg3.rawMins;
                    let bufferedTime = Math.ceil(rawTime * 1.1);

                    outputRoutes.push({
                        type: 'mrt', badge: '🚇 捷運直達線', title: `捷運 ${st1.name} ➔ ${st2.name}`,
                        time: bufferedTime, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2), price: '30 元',
                        steps: [
                            { icon: '🚶', title: `步行至 ${st1.name}`, mins: leg1.rawMins, color: '#0ea5e9', path: leg1.path, nodeName: `${st1.name}`, markerCoord: [st1.lat, st1.lon], detail: `進站與等車約需緩衝。` },
                            { icon: '🚇', title: `搭乘高雄捷運 [${st1.line}]`, mins: mrtDriveMins + 4, color: st1.line === '紅線' ? '#E60012' : '#F59E0B', path: leg2.path, nodeName: `${st2.name}`, markerCoord: [st2.lat, st2.lon], detail: `直達免轉車，車程預計 ${mrtDriveMins} 分鐘。` },
                            { icon: '🚶', title: `出站步行至終點`, mins: leg3.rawMins, color: '#0ea5e9', path: leg3.path, nodeName: `目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: `刷卡出站，步行抵達終點。` }
                        ]
                    });
                }
            }
        }
    }

    if (activeFilters.has('lightrail')) {
        let bestStart = await getTrueBestStation(originCoords, STATIONS_DATABASE.lightrail);
        let bestEnd = await getTrueBestStation(destCoords, STATIONS_DATABASE.lightrail);
        let st1 = bestStart.station, st2 = bestEnd.station;
        let leg1 = bestStart.walkLeg, leg3 = bestEnd.walkLeg;
        
        if (st1.name !== st2.name && leg1 && leg3) {
            const leg2 = await getRouteOSRM(st1.lat, st1.lon, st2.lat, st2.lon, 'driving');
            if (leg2) {
                let lrtDriveMins = Math.ceil(parseFloat(leg2.km) * 2.8); 
                let rawTime = leg1.rawMins + lrtDriveMins + 7 + st1.padding + st2.padding + leg3.rawMins;
                let bufferedTime = Math.ceil(rawTime * 1.1);

                outputRoutes.push({
                    type: 'lightrail', badge: '🍏 環狀輕軌線', title: `輕軌 ${st1.name} ➔ ${st2.name}`,
                    time: bufferedTime, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2), price: '30 元',
                    steps: [
                        { icon: '🚶', title: `步行至輕軌 ${st1.name}`, mins: leg1.rawMins, color: '#0ea5e9', path: leg1.path, nodeName: `${st1.name}`, markerCoord: [st1.lat, st1.lon], detail: `開放式輕軌站體。記得在黃色刷卡機過卡。` },
                        { icon: '🚃', title: '搭乘環狀輕軌', mins: lrtDriveMins + 7, color: '#009E52', path: leg2.path, nodeName: `${st2.name}`, markerCoord: [st2.lat, st2.lon], detail: `請按壓綠色車門鈕，車程約 ${lrtDriveMins} 分鐘。` },
                        { icon: '🚶', title: '出站步行至終點', mins: leg3.rawMins, color: '#0ea5e9', path: leg3.path, nodeName: `終點`, markerCoord: [destCoords.lat, destCoords.lon], detail: `步行離開軌道區前往目的地。` }
                    ]
                });
            }
        }
    }

    let isTooLong = outputRoutes.length === 0 || outputRoutes.some(rt => rt.time >= 60);
    if (isTooLong) {
        const driveRoute = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (driveRoute) {
            let waitTime = 5;
            let totalUberTime = driveRoute.rawMins + waitTime;
            let price = Math.ceil(85 + (parseFloat(driveRoute.km) * 25));

            outputRoutes.push({
                type: 'uber', badge: '🚕 建議改搭 Uber', title: `多元計程車直達`,
                time: totalUberTime, dist: driveRoute.km, price: `約 ${price} 元`,
                steps: [
                    { icon: '📱', title: `叫車與等候`, mins: waitTime, color: '#334155', path: [], nodeName: null, detail: `大眾運輸過遠，建議叫車。` },
                    { icon: '🚕', title: `專車直達`, mins: driveRoute.rawMins, color: '#0f172a', path: driveRoute.path, nodeName: `目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: `車程約 ${driveRoute.rawMins} 分鐘。` }
                ]
            });
        }
    }

    outputRoutes.sort((a,b) => a.time - b.time);
    renderRouteList(outputRoutes);
    loading.classList.add('hidden');
}

function renderRouteList(routes) {
    const container = document.getElementById('routesContainer');
    if (routes.length === 0) { container.innerHTML = '<p class="empty-state">查無路線，請放寬交通過濾器。</p>'; return; }
    routes.forEach((rt, idx) => {
        const card = document.createElement('div'); card.className = 'route-card';
        let clr = rt.type === 'mrt' ? (rt.badge.includes('轉乘') ? '#8B5CF6' : '#E60012') : (rt.type === 'uber' ? '#334155' : '#009E52');
        card.innerHTML = `
            <span class="badge" style="background:${clr}15; color:${clr}">${rt.badge}</span>
            <div class="card-title">${rt.title}</div>
            <div class="card-meta">⏱️ 總時: <b>${rt.time} 分鐘</b> | 🛣️ ${rt.dist} km</div>
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
                        <span class="step-title">${s.title} (${s.mins}分)</span>
                        ${s.path && s.path.length > 0 ? `<span class="click-hint">路徑展開 ▾</span>` : `<span class="click-hint" style="color:#8B5CF6">站內指引 ▾</span>`}
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
        const isHidden = el.classList.contains('hidden');
        el.classList.toggle('hidden');
        
        if (isHidden) {
            routeStepLayers.forEach(item => {
                if (item.index === index) {
                    item.layer.setStyle({ weight: 9, opacity: 1 });
                    if (item.layer.getBounds && Object.keys(item.layer.getBounds()).length > 0) {
                        map.fitBounds(item.layer.getBounds(), { padding: [40, 40] });
                    }
                } else {
                    item.layer.setStyle({ weight: 4, opacity: 0.3 });
                }
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
            L.marker(s.markerCoord, { icon: L.divIcon({ className: 'hidden' }) }) 
                .addTo(mapLayers)
                .bindTooltip(`📍 ${s.nodeName}`, { permanent: true, direction: 'top', className: 'map-node-tooltip', offset: [0, -5] });
        }
    });

    if (originCoords) {
        const customIcon = L.divIcon({ html: `<div class="dynamic-avatar-icon">${activeAvatar}</div>`, className: '', iconSize: [40, 40], iconAnchor: [20, 35] });
        L.marker([originCoords.lat, originCoords.lon], { icon: customIcon }).addTo(mapLayers);
        boundsPoints.push([originCoords.lat, originCoords.lon]); 
    }

    if(boundsPoints.length > 0) {
        map.fitBounds(L.latLngBounds(boundsPoints), { padding: [50, 50] });
    }
}

document.querySelectorAll('.filter-tag').forEach(t => t.addEventListener('click', () => {
    t.classList.toggle('active');
    if (t.classList.contains('active')) activeFilters.add(t.dataset.transit); else activeFilters.delete(t.dataset.transit);
}));
document.getElementById('backToListBtn').addEventListener('click', () => {
    document.getElementById('detailView').classList.add('hidden'); document.getElementById('listView').classList.remove('hidden');
    routeStepLayers.forEach(item => item.layer.setStyle({ weight: 6, opacity: 0.85 }));
});
document.getElementById('searchBtn').addEventListener('click', runRoutePlanning);
window.onload = initMap;