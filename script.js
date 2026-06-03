// ==================== TDX API Configuration ====================
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const TDX_TOKEN_URL = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
const TDX_ROUTING_API = 'https://tdx.transportdata.tw/api/v2';

let accessToken = null;
let tokenExpiry = null;

// ==================== Constants ====================
const KAOHSIUNG_CENTER = [22.6228, 120.3014];
const COLORS = {
    MRT_RED: '#E60012',
    MRT_ORANGE: '#FFA500',
    LIGHTRAIL_GREEN: '#009E52',
    WALK_BLUE: '#0099CC',
    PRIMARY: '#005CAF'
};

// ==================== Kaohsiung Major Transit Stations ====================
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

const TODAY_TEMP = 38;

// ==================== Mock Data (Kaohsiung Station to Sizihwan) ====================
const MOCK_ROUTE_DATA = {
    routes: [
        {
            id: 'route_1',
            type: 'fastest',
            duration: '32',
            departureTime: '14:25',
            arrivalTime: '14:57',
            distance: '8.5km',
            steps: [
                {
                    type: 'walk',
                    duration: 5,
                    distance: '0.3km',
                    instruction: '從高雄車站步行至O2美術館站',
                    startCoords: [22.6387, 120.3137],
                    endCoords: [22.6351, 120.3165]
                },
                {
                    type: 'mrt',
                    line: 'red',
                    duration: 22,
                    distance: '6.8km',
                    instruction: '搭乘紅線捷運往小港方向 (O2美術館 → 西子灣)',
                    stations: ['美術館', '文化中心', '中央公園', '高雄車站', '美麗島', '鳳山', '西子灣'],
                    startCoords: [22.6351, 120.3165],
                    endCoords: [22.6428, 120.3456]
                },
                {
                    type: 'walk',
                    duration: 5,
                    distance: '0.4km',
                    instruction: '步行至西子灣遊憩區',
                    startCoords: [22.6428, 120.3456],
                    endCoords: [22.6462, 120.3512]
                }
            ],
            hasHeatWarning: false,
            coordinates: [
                [22.6387, 120.3137],
                [22.6351, 120.3165],
                [22.6351, 120.3165],
                [22.6334, 120.3201],
                [22.6312, 120.3278],
                [22.6298, 120.3321],
                [22.6285, 120.3364],
                [22.6271, 120.3397],
                [22.6251, 120.3456],
                [22.6428, 120.3456],
                [22.6445, 120.3481],
                [22.6462, 120.3512]
            ]
        },
        {
            id: 'route_2',
            type: 'alternative',
            duration: '38',
            departureTime: '14:30',
            arrivalTime: '15:08',
            distance: '9.2km',
            steps: [
                {
                    type: 'walk',
                    duration: 3,
                    distance: '0.2km',
                    instruction: '從高雄車站步行至凱旋站',
                    startCoords: [22.6387, 120.3137],
                    endCoords: [22.6301, 120.3189]
                },
                {
                    type: 'bus',
                    line: '紅28',
                    duration: 28,
                    distance: '8.5km',
                    instruction: '搭乘紅28公車往西子灣',
                    stops: ['五福幸福路口', '信愛街', '新堀江商圈', '市政府', '漢神百貨', '西子灣'],
                    startCoords: [22.6301, 120.3189],
                    endCoords: [22.6462, 120.3512]
                },
                {
                    type: 'walk',
                    duration: 7,
                    distance: '0.5km',
                    instruction: '步行至西子灣遊憩區',
                    startCoords: [22.6462, 120.3512],
                    endCoords: [22.6485, 120.3545]
                }
            ],
            hasHeatWarning: true,
            coordinates: [
                [22.6387, 120.3137],
                [22.6301, 120.3189],
                [22.6280, 120.3210],
                [22.6251, 120.3245],
                [22.6220, 120.3285],
                [22.6189, 120.3325],
                [22.6175, 120.3365],
                [22.6168, 120.3410],
                [22.6173, 120.3456],
                [22.6195, 120.3490],
                [22.6245, 120.3521],
                [22.6485, 120.3545]
            ]
        },
        {
            id: 'route_3',
            type: 'eco',
            duration: '45',
            departureTime: '14:35',
            arrivalTime: '15:20',
            distance: '7.8km',
            steps: [
                {
                    type: 'bike',
                    duration: 20,
                    distance: '4.5km',
                    instruction: '騎乘YouBike至英國領事館',
                    startCoords: [22.6387, 120.3137],
                    endCoords: [22.6428, 120.3456]
                },
                {
                    type: 'lightrail',
                    line: 'green',
                    direction: '內圈',
                    duration: 18,
                    distance: '3.2km',
                    instruction: '搭乘輕軌內圈 (英國領事館 → 西子灣)',
                    stations: ['英國領事館', '光榮碼頭', '駁二藝術特區', '西子灣'],
                    startCoords: [22.6428, 120.3456],
                    endCoords: [22.6462, 120.3512]
                },
                {
                    type: 'walk',
                    duration: 7,
                    distance: '0.1km',
                    instruction: '到達目的地',
                    startCoords: [22.6462, 120.3512],
                    endCoords: [22.6462, 120.3512]
                }
            ],
            hasHeatWarning: false,
            coordinates: [
                [22.6387, 120.3137],
                [22.6405, 120.3198],
                [22.6420, 120.3267],
                [22.6428, 120.3350],
                [22.6428, 120.3456],
                [22.6440, 120.3465],
                [22.6450, 120.3478],
                [22.6462, 120.3512]
            ]
        }
    ]
};

