const OSRM_API = 'https://router.project-osrm.org/route/v1';
const KAOHSIUNG_CENTER = [22.6228, 120.3014];

// 🧠 精確路網數據：捷運與輕軌完全歸類清楚
const STATIONS_DATABASE = {
    mrt: [
        { name: '左營高鐵站', lat: 22.6879, lon: 120.3080, line: '紅線', color: '#E60012', bikeStation: '捷運左營站(2號出口)' },
        { name: '生態園區站', lat: 22.6756, lon: 120.3060, line: '紅線', color: '#E60012', bikeStation: '捷運生態園區站(1號出口)' },
        { name: '巨蛋站', lat: 22.6659, lon: 120.3023, line: '紅線', color: '#E60012', bikeStation: '捷運巨蛋站(2號出口)' },
        { name: '凹子底站', lat: 22.6575, lon: 120.3027, line: '紅線', color: '#E60012', bikeStation: '捷運凹子底站(4號出口)' },
        { name: '後驛站', lat: 22.6480, lon: 120.3028, line: '紅線', color: '#E60012', bikeStation: '捷運後驛站(2號出口)' },
        { name: '高雄車站', lat: 22.6397, lon: 120.3120, line: '紅線', color: '#E60012', bikeStation: '高雄車站(建國二路)' },
        { name: '美麗島站', lat: 22.6314, lon: 120.3180, line: '紅橘樞紐', color: '#8b5cf6', bikeStation: '捷運美麗島站(5號出口)' },
        { name: '中央公園站', lat: 22.6218, lon: 120.3150, line: '紅線', color: '#E60012', bikeStation: '捷運中央公園站(1號出口)' },
        { name: '三多商圈站', lat: 22.6134, lon: 120.3034, line: '紅線', color: '#E60012', bikeStation: '捷運三多商圈站(5號出口)' },
        { name: '獅甲站', lat: 22.6012, lon: 120.3026, line: '紅線', color: '#E60012', bikeStation: '捷運獅甲站(3號出口)' },
        { name: '凱旋站', lat: 22.5966, lon: 120.3153, line: '紅線', color: '#E60012', bikeStation: '捷運凱旋站(2號出口)' },
        { name: '前鎮高中站', lat: 22.5898, lon: 120.3218, line: '紅線', color: '#E60012', bikeStation: '捷運前鎮高中站(1號出口)' },
        { name: '草衙站 (SKM Park)', lat: 22.5812, lon: 120.3294, line: '紅線', color: '#E60012', bikeStation: '捷運草衙站(4號出口)' },
        { name: '小港站', lat: 22.5651, lon: 120.3556, line: '紅線', color: '#E60012', bikeStation: '捷運小港站(4號出口)' },
        
        { name: '哈瑪星站', lat: 22.6210, lon: 120.2725, line: '橘線', color: '#FFA500', bikeStation: '捷運哈瑪星站(1號出口)' },
        { name: '鹽埕埔站', lat: 22.6231, lon: 120.2844, line: '橘線', color: '#FFA500', bikeStation: '捷運鹽埕埔站(1號出口)' },
        { name: '市議會站', lat: 22.6293, lon: 120.2974, line: '橘線', color: '#FFA500', bikeStation: '捷運市議會站(4號出口)' },
        { name: '信義國小站', lat: 22.6295, lon: 120.3113, line: '橘線', color: '#FFA500', bikeStation: '捷運信義國小站(5號出口)' },
        { name: '文化中心站', lat: 22.6271, lon: 120.3180, line: '橘線', color: '#FFA500', bikeStation: '捷運文化中心站(3號出口)' },
        { name: '五塊厝站', lat: 22.6288, lon: 120.3298, line: '橘線', color: '#FFA500', bikeStation: '捷運五塊厝站(4號出口)' },
        { name: '技擊館站', lat: 22.6286, lon: 120.3415, line: '橘線', color: '#FFA500', bikeStation: '捷運技擊館站(1號出口)' },
        { name: '衛武營站', lat: 22.6248, lon: 120.3404, line: '橘線', color: '#FFA500', bikeStation: '捷運衛武營站(3號出口)' },
        { name: '鳳山站', lat: 22.6259, lon: 120.3556, line: '橘線', color: '#FFA500', bikeStation: '捷運鳳山站(1號出口)' }
    ],
    lightrail: [
        { name: '哈瑪星輕軌站', lat: 22.6215, lon: 120.2720, line: '環狀輕軌', color: '#009E52', bikeStation: '捷運哈瑪星站(2號出口)' },
        { name: '駁二大義站', lat: 22.6202, lon: 120.2858, line: '環狀輕軌', color: '#009E52', bikeStation: '駁二大義站' },
        { name: '光榮碼頭站', lat: 22.6190, lon: 120.2942, line: '環狀輕軌', color: '#009E52', bikeStation: '輕軌光榮碼頭站' },
        { name: '旅運中心站', lat: 22.6119, lon: 120.2974, line: '環狀輕軌', color: '#009E52', bikeStation: '輕軌旅運中心站' },
        { name: '高雄展覽館站', lat: 22.6072, lon: 120.3015, line: '環狀輕軌', color: '#009E52', bikeStation: '輕軌高雄展覽館站' },
        { name: '前鎮之星站', lat: 22.5965, lon: 120.3155, line: '環狀輕軌', color: '#009E52', bikeStation: '輕軌前鎮之星站' },
        { name: '道明中學站', lat: 22.6242, lon: 120.3235, line: '環狀輕軌', color: '#009E52', bikeStation: '凱旋醫院(凱旋二路)' },
        { name: '科工館站', lat: 22.6425, lon: 120.3256, line: '環狀輕軌', color: '#009E52', bikeStation: '台鐵科工館站' },
        { name: '愛河之心站', lat: 22.6595, lon: 120.3028, line: '環狀輕軌', color: '#009E52', bikeStation: '捷運凹子底站(1號出口)' },
        { name: '美術館站', lat: 22.6562, lon: 120.2831, line: '環狀輕軌', color: '#009E52', bikeStation: '台鐵美術館站' }
    ]
};

