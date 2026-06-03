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

const TODAY_TEMP = 38;  // Mock temperature for Kaohsiung

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
        console.warn('TDX Token Error (using Mock Data):', error.message);
        return null;
    }
}

async function fetchTransitRoute(origin, destination) {
    try {
        isLoading = true;
        showLoadingIndicator();

        const token = await getTdxToken();

        if (!token || CLIENT_ID === 'YOUR_CLIENT_ID') {
            console.log('Using Mock Data - TDX credentials not configured');
            return useMockData();
        }

        // TDX API call would go here
        // For now, we use mock data as fallback
        return useMockData();

    } catch (error) {
        console.error('Route fetch error:', error);
        return useMockData();
    } finally {
        isLoading = false;
        hideLoadingIndicator();
    }
}

function useMockData() {
    return MOCK_ROUTE_DATA.routes.map(route => ({
        ...route,
        steps: route.steps.map(step => ({
            ...step,
            expanded: false
        }))
    }));
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

    const header = document.createElement('div');
    header.className = 'route-header';
    header.innerHTML = `
        <span class="route-time">${route.departureTime} - ${route.arrivalTime}</span>
        <span class="route-duration">⏱️ ${route.duration}分鐘</span>
    `;

    const warning = document.createElement('div');
    warning.className = `route-warning ${!route.hasHeatWarning ? 'hidden' : ''}`;
    warning.innerHTML = `☀️ 高溫路線：沿途公車/步行段多，建議準備防曬`;

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

    card.appendChild(header);
    card.appendChild(warning);
    card.appendChild(stepsContainer);

    card.addEventListener('mouseenter', () => highlightRoute(route.id, true));
    card.addEventListener('mouseleave', () => highlightRoute(route.id, false));

    return card;
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
            details.title = `${getLineColor(step.line, 'text')} ${step.line === 'red' ? '紅線' : '橘線'}`;
            details.info = `${step.duration} 分鐘 · ${step.distance} · ${step.instruction}`;
            break;
        case 'lightrail':
            details.title = `輕軌 (${step.direction}圈)`;
            details.info = `${step.duration} 分鐘 · ${step.distance} · 請前往${step.direction}圈月台`;
            break;
        case 'bus':
            details.title = `公車 ${step.line}`;
            details.info = `${step.duration} 分鐘 · ${step.distance}`;
            break;
        case 'bike':
            details.title = `YouBike`;
            details.info = `${step.duration} 分鐘 · ${step.distance}`;
            break;
    }

    return details;
}

function getLineColor(line, type = 'color') {
    const colorMap = {
        'red': COLORS.MRT_RED,
        'orange': COLORS.MRT_ORANGE,
        'green': COLORS.LIGHTRAIL_GREEN
    };

    if (type === 'color') {
        return colorMap[line] || COLORS.PRIMARY;
    }
    return line === 'red' ? '🔴' : line === 'orange' ? '🟠' : '🟢';
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
    if (drawnLines[route.id]) {
        map.removeLayer(drawnLines[route.id]);
    }

    const polyline = L.polyline(
        route.coordinates.map(c => [c[0], c[1]]),
        {
            color: COLORS.PRIMARY,
            weight: 4,
            opacity: 0.8,
            smoothFactor: 1
        }
    );

    polyline.addTo(map);
    drawnLines[route.id] = polyline;

    // Add markers for start and end
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
            line.setStyle({ weight: 8, opacity: 1 });
        } else {
            line.setStyle({ weight: 4, opacity: 0.5 });
        }
    }

    // Update card styling
    const cards = document.querySelectorAll('[data-route-id]');
    cards.forEach(card => {
        if (isHighlight && card.getAttribute('data-route-id') === routeId) {
            card.style.boxShadow = '0 8px 20px rgba(0, 92, 175, 0.3)';
        } else if (!isHighlight && card.getAttribute('data-route-id') === routeId) {
            card.style.boxShadow = '0 4px 12px rgba(0, 92, 175, 0.2)';
        }
    });
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

    // Trigger animation
    const btn = document.getElementById('swapLocationsBtn');
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 500);

    // Animate input fields
    origin.style.animation = 'none';
    destination.style.animation = 'none';
    setTimeout(() => {
        origin.style.animation = 'opacity-fade 0.3s ease';
        destination.style.animation = 'opacity-fade 0.3s ease';
    }, 10);
}

async function handleSearch() {
    hideErrorMessage();
    
    const origin = document.getElementById('originInput').value.trim();
    const destination = document.getElementById('destinationInput').value.trim();

    if (!origin || !destination) {
        showErrorMessage('請輸入起點和終點');
        return;
    }

    // Mock validation - in real app, would geocode addresses
    if (origin === '高雄車站' && destination === '西子灣') {
        const routes = await fetchTransitRoute(origin, destination);
        
        // Filter by selected transit types
        const filtered = routes.filter(route => {
            return route.steps.some(step => selectedTransitTypes.has(step.type));
        });

        if (filtered.length === 0) {
            showErrorMessage('暫時無法取得符合篩選條件的路線，請調整篩選條件');
            return;
        }

        displayRoutes(filtered);
        
        // Draw all routes on map
        filtered.forEach(route => {
            drawRoute(route);
            highlightRoute(route.id, false);
        });

    } else {
        showErrorMessage('暫時無法取得路線，請稍後再試或重新輸入地點（試試看「高雄車站」到「西子灣」）');
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
        document.getElementById('originInput').value = `目前位置 (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})`;
    } else {
        showErrorMessage('無法取得您的位置，請允許定位權限');
    }
}

function handleRouteCardClick(e) {
    const card = e.currentTarget;
    const routeId = card.getAttribute('data-route-id');
    
    if (selectedRouteId === routeId) {
        selectedRouteId = null;
        card.style.borderColor = '';
    } else {
        document.querySelectorAll('.route-card').forEach(c => {
            c.style.borderColor = '';
        });
        selectedRouteId = routeId;
        card.style.borderColor = COLORS.PRIMARY;
        
        const route = currentRoutes.find(r => r.id === routeId);
        if (route) {
            const bounds = L.latLngBounds(route.coordinates.map(c => [c[0], c[1]]));
            map.fitBounds(bounds, { padding: [80, 80] });
        }
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

    document.getElementById('originInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    document.getElementById('destinationInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
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

    // Load default route for demo
    const originInput = document.getElementById('originInput');
    const destInput = document.getElementById('destinationInput');
    originInput.value = '高雄車站';
    destInput.value = '西子灣';
});
