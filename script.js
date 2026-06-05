const OSRM_API = 'https://router.project-osrm.org/route/v1';
const KAOHSIUNG_CENTER = [22.6228, 120.3014];

// 🧠 擴展自動方案：收錄高雄捷運紅橘兩線完整主要車站與核心輕軌交會站
const TRANSIT_STATIONS = [
    // 橘線 (Orange Line)
    { name: '哈瑪星站', lat: 22.6210, lon: 120.2725, type: 'mrt', line: 'orange', color: '#f97316' },
    { name: '鹽埕埔站', lat: 22.6231, lon: 120.2844, type: 'mrt', line: 'orange', color: '#f97316' },
    { name: '市議會站', lat: 22.6293, lon: 120.2974, type: 'mrt', line: 'orange', color: '#f97316' },
    { name: '美麗島站', lat: 22.6314, lon: 120.3180, type: 'mrt', line: 'transfer', color: '#8b5cf6' }, // 轉乘樞紐
    { name: '信義國小站', lat: 22.6295, lon: 120.3113, type: 'mrt', line: 'orange', color: '#f97316' },
    { name: '文化中心站', lat: 22.6271, lon: 120.3180, type: 'mrt', line: 'orange', color: '#f97316' },
    { name: '五塊厝站', lat: 22.6288, lon: 120.3298, type: 'mrt', line: 'orange', color: '#f97316' },
    { name: '技擊館站', lat: 22.6286, lon: 120.3415, type: 'mrt', line: 'orange', color: '#f97316' },
    { name: '衛武營站', lat: 22.6248, lon: 120.3404, type: 'mrt', line: 'orange', color: '#f97316' },
    { name: '鳳山站', lat: 22.6259, lon: 120.3556, type: 'mrt', line: 'orange', color: '#f97316' },
    { name: '大東站', lat: 22.6264, lon: 120.3662, type: 'mrt', line: 'orange', color: '#f97316' },
    
    // 紅線 (Red Line)
    { name: '左營高鐵站', lat: 22.6879, lon: 120.3080, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '生態園區站', lat: 22.6756, lon: 120.3060, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '巨蛋站', lat: 22.6659, lon: 120.3023, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '凹子底站', lat: 22.6575, lon: 120.3027, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '後驛站', lat: 22.6480, lon: 120.3028, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '高雄車站', lat: 22.6397, lon: 120.3120, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '後驛站', lat: 22.6480, lon: 120.3028, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '中央公園站', lat: 22.6218, lon: 120.3150, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '三多商圈站', lat: 22.6134, lon: 120.3034, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '獅甲站', lat: 22.6012, lon: 120.3026, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '凱旋站', lat: 22.5966, lon: 120.3153, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '前鎮高中站', lat: 22.5898, lon: 120.3218, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '草衙站 (SKM Park)', lat: 22.5812, lon: 120.3294, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '高雄國際機場站', lat: 22.5696, lon: 120.3398, type: 'mrt', line: 'red', color: '#ef4444' },
    { name: '小港站', lat: 22.5651, lon: 120.3556, type: 'mrt', line: 'red', color: '#ef4444' },

    // 輕軌交會站 (Light Rail Hubs)
    { name: '愛河之心站 (輕軌)', lat: 22.6595, lon: 120.3028, type: 'lightrail', line: 'lightrail', color: '#22c55e' },
    { name: '駁二大義站 (輕軌)', lat: 22.6202, lon: 120.2858, type: 'lightrail', line: 'lightrail', color: '#22c55e' },
    { name: '前鎮之星站 (輕軌)', lat: 22.5965, lon: 120.3155, type: 'lightrail', line: 'lightrail', color: '#22c55e' }
];

let map, mapLayers;
let originCoords = null, destCoords = null, userCoords = null;
let activeAvatar = '🧍‍♂️'; // 保持全域記錄，永不洗掉
let activeFilters = new Set(['mrt', 'lightrail', 'bus', 'bike']);