// ==================== Global State ====================
let map = null;
let currentRoutes = [];
let selectedRouteId = null;
let drawnLines = {};
let userLocation = null;
let selectedTransitTypes = new Set(['mrt', 'lightrail', 'bus', 'bike']);
let isLoading = false;

// Location coordinates storage
let originCoords = null;
let destinationCoords = null;

// Debounce timers
let originDebounceTimer = null;
let destinationDebounceTimer = null;

// ==================== Utility Functions ====================
function debounce(func, delay) {
    return function(...args) {
        clearTimeout(func.timer);
        func.timer = setTimeout(() => func(...args), delay);
    };
}

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

// ==================== Nominatim API Functions ====================
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
        
        if (!response.ok) {
            console.error('Nominatim API error:', response.status);
            return [];
        }
        
        const results = await response.json();
        return results.map(item => ({
            name: item.name || item.display_name.split(',')[0],
            displayName: item.display_name,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon)
        }));
    } catch (error) {
        console.error('Nominatim search error:', error);
        return [];
    }
}

// ==================== Autocomplete UI Functions ====================
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
        item.innerHTML = `
            <div class="autocomplete-item-main">📍 ${result.name}</div>
            <div class="autocomplete-item-sub">${result.displayName}</div>
        `;
        
        item.addEventListener('click', () => {
            selectAutocompleteItem(result, locationType);
        });
        
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
    
    const debounceFunc = locationType === 'origin' ? debouncedOriginSearch : debouncedDestinationSearch;
    debounceFunc(query, locationType);
}

const debouncedOriginSearch = debounce(async function(query, locationType) {
    const results = await searchNominatim(query);
    showAutocompleteResults(results, locationType);
}, 300);

const debouncedDestinationSearch = debounce(async function(query, locationType) {
    const results = await searchNominatim(query);
    showAutocompleteResults(results, locationType);
}, 300);

