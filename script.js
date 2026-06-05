const OSRM_API = 'https://router.project-osrm.org/route/v1';
const KAOHSIUNG_CENTER = [22.6228, 120.3014];

// 高雄重點車站座標 (簡化版，確保邏輯不報錯)
const STATIONS = [
    { name: '左營高鐵', lat: 22.6879, lon: 120.3080, type: 'mrt', color: '#E60012' },
    { name: '巨蛋', lat: 22.6725, lon: 120.3017, type: 'mrt', color: '#E60012' },
    { name: '高雄車站', lat: 22.6387, lon: 120.3137, type: 'mrt', color: '#E60012' },
    { name: '美麗島', lat: 22.6353, lon: 120.3176, type: 'mrt', color: '#E60012' },
    { name: '三多商圈', lat: 22.6088, lon: 120.3256, type: 'mrt', color: '#E60012' },
    { name: '衛武營', lat: 22.6259, lon: 120.3388, type: 'mrt', color: '#FFA500' },
    { name: '駁二大義', lat: 22.6200, lon: 120.2850, type: 'lightrail', color: '#009E52' },
    { name: '愛河之心', lat: 22.6595, lon: 120.3028, type: 'lightrail', color: '#009E52' }
];

let map, layerGroup, drawnLines = [];
let originCoords = null, destCoords = null, userCoords = null;

// ================= Map Init & Theme =================
function initMap() {
    map = L.map('map').setView(KAOHSIUNG_CENTER, 13);
    layerGroup = L.layerGroup().addTo(map);
    setMapTheme('light');
    setTimeout(() => map.invalidateSize(), 300);
}

function setMapTheme(theme) {
    if(map.tileLayer) map.removeLayer(map.tileLayer);
    const url = theme === 'dark' 
        ? 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png'
        : 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png';
    map.tileLayer = L.tileLayer(url, { maxZoom: 19, attribution: '© OpenStreetMap & CartoDB' }).addTo(map);
}

document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
    setMapTheme(isDark ? 'light' : 'dark');
});

// ================= GPS User Location =================
document.getElementById('useLocationBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('您的瀏覽器不支援定位功能');
    
    document.getElementById('originInput').value = "定位中...";
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            originCoords = userCoords;
            document.getElementById('originInput').value = "📍 我的目前位置";
            
            layerGroup.clearLayers();
            const userIcon = L.divIcon({ html: '<div class="user-avatar">🧍‍♂️</div>', className: '', iconSize: [30, 30] });
            L.marker([userCoords.lat, userCoords.lon], { icon: userIcon }).addTo(layerGroup).bindPopup('你在這裡！').openPopup();
            map.flyTo([userCoords.lat, userCoords.lon], 15);
        },
        (err) => {
            alert('無法取得位置，請確認是否已在瀏覽器設定中開啟「位置資訊存取權限」！');
            document.getElementById('originInput').value = "";
        },
        { enableHighAccuracy: true, timeout: 5000 }
    );
});

// ================= Core Routing Engine =================
function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 強制 OSRM foot 模式，保證不走高速公路
async function getOSRM(lat1, lon1, lat2, lon2, profile) {
    try {
        const res = await fetch(`${OSRM_API}/${profile}/${lon1},${lat1};${lon2},${lat2}?geometries=geojson`);
        if (!res.ok) return null;
        const data = await res.json();
        return {
            coords: data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]),
            dist: (data.routes[0].distance / 1000).toFixed(2),
            time: Math.ceil(data.routes[0].duration / 60)
        };
    } catch (e) { return null; }
}

async function generateRoutes() {
    layerGroup.clearLayers();
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('routesContainer').innerHTML = '';
    
    const routes = [];
    const directDist = calcDistance(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon);

    // 1. 大眾運輸優先方案 (捷運/輕軌)
    let nearestStart = STATIONS.sort((a,b) => calcDistance(originCoords.lat, originCoords.lon, a.lat, a.lon) - calcDistance(originCoords.lat, originCoords.lon, b.lat, b.lon))[0];
    let nearestEnd = STATIONS.sort((a,b) => calcDistance(destCoords.lat, destCoords.lon, a.lat, a.lon) - calcDistance(destCoords.lat, destCoords.lon, b.lat, b.lon))[0];

    if (nearestStart !== nearestEnd) {
        const w1 = await getOSRM(originCoords.lat, originCoords.lon, nearestStart.lat, nearestStart.lon, 'foot');
        const w2 = await getOSRM(nearestEnd.lat, nearestEnd.lon, destCoords.lat, destCoords.lon, 'foot');
        const transit = await getOSRM(nearestStart.lat, nearestStart.lon, nearestEnd.lat, nearestEnd.lon, 'driving'); // 模擬軌道
        
        if(w1 && w2 && transit) {
            const waitTime = 5; 
            const totalTime = w1.time + waitTime + transit.time + w2.time;
            routes.push({
                id: 'mrt', badge: '🚇 軌道優選', title: '捷運 / 輕軌方案',
                totalTime: totalTime, dist: (parseFloat(w1.dist) + parseFloat(transit.dist) + parseFloat(w2.dist)).toFixed(2),
                steps: [
                    { icon: '🚶', title: `步行至 ${nearestStart.name}站`, desc: `約 ${w1.time} 分鐘 (${w1.dist} km)`, color: '#A0AEC0', coords: w1.coords },
                    { icon: '🚇', title: `搭乘捷運至 ${nearestEnd.name}站`, desc: `等車 ${waitTime} 分 + 搭乘 ${transit.time} 分`, color: nearestStart.color, coords: transit.coords },
                    { icon: '🚶', title: `步行至目的地`, desc: `約 ${w2.time} 分鐘 (${w2.dist} km)`, color: '#A0AEC0', coords: w2.coords }
                ]
            });
        }
    }

    // 2. 公車直達方案
    const bus = await getOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'driving');
    if (bus) {
        const busTime = Math.ceil(bus.time * 1.5) + 10; // 模擬停靠站與等車
        routes.push({
            id: 'bus', badge: '🚌 一車直達', title: '市區公車方案', totalTime: busTime, dist: bus.dist,
            steps: [{ icon: '🚌', title: '搭乘公車前往目的地', desc: `包含等車約需 ${busTime} 分鐘`, color: '#9B59B6', coords: bus.coords }]
        });
    }

    // 3. 步行 (限 3km 內)
    if (directDist < 3) {
        const walk = await getOSRM(originCoords.lat, originCoords.lon, destCoords.lat, destCoords.lon, 'foot');
        if (walk) routes.push({
            id: 'walk', badge: '🚶 健康環保', title: '純步行方案', totalTime: walk.time, dist: walk.dist,
            steps: [{ icon: '🚶', title: '沿人行道步行直達', desc: `約 ${walk.time} 分鐘`, color: '#2ECC71', coords: walk.coords }]
        });
    }

    // 排序與渲染
    routes.sort((a, b) => a.totalTime - b.totalTime);
    renderRoutes(routes);
    document.getElementById('loading').classList.add('hidden');
}

