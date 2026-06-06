// 🛡️ 主動防呆除錯系統：若用手機複製漏了括號導致當機，會立刻跳出警告通知您！
window.onerror = function(msg, url, line) {
    alert("❌ 程式碼執行中斷！地圖因此無法顯示。\n原因：" + msg + "\n請檢查程式碼大約第 " + line + " 行附近是否複製時漏了符號！");
};

const OSRM_API = 'https://router.project-osrm.org/route/v1';
const KAOHSIUNG_CENTER = [22.6228, 120.3014];

// 📍 高雄在地熱門地標模糊座標庫（兜底使用）
const LOCAL_ALIASES = [
    { name: '高師大附中', lat: 22.6260, lon: 120.3236 },
    { name: '高雄榮總', lat: 22.6785, lon: 120.3195 },
    { name: '九如一路', lat: 22.6398, lon: 120.3445 },
    { name: 'SKM Park', lat: 22.5818, lon: 120.3323 }
];

// 🚉 高雄軌道與公車轉乘資料庫 (校正衛生局站座標，並新增全高雄公車樞紐)
const STATIONS_DATABASE = {
    mrt: [
        { name: '草衙站', lat: 22.581335, lon: 120.330364, line: '紅線', padding: 3, busRoute: '紅7A', busStop: '捷運草衙站' },
        { name: '前鎮高中站', lat: 22.592881, lon: 120.329868, line: '紅線', padding: 3, busRoute: '紅9', busStop: '捷運前鎮高中站' },
        { name: '左營高鐵站', lat: 22.687422, lon: 120.307611, line: '紅線', padding: 5, busRoute: '紅60A', busStop: '高鐵左營站' },
        { name: '生態園區站', lat: 22.677351, lon: 120.312154, line: '紅線', padding: 4, busRoute: '紅51', busStop: '捷運生態園區站' },
        { name: '技擊館站', lat: 22.626884, lon: 120.337921, line: '橘線', padding: 3, busRoute: '248路公車', busStop: '捷運技擊館站' },
        { name: '文化中心站', lat: 22.627188, lon: 120.318092, line: '橘線', padding: 3, busRoute: '50路五福幹線', busStop: '捷運文化中心站' },
        { name: '高雄車站', lat: 22.640523, lon: 120.302251, line: '紅線', padding: 5, busRoute: '60路覺民幹線', busStop: '高雄車站(站東)' }
    ],
    lrt: [
        { name: '凱旋瑞田站(C2)', lat: 22.597143, lon: 120.322589, line: '輕軌', padding: 3, busRoute: '紅12', busStop: '輕軌凱旋瑞田站' },
        { name: '前鎮之星站(C3)', lat: 22.593411, lon: 120.315582, line: '輕軌', padding: 3, busRoute: '紅9', busStop: '捷運凱旋站' },
        { name: '凱旋公園站(C32)', lat: 22.628435, lon: 120.324541, line: '輕軌', padding: 3, busRoute: '37路', busStop: '輕軌凱旋公園站' },
        { name: '衛生局站(C33)', lat: 22.621251, lon: 120.325514, line: '輕軌', padding: 3, busRoute: '紅21', busStop: '輕軌衛生局站' },
        { name: '五權國小站(C34)', lat: 22.615122, lon: 120.328195, line: '輕軌', padding: 3, busRoute: '100路', busStop: '輕軌五權國小站' },
        { name: '凱旋武昌站(C35)', lat: 22.610547, lon: 120.329241, line: '輕軌', padding: 3, busRoute: '37路', busStop: '輕軌凱旋武昌站' },
        { name: '愛河之心站(C24)', lat: 22.656551, lon: 120.302824, line: '輕軌', padding: 4, busRoute: '紅33', busStop: '捷運凹子底站' }
    ],
    // 🚌 新增：獨立的全高雄公車樞紐網路（解決公車出不來的問題）
    busHubs: [
        { name: '建軍站(衛武營)', lat: 22.625121, lon: 120.342154, routes: '70路三多幹線、88路建國幹線' },
        { name: '五甲公車站', lat: 22.589541, lon: 120.331214, routes: '紅10、五甲幹線' },
        { name: '三民高中站/轉運點', lat: 22.648541, lon: 120.318541, routes: '53路、黃1幹線' },
        { name: '高醫大轉運點', lat: 22.646512, lon: 120.308514, routes: '紅28、92路自由幹線' },
        { name: '加昌站/右昌轉運點', lat: 22.718541, lon: 120.291254, routes: '中華幹線(205路)、218路' },
        { name: '左營南大路轉運點', lat: 22.671254, lon: 120.292145, routes: '217路、明誠幹線' },
        { name: '鳳山轉運站', lat: 22.623145, lon: 120.356214, routes: '橘12、87路' },
        { name: '新興區公所轉運點', lat: 22.625841, lon: 120.301254, routes: '50路五福幹線、224路' }
    ]
};