// ==================== Smart Route Generation ====================
function generateSmartRoute(originLat, originLon, destLat, destLon) {
    const originNearest = findNearestStation(originLat, originLon);
    const destNearest = findNearestStation(destLat, destLon);
    
    const originStation = originNearest.station;
    const destStation = destNearest.station;
    const originWalkDist = originNearest.distance;
    const destWalkDist = destNearest.distance;
    
    const originWalkTime = Math.ceil(originWalkDist * 15);
    const destWalkTime = Math.ceil(destWalkDist * 15);
    const transitTime = 20;
    const totalTime = originWalkTime + transitTime + destWalkTime;
    
    const hasHeatWarning = originWalkTime > 10 || destWalkTime > 10;
    
    // Build route coordinates
    const routeCoordinates = [
        [originLat, originLon],
        [originStation.lat, originStation.lon],
        [destStation.lat, destStation.lon],
        [destLat, destLon]
    ];
    
    // Build steps
    const steps = [];
    
    if (originWalkDist > 0.01) {
        steps.push({
            type: 'walk',
            duration: originWalkTime,
            distance: originWalkDist.toFixed(2) + 'km',
            instruction: `步行至${originStation.name}站`,
            startCoords: [originLat, originLon],
            endCoords: [originStation.lat, originStation.lon]
        });
    }
    
    const lineType = originStation.line === 'red' ? 'red' : originStation.line === 'orange' ? 'orange' : 'green';
    const lineColor = lineType === 'red' ? '紅線' : lineType === 'orange' ? '橘線' : '輕軌';
    
    steps.push({
        type: originStation.type,
        line: lineType,
        duration: transitTime,
        distance: calculateDistance(originStation.lat, originStation.lon, destStation.lat, destStation.lon).toFixed(2) + 'km',
        instruction: `搭乘${lineColor}由${originStation.name}至${destStation.name}`,
        stations: [originStation.name, destStation.name],
        startCoords: [originStation.lat, originStation.lon],
        endCoords: [destStation.lat, destStation.lon]
    });
    
    if (destWalkDist > 0.01) {
        steps.push({
            type: 'walk',
            duration: destWalkTime,
            distance: destWalkDist.toFixed(2) + 'km',
            instruction: `步行至目的地`,
            startCoords: [destStation.lat, destStation.lon],
            endCoords: [destLat, destLon]
        });
    }
    
    return {
        id: `route_${Date.now()}`,
        type: 'smart',
        duration: totalTime.toString(),
        departureTime: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        arrivalTime: new Date(Date.now() + totalTime * 60000).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }),
        distance: (originWalkDist + calculateDistance(originStation.lat, originStation.lon, destStation.lat, destStation.lon) + destWalkDist).toFixed(2) + 'km',
        steps: steps,
        hasHeatWarning: hasHeatWarning,
        coordinates: routeCoordinates,
        expanded: false
    };
}

// ==================== TDX API Functions ====================
async function getTdxToken() {
    try {
        if (tokenExpiry && tokenExpiry > Date.now()) {
            return accessToken;
        }

        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        });

        const response = await fetch(TDX_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        if (!response.ok) {
            throw new Error(`Token request failed: ${response.status}`);
        }

        const data = await response.json();
        accessToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in * 1000);
        
        return accessToken;
    } catch (error) {
        console.warn('TDX Token Error (using Smart Generation):', error.message);
        return null;
    }
}

async function fetchTransitRoute(origin, destination) {
    try {
        isLoading = true;
        showLoadingIndicator();

        if (!originCoords || !destinationCoords) {
            showErrorMessage('無法取得座標，請重新輸入地點');
            return [];
        }

        const route = generateSmartRoute(
            originCoords.lat,
            originCoords.lon,
            destinationCoords.lat,
            destinationCoords.lon
        );

        return [route];

    } catch (error) {
        console.error('Route fetch error:', error);
        showErrorMessage('路線規劃失敗，請稍後重試');
        return [];
    } finally {
        isLoading = false;
        hideLoadingIndicator();
    }
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
    setTimeout(() => {
        errorEl.classList.add('hidden');
    }, 5000);
}

function hideErrorMessage() {
    document.getElementById('errorMessage').classList.add('hidden');
}