// ==================== 初始化地圖 ====================
function initMap() {
    map = L.map('map', { zoomControl: false }).setView(KAOHSIUNG_CENTER, 13);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapLayers = L.layerGroup().addTo(map);
    
    // 載入標準圖層，夜間樣式完全透過頂層高對比 CSS 濾鏡控制，無縫保留彩色幹道細節！
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

// ==================== 人偶造型綁定 ====================
document.querySelectorAll('.avatar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeAvatar = btn.dataset.avatar; // 即時變更角色
    });
});

// ==================== 定位模組 ====================
document.getElementById('useLocationBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('瀏覽器未支援定位');
    const inputField = document.getElementById('originInput');
    inputField.value = "精確衛星定位中...";
    
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            originCoords = userCoords;
            inputField.value = `📍 我的位置 (${activeAvatar})`;
            map.flyTo([userCoords.lat, userCoords.lon], 15);
        },
        () => { alert('獲取定位失敗'); inputField.value = ""; },
        { enableHighAccuracy: true, timeout: 6000 }
    );
});

// ==================== 地址聯想推薦 ====================
async function fetchAddressSuggestions(query, type) {
    if (query.length < 2) return;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=120.1,22.4,120.5,23.1&bounded=1&limit=5&countrycodes=tw`;
        const res = await fetch(url, { headers: { 'User-Agent': 'KaohsiungTransitV6/1.0' } });
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

// ==================== 網格智慧路網引擎 ====================
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
    if (!originCoords || !destCoords) return alert('請確認已正確填入起訖地址點！');
    
    // 確保回到列表視圖，清除留白
    document.getElementById('detailView').classList.add('hidden');
    document.getElementById('listView').classList.remove('hidden');
    
    const container = document.getElementById('routesContainer');
    const loading = document.getElementById('loadingIndicator');
    loading.classList.remove('hidden'); container.innerHTML = ''; mapLayers.clearLayers();

    const outputRoutes = [];
    const directKM = getDistanceKM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon);

    // 🧠 全自動網格化：找出離起點、終點最近的車站
    let sortedStart = [...TRANSIT_STATIONS].sort((a,b) => getDistanceKM(originCoords.lat, originCoords.lon, a.lat, a.lon) - getDistanceKM(originCoords.lat, originCoords.lon, b.lat, b.lon));
    let sortedEnd = [...TRANSIT_STATIONS].sort((a,b) => getDistanceKM(destCoords.lat, destCoords.lon, a.lat, a.lon) - getDistanceKM(destCoords.lat, destCoords.lon, b.lat, b.lon));
    
    let st1 = sortedStart[0], st2 = sortedEnd[0];
    let startDistToRail = getDistanceKM(originCoords.lat, originCoords.lon, st1.lat, st1.lon);
    let endDistToRail = getDistanceKM(destCoords.lat, destCoords.lon, st2.lat, st2.lon);

    // 1. 智慧軌道路網
    if ((activeFilters.has('mrt') || activeFilters.has('lightrail')) && st1.name !== st2.name) {
        const leg1 = await getRouteOSRM(originCoords.lat, originCoords.lon, st1.lat, st1.lon, 'foot');
        const leg2 = await getRouteOSRM(st1.lat, st1.lon, st2.lat, st2.lon, 'driving'); // 模擬軌道速度
        const leg3 = await getRouteOSRM(st2.lat, st2.lon, destCoords.lat, destCoords.lon, 'foot');
        
        if (leg1 && leg2 && leg3) {
            let waitTime = 4;
            let subNotes = "";
            // 轉乘邏輯全自動演算：紅橘跨線或捷運轉輕軌
            if (st1.line !== st2.line && st1.line !== 'transfer' && st2.line !== 'transfer') {
                waitTime += 6; 
                subNotes = "（含美麗島站內紅橘線跨線轉乘）";
            }

            outputRoutes.push({
                type: 'transit', badge: '🚇 智慧軌道優先', title: `${st1.name} ➔ ${st2.name}`,
                time: leg1.mins + waitTime + leg2.mins + leg3.mins, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2),
                steps: [
                    { icon: '🚶', title: `步行至 ${st1.name}`, mins: leg1.mins, desc: `向車站前進 · ${leg1.mins} 分鐘 (${leg1.km} km)`, color: '#38bdf8', path: leg1.path },
                    { icon: '🚇', title: `搭乘高雄捷運/輕軌系統 ${subNotes}`, mins: leg2.mins + waitTime, desc: `乘車路段 · 候車/轉乘約 ${waitTime} 分 + 乘車 ${leg2.mins} 分鐘`, color: st1.color, path: leg2.path },
                    { icon: '🚶', title: `由 ${st2.name} 出站步行至目的地`, mins: leg3.mins, desc: `最後一哩路 · ${leg3.mins} 分鐘 (${leg3.km} km)`, color: '#38bdf8', path: leg3.path }
                ]
            });
        }
    }

    // 2. 市區公車
    if (activeFilters.has('bus')) {
        const busDrive = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (busDrive) {
            const totalBusMins = Math.ceil(busDrive.mins * 1.3) + 7;
            outputRoutes.push({
                type: 'bus', badge: '🚌 市區公車方案', title: '全區公車動態優選線', time: totalBusMins, dist: busDrive.km,
                steps: [{ icon: '🚌', title: '搭乘市區優選公車線', mins: totalBusMins, desc: `多點靠站 · 全程包含等候與靠站約 ${totalBusMins} 分鐘`, color: '#a855f7', path: busDrive.path }]
            });
        }
    }

    // 3. YouBike 2.0
    if (activeFilters.has('bike') && directKM < 7) {
        const bikeDrive = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (bikeDrive) {
            const bikeMins = Math.ceil(bikeDrive.mins * 2.0);
            outputRoutes.push({
                type: 'bike', badge: '🚲 YouBike 2.0 樂活', title: '綠色低碳共享騎行', time: bikeMins, dist: bikeDrive.km,
                steps: [{ icon: '🚴', title: '租借 YouBike 沿單車道騎行', mins: bikeMins, desc: `均速前進 · 樂活舒壓騎行約 ${bikeMins} 分鐘`, color: '#06b6d4', path: bikeDrive.path }]
            });
        }
    }

    // 4. 🧠 偏鄉/盲區加開：如果離捷運輕軌大於 1.5 公里，或距離較遠，自動配發 Uber 方案
    if (startDistToRail > 1.5 || endDistToRail > 1.5 || directKM > 6) {
        const driveRoute = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (driveRoute) {
            // 費率估算公式：起跳 85 元 + 每公里 25 元 + 每分鐘 5 元
            const estFare = Math.round(85 + (parseFloat(driveRoute.km) * 25) + (driveRoute.mins * 5));
            outputRoutes.push({
                type: 'uber', badge: '🚖 Uber / 專車直達', title: '偏鄉與盲區快速替代方案', time: driveRoute.mins, dist: driveRoute.km,
                steps: [{ icon: '🚕', title: '預約 Uber / 專車快速直達', mins: driveRoute.mins, desc: `避開大眾運輸盲區 · 車資約 TWD $${estFare} 元 · 耗時 ${driveRoute.mins} 分鐘`, color: '#1e293b', path: driveRoute.path }]
            });
        }
    }

    outputRoutes.sort((a,b) => a.time - b.time);
    renderRouteList(outputRoutes);
    loading.classList.add('hidden');
}

// ==================== UI 渲染與視圖無縫切換 ====================
function renderRouteList(routes) {
    const container = document.getElementById('routesContainer');
    if (routes.length === 0) { container.innerHTML = '<div class="error-box">查無適合路網，請放寬交通工具篩選！</div>'; return; }

    routes.forEach((rt, idx) => {
        const card = document.createElement('div');
        card.className = 'route-card';
        
        let primaryColor = '#0284c7';
        if(rt.type === 'transit') primaryColor = '#ef4444';
        else if(rt.type === 'bus') primaryColor = '#a855f7';
        else if(rt.type === 'bike') primaryColor = '#06b6d4';
        else if(rt.type === 'uber') primaryColor = '#1e293b';

        card.innerHTML = `
            <span class="badge" style="background:${primaryColor}15; color:${primaryColor}">${rt.badge}</span>
            <div class="card-title">${rt.title}</div>
            <div class="card-meta">⏱️ 預估總用時: <b>${rt.time} 分鐘</b> | 🛣️ ${rt.dist} km</div>
        `;

        // 點擊卡片觸發精確視圖替換，絕不重疊
        card.addEventListener('click', () => toggleToDetailView(rt, primaryColor));
        container.appendChild(card);
        
        if (idx === 0) drawRouteOnMap(rt.steps); // 預設畫首選線
    });
}

function toggleToDetailView(route, themeColor) {
    // 重新在地圖上畫這條線
    drawRouteOnMap(route.steps);
    
    const content = document.getElementById('detailContent');
    
    // 遍歷步驟，如果步行大於 20 分鐘，塞入智慧 YouBike 提示框
    let stepsHtml = route.steps.map(s => {
        let ubikeBanner = "";
        if (s.icon === '🚶' && s.mins > 20) {
            ubikeBanner = `
                <div class="ubike-alert-box">
                    🚲 YouBike 智慧分流提示：此段步行時間達 ${s.mins} 分鐘較長，建議改在起點附近租借 YouBike 2.0 騎乘前來，可將時間大幅縮短至 ${Math.ceil(s.mins / 3.5)} 分鐘！
                </div>
            `;
        }
        
        return `
            <div class="step-row">
                <div class="step-circle" style="background:${s.color}">${s.icon}</div>
                <div class="step-body">
                    <div class="step-head">${s.title}</div>
                    <div class="step-desc">${s.desc}</div>
                    ${ubikeBanner}
                </div>
            </div>
        `;
    }).join('');

    content.innerHTML = `
        <div class="detail-main-header">
            <span class="badge" style="background:${themeColor}15; color:${themeColor}">${route.badge}</span>
            <div class="detail-main-title">${route.title}</div>
            <div class="card-meta">⏱️ 全程總時間: <b>${route.time} 分鐘</b><br>🛣️ 全程總里程: ${route.dist} km</div>
        </div>
        <div class="detail-timeline">${stepsHtml}</div>
    `;

    // 🚀 關鍵修正：隱藏列表、顯現詳情，結構完全切開，百分之百不留白
    document.getElementById('listView').classList.add('hidden');
    document.getElementById('detailView').classList.remove('hidden');
}

// 返回按鈕
document.getElementById('backToListBtn').addEventListener('click', () => {
    document.getElementById('detailView').classList.add('hidden');
    document.getElementById('listView').classList.remove('hidden');
});

// ==================== 繪製地圖與修復人偶造型 ====================
function drawRouteOnMap(steps) {
    mapLayers.clearLayers();
    let boundsPoints = [];
    
    steps.forEach(s => {
        L.polyline(s.path, {
            color: s.color,
            weight: 6,
            opacity: 0.85,
            dashArray: s.icon === '🚶' ? '5, 8' : 'none'
        }).addTo(mapLayers);
        boundsPoints = boundsPoints.concat(s.path);
    });

    // 🚀 核心修復：不管怎麼點、怎麼規劃，起點圖示永遠精準套用當前選擇的 activeAvatar！
    const customIcon = L.divIcon({
        html: `<div class="dynamic-avatar-icon">${activeAvatar}</div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 35]
    });
    
    L.marker(boundsPoints[0], { icon: customIcon }).addTo(mapLayers).bindPopup(`<b>出發點</b> (造型: ${activeAvatar})`).openPopup();
    L.circleMarker(boundsPoints[boundsPoints.length - 1], { radius: 8, fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(mapLayers).bindPopup('終點目的地');
    
    map.fitBounds(L.latLngBounds(boundsPoints), { padding: [50, 50] });
}

// ==================== 快篩與對調事件 ====================
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