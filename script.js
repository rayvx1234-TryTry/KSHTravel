// ==================== Configuration & Constants ====================
const OSRM_API = 'https://router.project-osrm.org/route/v1';

const ROUTE_COLORS = {
    MRT_RED: '#E60012',
    MRT_ORANGE: '#FFA500',
    LIGHTRAIL: '#009E52',
    WALK: '#2ECC71',
    BUS: '#9B59B6',
    BIKE: '#34495E',
    TRANSFER: '#888888'
};

// 票價與班距資訊庫 (Mock Data for UX)
const TRANSIT_INFO = {
    'mrt': { headway: '尖峰 4-6 分 / 離峰 8-10 分', price: 20 },
    'lightrail': { headway: '全天約 10-15 分一班', price: 30 },
    'bus': { headway: '依各路線發車 (約 15-20 分)', price: 12 }
};

// ==================== 高雄微型捷運路網 (Graph Nodes) ====================
const STATIONS = {
    'R16': { name: '左營', lat: 22.6879, lon: 120.3080, line: 'red' },
    'R14': { name: '巨蛋', lat: 22.6725, lon: 120.3017, line: 'red' },
    'R13': { name: '凹子底', lat: 22.6591, lon: 120.3025, line: 'red' },
    'R11': { name: '高雄車站', lat: 22.6387, lon: 120.3137, line: 'red' },
    'R10': { name: '美麗島', lat: 22.6353, lon: 120.3176, line: 'interchange' },
    'R9':  { name: '中央公園', lat: 22.6289, lon: 120.3202, line: 'red' },
    'R8':  { name: '三多商圈', lat: 22.6088, lon: 120.3256, line: 'red' },
    'O1':  { name: '西子灣', lat: 22.6219, lon: 120.2743, line: 'orange' },
    'O10': { name: '衛武營', lat: 22.6259, lon: 120.3388, line: 'orange' },
    'C14': { name: '哈瑪星', lat: 22.6215, lon: 120.2755, line: 'green' },
    'C12': { name: '駁二大義', lat: 22.6200, lon: 120.2850, line: 'green' },
    'C11': { name: '真愛碼頭', lat: 22.6174, lon: 120.2925, line: 'green' },
    'C10': { name: '光榮碼頭', lat: 22.6185, lon: 120.2974, line: 'green' },
    'C24': { name: '愛河之心', lat: 22.6595, lon: 120.3028, line: 'green' }
};

const ADJACENCY_LIST = {
    'R16': [{ to: 'R14', time: 4, type: 'mrt', line: 'red' }],
    'R14': [{ to: 'R16', time: 4, type: 'mrt', line: 'red' }, { to: 'R13', time: 2, type: 'mrt', line: 'red' }],
    'R13': [{ to: 'R14', time: 2, type: 'mrt', line: 'red' }, { to: 'R11', time: 4, type: 'mrt', line: 'red' }, { to: 'C24', time: 4, type: 'walk', line: 'transfer' }],
    'R11': [{ to: 'R13', time: 4, type: 'mrt', line: 'red' }, { to: 'R10', time: 2, type: 'mrt', line: 'red' }],
    'R10': [{ to: 'R11', time: 2, type: 'mrt', line: 'red' }, { to: 'R9', time: 2, type: 'mrt', line: 'red' }, { to: 'O1', time: 6, type: 'mrt', line: 'orange' }, { to: 'O10', time: 8, type: 'mrt', line: 'orange' }],
    'R9':  [{ to: 'R10', time: 2, type: 'mrt', line: 'red' }, { to: 'R8', time: 2, type: 'mrt', line: 'red' }],
    'R8':  [{ to: 'R9', time: 2, type: 'mrt', line: 'red' }],
    'O1':  [{ to: 'R10', time: 6, type: 'mrt', line: 'orange' }, { to: 'C14', time: 3, type: 'walk', line: 'transfer' }],
    'O10': [{ to: 'R10', time: 8, type: 'mrt', line: 'orange' }],
    'C14': [{ to: 'O1', time: 3, type: 'walk', line: 'transfer' }, { to: 'C12', time: 5, type: 'lightrail', line: 'green' }],
    'C12': [{ to: 'C14', time: 5, type: 'lightrail', line: 'green' }, { to: 'C11', time: 2, type: 'lightrail', line: 'green' }],
    'C11': [{ to: 'C12', time: 2, type: 'lightrail', line: 'green' }, { to: 'C10', time: 2, type: 'lightrail', line: 'green' }],
    'C10': [{ to: 'C11', time: 2, type: 'lightrail', line: 'green' }],
    'C24': [{ to: 'R13', time: 4, type: 'walk', line: 'transfer' }]
};