// ==================== Route Display Functions ====================
function displayRoutes(routes) {
    const container = document.getElementById('routesContainer');
    const bottomSheetContent = document.getElementById('bottomSheetContent');
    const bottomSheet = document.getElementById('bottomSheet');
    
    container.innerHTML = '';
    bottomSheetContent.innerHTML = '';
    currentRoutes = routes;

    routes.forEach(route => {
        const card = createRouteCard(route);
        container.appendChild(card);
        bottomSheetContent.appendChild(card.cloneNode(true));
    });

    if (window.innerWidth <= 768) {
        bottomSheet.classList.remove('hidden');
    }

    // Fit map to show all routes
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
    title.textContent = `最佳路線 · ${route.departureTime} → ${route.arrivalTime}`;
    
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
        const icons = {
            'walk': '🚶',
            'mrt': '🚇',
            'bus': '🚌',
            'lightrail': '🚃',
            'bike': '🚲'
        };
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
    
    // Add warning if applicable
    if (route.hasHeatWarning) {
        const warning = document.createElement('div');
        warning.className = 'route-warning-inline';
        warning.textContent = '☀️ 高溫路線 - 建議準備防曬';
        header.appendChild(warning);
    }

    // Content (Details)
    const content = document.createElement('div');
    content.className = 'route-card-content';
    
    const body = document.createElement('div');
    body.className = 'route-card-body';
    
    // Info rows
    const infoRow1 = document.createElement('div');
    infoRow1.className = 'route-info-row';
    infoRow1.innerHTML = `
        <div class="route-info-label">出發時間:</div>
        <div class="route-info-value">${route.departureTime}</div>
    `;
    
    const infoRow2 = document.createElement('div');
    infoRow2.className = 'route-info-row';
    infoRow2.innerHTML = `
        <div class="route-info-label">到達時間:</div>
        <div class="route-info-value">${route.arrivalTime}</div>
    `;
    
    const infoRow3 = document.createElement('div');
    infoRow3.className = 'route-info-row';
    infoRow3.innerHTML = `
        <div class="route-info-label">總距離:</div>
        <div class="route-info-value">${route.distance}</div>
    `;
    
    const infoRow4 = document.createElement('div');
    infoRow4.className = 'route-info-row';
    infoRow4.innerHTML = `
        <div class="route-info-label">總時間:</div>
        <div class="route-info-value">${route.duration}分鐘</div>
    `;
    
    body.appendChild(infoRow1);
    body.appendChild(infoRow2);
    body.appendChild(infoRow3);
    body.appendChild(infoRow4);
    
    // Steps
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

        const icon = getStepIcon(step);
        const details = getStepDetails(step);

        stepEl.innerHTML = `
            <div class="step-icon">${icon}</div>
            <div class="step-details">
                <div class="step-transit">${details.title}</div>
                <div class="step-info">${details.info}</div>
            </div>
        `;

        stepEl.addEventListener('click', () => handleStepClick(step, route));
        stepsContainer.appendChild(stepEl);
    });
    
    body.appendChild(stepsContainer);
    
    content.appendChild(body);

    card.appendChild(header);
    card.appendChild(content);

    // Toggle expand/collapse
    header.addEventListener('click', () => toggleCardExpansion(card, route));

    // Hover effects
    card.addEventListener('mouseenter', () => highlightRoute(route.id, true));
    card.addEventListener('mouseleave', () => highlightRoute(route.id, false));

    return card;
}

function toggleCardExpansion(card, route) {
    const isActive = card.classList.contains('active');
    
    // Close all cards
    document.querySelectorAll('.route-card.active').forEach(c => {
        c.classList.remove('active');
    });
    
    // Open clicked card if it wasn't already open
    if (!isActive) {
        card.classList.add('active');
        selectedRouteId = route.id;
        
        // Draw route on map
        drawRoute(route);
        
        // Highlight this route
        highlightRoute(route.id, true);
    } else {
        selectedRouteId = null;
    }
}

function getStepIcon(step) {
    const icons = {
        walk: '🚶',
        mrt: '🚇',
        bus: '🚌',
        lightrail: '🚃',
        bike: '🚲'
    };
    return icons[step.type] || '📍';
}

