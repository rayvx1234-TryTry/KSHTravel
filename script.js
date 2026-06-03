// ==================== Configuration ====================
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
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

// ==================== Kaohsiung Transit Stations ====================
const TRANSIT_STATIONS = [
    { name: '左營', lat: 22.6859, lon: 120.3048, type: 'mrt', line: 'red' },
    { name: '高雄車站', lat: 22.6387, lon: 120.3137, type: 'mrt', line: 'red' },
    { name: '美麗島', lat: 22.6353, lon: 120.3176, type: 'mrt', line: 'red' },
    { name: '中央公園', lat: 22.6289, lon: 120.3202, type: 'mrt', line: 'red' },
    { name: '三多商圈', lat: 22.6088, lon: 120.3256, type: 'mrt', line: 'red' },
    { name: '西子灣', lat: 22.6462, lon: 120.3512, type: 'mrt', line: 'orange' },
    { name: '衛武營', lat: 22.5559, lon: 120.3388, type: 'mrt', line: 'orange' },
    { name: '巨蛋', lat: 22.6725, lon: 120.3017, type: 'mrt', line: 'red' },
    { name: '凹子底', lat: 22.7170, lon: 120.2905, type: 'mrt', line: 'red' },
    { name: '哈瑪星', lat: 22.6548, lon: 120.3640, type: 'lightrail', line: 'green' },
    { name: '真愛碼頭', lat: 22.6405, lon: 120.3676, type: 'lightrail', line: 'green' },
    { name: '駁二藝術特區', lat: 22.6397, lon: 120.3618, type: 'lightrail', line: 'green' },
    { name: '光榮碼頭', lat: 22.6363, lon: 120.3560, type: 'lightrail', line: 'green' },
    { name: '英國領事館', lat: 22.6428, lon: 120.3456, type: 'lightrail', line: 'green' }
];

const KAOHSIUNG_CENTER = [22.6228, 120.3014];

// ==================== Global State ====================
let map = null;
let mapLayerGroup = null;
let currentRoutes = [];
let selectedRouteId = null;
let userLocation = null;
let selectedTransitTypes = new Set(['mrt', 'lightrail', 'bus', 'bike']);
let isLoading = false;
let originCoords = null;
let destinationCoords = null;

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

function findNearestStation(lat, lon) {
    let nearest = TRANSIT_STATIONS[0];
    let minDist = calculateDistance(lat, lon, nearest.lat, nearest.lon);
    
    for (let i = 1; i < TRANSIT_STATIONS.length; i++) {
        const station = TRANSIT_STATIONS[i];
        const dist = calculateDistance(lat, lon, station.lat, station.lon);
        if (dist < minDist) {
            minDist = dist;
            nearest = station;
        }
    }
    
    return { station: nearest, distance: minDist };
}

// ==================== OSRM API Functions ====================
async function getOSRMRoute(startLat, startLon, endLat, endLon, profile = 'foot') {
    try {
        const url = `${OSRM_API}/${profile}/${startLon},${startLat};${endLon},${endLat}?steps=true&overview=full&geometries=geojson`;
        const response = await fetch(url);
        
        if (!response.ok) {
            console.error('OSRM API error:', response.status);
            return null;
        }
        
        const data = await response.json();
        if (!data.routes || data.routes.length === 0) {
            return null;
        }
        
        const route = data.routes[0];
        const coordinates = route.geometry.coordinates.map(c => [c[1], c[0]]);
        
        return {
            coordinates: coordinates,
            distance: (route.distance / 1000).toFixed(2),
            duration: Math.ceil(route.duration / 60),
            profile: profile
        };
    } catch (error) {
        console.error('OSRM fetch error:', error);
        return null;
    }
}