const KAOHSIUNG_CENTER = [22.6228, 120.3014];

let map = null, mapLayerGroup = null, drawnPolylines = [];
let selectedTransitTypes = new Set(['mrt', 'lightrail', 'bus', 'bike']);
let originCoords = null, destinationCoords = null, userLocation = null;

// ==================== 數學距離與 Fallback 計算 ====================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 防呆：如果 OSRM 斷線或算不出走路路線，使用直線距離推算走路時間 (4.5km/h)
function fallbackWalk(lat1, lon1, lat2, lon2) {
    const dist = calculateDistance(lat1, lon1, lat2, lon2);
    return {
        coordinates: [[lat1, lon1], [lat2, lon2]],
        distance: dist.toFixed(2),
        duration: Math.ceil((dist / 4.5) * 60)
    };
}

// ==================== Dijkstra 核心演算法 ====================
function getNearestStations(lat, lon, allowedTypes, maxStations = 3) {
    let distances = [];
    for (let id in STATIONS) {
        const stn = STATIONS[id];
        if ((stn.line === 'red' || stn.line === 'orange' || stn.line === 'interchange') && !allowedTypes.has('mrt')) continue;
        if (stn.line === 'green' && !allowedTypes.has('lightrail')) continue;
        distances.push({ id: id, dist: calculateDistance(lat, lon, stn.lat, stn.lon) });
    }
    return distances.sort((a, b) => a.dist - b.dist).slice(0, maxStations).map(i => i.id);
}

function runDijkstra(startIds, endIds) {
    let shortestPath = null, minTime = Infinity;
    for (let startNode of startIds) {
        let times = {}, previous = {}, unvisited = new Set(Object.keys(STATIONS));
        for (let node of unvisited) times[node] = Infinity;
        times[startNode] = 0;

        while (unvisited.size > 0) {
            let currNode = null;
            for (let node of unvisited) { if (currNode === null || times[node] < times[currNode]) currNode = node; }
            if (times[currNode] === Infinity) break;
            unvisited.delete(currNode);
            if (!ADJACENCY_LIST[currNode]) continue;

            for (let neighbor of ADJACENCY_LIST[currNode]) {
                let altTime = times[currNode] + neighbor.time;
                if (previous[currNode] && ADJACENCY_LIST[previous[currNode]].find(n => n.to === currNode).line !== neighbor.line) altTime += 4; // 轉乘懲罰時間
                if (altTime < times[neighbor.to]) { times[neighbor.to] = altTime; previous[neighbor.to] = currNode; }
            }
        }

        for (let endNode of endIds) {
            if (times[endNode] < minTime) {
                minTime = times[endNode];
                let path = [], curr = endNode;
                while (curr) { path.unshift(curr); curr = previous[curr]; }
                shortestPath = path;
            }
        }
    }
    return shortestPath;
}

// ==================== OSRM 安全呼叫 ====================
async function getSafeOSRMRoute(startLat, startLon, endLat, endLon, profile = 'foot') {
    try {
        const safeProfile = (profile === 'walk' || profile === 'foot') ? 'foot' : profile;
        const url = `${OSRM_API}/${safeProfile}/${startLon},${startLat};${endLon},${endLat}?steps=true&overview=full&geometries=geojson`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.routes || data.routes.length === 0) return null;
        return {
            coordinates: data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]),
            distance: (data.routes[0].distance / 1000).toFixed(2),
            duration: Math.ceil(data.routes[0].duration / 60)
        };
    } catch (error) { return null; }
}