let map, mapLayers;
let originCoords = null, destCoords = null, userCoords = null;
let activeAvatar = '🧍‍♂️'; // 常駐記憶
let activeFilters = new Set(['mrt', 'lightrail', 'bus', 'bike']);

// ==================== 初始化地圖 ====================
function initMap() {
    map = L.map('map', { zoomControl: false }).setView(KAOHSIUNG_CENTER, 13);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapLayers = L.layerGroup().addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OSM' }).addTo(map);
}

document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
});

// ==================== 小人偶綁定 ====================
document.querySelectorAll('.avatar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeAvatar = btn.dataset.avatar;
    });
});

// ==================== 衛星定位與地址聯想 ====================
document.getElementById('useLocationBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('不支援定位');
    const inputField = document.getElementById('originInput');
    inputField.value = "衛星準確定位中...";
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
        const res = await fetch(url, { headers: { 'User-Agent': 'KaohsiungTransitV7/1.0' } });
        if (!res.ok) return;
        const data = await res.json();
        const dropdown = document.getElementById(`${type}Dropdown`);
        dropdown.innerHTML = '';
        if (data.length === 0) { dropdown.classList.add('hidden'); return; }
        
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            const shortName = item.name || item.display_name.split(',')[0];
            div.innerHTML = `<div class="autocomplete-item-main">📍 ${shortName}</div>`;
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

// ==================== 獨立路網核心計算引擎 ====================
function getDistanceKM(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
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
    if (!originCoords || !destCoords) return alert('請先選取有效的起訖點！');
    
    document.getElementById('detailView').classList.add('hidden');
    document.getElementById('listView').classList.remove('hidden');
    
    const container = document.getElementById('routesContainer');
    const loading = document.getElementById('loadingIndicator');
    loading.classList.remove('hidden'); container.innerHTML = ''; mapLayers.clearLayers();

    const outputRoutes = [];
    const directKM = getDistanceKM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon);

    // 1. 🚇 捷運獨立分析 (MRT)
    if (activeFilters.has('mrt')) {
        let sortedStart = [...STATIONS_DATABASE.mrt].sort((a,b) => getDistanceKM(originCoords.lat, originCoords.lon, a.lat, a.lon) - getDistanceKM(originCoords.lat, originCoords.lon, b.lat, b.lon));
        let sortedEnd = [...STATIONS_DATABASE.mrt].sort((a,b) => getDistanceKM(destCoords.lat, destCoords.lon, a.lat, a.lon) - getDistanceKM(destCoords.lat, destCoords.lon, b.lat, b.lon));
        let st1 = sortedStart[0], st2 = sortedEnd[0];
        
        if (st1.name !== st2.name) {
            const leg1 = await getRouteOSRM(originCoords.lat, originCoords.lon, st1.lat, st1.lon, 'foot');
            const leg2 = await getRouteOSRM(st1.lat, st1.lon, st2.lat, st2.lon, 'driving');
            const leg3 = await getRouteOSRM(st2.lat, st2.lon, destCoords.lat, destCoords.lon, 'foot');
            
            if (leg1 && leg2 && leg3) {
                let waitTime = 4, price = 20, transferNote = "";
                if (st1.line !== st2.line && st1.line !== '紅橘樞紐' && st2.line !== '紅橘樞紐') {
                    waitTime += 6; price = 35; transferNote = "（需於美麗島站室內轉乘）";
                }
                if (parseFloat(leg2.km) > 6) price += 15;

                outputRoutes.push({
                    type: 'mrt', badge: '🚇 高雄捷運優先線', title: `捷運 ${st1.name} ➔ ${st2.name}`,
                    time: leg1.mins + waitTime + leg2.mins + leg3.mins, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2),
                    price: `${price} 元`, frequency: '尖峰 4-6分 / 離峰 8-10分',
                    bikeInfo: `起點推薦：${st1.bikeStation} 站；終點推薦：${st2.bikeStation} 站`,
                    steps: [
                        { icon: '🚶', title: `從起點步行至捷運 ${st1.name}`, mins: leg1.mins, desc: `前進車站 · ${leg1.mins} 分 (${leg1.km} km)`, color: '#38bdf8', path: leg1.path },
                        { icon: '🚇', title: `搭乘高雄捷運 [${st1.line}] ${transferNote}`, mins: leg2.mins + waitTime, desc: `車程約 ${leg2.mins} 分 + 候車轉乘 ${waitTime} 分`, color: '#E60012', path: leg2.path },
                        { icon: '🚶', title: `自捷運 ${st2.name} 出站步行至終點`, mins: leg3.mins, desc: `最後一哩路 · ${leg3.mins} 分 (${leg3.km} km)`, color: '#38bdf8', path: leg3.path }
                    ]
                });
            }
        }
    }

    // 2. 🍏 輕軌獨立分析 (LRT)
    if (activeFilters.has('lightrail')) {
        let sortedStart = [...STATIONS_DATABASE.lightrail].sort((a,b) => getDistanceKM(originCoords.lat, originCoords.lon, a.lat, a.lon) - getDistanceKM(originCoords.lat, originCoords.lon, b.lat, b.lon));
        let sortedEnd = [...STATIONS_DATABASE.lightrail].sort((a,b) => getDistanceKM(destCoords.lat, destCoords.lon, a.lat, a.lon) - getDistanceKM(destCoords.lat, destCoords.lon, b.lat, b.lon));
        let st1 = sortedStart[0], st2 = sortedEnd[0];
        
        if (st1.name !== st2.name) {
            const leg1 = await getRouteOSRM(originCoords.lat, originCoords.lon, st1.lat, st1.lon, 'foot');
            const leg2 = await getRouteOSRM(st1.lat, st1.lon, st2.lat, st2.lon, 'driving');
            const leg3 = await getRouteOSRM(st2.lat, st2.lon, destCoords.lat, destCoords.lon, 'foot');
            
            if (leg1 && leg2 && leg3) {
                outputRoutes.push({
                    type: 'lightrail', badge: '🍏 高雄環狀輕軌線', title: `${st1.name} ➔ ${st2.name}`,
                    time: leg1.mins + 8 + leg2.mins + leg3.mins, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2),
                    price: '30 元 (單一計價)', frequency: '尖峰 10分 / 離峰 15分',
                    bikeInfo: `起點鄰近：${st1.bikeStation}；終點鄰近：${st2.bikeStation}`,
                    steps: [
                        { icon: '🚶', title: `步行至輕軌 ${st1.name}`, mins: leg1.mins, desc: `前往月台 · ${leg1.mins} 分鐘`, color: '#38bdf8', path: leg1.path },
                        { icon: '🚃', title: '搭乘環狀輕軌列車', mins: leg2.mins + 8, desc: `沿線草綠景觀地帶 · 乘車約 ${leg2.mins} 分鐘`, color: '#009E52', path: leg2.path },
                        { icon: '🚶', title: '輕軌出站步行至目的地', mins: leg3.mins, desc: `步行指引 · ${leg3.mins} 分鐘`, color: '#38bdf8', path: leg3.path }
                    ]
                });
            }
        }
    }

    // 3. 市區公車
    if (activeFilters.has('bus')) {
        const busDrive = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (busDrive) {
            const busMins = Math.ceil(busDrive.mins * 1.3) + 7;
            outputRoutes.push({
                type: 'bus', badge: '🚌 市區公車動態', title: '市區優選公車直達解', time: busMins, dist: busDrive.km,
                price: '12 元 (全票)', frequency: '固定班表 / 約 15-25 分一班', bikeInfo: '建議搭配各公車站旁 YouBike 站點調度',
                steps: [{ icon: '🚌', title: '搭乘高市公車優選路線', mins: busMins, desc: `包含停靠各站與候車約 ${busMins} 分鐘`, color: '#9333ea', path: busDrive.path }]
            });
        }
    }

    // 4. YouBike 全程騎行
    if (activeFilters.has('bike') && directKM < 6) {
        const bikeDrive = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (bikeDrive) {
            const bMins = Math.ceil(bikeDrive.mins * 2.0);
            outputRoutes.push({
                type: 'bike', badge: '🚲 YouBike 綠色騎行', title: '全程共享單車綠廊道', time: bMins, dist: bikeDrive.km,
                price: '每 30 分鐘 10 元', frequency: '24小時隨拆隨還', bikeInfo: '起迄點周邊 100 公尺皆有 YouBike 2.0 系統站點',
                steps: [{ icon: '🚴', title: '租借 YouBike 自行車騎行', mins: bMins, desc: `均速舒壓騎行約 ${bMins} 分鐘`, color: '#06b6d4', path: bikeDrive.path }]
            });
        }
    }

    // 5. 偏鄉與軌道盲區自動判定 (加開 Uber)
    if (directKM > 5.5) {
        const drive = await getRouteOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (drive) {
            const fare = Math.round(85 + (parseFloat(drive.km) * 25) + (drive.mins * 5));
            outputRoutes.push({
                type: 'uber', badge: '🚖 Uber / 專車直達', title: '避開盲區專車快捷方案', time: drive.mins, dist: drive.km,
                price: `約 TWD $${fare} 元`, frequency: 'APP 隨叫隨到 (即時)', bikeInfo: '不需借還車',
                steps: [{ icon: '🚕', title: '預約專車/Uber直達', mins: drive.mins, desc: `無縫點對點運輸 · 里程 ${drive.km} km`, color: '#1e293b', path: drive.path }]
            });
        }
    }

    outputRoutes.sort((a,b) => a.time - b.time);
    renderRouteList(outputRoutes);
    loading.classList.add('hidden');
}