function getStepDetails(step) {
    const details = {
        title: '',
        info: ''
    };

    switch (step.type) {
        case 'walk':
            details.title = `步行 ${step.duration} 分鐘`;
            details.info = `${step.distance} · ${step.instruction}`;
            break;
        case 'mrt':
            const lineColor = step.line === 'red' ? '紅線' : step.line === 'orange' ? '橘線' : '橙線';
            details.title = `捷運${lineColor}`;
            details.info = `${step.duration}分 · ${step.distance} · ${step.instruction}`;
            break;
        case 'lightrail':
            details.title = `輕軌`;
            details.info = `${step.duration}分 · ${step.distance} · ${step.instruction}`;
            break;
        case 'bus':
            details.title = `公車`;
            details.info = `${step.duration}分 · ${step.distance}`;
            break;
        case 'bike':
            details.title = `YouBike`;
            details.info = `${step.duration}分 · ${step.distance}`;
            break;
    }

    return details;
}

// ==================== Map Functions ====================
function initializeMap() {
    map = L.map('map').setView(KAOHSIUNG_CENTER, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Add geolocation button
    map.locate({ setView: true, maxZoom: 16 });
    map.on('locationfound', (e) => {
        userLocation = e.latlng;
        L.circleMarker(e.latlng, {
            radius: 8,
            fillColor: COLORS.PRIMARY,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map).bindPopup('您的位置');
    });

    map.on('locationerror', () => {
        console.log('Geolocation not available, using default center');
    });
}

function drawRoute(route) {
    // Clear old polylines for this route
    Object.keys(drawnLines).forEach(key => {
        if (key.startsWith(route.id)) {
            map.removeLayer(drawnLines[key]);
            delete drawnLines[key];
        }
    });

    // Draw main polyline
    const polyline = L.polyline(
        route.coordinates.map(c => [c[0], c[1]]),
        {
            color: COLORS.PRIMARY,
            weight: 5,
            opacity: 0.8,
            smoothFactor: 1
        }
    );

    polyline.addTo(map);
    drawnLines[route.id] = polyline;

    // Add markers
    const startMarker = L.circleMarker(route.coordinates[0], {
        radius: 10,
        fillColor: '#4CAF50',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map).bindPopup('起點');

    const endMarker = L.circleMarker(route.coordinates[route.coordinates.length - 1], {
        radius: 10,
        fillColor: '#F44336',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(map).bindPopup('終點');

    drawnLines[`${route.id}_start`] = startMarker;
    drawnLines[`${route.id}_end`] = endMarker;
}

function highlightRoute(routeId, isHighlight) {
    const line = drawnLines[routeId];
    if (line && line.setStyle) {
        if (isHighlight) {
            line.setStyle({ weight: 8, opacity: 1, color: COLORS.PRIMARY });
        } else {
            line.setStyle({ weight: 4, opacity: 0.4, color: COLORS.PRIMARY });
        }
    }
}

function handleStepClick(step, route) {
    if (step.startCoords) {
        map.flyTo(step.startCoords, 16, { duration: 1 });
    }
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

    const routes = await fetchTransitRoute(origin, destination);
    
    if (routes.length === 0) {
        showErrorMessage('無法規劃路線，請重新嘗試');
        return;
    }

    displayRoutes(routes);
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
        document.getElementById('originInput').value = `目前位置 (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`;
        originCoords = { lat: userLocation.lat, lon: userLocation.lng };
    } else {
        showErrorMessage('無法取得您的位置，請允許定位權限');
    }
}

// ==================== Event Listeners Setup ====================
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

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('location-input')) {
            document.getElementById('originDropdown').classList.add('hidden');
            document.getElementById('destinationDropdown').classList.add('hidden');
        }
    });
}

// ==================== Responsive Handling ====================
function handleResponsive() {
    const controlPanel = document.getElementById('controlPanel');
    const bottomSheet = document.getElementById('bottomSheet');
    
    if (window.innerWidth <= 768) {
        controlPanel.classList.add('collapsed');
    } else {
        controlPanel.classList.remove('collapsed');
        if (bottomSheet) bottomSheet.classList.add('hidden');
    }
}

window.addEventListener('resize', handleResponsive);

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeMap();
    setupEventListeners();
    handleResponsive();
});