let map, mapLayers;
let originCoords = null, destCoords = null, userCoords = null;
let activeAvatar = '🧍‍♂️';
let routeStepLayers = [];

function initMap() {
    if (map) return; // 防呆：避免地圖重複載入
    map = L.map('map', { zoomControl: false }).setView(KAOHSIUNG_CENTER, 13);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapLayers = L.layerGroup().addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    setTimeout(() => { map.invalidateSize(); }, 400);
}

document.getElementById('togglePanelBtn').addEventListener('click', () => {
    document.getElementById('searchPanel').classList.remove('collapsed');
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
            alert('無法取得位置，請確認手機定位服務已開啟。');
            inputField.value = ""; 
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
});

async function fetchAddressSuggestions(query, type) {
    if (query.length < 1) return;
    const dropdown = document.getElementById(`${type}Dropdown`);
    dropdown.innerHTML = '';
    let searchQuery = query.includes('高雄') ? query : `高雄 ${query}`;
    let combinedResults = LOCAL_ALIASES.filter(item => item.name.toLowerCase().includes(query.toLowerCase()));

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

async function getRouteOSRM(lat1, lon1, lat2, lon2, profile = 'driving') {
    try {
        const res = await fetch(`${OSRM_API}/driving/${lon1},${lat1};${lon2},${lat2}?geometries=geojson`);
        if (!res.ok) return null; 
        const data = await res.json();
        if (!data.routes || data.routes.length === 0) return null; // 防呆：避免 OSRM 沒回傳路線當機
        
        const km = (data.routes[0].distance / 1000).toFixed(2);
        
        // 🔒 強制覆蓋：只要是步行，徹底拔除伺服器時間，定速 1 公里 = 14 分鐘！(消滅閃電俠步速)
        if (profile === 'foot') {
            const forcedWalkMins = Math.max(1, Math.ceil(km * 14.0)); 
            return { path: data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]), km: km, rawMins: forcedWalkMins };
        }

        let driveMins = Math.ceil(data.routes[0].duration / 60);
        return { path: data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]), km: km, rawMins: driveMins };
    } catch (e) { 
        return null; 
    }
}

async function getBestStationFromSet(coords, stations) {
    // 🛡️ 安全防護：避免找不到陣列導致當機
    if (!coords || !stations || stations.length === 0) return null;
    let sorted = [...stations].sort((a,b) => getDistanceKM(coords.lat, coords.lon, a.lat, a.lon) - getDistanceKM(coords.lat, coords.lon, b.lat, b.lon));
    let walk = await getRouteOSRM(coords.lat, coords.lon, sorted[0].lat, sorted[0].lon, 'foot');
    if (!walk) return null; 
    return { station: sorted[0], walkLeg: walk };
}

function checkAndFallbackInputs() {
    const oVal = document.getElementById('originInput').value;
    const dVal = document.getElementById('destinationInput').value;
    if (!originCoords && oVal) {
        let found = LOCAL_ALIASES.find(x => oVal.toLowerCase().includes(x.name.toLowerCase()));
        if (found) originCoords = { lat: found.lat, lon: found.lon };
    }
    if (!destCoords && dVal) {
        let found = LOCAL_ALIASES.find(x => dVal.toLowerCase().includes(x.name.toLowerCase()));
        if (found) destCoords = { lat: found.lat, lon: found.lon };
    }
}

