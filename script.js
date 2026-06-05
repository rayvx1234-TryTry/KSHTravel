const OSRM_API = 'https://router.project-osrm.org/route/v1';
const KAOHSIUNG_CENTER = [22.6228, 120.3014];

// 🛰️ 深度擴充高精確軌道交通資料庫
const STATIONS_DATABASE = {
    mrt: [
        { name: '左營高鐵站', lat: 22.6874, lon: 120.3076, line: '紅線', padding: 5 },
        { name: '巨蛋站', lat: 22.6659, lon: 120.3023, line: '紅線', padding: 3 },
        { name: '凹子底站', lat: 22.6575, lon: 120.3027, line: '紅線', padding: 4 },
        { name: '高雄車站', lat: 22.6405, lon: 120.3022, line: '紅線', padding: 5 },
        { name: '美麗島站', lat: 22.6314, lon: 120.3019, line: '紅橘樞紐', padding: 5 },
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

// 🔧 修復：夜間模式切換
document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
});

// 0.5 秒快閃人偶提示
document.querySelectorAll('.avatar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); activeAvatar = btn.dataset.avatar;
        const toast = document.getElementById('avatarToast');
        toast.textContent = `已切換為 ${activeAvatar} 導航模式`; toast.classList.remove('hidden'); toast.style.opacity = '1';
        setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.classList.add('hidden'), 200); }, 500);
    });
});

// ==================== 🔧 修復：真實地址搜尋聯想與定位 ====================
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