// ==================== UI 渲染與動態深層連結產生 ====================
function renderRouteList(routes) {
    const container = document.getElementById('routesContainer');
    if (routes.length === 0) { container.innerHTML = '<div class="error-box">無合適路線，請放寬過濾標籤。</div>'; return; }

    routes.forEach((rt, idx) => {
        const card = document.createElement('div');
        card.className = 'route-card';
        let clr = '#005CAF';
        if(rt.type === 'mrt') clr = '#E60012';
        else if(rt.type === 'lightrail') clr = '#009E52';
        else if(rt.type === 'bus') clr = '#9333ea';
        else if(rt.type === 'bike') clr = '#06b6d4';

        card.innerHTML = `
            <span class="badge" style="background:${clr}12; color:${clr}">${rt.badge}</span>
            <div class="card-title">${rt.title}</div>
            <div class="card-meta">⏱️ 時間: <b>${rt.time} 分鐘</b> | 🛣️ ${rt.dist} km</div>
        `;
        card.addEventListener('click', () => toggleToDetailView(rt, clr));
        container.appendChild(card);
        if (idx === 0) drawRouteOnMap(rt.steps);
    });
}

function toggleToDetailView(route, themeColor) {
    drawRouteOnMap(route.steps);
    const content = document.getElementById('detailContent');
    
    // 🧠 核心升級：幫使用者做好的 Google Maps 大眾運輸智慧深層連結網址！直接帶入起訖經緯度參數
    const preFilledUrl = `https://www.google.com/maps/dir/?api=1&origin=${originCoords.lat},${originCoords.lon}&destination=${destCoords.lat},${destCoords.lon}&travelmode=transit`;

    let stepsHtml = route.steps.map(s => {
        let ubikeBanner = "";
        if (s.icon === '🚶' && s.mins > 20) {
            ubikeBanner = `
                <div class="ubike-alert-box">
                    🚲 智慧接駁提示：此段步行時間達 ${s.mins} 分鐘較長，建議直接在站點旁租借 YouBike 2.0，可節省時間至 ${Math.ceil(s.mins / 3.5)} 分鐘！
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
            
            <div class="meta-info-grid">
                <div class="meta-item"><span class="meta-label">💰 預估票價</span><span class="meta-value" style="color:${themeColor}">${route.price}</span></div>
                <div class="meta-item"><span class="meta-label">⏱️ 發車班次</span><span class="meta-value">${route.frequency}</span></div>
                <div class="meta-item" style="width:100%; margin-top:4px;"><span class="meta-label">🚲 鄰近 YouBike 2.0 租賃站</span><span class="meta-value" style="font-size:12px; color:#0891b2;">${route.bikeInfo}</span></div>
            </div>

            <a href="${preFilledUrl}" target="_blank" class="deeplink-btn">
                🔍 開啟 Google Maps 查看本路線即時公車/捷運班次
            </a>
        </div>
        <div class="detail-timeline">${stepsHtml}</div>
    `;

    document.getElementById('listView').classList.add('hidden');
    document.getElementById('detailView').classList.remove('hidden');
}

document.getElementById('backToListBtn').addEventListener('click', () => {
    document.getElementById('detailView').classList.add('hidden');
    document.getElementById('listView').classList.remove('hidden');
});

// ==================== 地圖路軌描繪與人偶修復 ====================
function drawRouteOnMap(steps) {
    mapLayers.clearLayers();
    let boundsPoints = [];
    
    steps.forEach(s => {
        L.polyline(s.path, { color: s.color, weight: 6, opacity: 0.85, dashArray: s.icon === '🚶' ? '4, 8' : 'none' }).addTo(mapLayers);
        boundsPoints = boundsPoints.concat(s.path);
    });

    // 🚀 起點永遠精確保持當前設定的 activeAvatar 小人偶圖示，完全修復變回綠點的 Bug！
    const customIcon = L.divIcon({
        html: `<div class="dynamic-avatar-icon">${activeAvatar}</div>`,
        className: '', iconSize: [40, 40], iconAnchor: [20, 35]
    });
    
    L.marker(boundsPoints[0], { icon: customIcon }).addTo(mapLayers).bindPopup(`<b>起點出發</b> (造型: ${activeAvatar})`).openPopup();
    L.circleMarker(boundsPoints[boundsPoints.length - 1], { radius: 8, fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(mapLayers).bindPopup('目的地終點');
    
    map.fitBounds(L.latLngBounds(boundsPoints), { padding: [50, 50] });
}

// ==================== 事件與對調 ====================
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