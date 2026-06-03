// ==================== Configuration ====================
const OSRM_API = 'https://router.project-osrm.org/route/v1';

// ==================== Color Constants ====================
const ROUTE_COLORS = {
    MRT_RED: '#E60012',
    MRT_ORANGE: '#FFA500',
    LIGHTRAIL: '#009E52',
    WALK: '#2ECC71',
    BUS: '#9B59B6',
    BIKE: '#34495E'
};

// ==================== Kaohsiung Transit Network ====================
// 包含精準座標，防止路由拉回時亂飄
const TRANSIT_STATIONS = [
    { name: '左營', lat: 22.6879, lon: 120.3080, type: 'mrt', line: 'red' },
    { name: '巨蛋', lat: 22.6725, lon: 120.3017, type: 'mrt', line: 'red' },
    { name: '凹子底', lat: 22.6591, lon: 120.3025, type: 'mrt', line: 'red' },
    { name: '高雄車站', lat: 22.6387, lon: 120.3137, type: 'mrt', line: 'red' },
    { name: '美麗島', lat: 22.6353, lon: 120.3176, type: 'mrt', line: 'interchange', line2: 'orange' },
    { name: '中央公園', lat: 22.6289, lon: 120.3202, type: 'mrt', line: 'red' },
    { name: '三多商圈', lat: 22.6088, lon: 120.3256, type: 'mrt', line: 'red' },
    { name: '西子灣', lat: 22.6462, lon: 120.3512, type: 'mrt', line: 'orange' },
    { name: '衛武營', lat: 22.6259, lon: 120.3388, type: 'mrt', line: 'orange' },
    { name: '哈瑪星', lat: 22.6420, lon: 120.2760, type: 'lightrail', line: 'green' },
    { name: '駁二大義', lat: 22.6200, lon: 120.2850, type: 'lightrail', line: 'green' },
    { name: '真愛碼頭', lat: 22.6214, lon: 120.2933, type: 'lightrail', line: 'green' },
    { name: '光榮碼頭', lat: 22.6185, lon: 120.2974, type: 'lightrail', line: 'green' },
    { name: '愛河之心', lat: 22.6595, lon: 120.3028, type: 'lightrail', line: 'green' }
];

const KAOHSIUNG_CENTER = [22.6228, 120.3014];

// ==================== Global State ====================
let map = null;
let mapLayerGroup = null;
let currentRoutes = [];
let selectedRouteId = null;
let userLocation = null;
let selectedTransitTypes = new Set(['mrt', 'lightrail', 'bus', 'bike']);
let originCoords = null;
let destinationCoords = null;
let drawnPolylines = [];

// ==================== Utility Functions ====================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function findNearestStation(lat, lon, allowedTypes) {
    let nearest = null;
    let minDist = Infinity;
    for (let i = 0; i < TRANSIT_STATIONS.length; i++) {
        const station = TRANSIT_STATIONS[i];
        if (!allowedTypes.includes(station.type)) continue;
        const dist = calculateDistance(lat, lon, station.lat, station.lon);
        if (dist < minDist) { minDist = dist; nearest = station; }
    }
    return nearest ? { station: nearest, distance: minDist } : null;
}

// ==================== OSRM 安全性呼叫 API ====================
async function getOSRMRoute(startLat, startLon, endLat, endLon, profile = 'foot') {
    try {
        // 安全機制：如果是走路，強制用 foot 模式，OSRM 就絕對不可能走上高速道路
        const url = `${OSRM_API}/${profile}/${startLon},${startLat};${endLon},${endLat}?steps=true&overview=full&geometries=geojson`;
        const response = await fetch(url);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.routes || data.routes.length === 0) return null;
        
        const route = data.routes[0];
        return {
            coordinates: route.geometry.coordinates.map(c => [c[1], c[0]]),
            distance: (route.distance / 1000).toFixed(2),
            duration: Math.ceil(route.duration / 60)
        };
    } catch (error) {
        console.error('OSRM API Error:', error);
        return null;
    }
}

