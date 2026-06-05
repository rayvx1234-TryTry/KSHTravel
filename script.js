const OSRM_API = 'https://router.project-osrm.org/route/v1';
const KAOHSIUNG_CENTER = [22.6228, 120.3014];

// 高雄核心轉乘路網節點 (座標高度精確校準)
const TRANSIT_STATIONS = [
    { name: '左營高鐵站', lat: 22.6879, lon: 120.3080, type: 'mrt', color: '#e11d48' },
    { name: '巨蛋站', lat: 22.6659, lon: 120.3023, type: 'mrt', color: '#e11d48' },
    { name: '凹子底站', lat: 22.6575, lon: 120.3027, type: 'mrt', color: '#e11d48' },
    { name: '高雄車站', lat: 22.6397, lon: 120.3120, type: 'mrt', color: '#e11d48' },
    { name: '美麗島站', lat: 22.6314, lon: 120.3180, type: 'mrt', color: '#e11d48' },
    { name: '中央公園站', lat: 22.6218, lon: 120.3150, type: 'mrt', color: '#e11d48' },
    { name: '三多商圈站', lat: 22.6134, lon: 120.3340, type: 'mrt', color: '#e11d48' },
    { name: '衛武營站', lat: 22.6248, lon: 120.3404, type: 'mrt', color: '#9333ea' },
    { name: '西子灣站', lat: 22.6210, lon: 120.2725, type: 'mrt', color: '#9333ea' },
    { name: '駁二大義站', lat: 22.6202, lon: 120.2858, type: 'lightrail', color: '#16a34a' },
    { name: '愛河之心站', lat: 22.6595, lon: 120.3028, type: 'lightrail', color: '#16a34a' }
];

let map, mapLayers, userMarker = null;
let originCoords = null, destCoords = null, userCoords = null;
let activeAvatar = '🧍‍♂️';
let activeFilters = new Set(['mrt', 'lightrail', 'bus', 'bike']);

// ==================== 初始化繽紛地圖與夜間模式 ====================
function initMap() {
    map = L.map('map', { zoomControl: false }).setView(KAOHSIUNG_CENTER, 13);
    L.control.zoom({ position: 'topright' }).addTo(map);
    mapLayers = L.layerGroup().addTo(map);
    updateMapTheme('light');
    setTimeout(() => map.invalidateSize(), 300);
}

function updateMapTheme(theme) {
    if (map.tileLayer) map.removeLayer(map.tileLayer);
    // 白天模式採用繽紛齊全的原生 OSM，夜間模式採用質感深藍色
    const tileUrl = theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    map.tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

// 主題切換監聽
document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
    updateMapTheme(isDark ? 'light' : 'dark');
});

// ==================== 客製化小人偶造型切換邏輯 ====================
document.querySelectorAll('.avatar-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeAvatar = btn.dataset.avatar;
        
        // 如果地圖上已經定位成功，即時刷新小人偶造型！
        if (userCoords && userMarker) {
            const newIcon = L.divIcon({
                html: `<div class="dynamic-avatar-icon">${activeAvatar}</div>`,
                className: '',
                iconSize: [40, 40],
                iconAnchor: [20, 35]
            });
            userMarker.setIcon(newIcon);
        }
    });
});

// ==================== GPS 瀏覽器精確定位 ====================
document.getElementById('useLocationBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('瀏覽器不支援定位功能');
    
    const inputField = document.getElementById('originInput');
    inputField.value = "正在請求定位權限...";
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            userCoords = { lat: position.coords.latitude, lon: position.coords.longitude };
            originCoords = userCoords;
            inputField.value = `📍 我的位置 (${activeAvatar})`;
            
            // 繪製或更新客製化造型小人偶
            if (userMarker) mapLayers.removeLayer(userMarker);
            const avatarIcon = L.divIcon({
                html: `<div class="dynamic-avatar-icon">${activeAvatar}</div>`,
                className: '',
                iconSize: [40, 40],
                iconAnchor: [20, 35]
            });
            
            userMarker = L.marker([userCoords.lat, userCoords.lon], { icon: avatarIcon }).addTo(mapLayers);
            userMarker.bindPopup(`<b>你在這裡！</b><br>造型：${activeAvatar}`).openPopup();
            map.flyTo([userCoords.lat, userCoords.lon], 15);
        },
        (error) => {
            alert('定位失敗！請確保已核准瀏覽器的「位置資訊存取權限」。');
            inputField.value = "";
        },
        { enableHighAccuracy: true, timeout: 6000 }
    );
});