// ==================== 智慧多方案生成 (包含公車、捷運班距) ====================
async function generateSmartRoute(originLat, originLon, destLat, destLon) {
    const routes = [];
    const directDist = calculateDistance(originLat, originLon, destLat, destLon);
    
    // 方案一：大眾運輸優先 (捷運/輕軌)
    if (selectedTransitTypes.has('mrt') || selectedTransitTypes.has('lightrail')) {
        const startIds = getNearestStations(originLat, originLon, selectedTransitTypes);
        const endIds = getNearestStations(destLat, destLon, selectedTransitTypes);

        if (startIds.length > 0 && endIds.length > 0) {
            const bestPath = runDijkstra(startIds, endIds);
            if (bestPath && bestPath.length > 0) {
                let steps = [], totalTime = 0, totalDistance = 0, allCoords = [], fare = 0;
                const firstStn = STATIONS[bestPath[0]]; const lastStn = STATIONS[bestPath[bestPath.length - 1]];

                // [走路 1] 保證路線一定生成
                let walk1 = await getSafeOSRMRoute(originLat, originLon, firstStn.lat, firstStn.lon, 'foot');
                if (!walk1) walk1 = fallbackWalk(originLat, originLon, firstStn.lat, firstStn.lon);
                
                totalTime += walk1.duration; allCoords = allCoords.concat(walk1.coordinates);
                steps.push({
                    type: 'walk', duration: walk1.duration, distance: walk1.distance + ' km',
                    instruction: `步行至【${firstStn.name}站】`, color: ROUTE_COLORS.WALK, coordinates: walk1.coordinates
                });

                // [軌道段]
                let currentLine = null, currentLineStart = null, currentLineCoords = [], transitTime = 5;
                for (let i = 0; i < bestPath.length - 1; i++) {
                    const stn1 = STATIONS[bestPath[i]]; const stn2 = STATIONS[bestPath[i+1]];
                    const edgeInfo = ADJACENCY_LIST[bestPath[i]].find(e => e.to === bestPath[i+1]);
                    
                    transitTime += edgeInfo.time; currentLineCoords.push([stn1.lat, stn1.lon]);
                    if (i === bestPath.length - 2) currentLineCoords.push([stn2.lat, stn2.lon]);

                    if (currentLine === null) { currentLine = edgeInfo.line; currentLineStart = stn1.name; } 
                    else if (currentLine !== edgeInfo.line || i === bestPath.length - 2) {
                        const color = currentLine === 'red' ? ROUTE_COLORS.MRT_RED : currentLine === 'orange' ? ROUTE_COLORS.MRT_ORANGE : ROUTE_COLORS.LIGHTRAIL;
                        const action = currentLine === 'transfer' ? '站外轉乘' : `搭乘${currentLine === 'green' ? '輕軌' : '捷運'}`;
                        const tType = currentLine === 'green' ? 'lightrail' : 'mrt';
                        const extraInfo = currentLine !== 'transfer' ? `<br><small style="color:#666;">ℹ️ 班距：${TRANSIT_INFO[tType].headway}</small>` : '';
                        
                        if (currentLine !== 'transfer') fare += TRANSIT_INFO[tType].price;

                        steps.push({
                            type: tType, duration: transitTime, distance: '大眾運輸',
                            instruction: `${action}由【${currentLineStart}】至【${i === bestPath.length - 2 ? stn2.name : stn1.name}】${extraInfo}`,
                            color: color, coordinates: [...currentLineCoords]
                        });
                        
                        currentLine = edgeInfo.line; currentLineStart = stn1.name; currentLineCoords = [[stn1.lat, stn1.lon]]; transitTime = 5;
                    }
                    allCoords.push([stn1.lat, stn1.lon]);
                }
                allCoords.push([lastStn.lat, lastStn.lon]);

                // [走路 2]
                let walk2 = await getSafeOSRMRoute(lastStn.lat, lastStn.lon, destLat, destLon, 'foot');
                if (!walk2) walk2 = fallbackWalk(lastStn.lat, lastStn.lon, destLat, destLon);
                
                totalTime += walk2.duration; allCoords = allCoords.concat(walk2.coordinates);
                steps.push({
                    type: 'walk', duration: walk2.duration, distance: walk2.distance + ' km',
                    instruction: `出站後步行至目的地`, color: ROUTE_COLORS.WALK, coordinates: walk2.coordinates
                });

                // 只有當真的有搭到車時才加入此路線
                if (fare > 0) {
                    routes.push({
                        id: `route_transit_${Date.now()}`, title: `🚇 捷運/輕軌優先轉乘方案`,
                        duration: totalTime.toString(), distance: '依實際路網', steps: steps, fare: fare,
                        hasHeatWarning: (walk1.duration + walk2.duration) > 20, coordinates: allCoords, type: 'mrt'
                    });
                }
            }
        }
    }

    // 方案二：公車路網方案
    if (selectedTransitTypes.has('bus')) {
        let busRoute = await getSafeOSRMRoute(originLat, originLon, destLat, destLon, 'driving');
        if (!busRoute && directDist < 15) busRoute = fallbackWalk(originLat, originLon, destLat, destLon); // Fallback for simulation
        
        if (busRoute) {
            const busTime = Math.ceil(busRoute.duration * 1.4) + 10; // 模擬等車與靠站
            routes.push({
                id: `route_bus_${Date.now()}`, title: `🚌 高雄公車一車直達`,
                duration: busTime.toString(), distance: busRoute.distance + ' km', fare: TRANSIT_INFO.bus.price,
                steps: [{
                    type: 'bus', duration: busTime, distance: busRoute.distance + ' km',
                    instruction: `搭乘市區公車直達目的地<br><small style="color:#666;">ℹ️ 班距：${TRANSIT_INFO.bus.headway}</small>`, 
                    color: ROUTE_COLORS.BUS, coordinates: busRoute.coordinates
                }], hasHeatWarning: false, coordinates: busRoute.coordinates, type: 'bus'
            });
        }
    }

    // 方案三：健康步行 (防呆：超過 2.5 公里就不建議純走路了，除非沒其他選擇)
    if (directDist < 2.5 || routes.length === 0) {
        let walkRoute = await getSafeOSRMRoute(originLat, originLon, destLat, destLon, 'foot');
        if (!walkRoute) walkRoute = fallbackWalk(originLat, originLon, destLat, destLon);
        
        routes.push({
            id: `route_walk_${Date.now()}`, title: `🚶 短距健康步行`,
            duration: walkRoute.duration.toString(), distance: walkRoute.distance + ' km', fare: 0,
            steps: [{
                type: 'walk', duration: walkRoute.duration, distance: walkRoute.distance + ' km',
                instruction: '純步行直達，請留意防曬與補水', color: ROUTE_COLORS.WALK, coordinates: walkRoute.coordinates
            }], hasHeatWarning: walkRoute.duration > 15, coordinates: walkRoute.coordinates, type: 'walk'
        });
    }

    // 排序：預設以大眾運輸優先，如果大眾運輸時間沒有誇張到步行的 2 倍，依然排前面
    return routes.sort((a, b) => {
        if (a.type !== 'walk' && b.type === 'walk' && a.duration < parseInt(b.duration) * 1.5) return -1;
        return parseInt(a.duration) - parseInt(b.duration);
    });
}