// ==================== 升級版智慧多線路路由引擎 ====================
async function generateSmartRoute(originLat, originLon, destLat, destLon) {
    const routes = [];
    const hasTrack = selectedTransitTypes.has('mrt') || selectedTransitTypes.has('lightrail');

    // ------------------ 方案一：軌道運輸最佳組合 (捷運 + 安全人行/接駁) ------------------
    if (hasTrack) {
        const allowedTypes = [];
        if (selectedTransitTypes.has('mrt')) allowedTypes.push('mrt');
        if (selectedTransitTypes.has('lightrail')) allowedTypes.push('lightrail');

        const originNearest = findNearestStation(originLat, originLon, allowedTypes);
        const destNearest = findNearestStation(destLat, destLon, allowedTypes);

        if (originNearest && destNearest) {
            const startStn = originNearest.station;
            const endStn = destNearest.station;
            
            let steps = [];
            let totalTime = 0;
            let totalDistance = 0;
            let allCoords = [];

            // Step 1: 起點 ➔ 車站 (強制使用 foot 安全走路路網，避開高架公路)
            const walk1 = await getOSRMRoute(originLat, originLon, startStn.lat, startStn.lon, 'foot');
            if (walk1) {
                totalTime += walk1.duration;
                totalDistance += parseFloat(walk1.distance);
                allCoords = allCoords.concat(walk1.coordinates);
                steps.push({
                    type: 'walk', duration: walk1.duration, distance: walk1.distance + ' km',
                    instruction: `從起點沿人行道安全步行至【${startStn.name}站】`, color: ROUTE_COLORS.WALK, coordinates: walk1.coordinates
                });
            }

            // Step 2: 車站 ➔ 車站 (軌道線路模擬)
            let midTransitCoords = [];
            let transitInstruction = '';
            let transitColor = ROUTE_COLORS.MRT_RED;
            let transitTimeCalculated = 4; // 基礎等車時間

            // 美麗島紅橘轉乘
            if (startStn.type === 'mrt' && endStn.type === 'mrt' && startStn.line !== endStn.line && startStn.line !== 'interchange' && endStn.line !== 'interchange') {
                const interchangeStn = TRANSIT_STATIONS.find(s => s.name === '美麗島');
                const r1 = await getOSRMRoute(startStn.lat, startStn.lon, interchangeStn.lat, interchangeStn.lon, 'driving');
                const r2 = await getOSRMRoute(interchangeStn.lat, interchangeStn.lon, endStn.lat, endStn.lon, 'driving');
                if (r1 && r2) {
                    midTransitCoords = r1.coordinates.concat(r2.coordinates);
                    transitTimeCalculated += (r1.duration + r2.duration + 4);
                    transitInstruction = `搭乘捷運至【美麗島站】站內轉乘，再搭至【${endStn.name}站】`;
                    transitColor = startStn.line === 'red' ? ROUTE_COLORS.MRT_RED : ROUTE_COLORS.MRT_ORANGE;
                }
            } 
            // 凹子底捷運轉輕軌
            else if (startStn.type === 'mrt' && endStn.type === 'lightrail') {
                const transferStn = TRANSIT_STATIONS.find(s => s.name === '凹子底');
                const r1 = await getOSRMRoute(startStn.lat, startStn.lon, transferStn.lat, transferStn.lon, 'driving');
                const r2 = await getOSRMRoute(transferStn.lat, transferStn.lon, endStn.lat, endStn.lon, 'foot');
                if (r1 && r2) {
                    midTransitCoords = r1.coordinates.concat(r2.coordinates);
                    transitTimeCalculated += (r1.duration + r2.duration + 5);
                    transitInstruction = `搭乘捷運紅線至【凹子底站】，出站前往【愛河之心站】轉乘輕軌至【${endStn.name}站】`;
                    transitColor = ROUTE_COLORS.LIGHTRAIL;
                }
            }
            // 直達線
            else {
                const r = await getOSRMRoute(startStn.lat, startStn.lon, endStn.lat, endStn.lon, startStn.type === 'mrt' ? 'driving' : 'foot');
                if (r) {
                    midTransitCoords = r.coordinates;
                    transitTimeCalculated += r.duration;
                    const lineLabel = startStn.type === 'mrt' ? `捷運${startStn.line === 'red' ? '紅線' : '橘線'}` : '環狀輕軌';
                    transitInstruction = `搭乘${lineLabel}由【${startStn.name}站】直達【${endStn.name}站】`;
                    transitColor = startStn.line === 'red' ? ROUTE_COLORS.MRT_RED : startStn.line === 'orange' ? ROUTE_COLORS.MRT_ORANGE : ROUTE_COLORS.LIGHTRAIL;
                }
            }

            if (midTransitCoords.length > 0) {
                totalTime += transitTimeCalculated;
                allCoords = allCoords.concat(midTransitCoords);
                steps.push({
                    type: startStn.type, duration: transitTimeCalculated, distance: '市區軌道路網',
                    instruction: transitInstruction, color: transitColor, coordinates: midTransitCoords
                });
            }

            // Step 3: 車站 ➔ 目的地 (智慧判斷：如果距離過遠，不逼使用者走路，建議搭配公車或接駁)
            const walk2 = await getOSRMRoute(endStn.lat, endStn.lon, destLat, destLon, 'foot'); // 再次強制安全步行
            if (walk2) {
                totalTime += walk2.duration;
                totalDistance += parseFloat(walk2.distance);
                allCoords = allCoords.concat(walk2.coordinates);
                
                // 如果出站後還要走超過 0.5 公里，在說明文字上提供警告與公車轉乘建議
                const displayInstruction = parseFloat(walk2.distance) > 0.5 ? 
                    `從【${endStn.name}站】步行至目的地 (距離較遠，亦可在站外轉乘公車或騎乘 YouBike 銜接)` : 
                    `從【${endStn.name}站】安全步行至目的地`;

                steps.push({
                    type: 'walk', duration: walk2.duration, distance: walk2.distance + ' km',
                    instruction: displayInstruction, color: ROUTE_COLORS.WALK, coordinates: walk2.coordinates
                });
            }

            routes.push({
                id: `route_transit_${Date.now()}`,
                title: `🚇 大眾捷運/輕軌最佳複合方案`,
                duration: totalTime.toString(),
                departureTime: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                arrivalTime: new Date(Date.now() + totalTime * 60000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                distance: totalDistance.toFixed(2) + ' km',
                steps: steps,
                hasHeatWarning: (walk2 && parseFloat(walk2.distance) > 0.5),
                coordinates: allCoords
            });
        }
    }

    // ------------------ 方案二：公車路網方案 (走一般市區道路面) ------------------
    if (selectedTransitTypes.has('bus')) {
        const busRoute = await getOSRMRoute(originLat, originLon, destLat, destLon, 'driving'); // 模擬市區道路平面
        if (busRoute) {
            const busTime = Math.ceil(busRoute.duration * 1.2) + 6; // 估算市區停靠時間
            routes.push({
                id: `route_bus_${Date.now()}`,
                title: `🚌 高雄市區公車直達方案`,
                duration: busTime.toString(),
                departureTime: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                arrivalTime: new Date(Date.now() + busTime * 60000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                distance: busRoute.distance + ' km',
                steps: [{
                    type: 'bus', duration: busTime, distance: busRoute.distance + ' km',
                    instruction: '前往臨近公車站，搭乘高市公車走一般平面道路直達目的地', color: ROUTE_COLORS.BUS, coordinates: busRoute.coordinates
                }],
                hasHeatWarning: false,
                coordinates: busRoute.coordinates
            });
        }
    }

    // ------------------ 方案三：YouBike 2.0 方案 (走自行車道/安全平面) ------------------
    if (selectedTransitTypes.has('bike')) {
        const bikeRoute = await getOSRMRoute(originLat, originLon, destLat, destLon, 'bike');
        if (bikeRoute) {
            routes.push({
                id: `route_bike_${Date.now()}`,
                title: `🚲 YouBike 2.0 平面綠廊方案`,
                duration: bikeRoute.duration.toString(),
                departureTime: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                arrivalTime: new Date(Date.now() + bikeRoute.duration * 60000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                distance: bikeRoute.distance + ' km',
                steps: [{
                    type: 'bike', duration: bikeRoute.duration, distance: bikeRoute.distance + ' km',
                    instruction: '租借 YouBike 2.0，沿平面市區道路與自行車綠廊騎行，避開高速公路區', color: ROUTE_COLORS.BIKE, coordinates: bikeRoute.coordinates
                }],
                hasHeatWarning: parseFloat(bikeRoute.distance) > 2.0,
                coordinates: bikeRoute.coordinates
            });
        }
    }

    return routes.sort((a, b) => parseInt(a.duration) - parseInt(b.duration));
}

// ==================== 以下為其餘功能模組，保持完美對應 ====================
async function searchNominatim(query) {
    try {
        const encodedQuery = encodeURIComponent(query);
        const viewbox = '120.1,22.4,120.5,23.1';
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&viewbox=${viewbox}&bounded=1&limit=5&countrycodes=tw`;
        const response = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'KaohsiungTransitApp/4.0' } });
        if (!response.ok) return [];
        const results = await response.json();
        return results.map(item => ({
            name: item.name || item.display_name.split(',')[0],
            displayName: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon)
        }));
    } catch (error) { return []; }
}

function showAutocompleteResults(results, locationType) {
    const dropdownId = locationType === 'origin' ? 'originDropdown' : 'destinationDropdown';
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    dropdown.innerHTML = '';
    if (results.length === 0) { dropdown.classList.add('hidden'); return; }
    results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `<div class="autocomplete-item-main">📍 ${result.name}</div><div class="autocomplete-item-sub">${result.displayName}</div>`;
        item.addEventListener('click', () => selectAutocompleteItem(result, locationType));
        dropdown.appendChild(item);
    });
    dropdown.classList.remove('hidden');
}

function selectAutocompleteItem(result, locationType) {
    const inputId = locationType === 'origin' ? 'originInput' : 'destinationInput';
    const dropdownId = locationType === 'origin' ? 'originDropdown' : 'destinationDropdown';
    document.getElementById(inputId).value = result.name;
    document.getElementById(dropdownId).classList.add('hidden');
    if (locationType === 'origin') { originCoords = { lat: result.lat, lon: result.lon }; } else { destinationCoords = { lat: result.lat, lon: result.lon }; }
}

let autocompleteTimeout = null;
function handleAutocompleteInput(e) {
    const locationType = e.target.getAttribute('data-location-type');
    const query = e.target.value.trim();
    clearTimeout(autocompleteTimeout);
    if (query.length < 2) {
        const dropdown = document.getElementById(locationType === 'origin' ? 'originDropdown' : 'destinationDropdown');
        if (dropdown) dropdown.classList.add('hidden');
        return;
    }
    autocompleteTimeout = setTimeout(async () => {
        const results = await searchNominatim(query);
        showAutocompleteResults(results, locationType);
    }, 300);
}

function showLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    const searchBtn = document.getElementById('searchBtn');
    if (indicator) indicator.classList.remove('hidden');
    if (searchBtn) searchBtn.disabled = true;
}

// 修正：補上之前漏掉的隱藏 Loading Indicator 函數
function hideLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    const searchBtn = document.getElementById('searchBtn');
    if (indicator) indicator.classList.add('hidden');
    if (searchBtn) searchBtn.disabled = false;
}

function showErrorMessage(message) {
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
        setTimeout(() => errorEl.classList.add('hidden'), 5000);
    }
}

function hideErrorMessage() {
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) errorEl.classList.add('hidden');
}

function clearMapLayers() {
    if (mapLayerGroup) mapLayerGroup.clearLayers();
    drawnPolylines = [];
}

function displayRoutes(routes) {
    const container = document.getElementById('routesContainer');
    if (!container) return;
    container.innerHTML = '';
    currentRoutes = routes;
    
    routes.forEach((route, index) => {
        const card = createRouteCard(route);
        container.appendChild(card);
        if (index === 0) {
            card.classList.add('active');
            selectedRouteId = route.id;
            drawRoute(route);
        }
    });
}

function createRouteCard(route) {
    const card = document.createElement('div');
    card.className = 'route-card';
    card.setAttribute('data-route-id', route.id);
    
    const header = document.createElement('div');
    header.className = 'route-card-header';
    
    const summary = document.createElement('div');
    summary.className = 'route-summary';
    
    const title = document.createElement('div');
    title.className = 'route-title';
    title.style.fontWeight = 'bold';
    title.textContent = route.title;
    
    const meta = document.createElement('div');
    meta.className = 'route-meta';
    
    const timeBadge = document.createElement('div');
    timeBadge.className = 'route-time-badge';
    timeBadge.style.backgroundColor = '#005CAF';
    timeBadge.style.color = '#fff';
    timeBadge.style.padding = '2px 6px';
    timeBadge.style.borderRadius = '4px';
    timeBadge.textContent = `⏱️ ${route.duration}分`;
    
    const distanceBadge = document.createElement('div');
    distanceBadge.className = 'route-distance-badge';
    distanceBadge.textContent = `🛣️ ${route.distance}`;
    
    const transitIcons = document.createElement('div');
    transitIcons.className = 'route-transit-icons';
    route.steps.forEach(step => {
        const icons = { 'walk': '🚶', 'mrt': '🚇', 'bus': '🚌', 'lightrail': '🚃', 'bike': '🚲' };
        transitIcons.textContent += ' ' + (icons[step.type] || '📍');
    });
    
    meta.appendChild(timeBadge);
    meta.appendChild(distanceBadge);
    meta.appendChild(transitIcons);
    summary.appendChild(title);
    summary.appendChild(meta);
    header.appendChild(summary);
    
    if (route.hasHeatWarning) {
        const warning = document.createElement('div');
        warning.className = 'route-warning-inline';
        warning.style.color = '#E67E22';
        warning.style.fontSize = '12px';
        warning.style.marginTop = '4px';
        warning.innerHTML = `⚠️ 轉乘提示：出站後步行距離較長，可考慮轉公車或騎車接駁。`;
        header.appendChild(warning);
    }
    
    const content = document.createElement('div');
    content.className = 'route-card-content';
    const body = document.createElement('div');
    body.className = 'route-card-body';
    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'route-steps';
    stepsContainer.style.borderLeft = '2px dashed #ccc';
    stepsContainer.style.marginLeft = '10px';
    stepsContainer.style.paddingLeft = '15px';
    
    route.steps.forEach((step) => {
        const stepEl = document.createElement('div');
        stepEl.className = 'route-step';
        stepEl.style.cursor = 'pointer';
        stepEl.style.marginBottom = '12px';
        const icon = { 'walk': '🚶', 'mrt': '🚇', 'bus': '🚌', 'lightrail': '🚃', 'bike': '🚲' }[step.type] || '📍';
        stepEl.innerHTML = `
            <span class="step-icon" style="color: ${step.color}; font-size: 16px;">${icon}</span>
            <span class="step-instruction" style="margin-left: 8px;">
                <strong style="color: ${step.color}">${step.distance}</strong> - ${step.instruction}
            </span>
        `;
        stepEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (step.coordinates && step.coordinates.length > 0) { map.flyTo(step.coordinates[0], 16, { duration: 1 }); }
        });
        stepsContainer.appendChild(stepEl);
    });
    
    body.appendChild(stepsContainer);
    content.appendChild(body);
    card.appendChild(header);
    card.appendChild(content);
    
    header.addEventListener('click', () => toggleCardExpansion(card, route));
    card.addEventListener('mouseenter', () => highlightRoute(route.id, true));
    card.addEventListener('mouseleave', () => highlightRoute(route.id, false));
    return card;
}

function toggleCardExpansion(card, route) {
    const isActive = card.classList.contains('active');
    document.querySelectorAll('.route-card').forEach(c => c.classList.remove('active'));
    if (!isActive) {
        card.classList.add('active');
        selectedRouteId = route.id;
        drawRoute(route);
        highlightRoute(route.id, true);
    } else {
        selectedRouteId = null;
        clearMapLayers();
    }
}

function drawRoute(route) {
    clearMapLayers();
    if (!route.coordinates || route.coordinates.length === 0) return;
    
    route.steps.forEach(step => {
        if (!step.coordinates || step.coordinates.length === 0) return;
        const polylineOptions = { color: step.color, weight: 6, opacity: 0.8, smoothFactor: 1 };
        if (step.type === 'walk') { polylineOptions.dashArray = '6, 8'; polylineOptions.weight = 4; }
        const polyline = L.polyline(step.coordinates, polylineOptions);
        mapLayerGroup.addLayer(polyline);
        drawnPolylines.push({ line: polyline, defaultColor: step.color });
    });
    
    L.circleMarker(route.coordinates[0], { radius: 8, fillColor: '#2ECC71', color: '#fff', weight: 2, fillOpacity: 0.9 }).bindPopup('📍 起點').addTo(mapLayerGroup);
    L.circleMarker(route.coordinates[route.coordinates.length - 1], { radius: 8, fillColor: '#E74C3C', color: '#fff', weight: 2, fillOpacity: 0.9 }).bindPopup('🏁 終點').addTo(mapLayerGroup);
    
    if (map) { const bounds = L.latLngBounds(route.coordinates); map.fitBounds(bounds, { padding: [50, 50] }); }
}

function highlightRoute(routeId, isHighlight) {
    const cards = document.querySelectorAll('.route-card');
    cards.forEach(card => {
        if (card.getAttribute('data-route-id') === routeId) {
            if (isHighlight) {
                card.style.boxShadow = '0 8px 24px rgba(0, 92, 175, 0.4)';
                card.style.borderLeft = '5px solid #005CAF';
                drawnPolylines.forEach(p => p.line.setStyle({ weight: 9, opacity: 1 }));
            } else {
                card.style.boxShadow = 'none';
                card.style.borderLeft = 'none';
                drawnPolylines.forEach(p => p.line.setStyle({ weight: 6, opacity: 0.8 }));
            }
        } else if (isHighlight) { card.style.opacity = '0.3'; } else { card.style.opacity = '1'; }
    });
}

function handleSwapLocations() {
    const origin = document.getElementById('originInput');
    const destination = document.getElementById('destinationInput');
    const temp = origin.value; origin.value = destination.value; destination.value = temp;
    const tempCoords = originCoords; originCoords = destinationCoords; destinationCoords = tempCoords;
}

async function handleSearch() {
    hideErrorMessage();
    const origin = document.getElementById('originInput').value.trim();
    const destination = document.getElementById('destinationInput').value.trim();
    if (!origin || !destination) { showErrorMessage('請輸入起點和終點地名'); return; }
    if (!originCoords || !destinationCoords) { showErrorMessage('請點選下拉選單提供的精確地點，以便定位座標'); return; }
    if (selectedTransitTypes.size === 0) { showErrorMessage('請至少勾選一種交通工具進行篩選'); return; }
    
    showLoadingIndicator();
    try {
        clearMapLayers();
        const routes = await generateSmartRoute(originCoords.lat, originCoords.lon, destinationCoords.lat, destinationCoords.lon);
        if (routes.length === 0) { showErrorMessage('無法建立有效路線，請更改篩選標籤'); } else { displayRoutes(routes); }
    } catch (error) { showErrorMessage('搜尋失敗，請確認網路連線或稍後重試'); } finally { hideLoadingIndicator(); }
}

function handleTransitFilterChange(e) {
    const btn = e.target.closest('.transit-filter-btn') || e.target;
    const transitType = btn.getAttribute('data-transit');
    btn.classList.toggle('active');
    if (btn.classList.contains('active')) { selectedTransitTypes.add(transitType); } else { selectedTransitTypes.delete(transitType); }
}

function handleUseCurrentLocation() {
    if (userLocation) {
        document.getElementById('originInput').value = `我的目前位置`;
        originCoords = { lat: userLocation.lat, lon: userLocation.lng };
        const drop = document.getElementById('originDropdown'); if (drop) drop.classList.add('hidden');
    } else { showErrorMessage('無法取得定位，請確認瀏覽器是否開啟 GPS 授權'); }
}

function setupEventListeners() {
    document.getElementById('swapLocationsBtn').addEventListener('click', handleSwapLocations);
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.getElementById('useCurrentLocationBtn').addEventListener('click', handleUseCurrentLocation);
    document.querySelectorAll('.transit-filter-btn').forEach(btn => btn.addEventListener('click', handleTransitFilterChange));
    document.querySelectorAll('.location-input').forEach(input => input.addEventListener('input', handleAutocompleteInput));
    document.getElementById('originInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
    document.getElementById('destinationInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('location-input')) {
            const originDrop = document.getElementById('originDropdown'); const destDrop = document.getElementById('destinationDropdown');
            if (originDrop) originDrop.classList.add('hidden'); if (destDrop) destDrop.classList.add('hidden');
        }
    });
}

function initializeMap() {
    if (map !== null) return;
    map = L.map('map').setView(KAOHSIUNG_CENTER, 13);
    mapLayerGroup = L.layerGroup().addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
    setTimeout(() => { if (map) map.invalidateSize(); }, 200);
    map.locate({ setView: false, maxZoom: 16 });
    map.on('locationfound', (e) => {
        userLocation = e.latlng;
        L.circleMarker(e.latlng, { radius: 6, fillColor: '#005CAF', color: '#fff', weight: 2, fillOpacity: 0.9 }).bindPopup('📍 您目前所在的概略位置').addTo(map);
    });
}

function handleResponsive() {
    const controlPanel = document.getElementById('controlPanel');
    if (controlPanel) { if (window.innerWidth <= 768) { controlPanel.classList.add('collapsed'); } else { controlPanel.classList.remove('collapsed'); } }
}

window.addEventListener('resize', handleResponsive);
window.addEventListener('load', () => { initializeMap(); setupEventListeners(); handleResponsive(); });