async function runRoutePlanning() {
    checkAndFallbackInputs();
    if (!originCoords || !destCoords) return alert('請確認起訖點已輸入，建議從下拉選單點選以確保座標精準！');
    
    // 🛡️ 主動防護：檢查是否有成功載入包含公車樞紐的資料庫
    if (!STATIONS_DATABASE || !STATIONS_DATABASE.busHubs) {
        return alert('❌ 偵測到資料庫不完整！請確定 STATIONS_DATABASE 有正確載入。');
    }
    
    document.getElementById('searchPanel').classList.add('collapsed');
    document.getElementById('togglePanelBtn').classList.remove('hidden');
    document.getElementById('detailView').classList.add('hidden'); 
    document.getElementById('listView').classList.remove('hidden');
    
    const container = document.getElementById('routesContainer'); 
    const loading = document.getElementById('loadingIndicator');
    loading.classList.remove('hidden'); container.innerHTML = ''; mapLayers.clearLayers(); routeStepLayers = [];

    const outputRoutes = [];

    // ==================== 1. 🚇 純捷運方案 ====================
    let mrtStart = await getBestStationFromSet(originCoords, STATIONS_DATABASE.mrt);
    let mrtEnd = await getBestStationFromSet(destCoords, STATIONS_DATABASE.mrt);
    if (mrtStart && mrtEnd && mrtStart.walkLeg && mrtEnd.walkLeg && mrtStart.station.name !== mrtEnd.station.name) {
        let totalWalkKm = parseFloat(mrtStart.walkLeg.km) + parseFloat(mrtEnd.walkLeg.km);
        if (totalWalkKm <= 10) {
            let leg2 = await getRouteOSRM(mrtStart.station.lat, mrtStart.station.lon, mrtEnd.station.lat, mrtEnd.station.lon, 'driving');
            if (leg2) {
                let mrtTime = Math.ceil(mrtStart.walkLeg.rawMins + leg2.rawMins + mrtEnd.walkLeg.rawMins + 5);
                outputRoutes.push({
                    type: 'mrt', badge: '🚇 捷運直達方案', title: `捷運 [${mrtStart.station.line}] ➔ 步行至目的地`,
                    time: mrtTime, dist: (parseFloat(mrtStart.walkLeg.km) + parseFloat(leg2.km) + parseFloat(mrtEnd.walkLeg.km)).toFixed(2), price: '30 元', color: '#E60012',
                    steps: [
                        { icon: '🚶', title: `步行至【${mrtStart.station.name}】上車`, mins: mrtStart.walkLeg.rawMins, color: '#64748b', path: mrtStart.walkLeg.path, nodeName: `[上車] ${mrtStart.station.name}`, markerCoord: [mrtStart.station.lat, mrtStart.station.lon], detail: `依真實步速約需 ${mrtStart.walkLeg.rawMins} 分鐘，前往進站。` },
                        { icon: '🚇', title: `搭乘捷運至【${mrtEnd.station.name}】下車`, mins: leg2.rawMins, color: '#E60012', path: leg2.path, nodeName: `[下車] ${mrtEnd.station.name}`, markerCoord: [mrtEnd.station.lat, mrtEnd.station.lon], detail: `搭乘捷運列車，車程預計 ${leg2.rawMins} 分鐘。` },
                        { icon: '🚶', title: `出站步行至終點`, mins: mrtEnd.walkLeg.rawMins, color: '#10B981', path: mrtEnd.walkLeg.path, nodeName: `終點`, markerCoord: [destCoords.lat, destCoords.lon], detail: `刷卡出站，步行約 ${mrtEnd.walkLeg.km} 公里抵達目的地。` }
                    ]
                });
            }
        }
    }

    // ==================== 2. 🍏 輕軌專屬方案 ====================
    let lrtStart = await getBestStationFromSet(originCoords, STATIONS_DATABASE.lrt);
    let lrtEnd = await getBestStationFromSet(destCoords, STATIONS_DATABASE.lrt);
    if (lrtStart && lrtEnd && lrtStart.walkLeg && lrtEnd.walkLeg && lrtStart.station.name !== lrtEnd.station.name) {
        let totalWalkKm = parseFloat(lrtStart.walkLeg.km) + parseFloat(lrtEnd.walkLeg.km);
        if (totalWalkKm <= 10) {
            let leg2 = await getRouteOSRM(lrtStart.station.lat, lrtStart.station.lon, lrtEnd.station.lat, lrtEnd.station.lon, 'driving');
            if (leg2) {
                let lrtTime = Math.ceil(lrtStart.walkLeg.rawMins + leg2.rawMins + lrtEnd.walkLeg.rawMins + 4);
                outputRoutes.push({
                    type: 'lrt', badge: '🍏 輕軌專屬方案', title: `高雄環狀輕軌 ➔ 漫步至目的地`,
                    time: lrtTime, dist: (parseFloat(lrtStart.walkLeg.km) + parseFloat(leg2.km) + parseFloat(lrtEnd.walkLeg.km)).toFixed(2), price: '20 元', color: '#009E52',
                    steps: [
                        { icon: '🚶', title: `步行至輕軌【${lrtStart.station.name}】上車`, mins: lrtStart.walkLeg.rawMins, color: '#64748b', path: lrtStart.walkLeg.path, nodeName: `[上車] ${lrtStart.station.name}`, markerCoord: [lrtStart.station.lat, lrtStart.station.lon], detail: `步行約需 ${lrtStart.walkLeg.rawMins} 分鐘，於黃色刷卡機過卡候車。` },
                        { icon: '🍏', title: `搭乘輕軌至【${lrtEnd.station.name}】下車`, mins: leg2.rawMins, color: '#009E52', path: leg2.path, nodeName: `[下車] ${lrtEnd.station.name}`, markerCoord: [lrtEnd.station.lat, lrtEnd.station.lon], detail: `列車進站請按鈕上下車，行經綠廊車程約 ${leg2.rawMins} 分鐘。` },
                        { icon: '🚶', title: `出站步行至目的地`, mins: lrtEnd.walkLeg.rawMins, color: '#10B981', path: lrtEnd.walkLeg.path, nodeName: `終點`, markerCoord: [destCoords.lat, destCoords.lon], detail: `下車刷卡後，跟隨指引步行抵達終點。` }
                    ]
                });
            }
        }
    }

    // ==================== 3. 🚌 全高雄獨立公車網方案 ====================
    let nearBusStart = [...STATIONS_DATABASE.busHubs].sort((a,b) => getDistanceKM(originCoords.lat, originCoords.lon, a.lat, a.lon) - getDistanceKM(originCoords.lat, originCoords.lon, b.lat, b.lon))[0];
    let nearBusEnd = [...STATIONS_DATABASE.busHubs].sort((a,b) => getDistanceKM(destCoords.lat, destCoords.lon, a.lat, a.lon) - getDistanceKM(destCoords.lat, destCoords.lon, b.lat, b.lon))[0];

    if (nearBusStart && nearBusEnd && nearBusStart.name !== nearBusEnd.name) {
        let walkToBus = await getRouteOSRM(originCoords.lat, originCoords.lon, nearBusStart.lat, nearBusStart.lon, 'foot');
        let busRide = await getRouteOSRM(nearBusStart.lat, nearBusStart.lon, nearBusEnd.lat, nearBusEnd.lon, 'driving');
        let walkToDest = await getRouteOSRM(nearBusEnd.lat, nearBusEnd.lon, destCoords.lat, destCoords.lon, 'foot');

        if (walkToBus && busRide && walkToDest) {
            let totalBusPlanTime = Math.ceil(walkToBus.rawMins + (busRide.rawMins * 1.2) + walkToDest.rawMins + 4);
            let totalBusPlanDist = (parseFloat(walkToBus.km) + parseFloat(busRide.km) + parseFloat(walkToDest.km)).toFixed(2);

            outputRoutes.push({
                type: 'mixed', badge: '🚌 市區公車小資方案',
                title: `搭乘高雄幹線公車 ➔ 步行至目的地`,
                time: totalBusPlanTime, dist: totalBusPlanDist, price: '12 元 (Uber 太貴選這個！)', color: '#f59e0b',
                steps: [
                    { icon: '🚶', title: `步行至最近公車樞紐/站牌`, mins: walkToBus.rawMins, color: '#64748b', path: walkToBus.path, nodeName: `[起點步行]`, markerCoord: [nearBusStart.lat, nearBusStart.lon], detail: `依真實步速步行約需 ${walkToBus.rawMins} 分鐘 前往公車站。` },
                    { icon: '🚌', title: `搭乘公車於【${nearBusEnd.name}】下車`, mins: Math.ceil(busRide.rawMins * 1.2), color: '#f59e0b', path: busRide.path, nodeName: `[公車轉運點]`, markerCoord: [nearBusEnd.lat, nearBusEnd.lon], detail: `於<b>【${nearBusStart.name}】</b>上車，可搭乘：${nearBusStart.routes}。市區車程約 ${Math.ceil(busRide.rawMins * 1.2)} 分鐘。` },
                    { icon: '🚶', title: `下車步行抵達目的地`, mins: walkToDest.rawMins, color: '#10B981', path: walkToDest.path, nodeName: `終點`, markerCoord: [destCoords.lat, destCoords.lon], detail: `下車後，步行約需 ${walkToDest.rawMins} 分鐘 抵達目的地，為您省下大筆 Uber 費用！` }
                ]
            });
        }
    }

    // ==================== 4. 🚕 多元計程車方案 ====================
    const driveRoute = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
    if (driveRoute && driveRoute.path && driveRoute.path.length > 0) {
        let waitTime = 5;
        let adjustedDriveMins = Math.ceil(driveRoute.rawMins * 1.35);
        let totalUberTime = adjustedDriveMins + waitTime;
        let price = Math.ceil(85 + (parseFloat(driveRoute.km) * 25));

        outputRoutes.push({
            type: 'uber', badge: '🚕 寧早勿遲：計程車直達', title: `多元計程車直達 (含塞車緩衝)`, color: '#475569',
            time: totalUberTime, dist: driveRoute.km, price: `約 ${price} 元`,
            steps: [
                { icon: '📱', title: `App 線上叫車與等候派車`, mins: waitTime, color: '#64748b', path: [], nodeName: null, detail: `發出叫車請求，預估司機前往您的起點需要 5 分鐘。` },
                { icon: '🚕', title: `乘車直達目的地`, mins: adjustedDriveMins, color: '#334155', path: driveRoute.path, nodeName: `[下車] 目的地`, markerCoord: [destCoords.lat, destCoords.lon], detail: `走最佳公路幹線。<b>本系統已強力加計 35% 的紅綠燈與塞車時間</b>，確保您寧可提早抵達，也絕對不會遲到！` }
            ]
        });
    }

    outputRoutes.sort((a, b) => a.time - b.time);
    if (outputRoutes.length > 0) {
        outputRoutes[0].badge = '🏆 系統推薦最佳方案 | ' + outputRoutes[0].badge;
    }

    renderRouteList(outputRoutes);
    loading.classList.add('hidden');
    setTimeout(() => map.invalidateSize(), 300);
}

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
    mapLayers.clearLayers(); 
    let boundsPoints = []; 
    routeStepLayers = [];
    
    steps.forEach((s, index) => {
        if(s.path && s.path.length > 0) {
            let polyline = L.polyline(s.path, { color: s.color, weight: 6, opacity: 0.85, dashArray: (s.icon === '🚶') ? '5, 8' : 'none' }).addTo(mapLayers);
            routeStepLayers.push({ index: index, layer: polyline });
            boundsPoints = boundsPoints.concat(s.path);
        }
        
        if (s.nodeName && s.markerCoord) {
            L.circleMarker(s.markerCoord, { radius: 7, fillColor: s.color, color: '#ffffff', weight: 2.5, fillOpacity: 1 }).addTo(mapLayers);
            
            L.marker(s.markerCoord, { icon: L.divIcon({ className: 'hidden' }) })
                .addTo(mapLayers)
                .bindTooltip(`<b>${s.nodeName}</b>`, { 
                    permanent: true, 
                    direction: 'top', 
                    className: 'map-node-tooltip', 
                    offset: [0, -8] 
                });
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

// 🛡️ 強力載入：確保地圖在不同手機瀏覽器上絕對會被呼叫顯示
document.addEventListener('DOMContentLoaded', initMap);
window.onload = initMap;