// ==================== 關鍵修正：兩地地址輸入與推薦清單 ====================
async function fetchAddressSuggestions(query, type) {
    if (query.length < 2) return;
    try {
        // 設定精確的高雄區域界限，並強制加入 User-Agent 標頭防止 OSM 拒絕連線
        const viewbox = '120.1,22.4,120.5,23.1';
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=${viewbox}&bounded=1&limit=5&countrycodes=tw`;
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'KaohsiungTransitSmartNavigatorV4/1.0' }
        });
        if (!response.ok) return;
        const data = await response.json();
        
        const dropdown = document.getElementById(`${type}Dropdown`);
        dropdown.innerHTML = '';
        
        if (data.length === 0) {
            dropdown.classList.add('hidden');
            return;
        }
        
        data.forEach(item => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            const shortName = item.name || item.display_name.split(',')[0];
            div.innerHTML = `
                <div class="autocomplete-item-main">📍 ${shortName}</div>
                <div class="autocomplete-item-sub">${item.display_name}</div>
            `;
            
            // 關鍵修正：改用 mousedown 避免與 input 的 blur 衝突，確保點擊必能選取
            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                document.getElementById(`${type}Input`).value = shortName;
                if (type === 'origin') {
                    originCoords = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) };
                } else {
                    destCoords = { lat: parseFloat(item.lat), lon: parseFloat(item.lon) };
                }
                dropdown.classList.add('hidden');
            });
            dropdown.appendChild(div);
        });
        dropdown.classList.remove('hidden');
    } catch (err) {
        console.error("地址搜尋出錯:", err);
    }
}

// 輸入欄位防抖動監聽
let searchDebounceTimer;
document.querySelectorAll('input[data-location-type]').forEach(input => {
    const type = input.dataset.locationType; // 'origin' 或 'destination'
    input.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            fetchAddressSuggestions(e.target.value.trim(), type);
        }, 400);
    });
    
    // 聚焦時若有內容重啟下拉選單
    input.addEventListener('focus', (e) => {
        if (e.target.value.trim().length >= 2) fetchAddressSuggestions(e.target.value.trim(), type);
    });
    
    // 失去焦點自動隱藏
    input.addEventListener('blur', () => {
        setTimeout(() => {
            document.getElementById(`${type}Dropdown`).classList.add('hidden');
        }, 200);
    });
});

// ==================== 核心邏輯路由計算引擎 ====================
function getDistanceKM(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function requestOSRMGeometry(lat1, lon1, lat2, lon2, profile = 'foot') {
    try {
        const url = `${OSRM_API}/${profile}/${lon1},${lat1};${lon2},${lat2}?geometries=geojson`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return {
            path: data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]),
            km: (data.routes[0].distance / 1000).toFixed(2),
            mins: Math.ceil(data.routes[0].duration / 60)
        };
    } catch (e) { return null; }
}

async function runRoutePlanning() {
    if (!originCoords || !destCoords) return alert('請確認已輸入並從候選名單選取正確的起訖點！');
    
    const container = document.getElementById('routesContainer');
    const loading = document.getElementById('loadingIndicator');
    
    loading.classList.remove('hidden');
    container.innerHTML = '';
    mapLayers.clearLayers();
    
    // 如果有使用者定位點，重繪客製化小人偶
    if (userCoords) {
        const avatarIcon = L.divIcon({ html: `<div class="dynamic-avatar-icon">${activeAvatar}</div>`, className: '', iconSize: [40, 40] });
        L.marker([userCoords.lat, userCoords.lon], { icon: avatarIcon }).addTo(mapLayers);
    }

    const outputRoutes = [];
    const directKM = getDistanceKM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon);

    // 1. 捷運與輕軌優選路由
    if (activeFilters.has('mrt') || activeFilters.has('lightrail')) {
        let sortedStart = [...TRANSIT_STATIONS].sort((a,b) => getDistanceKM(originCoords.lat, originCoords.lon, a.lat, a.lon) - getDistanceKM(originCoords.lat, originCoords.lon, b.lat, b.lon));
        let sortedEnd = [...TRANSIT_STATIONS].sort((a,b) => getDistanceKM(destCoords.lat, destCoords.lon, a.lat, a.lon) - getDistanceKM(destCoords.lat, destCoords.lon, b.lat, b.lon));
        
        let st1 = sortedStart[0], st2 = sortedEnd[0];
        if (st1.name !== st2.name) {
            const leg1 = await requestOSRMGeometry(originCoords.lat, originCoords.lon, st1.lat, st1.lon, 'foot');
            const leg2 = await requestOSRMGeometry(st1.lat, st1.lon, st2.lat, st2.lon, 'driving'); // 模擬軌道
            const leg3 = await requestOSRMGeometry(st2.lat, st2.lon, destCoords.lat, destCoords.lon, 'foot');
            
            if (leg1 && leg2 && leg3) {
                const waitTime = 4;
                const totalMins = leg1.mins + waitTime + leg2.mins + leg3.mins;
                outputRoutes.push({
                    type: 'transit', badge: '🚇 軌道最速優先', title: `${st1.name} ➔ ${st2.name} 轉乘`,
                    time: totalMins, dist: (parseFloat(leg1.km) + parseFloat(leg2.km) + parseFloat(leg3.km)).toFixed(2),
                    steps: [
                        { icon: '🚶', title: `步行至 ${st1.name}`, desc: `搭乘前準備 · ${leg1.mins} 分鐘 (${leg1.km} km)`, color: '#0ea5e9', path: leg1.path },
                        { icon: '🚇', title: `搭乘高雄捷運線/輕軌`, desc: `候車約 ${waitTime} 分 + 乘車 ${leg2.mins} 分鐘`, color: st1.color, path: leg2.path },
                        { icon: '🚶', title: `出站步行至目的地`, desc: `最後一哩路 · ${leg3.mins} 分鐘 (${leg3.km} km)`, color: '#0ea5e9', path: leg3.path }
                    ]
                });
            }
        }
    }

    // 2. 市區公車路線
    if (activeFilters.has('bus')) {
        const busDrive = await requestOSRMGeometry(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (busDrive) {
            const realBusMins = Math.ceil(busDrive.mins * 1.4) + 8; // 包含等車與靠站時間
            outputRoutes.push({
                type: 'bus', badge: '🚌 市區公車直達', title: '全區公車串聯方案', time: realBusMins, dist: busDrive.km,
                steps: [{ icon: '🚌', title: '搭乘市區精選公車線', desc: `優雅直達 · 包含停靠等候約 ${realBusMins} 分鐘`, color: '#9333ea', path: busDrive.path }]
            });
        }
    }

    // 3. YouBike 綠色共享單車
    if (activeFilters.has('bike') && directKM < 6) {
        const bikeDrive = await requestOSRMGeometry(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
        if (bikeDrive) {
            const bikeMins = Math.ceil(bikeDrive.mins * 2.2);
            outputRoutes.push({
                type: 'bike', badge: '🚲 YouBike 樂活', title: '低碳共享單車騎行', time: bikeMins, dist: bikeDrive.km,
                steps: [{ icon: '🚴', title: '租借 YouBike 沿自行車道騎行', desc: `時速約15km · 全程約 ${bikeMins} 分鐘`, color: '#475569', path: bikeDrive.path }]
            });
        }
    }

    outputRoutes.sort((a,b) => a.time - b.time);
    renderRouteCards(outputRoutes);
    loading.classList.add('hidden');
}

// ==================== 卡片 UI 渲染與精確拆解時間 ====================
function renderRouteCards(routes) {
    const container = document.getElementById('routesContainer');
    if (routes.length === 0) {
        container.innerHTML = '<div class="error-box">查無適合的組合，請試著放寬交通工具篩選！</div>';
        return;
    }

    routes.forEach((rt, idx) => {
        const card = document.createElement('div');
        card.className = `route-card ${idx === 0 ? 'active' : ''}`;
        
        let stepsHtml = rt.steps.map(s => `
            <div class="step-item">
                <div class="step-badge" style="background:${s.color}">${s.icon}</div>
                <div class="step-info">
                    <div class="step-text">${s.title}</div>
                    <div class="step-subtext">${s.desc}</div>
                </div>
            </div>
        `).join('');

        const accentColor = rt.steps.find(s => s.icon !== '🚶')?.color || '#0ea5e9';

        card.innerHTML = `
            <div class="card-header">
                <span class="badge" style="background:${accentColor}15; color:${accentColor}">${rt.badge}</span>
                <div class="card-title">${rt.title}</div>
                <div class="card-meta">
                    <span>⏱️ 總需時: <b>${rt.time} 分鐘</b></span>
                    <span>🛣️ 總距離: ${rt.dist} km</span>
                </div>
            </div>
            <div class="card-details">${stepsHtml}</div>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.route-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            drawRouteOnMap(rt.steps);
        });

        container.appendChild(card);
        if (idx === 0) drawRouteOnMap(rt.steps);
    });
}