// 起訖點對調按鈕
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

    // 1. 捷運精確算時解
    if (activeFilters.has('mrt')) {
        let sortedStart = [...STATIONS_DATABASE.mrt].sort((a,b) => getDistanceKM(originCoords.lat, originCoords.lon, a.lat, a.lon) - getDistanceKM(originCoords.lat, originCoords.lon, b.lat, b.lon));
        let sortedEnd = [...STATIONS_DATABASE.mrt].sort((a,b) => getDistanceKM(destCoords.lat, destCoords.lon, a.lat, a.lon) - getDistanceKM(destCoords.lat, destCoords.lon, b.lat, b.lon));
        let st1 = sortedStart[0], st2 = sortedEnd[0];
        
        if (st1.name !== st2.name) {
            const leg1 = await getRouteOSRM(originCoords.lat, originCoords.lon, st1.lat, st1.lon, 'foot');
            const leg2 = await getRouteOSRM(st1.lat, st1.lon, st2.lat, st2.lon, 'driving');
            const leg3 = await getRouteOSRM(st2.lat, st2.lon, destCoords.lat, destCoords.lon, 'foot');
            
            if (leg1 && leg2 && leg3) {
                let mrtDriveMins = Math.ceil(parseFloat(leg2.km) * 1.5);
                let waitTime = 4;
                let stationBuffer = st1.padding + st2.padding;
                let totalMrtTime = leg1.rawMins + mrtDriveMins + waitTime + stationBuffer;

                outputRoutes.push({
                    type: 'mrt', badge: '🚇 高雄捷運精確線', title: `捷運 ${st1.name} ➔ ${st2.name}`,
                    time: totalMrtTime, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2), price: '30 元',
                    steps: [
                        { icon: '🚶', title: `從起點步行至捷運 ${st1.name}`, mins: leg1.rawMins, color: '#38bdf8', path: leg1.path, nodeName: `${st1.name}入口`, detail: `請沿人行道步行前往。抵達車站後，因該站屬於深層地下化結構，從入口通過閘門並步行至地下月台層約需 ${st1.padding} 分鐘，請提早準備。` },
                        { icon: '🚇', title: `搭乘高雄捷運 [${st1.line}]`, mins: mrtDriveMins + waitTime, color: '#E60012', path: leg2.path, nodeName: `${st2.name}月台`, detail: `<b>轉乘指引：</b><br>1. 進入月台後請確認往終點之行車方向。<br>2. 列車車程預計 ${mrtDriveMins} 分鐘，沿途請注意車廂廣播。<br>3. 抵達 ${st2.name} 後，請配合「往地面出口」手扶梯向上移動。` },
                        { icon: '🚶', title: `出站步行至終點`, mins: leg3.rawMins, color: '#38bdf8', path: leg3.path, nodeName: `目的地`, detail: `自捷運閘門刷卡出站。建議從站前 YouBike 租賃站側出口離開，出站後順向步行即可抵達目的地。` }
                    ]
                });
            }
        }
    }

    // 2. 輕軌精確算時解
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
                let waitTime = 7; 
                let stationBuffer = st1.padding + st2.padding;
                let totalLrtTime = leg1.rawMins + lrtDriveMins + waitTime + stationBuffer;

                outputRoutes.push({
                    type: 'lightrail', badge: '🍏 環狀輕軌校正線', title: `輕軌 ${st1.name} ➔ ${st2.name}`,
                    time: totalLrtTime, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2), price: '30 元',
                    steps: [
                        { icon: '🚶', title: `步行至輕軌 ${st1.name}`, mins: leg1.rawMins, color: '#38bdf8', path: leg1.path, nodeName: `${st1.name}`, detail: `前往地面開放式輕軌站體。可以直接走到月台候車，進站時請記得在月台黃色刷卡機完成電子票證過卡。` },
                        { icon: '🚃', title: '搭乘環狀輕軌低碳列車', mins: lrtDriveMins + waitTime, color: '#009E52', path: leg2.path, nodeName: `${st2.name}`, detail: `<b>轉乘與下車指引：</b><br>1. 列車到站時，<b>必須主動按壓車門上的綠色按鈕</b>，車門才會開啟。<br>2. 行駛過程中列車享有部分路口優先權，車程約 ${lrtDriveMins} 分鐘。<br>3. 抵達 ${st2.name} 下車時，同樣需手動按壓車門鈕，並於月台刷卡機再次過卡刷出。` },
                        { icon: '🚶', title: '輕軌出站步行至終點', mins: leg3.rawMins, color: '#38bdf8', path: leg3.path, nodeName: `終點`, detail: `離開輕軌月台，沿著行人穿越道安全離開軌道區，步行最後一哩路前往指定目的地。` }
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
    if (routes.length === 0) { container.innerHTML = '<div class="error-box">查無路線，請試著變更地點或放寬交通工具過濾器。</div>'; return; }
    routes.forEach((rt, idx) => {
        const card = document.createElement('div'); card.className = 'route-card';
        let clr = rt.type === 'mrt' ? '#E60012' : '#009E52';
        card.innerHTML = `
            <span class="badge" style="background:${clr}12; color:${clr}">${rt.badge}</span>
            <div class="card-title">${rt.title}</div>
            <div class="card-meta">⏱️ 精確總時: <b>${rt.time} 分鐘</b> (含進出站) | 🛣️ ${rt.dist} km</div>
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
                        <span class="click-hint">點擊看微觀轉乘指引 ▾</span>
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
        L.polyline(s.path, { color: s.color, weight: 6, opacity: 0.85, dashArray: s.icon === '🚶' ? '4, 8' : 'none' }).addTo(mapLayers);
        boundsPoints = boundsPoints.concat(s.path);

        if (s.path && s.path.length > 0 && s.nodeName) {
            const nodeCoord = s.path[0];
            L.circleMarker(nodeCoord, { radius: 6, fillColor: s.color, color: '#ffffff', weight: 2, fillOpacity: 1 }).addTo(mapLayers);
            L.marker(nodeCoord, { icon: L.divIcon({ className: 'hidden' }) }) 
                .addTo(mapLayers)
                .bindTooltip(`📍 ${s.nodeName}`, { permanent: true, direction: 'top', className: 'map-node-tooltip', offset: [0, -5] });
        }
    });

    const customIcon = L.divIcon({ html: `<div class="dynamic-avatar-icon">${activeAvatar}</div>`, className: '', iconSize: [40, 40], iconAnchor: [20, 35] });
    L.marker(boundsPoints[0], { icon: customIcon }).addTo(mapLayers);
    map.fitBounds(L.latLngBounds(boundsPoints), { padding: [50, 50] });
}

// 綁定過濾器與按鈕事件
document.querySelectorAll('.filter-tag').forEach(t => t.addEventListener('click', () => {
    t.classList.toggle('active');
    if (t.classList.contains('active')) activeFilters.add(t.dataset.transit); else activeFilters.delete(t.dataset.transit);
}));
document.getElementById('backToListBtn').addEventListener('click', () => {
    document.getElementById('detailView').classList.add('hidden'); document.getElementById('listView').classList.remove('hidden');
});
document.getElementById('searchBtn').addEventListener('click', runRoutePlanning);
window.onload = initMap;