// ==================== Nominatim API 地名搜尋 ====================
async function searchNominatim(query) {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=120.1,22.4,120.5,23.1&bounded=1&limit=5&countrycodes=tw`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'KSHTravel/6.0' } });
        if (!res.ok) return [];
        const data = await res.json();
        return data.map(item => ({ name: item.name || item.display_name.split(',')[0], displayName: item.display_name, lat: parseFloat(item.lat), lon: parseFloat(item.lon) }));
    } catch (e) { return []; }
}

function showAutocompleteResults(results, locationType) {
    const dropdown = document.getElementById(locationType === 'origin' ? 'originDropdown' : 'destinationDropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';
    if (results.length === 0) { dropdown.classList.add('hidden'); return; }
    results.forEach(res => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.innerHTML = `<div class="autocomplete-item-main">📍 ${res.name}</div><div class="autocomplete-item-sub">${res.displayName}</div>`;
        div.onclick = () => {
            document.getElementById(locationType === 'origin' ? 'originInput' : 'destinationInput').value = res.name;
            dropdown.classList.add('hidden');
            if (locationType === 'origin') originCoords = { lat: res.lat, lon: res.lon }; else destinationCoords = { lat: res.lat, lon: res.lon };
        };
        dropdown.appendChild(div);
    });
    dropdown.classList.remove('hidden');
}

let autocompleteTimeout = null;
function handleAutocompleteInput(e) {
    const type = e.target.getAttribute('data-location-type');
    const query = e.target.value.trim();
    clearTimeout(autocompleteTimeout);
    if (query.length < 2) { document.getElementById(type === 'origin' ? 'originDropdown' : 'destinationDropdown').classList.add('hidden'); return; }
    autocompleteTimeout = setTimeout(async () => showAutocompleteResults(await searchNominatim(query), type), 300);
}

// ==================== UI 與地圖繪製 ====================
function clearMapLayers() {
    if (mapLayerGroup) mapLayerGroup.clearLayers();
    drawnPolylines = [];
}

function displayRoutes(routes) {
    const container = document.getElementById('routesContainer');
    if (!container) return;
    container.innerHTML = '';
    routes.forEach((route, index) => {
        const card = createRouteCard(route);
        container.appendChild(card);
        if (index === 0) { card.classList.add('active'); drawRoute(route); highlightRoute(route.id, true); }
    });
}

function createRouteCard(route) {
    const card = document.createElement('div');
    card.className = 'route-card';
    card.setAttribute('data-route-id', route.id);
    
    let stepsHtml = route.steps.map(s => {
        const icon = { 'walk': '🚶', 'mrt': '🚇', 'bus': '🚌', 'lightrail': '🚃', 'bike': '🚲' }[s.type] || '📍';
        return `<div class="route-step" style="margin-bottom:12px;cursor:pointer;line-height:1.4;">
            <span class="step-icon" style="color:${s.color};font-size:16px;">${icon}</span>
            <span class="step-instruction" style="margin-left:8px;"><strong style="color:${s.color}">${s.distance}</strong> - ${s.instruction}</span>
        </div>`;
    }).join('');

    // 新增豐富的外部連結面板
    let actionPanel = `
        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; display: flex; gap: 8px;">
            ${route.type === 'bus' ? `<a href="https://ibus.tbkc.gov.tw/ibus/route-list" target="_blank" style="flex:1;text-align:center;padding:6px;background:#9B59B6;color:white;text-decoration:none;border-radius:4px;font-size:12px;">🔗 公車動態查詢</a>` : ''}
            ${route.type === 'mrt' ? `<a href="https://www.krtc.com.tw/" target="_blank" style="flex:1;text-align:center;padding:6px;background:#005CAF;color:white;text-decoration:none;border-radius:4px;font-size:12px;">🔗 高捷時刻表</a>` : ''}
            <div style="flex:1;text-align:center;padding:6px;background:#f0f0f0;color:#333;border-radius:4px;font-size:12px;font-weight:bold;">💰 預估票價: NT$ ${route.fare}</div>
        </div>
    `;

    card.innerHTML = `
        <div class="route-card-header" style="cursor:pointer;">
            <div class="route-title" style="font-weight:bold;">${route.title}</div>
            <div class="route-meta">⏱️ ${route.duration}分 | 🛣️ ${route.distance}</div>
            ${route.hasHeatWarning ? '<div style="color:#E67E22;font-size:12px;margin-top:4px;">☀️ 警告：步行段較長，請注意防曬。</div>' : ''}
        </div>
        <div class="route-card-content"><div class="route-card-body">
            <div class="route-steps" style="border-left:2px dashed #ccc;padding-left:15px;margin-left:10px;">${stepsHtml}</div>
            ${route.type !== 'walk' ? actionPanel : ''}
        </div></div>
    `;
    
    card.querySelector('.route-card-header').onclick = () => {
        const isActive = card.classList.contains('active');
        document.querySelectorAll('.route-card').forEach(c => c.classList.remove('active'));
        if (!isActive) { card.classList.add('active'); drawRoute(route); highlightRoute(route.id, true); } else { clearMapLayers(); }
    };
    return card;
}

function drawRoute(route) {
    clearMapLayers();
    if (!route.coordinates || route.coordinates.length === 0) return;
    
    route.steps.forEach(step => {
        if (!step.coordinates || step.coordinates.length === 0) return;
        const options = { color: step.color, weight: 6, opacity: 0.8, smoothFactor: 1 };
        if (step.type === 'walk') { options.dashArray = '6, 8'; options.weight = 4; }
        const polyline = L.polyline(step.coordinates, options);
        mapLayerGroup.addLayer(polyline);
        drawnPolylines.push({ line: polyline, defaultColor: step.color });
    });
    
    L.circleMarker(route.coordinates[0], { radius: 8, fillColor: '#2ECC71', color: '#fff', weight: 2, fillOpacity: 0.9 }).bindPopup('起點').addTo(mapLayerGroup);
    L.circleMarker(route.coordinates[route.coordinates.length - 1], { radius: 8, fillColor: '#E74C3C', color: '#fff', weight: 2, fillOpacity: 0.9 }).bindPopup('終點').addTo(mapLayerGroup);
    if (map) map.fitBounds(L.latLngBounds(route.coordinates), { padding: [50, 50] });
}

function highlightRoute(routeId, isHighlight) {
    document.querySelectorAll('.route-card').forEach(card => {
        if (card.getAttribute('data-route-id') === routeId) {
            if (isHighlight) { card.style.borderLeft = '5px solid #005CAF'; drawnPolylines.forEach(p => p.line.setStyle({ weight: 9, opacity: 1 })); }
        } else { card.style.opacity = isHighlight ? '0.3' : '1'; }
    });
}

// ==================== Events & Initialization ====================
async function handleSearch() {
    document.getElementById('errorMessage').classList.add('hidden');
    if (!originCoords || !destinationCoords) { document.getElementById('errorMessage').textContent = '請點選下拉選單的精確地點'; document.getElementById('errorMessage').classList.remove('hidden'); return; }
    
    document.getElementById('loadingIndicator').classList.remove('hidden');
    try {
        clearMapLayers();
        const routes = await generateSmartRoute(originCoords.lat, originCoords.lon, destinationCoords.lat, destinationCoords.lon);
        if (routes.length === 0) throw new Error('No Route');
        displayRoutes(routes);
    } catch (e) { document.getElementById('errorMessage').textContent = '搜尋失敗'; document.getElementById('errorMessage').classList.remove('hidden'); }
    document.getElementById('loadingIndicator').classList.add('hidden');
}

function setupEventListeners() {
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.querySelectorAll('.location-input').forEach(input => input.addEventListener('input', handleAutocompleteInput));
    document.getElementById('swapLocationsBtn').addEventListener('click', () => {
        const temp = document.getElementById('originInput').value; document.getElementById('originInput').value = document.getElementById('destinationInput').value; document.getElementById('destinationInput').value = temp;
        const tc = originCoords; originCoords = destinationCoords; destinationCoords = tc;
    });
    document.querySelectorAll('.transit-filter-btn').forEach(btn => btn.addEventListener('click', (e) => {
        const b = e.target.closest('.transit-filter-btn'); b.classList.toggle('active');
        if (b.classList.contains('active')) selectedTransitTypes.add(b.getAttribute('data-transit')); else selectedTransitTypes.delete(b.getAttribute('data-transit'));
    }));
}

window.addEventListener('load', () => {
    if (map !== null) return;
    map = L.map('map').setView(KAOHSIUNG_CENTER, 13);
    mapLayerGroup = L.layerGroup().addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    setTimeout(() => map.invalidateSize(), 200);
    setupEventListeners();
});