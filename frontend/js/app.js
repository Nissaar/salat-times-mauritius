// Salat Times Mauritius - Main Application JavaScript

const API_BASE = '/api';

// State
let state = {
    selectedLocation: null,
    madhab: 'hanafi',
    date: new Date().toISOString().split('T')[0],
    prayerTimes: null
};

// DOM Elements
const elements = {
    gpsBtn: document.getElementById('gpsBtn'),
    locationSearch: document.getElementById('locationSearch'),
    searchResults: document.getElementById('searchResults'),
    selectedLocation: document.getElementById('selectedLocation'),
    locationName: document.getElementById('locationName'),
    locationDistrict: document.getElementById('locationDistrict'),
    clearLocation: document.getElementById('clearLocation'),
    madhabSelect: document.getElementById('madhabSelect'),
    displayDate: document.getElementById('displayDate'),
    liveClock: document.getElementById('liveClock'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    noDataMessage: document.getElementById('noDataMessage'),
    prayerTimesGrid: document.getElementById('prayerTimesGrid'),
    calculatedLocation: document.getElementById('calculatedLocation'),
    // Madhab labels in prayer bars
    asrMadhab: document.getElementById('asrMadhab'),
    maghribMadhab: document.getElementById('maghribMadhab'),
    ishaMadhab: document.getElementById('ishaMadhab'),
    // Prayer time displays
    sehriTime: document.getElementById('sehriTime'),
    fajrTime: document.getElementById('fajrTime'),
    sunriseStartTime: document.getElementById('sunriseStartTime'),
    sunriseEndTime: document.getElementById('sunriseEndTime'),
    istiwaStartTime: document.getElementById('istiwaStartTime'),
    istiwaEndTime: document.getElementById('istiwaEndTime'),
    zohrTime: document.getElementById('zohrTime'),
    asrTime: document.getElementById('asrTime'),
    sunsetStartTime: document.getElementById('sunsetStartTime'),
    sunsetEndTime: document.getElementById('sunsetEndTime'),
    maghribTime: document.getElementById('maghribTime'),
    eshaTime: document.getElementById('eshaTime')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Set today's date and start clock
    updateDisplayDate();
    startLiveClock();

    // Load saved preferences
    loadPreferences();

    // Set up event listeners
    setupEventListeners();

    // If location was saved, load prayer times
    if (state.selectedLocation) {
        updateSelectedLocationDisplay();
        fetchPrayerTimes();
    }
}

function startLiveClock() {
    function updateClock() {
        const now = new Date();
        const options = { 
            hour: 'numeric', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        };
        elements.liveClock.textContent = now.toLocaleTimeString('en-US', options);
    }
    
    updateClock();
    setInterval(updateClock, 1000);
}

function setupEventListeners() {
    // GPS Button
    elements.gpsBtn.addEventListener('click', handleGPSClick);

    // Location Search
    let searchTimeout;
    elements.locationSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            elements.searchResults.classList.remove('active');
            return;
        }

        searchTimeout = setTimeout(() => searchLocations(query), 300);
    });

    elements.locationSearch.addEventListener('focus', () => {
        if (elements.locationSearch.value.length >= 2) {
            elements.searchResults.classList.add('active');
        }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.location-wrapper')) {
            elements.searchResults.classList.remove('active');
        }
    });

    // Clear Location
    elements.clearLocation.addEventListener('click', () => {
        clearLocation();
    });

    // Madhab Change (select dropdown)
    elements.madhabSelect.addEventListener('change', (e) => {
        state.madhab = e.target.value;
        updateMadhabLabels();
        savePreferences();
        if (state.selectedLocation) {
            fetchPrayerTimes();
        }
    });
}

function updateMadhabLabels() {
    const madhab = state.madhab;
    if (elements.asrMadhab) elements.asrMadhab.textContent = madhab;
    if (elements.maghribMadhab) elements.maghribMadhab.textContent = madhab;
    if (elements.ishaMadhab) elements.ishaMadhab.textContent = madhab;
}

// GPS Location
async function handleGPSClick() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    elements.gpsBtn.disabled = true;

    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });

        const { latitude, longitude } = position.coords;
        
        // Find nearest location
        const response = await fetch(`${API_BASE}/locations/nearest/coords?lat=${latitude}&lng=${longitude}`);
        
        if (!response.ok) {
            throw new Error('Failed to find nearest location');
        }

        const locations = await response.json();
        
        if (locations.length > 0) {
            selectLocation(locations[0]);
        } else {
            alert('No nearby locations found. Please search manually.');
        }
    } catch (error) {
        console.error('GPS error:', error);
        if (error.code === 1) {
            alert('Location permission denied. Please allow location access or search manually.');
        } else if (error.code === 2) {
            alert('Unable to determine your location. Please search manually.');
        } else {
            alert('Error getting location: ' + error.message);
        }
    } finally {
        elements.gpsBtn.disabled = false;
    }
}