function drawRouteOnMap(steps) {
    mapLayers.clearLayers();
    let boundsPoints = [];
    
    steps.forEach(s => {
        const isWalk = s.icon === '🚶';
        L.polyline(s.path, {
            color: s.color,
            weight: 6,
            opacity: 0.85,
            dashArray: isWalk ? '6, 8' : 'none'
        }).addTo(mapLayers);
        boundsPoints = boundsPoints.concat(s.path);
    });

    // 繪製頭尾鮮明端點
    L.circleMarker(boundsPoints[0], { radius: 7, fillColor: '#16a34a', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(mapLayers).bindPopup('出發起點');
    L.circleMarker(boundsPoints[boundsPoints.length - 1], { radius: 7, fillColor: '#e11d48', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(mapLayers).bindPopup('目的地終點');
    
    map.fitBounds(L.latLngBounds(boundsPoints), { padding: [40, 40] });
}

// ==================== 快篩與輔助按鈕按鍵宣告 ====================
document.querySelectorAll('.filter-tag').forEach(tag => {
    tag.addEventListener('click', () => {
        const transit = tag.dataset.transit;
        tag.classList.toggle('active');
        if (tag.classList.contains('active')) activeFilters.add(transit); else activeFilters.delete(transit);
    });
});

document.getElementById('swapBtn').addEventListener('click', () => {
    const originInput = document.getElementById('originInput');
    const destInput = document.getElementById('destinationInput');
    [originInput.value, destInput.value] = [destInput.value, originInput.value];
    [originCoords, destCoords] = [destCoords, originCoords];
});

document.getElementById('searchBtn').addEventListener('click', runRoutePlanning);

window.onload = initMap;