// ==================== Route Generation with Transit Filter ====================
async function generateSmartRoute(originLat, originLon, destLat, destLon) {
    const routes = [];
    const transitOptions = Array.from(selectedTransitTypes);
    
    // Option 1: 如果選擇了捷運或輕軌
    if (selectedTransitTypes.has('mrt') || selectedTransitTypes.has('lightrail')) {
        const originNearest = findNearestStation(originLat, originLon);
        const destNearest = findNearestStation(destLat, destLon);
        
        const originStation = originNearest.station;
        const destStation = destNearest.station;
        const originWalkDist = originNearest.distance;
        const destWalkDist = destNearest.distance;
        
        // 檢查是否應該包含這個路線
        if ((originStation.type === 'mrt' && selectedTransitTypes.has('mrt')) ||
            (originStation.type === 'lightrail' && selectedTransitTypes.has('lightrail'))) {
            
            const steps = [];
            let totalTime = 0;
            let routeCoordinates = [];
            
            // 第一段：OSRM 走路
            if (originWalkDist > 0.02) {
                const walkRoute = await getOSRMRoute(originLat, originLon, originStation.lat, originStation.lon, 'foot');
                if (walkRoute) {
                    routeCoordinates = routeCoordinates.concat(walkRoute.coordinates);
                    totalTime += walkRoute.duration;
                    steps.push({
                        type: 'walk',
                        duration: walkRoute.duration,
                        distance: walkRoute.distance + 'km',
                        instruction: `步行至${originStation.name}站`,
                        startCoords: [originLat, originLon],
                        endCoords: [originStation.lat, originStation.lon],
                        color: ROUTE_COLORS.WALK
                    });
                }
            } else {
                routeCoordinates.push([originLat, originLon]);
            }
            
            // 第二段：捷運/輕軌
            const transitDist = calculateDistance(originStation.lat, originStation.lon, destStation.lat, destStation.lon);
            const transitTime = Math.ceil(transitDist / 0.3);
            totalTime += transitTime;
            
            const lineColor = originStation.line === 'red' ? ROUTE_COLORS.MRT_RED : 
                             originStation.line === 'orange' ? ROUTE_COLORS.MRT_ORANGE : ROUTE_COLORS.LIGHTRAIL;
            const lineLabel = originStation.line === 'red' ? '紅線' : 
                             originStation.line === 'orange' ? '橘線' : '輕軌';
            
            // 簡化捷運路線（直線連接）
            routeCoordinates.push([originStation.lat, originStation.lon]);
            routeCoordinates.push([destStation.lat, destStation.lon]);
            
            steps.push({
                type: originStation.type,
                line: originStation.line,
                duration: transitTime,
                distance: transitDist.toFixed(2) + 'km',
                instruction: `搭乘${lineLabel}由${originStation.name}至${destStation.name}`,
                startCoords: [originStation.lat, originStation.lon],
                endCoords: [destStation.lat, destStation.lon],
                color: lineColor
            });
            
            // 第三段：OSRM 走路
            if (destWalkDist > 0.02) {
                const walkRoute2 = await getOSRMRoute(destStation.lat, destStation.lon, destLat, destLon, 'foot');
                if (walkRoute2) {
                    routeCoordinates = routeCoordinates.concat(walkRoute2.coordinates);
                    totalTime += walkRoute2.duration;
                    steps.push({
                        type: 'walk',
                        duration: walkRoute2.duration,
                        distance: walkRoute2.distance + 'km',
                        instruction: `步行至目的地`,
                        startCoords: [destStation.lat, destStation.lon],
                        endCoords: [destLat, destLon],
                        color: ROUTE_COLORS.WALK
                    });
                }
            } else {
                routeCoordinates.push([destLat, destLon]);
            }
            
            routes.push({
                id: `route_${Date.now()}_transit`,
                type: 'transit',
                duration: totalTime.toString(),
                departureTime: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                arrivalTime: new Date(Date.now() + totalTime * 60000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                distance: (originWalkDist + transitDist + destWalkDist).toFixed(2) + 'km',
                steps: steps,
                hasHeatWarning: originWalkDist > 0.5 || destWalkDist > 0.5,
                coordinates: routeCoordinates,
                expanded: false
            });
        }
    }
    
    // Option 2: 如果只選擇公車或 YouBike，使用 OSRM 街道網絡
    if (!selectedTransitTypes.has('mrt') && !selectedTransitTypes.has('lightrail')) {
        const route = await getOSRMRoute(originLat, originLon, destLat, destLon, 'foot');
        
        if (route) {
            const transitType = selectedTransitTypes.has('bus') ? 'bus' : selectedTransitTypes.has('bike') ? 'bike' : 'walk';
            const color = transitType === 'bus' ? ROUTE_COLORS.BUS : transitType === 'bike' ? ROUTE_COLORS.BIKE : ROUTE_COLORS.WALK;
            const icon = transitType === 'bus' ? '🚌' : transitType === 'bike' ? '🚲' : '🚶';
            
            routes.push({
                id: `route_${Date.now()}_street`,
                type: 'street',
                duration: route.duration.toString(),
                departureTime: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                arrivalTime: new Date(Date.now() + route.duration * 60000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
                distance: route.distance + 'km',
                steps: [{
                    type: transitType,
                    duration: route.duration,
                    distance: route.distance + 'km',
                    instruction: `${icon}取道真實街道網絡前往目的地`,
                    startCoords: [originLat, originLon],
                    endCoords: [destLat, destLon],
                    color: color
                }],
                hasHeatWarning: false,
                coordinates: route.coordinates,
                expanded: false
            });
        }
    }
    
    return routes;
}

// ==================== Nominatim API ====================
async function searchNominatim(query) {
    try {
        const encodedQuery = encodeURIComponent(query);
        const viewbox = '120.1,22.4,120.5,23.1';
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedQuery}&viewbox=${viewbox}&bounded=1&limit=5&countrycodes=tw`;
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'KaohsiungTransitApp/1.0'
            }
        });
        
        if (!response.ok) return [];
        
        const results = await response.json();
        return results.map(item => ({
            name: item.name || item.display_name.split(',')[0],
            displayName: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon)
        }));
    } catch (error) {
        console.error('Nominatim error:', error);
        return [];
    }
}

// ==================== Autocomplete UI ====================
function showAutocompleteResults(results, locationType) {
    const dropdownId = locationType === 'origin' ? 'originDropdown' : 'destinationDropdown';
    const dropdown = document.getElementById(dropdownId);
    
    dropdown.innerHTML = '';
    if (results.length === 0) {
        dropdown.classList.add('hidden');
        return;
    }
    
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
    
    if (locationType === 'origin') {
        originCoords = { lat: result.lat, lon: result.lon };
    } else {
        destinationCoords = { lat: result.lat, lon: result.lon };
    }
}

function handleAutocompleteInput(e) {
    const locationType = e.target.getAttribute('data-location-type');
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        const dropdownId = locationType === 'origin' ? 'originDropdown' : 'destinationDropdown';
        document.getElementById(dropdownId).classList.add('hidden');
        return;
    }
    
    (async () => {
        const results = await searchNominatim(query);
        showAutocompleteResults(results, locationType);
    })();
}

// ==================== UI State Functions ====================
function showLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    const searchBtn = document.getElementById('searchBtn');
    indicator?.classList.remove('hidden');
    searchBtn.disabled = true;
}

function hideLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    const searchBtn = document.getElementById('searchBtn');
    indicator?.classList.add('hidden');
    searchBtn.disabled = false;
}

function showErrorMessage(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
    setTimeout(() => errorEl.classList.add('hidden'), 5000);
}

function hideErrorMessage() {
    document.getElementById('errorMessage').classList.add('hidden');
}

// ==================== Map Management ====================
function clearMapLayers() {
    if (mapLayerGroup) {
        mapLayerGroup.clearLayers();
    }
}

// ==================== Route Display ====================
function displayRoutes(routes) {
    const container = document.getElementById('routesContainer');
    container.innerHTML = '';
    currentRoutes = routes;
    
    routes.forEach(route => {
        const card = createRouteCard(route);
        container.appendChild(card);
    });
    
    if (map && routes.length > 0) {
        const bounds = L.latLngBounds(routes[0].coordinates.map(c => [c[0], c[1]]));
        map.fitBounds(bounds, { padding: [100, 100] });
    }
}

function createRouteCard(route) {
    const card = document.createElement('div');
    card.className = 'route-card';
    card.setAttribute('data-route-id', route.id);
    
    // Header (Summary)
    const header = document.createElement('div');
    header.className = 'route-card-header';
    
    const summary = document.createElement('div');
    summary.className = 'route-summary';
    
    const title = document.createElement('div');
    title.className = 'route-title';
    title.textContent = `${route.departureTime} → ${route.arrivalTime}`;
    
    const meta = document.createElement('div');
    meta.className = 'route-meta';
    
    const timeBadge = document.createElement('div');
    timeBadge.className = 'route-time-badge';
    timeBadge.textContent = `⏱️ ${route.duration}分`;
    
    const distanceBadge = document.createElement('div');
    distanceBadge.className = 'route-distance-badge';
    distanceBadge.textContent = route.distance;
    
    const transitIcons = document.createElement('div');
    transitIcons.className = 'route-transit-icons';
    route.steps.forEach(step => {
        const icons = { 'walk': '🚶', 'mrt': '🚇', 'bus': '🚌', 'lightrail': '🚃', 'bike': '🚲' };
        transitIcons.textContent += icons[step.type] || '📍';
    });
    
    meta.appendChild(timeBadge);
    meta.appendChild(distanceBadge);
    meta.appendChild(transitIcons);
    
    const toggleIcon = document.createElement('div');
    toggleIcon.className = 'route-toggle-icon';
    toggleIcon.textContent = '▼';
    
    summary.appendChild(title);
    summary.appendChild(meta);
    header.appendChild(summary);
    header.appendChild(toggleIcon);
    
    if (route.hasHeatWarning) {
        const warning = document.createElement('div');
        warning.className = 'route-warning-inline';
        warning.textContent = '☀️ 高溫路線';
        header.appendChild(warning);
    }
    
    // Content (Details)
    const content = document.createElement('div');
    content.className = 'route-card-content';
    
    const body = document.createElement('div');
    body.className = 'route-card-body';
    
    const infoRow1 = document.createElement('div');
    infoRow1.className = 'route-info-row';
    infoRow1.innerHTML = `<div class="route-info-label">出發:</div><div class="route-info-value">${route.departureTime}</div>`;
    
    const infoRow2 = document.createElement('div');
    infoRow2.className = 'route-info-row';
    infoRow2.innerHTML = `<div class="route-info-label">到達:</div><div class="route-info-value">${route.arrivalTime}</div>`;
    
    const infoRow3 = document.createElement('div');
    infoRow3.className = 'route-info-row';
    infoRow3.innerHTML = `<div class="route-info-label">距離:</div><div class="route-info-value">${route.distance}</div>`;
    
    const infoRow4 = document.createElement('div');
    infoRow4.className = 'route-info-row';
    infoRow4.innerHTML = `<div class="route-info-label">時間:</div><div class="route-info-value">${route.duration}分鐘</div>`;
    
    body.appendChild(infoRow1);
    body.appendChild(infoRow2);
    body.appendChild(infoRow3);
    body.appendChild(infoRow4);
    
    const stepsLabel = document.createElement('div');
    stepsLabel.className = 'route-info-label';
    stepsLabel.style.marginTop = '8px';
    stepsLabel.textContent = '轉乘步驟：';
    body.appendChild(stepsLabel);
    
    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'route-steps';
    
    route.steps.forEach((step, index) => {
        const stepEl = document.createElement('div');
        stepEl.className = 'route-step';
        stepEl.setAttribute('data-step-index', index);
        stepEl.setAttribute('data-route-id', route.id);
        
        const icon = { 'walk': '🚶', 'mrt': '🚇', 'bus': '🚌', 'lightrail': '🚃', 'bike': '🚲' }[step.type] || '📍';
        const title = step.type === 'walk' ? `步行 ${step.duration}分` :
                     step.type === 'mrt' ? `捷運${step.line === 'red' ? '紅線' : '橘線'}` :
                     step.type === 'lightrail' ? '輕軌' :
                     step.type === 'bus' ? '公車' : 'YouBike';
        
        stepEl.innerHTML = `
            <div class="step-icon" style="color: ${step.color}">${icon}</div>
            <div class="step-details">
                <div class="step-transit" style="color: ${step.color}; font-weight: 600">${title}</div>
                <div class="step-info">${step.distance} · ${step.instruction}</div>
            </div>
        `;
        
        stepEl.addEventListener('click', () => handleStepClick(step, route));
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
    
    document.querySelectorAll('.route-card.active').forEach(c => {
        c.classList.remove('active');
    });
    
    if (!isActive) {
        card.classList.add('active');
        selectedRouteId = route.id;
        drawRoute(route);
        highlightRoute(route.id, true);
    } else {
        selectedRouteId = null;
    }
}

function handleStepClick(step, route) {
    if (step.startCoords) {
        map.flyTo(step.startCoords, 16, { duration: 1 });
    }
}

// ==================== Map Drawing ====================
function drawRoute(route) {
    clearMapLayers();
    
    const polyline = L.polyline(
        route.coordinates.map(c => [c[0], c[1]]),
        {
            color: route.steps[0].color || ROUTE_COLORS.WALK,
            weight: 5,
            opacity: 0.9,
            smoothFactor: 1,
            dashArray: route.steps[0].type === 'walk' ? '5, 5' : 'none'
        }
    );
    
    mapLayerGroup.addLayer(polyline);
    
    // Start marker
    const startMarker = L.circleMarker(route.coordinates[0], {
        radius: 10,
        fillColor: '#4CAF50',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).bindPopup('起點');
    
    mapLayerGroup.addLayer(startMarker);
    
    // End marker
    const endMarker = L.circleMarker(route.coordinates[route.coordinates.length - 1], {
        radius: 10,
        fillColor: '#F44336',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).bindPopup('終點');
    
    mapLayerGroup.addLayer(endMarker);
}

function highlightRoute(routeId, isHighlight) {
    const cards = document.querySelectorAll('[data-route-id]');
    cards.forEach(card => {
        if (card.getAttribute('data-route-id') === routeId) {
            if (isHighlight) {
                card.style.boxShadow = '0 8px 20px rgba(0, 92, 175, 0.3)';
            } else {
                card.style.boxShadow = '0 4px 12px rgba(0, 92, 175, 0.2)';
            }
        } else if (isHighlight) {
            card.style.opacity = '0.3';
        } else {
            card.style.opacity = '1';
        }
    });
}

// ==================== Event Handlers ====================
function handleSwapLocations() {
    const origin = document.getElementById('originInput');
    const destination = document.getElementById('destinationInput');
    const temp = origin.value;
    origin.value = destination.value;
    destination.value = temp;
    
    const tempCoords = originCoords;
    originCoords = destinationCoords;
    destinationCoords = tempCoords;
    
    const btn = document.getElementById('swapLocationsBtn');
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 500);
}

async function handleSearch() {
    hideErrorMessage();
    
    const origin = document.getElementById('originInput').value.trim();
    const destination = document.getElementById('destinationInput').value.trim();
    
    if (!origin || !destination) {
        showErrorMessage('請輸入起點和終點');
        return;
    }
    
    if (!originCoords || !destinationCoords) {
        showErrorMessage('請確保起點和終點已正確選取');
        return;
    }
    
    showLoadingIndicator();
    
    try {
        clearMapLayers();
        const routes = await generateSmartRoute(
            originCoords.lat,
            originCoords.lon,
            destinationCoords.lat,
            destinationCoords.lon
        );
        
        if (routes.length === 0) {
            showErrorMessage('無法規劃路線，請重新嘗試');
        } else {
            displayRoutes(routes);
        }
    } catch (error) {
        console.error('Search error:', error);
        showErrorMessage('搜尋失敗，請稍後重試');
    } finally {
        hideLoadingIndicator();
    }
}

function handleTransitFilterChange(e) {
    const btn = e.target;
    const transitType = btn.getAttribute('data-transit');
    
    btn.classList.toggle('active');
    
    if (btn.classList.contains('active')) {
        selectedTransitTypes.add(transitType);
    } else {
        selectedTransitTypes.delete(transitType);
    }
}

function handleUseCurrentLocation() {
    if (userLocation) {
        document.getElementById('originInput').value = `目前位置`;
        originCoords = { lat: userLocation.lat, lon: userLocation.lng };
    } else {
        showErrorMessage('無法取得您的位置');
    }
}

// ==================== Event Listeners ====================
function setupEventListeners() {
    document.getElementById('swapLocationsBtn').addEventListener('click', handleSwapLocations);
    document.getElementById('searchBtn').addEventListener('click', handleSearch);
    document.getElementById('useCurrentLocationBtn').addEventListener('click', handleUseCurrentLocation);
    
    document.querySelectorAll('.transit-filter-btn').forEach(btn => {
        btn.addEventListener('click', handleTransitFilterChange);
    });
    
    document.querySelectorAll('.location-input').forEach(input => {
        input.addEventListener('input', handleAutocompleteInput);
    });
    
    document.getElementById('originInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    document.getElementById('destinationInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('location-input')) {
            document.getElementById('originDropdown').classList.add('hidden');
            document.getElementById('destinationDropdown').classList.add('hidden');
        }
    });
}

// ==================== Map Initialization ====================
function initializeMap() {
    map = L.map('map').setView(KAOHSIUNG_CENTER, 13);
    mapLayerGroup = L.layerGroup().addTo(map);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    map.locate({ setView: false, maxZoom: 16 });
    map.on('locationfound', (e) => {
        userLocation = e.latlng;
        L.circleMarker(e.latlng, {
            radius: 8,
            fillColor: '#005CAF',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).bindPopup('您的位置').addTo(map);
    });
}

function handleResponsive() {
    const controlPanel = document.getElementById('controlPanel');
    if (window.innerWidth <= 768) {
        controlPanel.classList.add('collapsed');
    } else {
        controlPanel.classList.remove('collapsed');
    }
}

window.addEventListener('resize', handleResponsive);

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    setupEventListeners();
    handleResponsive();
});