// Location Search
async function searchLocations(query) {
    try {
        const response = await fetch(`${API_BASE}/locations/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error('Search failed');
        }

        const locations = await response.json();
        displaySearchResults(locations);
    } catch (error) {
        console.error('Search error:', error);
        elements.searchResults.innerHTML = '<div class="search-result-item">Error searching locations</div>';
        elements.searchResults.classList.add('active');
    }
}

function displaySearchResults(locations) {
    if (locations.length === 0) {
        elements.searchResults.innerHTML = '<div class="search-result-item">No locations found</div>';
    } else {
        elements.searchResults.innerHTML = locations.map(loc => `
            <div class="search-result-item" data-id="${loc.id}" data-name="${loc.name}" 
                 data-district="${loc.district_name}" data-altitude="${loc.altitude}"
                 data-lat="${loc.latitude}" data-lng="${loc.longitude}">
                <div class="name">${loc.name}</div>
                <div class="district">${loc.district_name} • ${loc.altitude}m altitude</div>
            </div>
        `).join('');

        // Add click handlers
        elements.searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const location = {
                    id: item.dataset.id,
                    name: item.dataset.name,
                    district_name: item.dataset.district,
                    altitude: parseInt(item.dataset.altitude),
                    latitude: parseFloat(item.dataset.lat),
                    longitude: parseFloat(item.dataset.lng)
                };
                selectLocation(location);
                elements.searchResults.classList.remove('active');
                elements.locationSearch.value = '';
            });
        });
    }
    elements.searchResults.classList.add('active');
}

function selectLocation(location) {
    state.selectedLocation = location;
    savePreferences();
    updateSelectedLocationDisplay();
    fetchPrayerTimes();
}

function updateSelectedLocationDisplay() {
    if (state.selectedLocation) {
        elements.locationName.textContent = state.selectedLocation.name;
        elements.locationDistrict.textContent = `• ${state.selectedLocation.district_name}`;
        elements.selectedLocation.classList.remove('hidden');
        elements.locationSearch.classList.add('hidden');
        document.querySelector('.gps-btn').classList.add('hidden');
        
        // Update footer location text
        if (elements.calculatedLocation) {
            elements.calculatedLocation.textContent = state.selectedLocation.name;
        }
    }
}

function clearLocation() {
    state.selectedLocation = null;
    state.prayerTimes = null;
    elements.selectedLocation.classList.add('hidden');
    elements.locationSearch.classList.remove('hidden');
    elements.locationSearch.value = '';
    document.querySelector('.gps-btn').classList.remove('hidden');
    elements.prayerTimesGrid.classList.add('hidden');
    elements.noDataMessage.classList.remove('hidden');
    savePreferences();
}

// Prayer Times
async function fetchPrayerTimes() {
    if (!state.selectedLocation) return;

    showLoading(true);

    try {
        const params = new URLSearchParams({
            date: state.date,
            locationId: state.selectedLocation.id,
            madhab: state.madhab
        });

        const response = await fetch(`${API_BASE}/prayer-times?${params}`);
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch prayer times');
        }

        const data = await response.json();
        state.prayerTimes = data;
        displayPrayerTimes(data);
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        elements.prayerTimesGrid.classList.add('hidden');
        elements.noDataMessage.classList.remove('hidden');
        elements.noDataMessage.innerHTML = `<p>Error: ${error.message}</p>`;
    } finally {
        showLoading(false);
    }
}

function displayPrayerTimes(data) {
    const times = data.times;

    // Format time in 24-hour format
    const formatTime = (time) => {
        if (!time) return '--:--';
        const parts = time.split(':');
        return `${parts[0]}:${parts[1]}`;
    };

    elements.sehriTime.textContent = formatTime(times.sehri);
    elements.fajrTime.textContent = formatTime(times.fajr);
    
    // Sunrise (start and end)
    elements.sunriseStartTime.textContent = formatTime(times.sunriseStart || times.sunrise);
    elements.sunriseEndTime.textContent = formatTime(times.sunriseEnd || times.sunrise);
    
    // Istiwa (start and end)
    elements.istiwaStartTime.textContent = formatTime(times.istiwaStart || times.istiwa);
    elements.istiwaEndTime.textContent = formatTime(times.istiwaEnd || times.istiwa);
    
    elements.zohrTime.textContent = formatTime(times.zohr);
    elements.asrTime.textContent = formatTime(times.asr);
    
    // Sunset (start and end)
    elements.sunsetStartTime.textContent = formatTime(times.sunsetStart || times.sunset);
    elements.sunsetEndTime.textContent = formatTime(times.sunsetEnd || times.sunset);
    
    elements.maghribTime.textContent = formatTime(times.maghrib);
    elements.eshaTime.textContent = formatTime(times.esha);

    elements.noDataMessage.classList.add('hidden');
    elements.prayerTimesGrid.classList.remove('hidden');
}

function showLoading(show) {
    if (show) {
        elements.loadingSpinner.classList.remove('hidden');
        elements.prayerTimesGrid.classList.add('hidden');
        elements.noDataMessage.classList.add('hidden');
    } else {
        elements.loadingSpinner.classList.add('hidden');
    }
}

function updateDisplayDate() {
    const date = new Date(state.date);
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    elements.displayDate.textContent = date.toLocaleDateString('en-US', options);
}

// Local Storage
function savePreferences() {
    const prefs = {
        selectedLocation: state.selectedLocation,
        madhab: state.madhab
    };
    localStorage.setItem('salatTimesPrefs', JSON.stringify(prefs));
}

function loadPreferences() {
    try {
        const prefs = JSON.parse(localStorage.getItem('salatTimesPrefs'));
        if (prefs) {
            if (prefs.selectedLocation) {
                state.selectedLocation = prefs.selectedLocation;
            }
            if (prefs.madhab) {
                state.madhab = prefs.madhab;
                elements.madhabSelect.value = prefs.madhab;
            }
        }
        updateMadhabLabels();
    } catch (error) {
        console.error('Error loading preferences:', error);
    }
}