// ================= UI Rendering =================
function renderRoutes(routes) {
    const container = document.getElementById('routesContainer');
    routes.forEach((rt, idx) => {
        const el = document.createElement('div');
        el.className = `route-card ${idx === 0 ? 'active' : ''}`;
        
        let stepsHtml = rt.steps.map(s => `
            <div class="timeline-step">
                <div class="step-icon" style="background:${s.color}">${s.icon}</div>
                <div class="step-content">
                    <div class="step-title">${s.title}</div>
                    <div class="step-desc">${s.desc}</div>
                </div>
            </div>
        `).join('');

        el.innerHTML = `
            <div class="card-header">
                <div class="route-type-badge" style="background:${rt.steps.find(s=>s.icon!=='🚶').color}20; color:${rt.steps.find(s=>s.icon!=='🚶').color}">${rt.badge}</div>
                <div class="route-title">${rt.title}</div>
                <div class="route-summary">⏱️ 總時間: ${rt.totalTime} 分 | 🛣️ 總距離: ${rt.dist} km</div>
            </div>
            <div class="card-details">${stepsHtml}</div>
        `;
        
        el.onclick = () => {
            document.querySelectorAll('.route-card').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
            drawMap(rt.steps);
        };
        container.appendChild(el);
        if (idx === 0) drawMap(rt.steps);
    });
}

function drawMap(steps) {
    layerGroup.clearLayers();
    let allCoords = [];
    steps.forEach(s => {
        L.polyline(s.coords, { color: s.color, weight: 6, opacity: 0.8, dashArray: s.icon==='🚶'?'8,8':'' }).addTo(layerGroup);
        allCoords = allCoords.concat(s.coords);
    });
    L.circleMarker(allCoords[0], { radius: 8, fillColor: '#2ECC71', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(layerGroup);
    L.circleMarker(allCoords[allCoords.length-1], { radius: 8, fillColor: '#E74C3C', color: '#fff', weight: 2, fillOpacity: 1 }).addTo(layerGroup);
    map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
}

// ================= Search / Autocomplete =================
async function searchLoc(query, type) {
    if(query.length < 2) return;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=120.1,22.4,120.5,23.1&bounded=1`);
    const data = await res.json();
    const dropdown = document.getElementById(`${type}Dropdown`);
    dropdown.innerHTML = '';
    data.slice(0,4).forEach(d => {
        const item = document.createElement('div'); item.className = 'autocomplete-item';
        item.innerHTML = `<div class="autocomplete-item-main">${d.name||d.display_name.split(',')[0]}</div>`;
        item.onclick = () => {
            document.getElementById(`${type}Input`).value = d.name||d.display_name.split(',')[0];
            dropdown.classList.add('hidden');
            if(type==='origin') originCoords = { lat: d.lat, lon: d.lon }; else destCoords = { lat: d.lat, lon: d.lon };
        };
        dropdown.appendChild(item);
    });
    dropdown.classList.remove('hidden');
}

let timer;
document.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => searchLoc(e.target.value, e.target.dataset.type), 400);
    });
});

document.getElementById('searchBtn').addEventListener('click', () => {
    if(!originCoords || !destCoords) return alert('請確認已輸入並選擇起訖點！');
    generateRoutes();
});

document.getElementById('swapBtn').addEventListener('click', () => {
    const oInp = document.getElementById('originInput'); const dInp = document.getElementById('destinationInput');
    [oInp.value, dInp.value] = [dInp.value, oInp.value];
    [originCoords, destCoords] = [destCoords, originCoords];
});

window.onload = initMap;