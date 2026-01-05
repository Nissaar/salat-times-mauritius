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
    dateSelect: document.getElementById('dateSelect'),
    displayDate: document.getElementById('displayDate'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    noDataMessage: document.getElementById('noDataMessage'),
    prayerTimesGrid: document.getElementById('prayerTimesGrid'),
    altitudeNote: document.getElementById('altitudeNote'),
    altitudeValue: document.getElementById('altitudeValue'),
    // Prayer time displays
    sehriTime: document.getElementById('sehriTime'),
    fajrTime: document.getElementById('fajrTime'),
    sunriseTime: document.getElementById('sunriseTime'),
    istiwaTime: document.getElementById('istiwaTime'),
    zohrTime: document.getElementById('zohrTime'),
    asrTime: document.getElementById('asrTime'),
    sunsetTime: document.getElementById('sunsetTime'),
    maghribTime: document.getElementById('maghribTime'),
    eshaTime: document.getElementById('eshaTime')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Set today's date
    elements.dateSelect.value = state.date;
    updateDisplayDate();

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
        if (!e.target.closest('.search-container')) {
            elements.searchResults.classList.remove('active');
        }
    });

    // Clear Location
    elements.clearLocation.addEventListener('click', () => {
        clearLocation();
    });

    // Date Change
    elements.dateSelect.addEventListener('change', (e) => {
        state.date = e.target.value;
        updateDisplayDate();
        savePreferences();
        if (state.selectedLocation) {
            fetchPrayerTimes();
        }
    });

    // Madhab Change
    document.querySelectorAll('input[name="madhab"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.madhab = e.target.value;
            savePreferences();
            if (state.selectedLocation) {
                fetchPrayerTimes();
            }
        });
    });
}

// GPS Location
async function handleGPSClick() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    elements.gpsBtn.disabled = true;
    elements.gpsBtn.textContent = 'Locating...';

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
        elements.gpsBtn.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
            </svg>
            Use My Location (GPS)
        `;
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
        elements.locationDistrict.textContent = `${state.selectedLocation.district_name} • ${state.selectedLocation.altitude}m`;
        elements.selectedLocation.classList.remove('hidden');
    }
}

function clearLocation() {
    state.selectedLocation = null;
    state.prayerTimes = null;
    elements.selectedLocation.classList.add('hidden');
    elements.prayerTimesGrid.classList.add('hidden');
    elements.noDataMessage.classList.remove('hidden');
    elements.altitudeNote.classList.add('hidden');
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

    // Format time (remove seconds if present)
    const formatTime = (time) => {
        if (!time) return '--:--';
        const parts = time.split(':');
        return `${parts[0]}:${parts[1]}`;
    };

    elements.sehriTime.textContent = formatTime(times.sehri);
    elements.fajrTime.textContent = formatTime(times.fajr);
    elements.sunriseTime.textContent = formatTime(times.sunrise);
    elements.istiwaTime.textContent = formatTime(times.istiwa);
    elements.zohrTime.textContent = formatTime(times.zohr);
    elements.asrTime.textContent = formatTime(times.asr);
    elements.sunsetTime.textContent = formatTime(times.sunset);
    elements.maghribTime.textContent = formatTime(times.maghrib);
    elements.eshaTime.textContent = formatTime(times.esha);

    // Show altitude adjustment note if applicable
    if (data.altitudeAdjustment && 
        (data.altitudeAdjustment.sunrise_adjustment !== 0 || 
         data.altitudeAdjustment.sunset_adjustment !== 0)) {
        elements.altitudeValue.textContent = state.selectedLocation.altitude;
        elements.altitudeNote.classList.remove('hidden');
    } else {
        elements.altitudeNote.classList.add('hidden');
    }

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
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
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
                document.querySelector(`input[name="madhab"][value="${prefs.madhab}"]`).checked = true;
            }
        }
    } catch (error) {
        console.error('Error loading preferences:', error);
    }
}
