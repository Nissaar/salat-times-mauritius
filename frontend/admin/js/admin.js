// Admin Panel JavaScript

const API_BASE = '/api';

// State
let state = {
    token: null,
    user: null,
    currentTab: 'dashboard'
};

// DOM Elements
const elements = {
    loginModal: document.getElementById('loginModal'),
    registerModal: document.getElementById('registerModal'),
    adminDashboard: document.getElementById('adminDashboard'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    loginError: document.getElementById('loginError'),
    registerMessage: document.getElementById('registerMessage'),
    showRegister: document.getElementById('showRegister'),
    backToLogin: document.getElementById('backToLogin'),
    userName: document.getElementById('userName'),
    logoutBtn: document.getElementById('logoutBtn')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeAdmin();
});

function initializeAdmin() {
    // Check for saved token
    const savedToken = localStorage.getItem('adminToken');
    const savedUser = localStorage.getItem('adminUser');
    
    if (savedToken && savedUser) {
        state.token = savedToken;
        state.user = JSON.parse(savedUser);
        showDashboard();
    }

    setupEventListeners();
}

function setupEventListeners() {
    // Login form
    elements.loginForm.addEventListener('submit', handleLogin);
    
    // Register form
    elements.registerForm.addEventListener('submit', handleRegister);
    
    // Toggle between login and register
    elements.showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        elements.loginModal.classList.add('hidden');
        elements.registerModal.classList.remove('hidden');
    });
    
    elements.backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        elements.registerModal.classList.add('hidden');
        elements.loginModal.classList.remove('hidden');
    });
    
    // Logout
    elements.logoutBtn.addEventListener('click', handleLogout);
    
    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    });
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }
        
        state.token = data.token;
        state.user = data.user;
        
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.user));
        
        showDashboard();
    } catch (error) {
        elements.loginError.textContent = error.message;
        elements.loginError.classList.remove('hidden');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('regFullName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const reason = document.getElementById('regReason').value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, password, reason })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }
        
        elements.registerMessage.textContent = 'Registration submitted! Please wait for admin approval.';
        elements.registerMessage.classList.remove('hidden');
        elements.registerMessage.classList.add('success');
        elements.registerForm.reset();
    } catch (error) {
        elements.registerMessage.textContent = error.message;
        elements.registerMessage.classList.remove('hidden', 'success');
    }
}

function handleLogout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    
    elements.adminDashboard.classList.add('hidden');
    elements.loginModal.classList.remove('hidden');
    elements.loginForm.reset();
    elements.loginError.classList.add('hidden');
}

function showDashboard() {
    elements.loginModal.classList.add('hidden');
    elements.registerModal.classList.add('hidden');
    elements.adminDashboard.classList.remove('hidden');
    
    elements.userName.textContent = state.user.fullName;
    
    loadDashboardData();
}

// API helpers
async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.token}`,
            ...options.headers
        }
    });
    
    if (response.status === 401) {
        handleLogout();
        throw new Error('Session expired. Please login again.');
    }
    
    return response;
}

// Dashboard
async function loadDashboardData() {
    try {
        // Load stats
        const statsResponse = await apiRequest('/admin/stats');
        const stats = await statsResponse.json();
        
        document.getElementById('statUsers').textContent = stats.users;
        document.getElementById('statLocations').textContent = stats.locations;
        document.getElementById('statPrayerTimes').textContent = stats.prayerTimesEntries;
        document.getElementById('statPending').textContent = stats.pendingRegistrations;
        
        // Load pending registrations
        loadPendingRegistrations();
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

async function loadPendingRegistrations() {
    try {
        const response = await apiRequest('/admin/registration-requests');
        const requests = await response.json();
        
        const container = document.getElementById('pendingList');
        
        if (requests.length === 0) {
            container.innerHTML = '<p class="no-data">No pending requests</p>';
            return;
        }
        
        container.innerHTML = requests.map(req => `
            <div class="pending-item" data-id="${req.id}">
                <div class="pending-info">
                    <strong>${req.full_name}</strong>
                    <span>${req.email}</span>
                    ${req.reason ? `<p style="margin-top: 0.5rem; font-size: 0.85rem;">${req.reason}</p>` : ''}
                </div>
                <div class="pending-actions">
                    <button class="btn btn-small btn-success" onclick="approveRequest(${req.id})">✓ Approve</button>
                    <button class="btn btn-small btn-danger" onclick="rejectRequest(${req.id})">✗ Reject</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading pending registrations:', error);
    }
}

async function approveRequest(id) {
    try {
        const role = prompt('Assign role (admin/editor/viewer):', 'viewer');
        if (!role) return;
        
        await apiRequest(`/admin/registration-requests/${id}/approve`, {
            method: 'POST',
            body: JSON.stringify({ role })
        });
        
        loadPendingRegistrations();
        loadDashboardData();
        alert('Registration approved!');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function rejectRequest(id) {
    try {
        const reason = prompt('Rejection reason (optional):');
        
        await apiRequest(`/admin/registration-requests/${id}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });
        
        loadPendingRegistrations();
        loadDashboardData();
        alert('Registration rejected.');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Tab switching
function switchTab(tabName) {
    state.currentTab = tabName;
    
    // Update nav
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}Tab`);
    });
    
    // Load tab data
    switch(tabName) {
        case 'users':
            loadUsers();
            break;
        case 'adjustments':
            loadAdjustments();
            break;
        case 'prayer-times':
            initPrayerTimesCalendar();
            break;
    }
}

// Users management
async function loadUsers() {
    try {
        const response = await apiRequest('/admin/users');
        const users = await response.json();
        
        const tbody = document.getElementById('usersBody');
        
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.full_name}</td>
                <td>${user.email}</td>
                <td>
                    <select onchange="updateUserRole(${user.id}, this.value)" ${user.id === state.user.id ? 'disabled' : ''}>
                        <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                        <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>
                    <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
                        ${user.is_active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
                <td>
                    ${user.id !== state.user.id ? `
                        <button class="btn btn-small ${user.is_active ? 'btn-danger' : 'btn-success'}" 
                                onclick="toggleUserStatus(${user.id}, ${!user.is_active})">
                            ${user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                    ` : '-'}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function updateUserRole(userId, role) {
    try {
        await apiRequest(`/admin/users/${userId}/role`, {
            method: 'PATCH',
            body: JSON.stringify({ role })
        });
        alert('Role updated!');
    } catch (error) {
        alert('Error: ' + error.message);
        loadUsers();
    }
}

async function toggleUserStatus(userId, active) {
    try {
        await apiRequest(`/admin/users/${userId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ active })
        });
        loadUsers();
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Adjustments management
async function loadAdjustments() {
    try {
        const response = await fetch(`${API_BASE}/adjustments`);
        const adjustments = await response.json();
        
        const tbody = document.getElementById('adjustmentsBody');
        
        tbody.innerHTML = adjustments.map(adj => `
            <tr>
                <td>${adj.altitude_min} - ${adj.altitude_max}m</td>
                <td>${adj.sunrise_adjustment > 0 ? '+' : ''}${adj.sunrise_adjustment}</td>
                <td>${adj.sunset_adjustment > 0 ? '+' : ''}${adj.sunset_adjustment}</td>
                <td>${adj.description || '-'}</td>
                <td>
                    <button class="btn btn-small btn-outline" onclick="editAdjustment(${adj.id})">Edit</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading adjustments:', error);
    }
}

async function editAdjustment(id) {
    const sunrise = prompt('Sunrise adjustment (minutes, e.g., -2):');
    if (sunrise === null) return;
    
    const sunset = prompt('Sunset adjustment (minutes, e.g., 2):');
    if (sunset === null) return;
    
    try {
        await apiRequest(`/adjustments/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                sunriseAdjustment: parseInt(sunrise),
                sunsetAdjustment: parseInt(sunset)
            })
        });
        loadAdjustments();
        alert('Adjustment updated!');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Prayer Times management - Calendar View
let currentMonth = new Date().getMonth() + 1; // 1-12
let prayerTimesData = {}; // Cache for loaded data

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];

let calendarInitialized = false;

async function initPrayerTimesCalendar() {
    // Only initialize once
    if (calendarInitialized) {
        renderCalendar();
        return;
    }
    
    // Load all prayer times data
    await loadAllPrayerTimes();
    
    // Set up event listeners for month navigation
    document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
    document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
    
    // Month select dropdown
    document.getElementById('monthSelect').addEventListener('change', (e) => {
        currentMonth = parseInt(e.target.value);
        renderCalendar();
    });
    
    // Delete button
    document.getElementById('deleteTimesBtn').addEventListener('click', deleteDayTimes);
    
    // Form submit
    document.getElementById('editPrayerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveDayTimes();
    });
    
    calendarInitialized = true;
    
    // Render current month
    renderCalendar();
}

async function loadAllPrayerTimes() {
    try {
        // Load all prayer times for the year
        const response = await apiRequest('/prayer-times/admin/all');
        const times = await response.json();
        
        // Index by day of year
        prayerTimesData = {};
        times.forEach(t => {
            prayerTimesData[t.day_of_year] = t;
        });
        
        updateStats();
    } catch (error) {
        console.error('Error loading prayer times:', error);
    }
}

function updateStats() {
    const totalDays = 366; // Leap year
    const filledDays = Object.keys(prayerTimesData).length;
    const remaining = totalDays - filledDays;
    const percentage = ((filledDays / totalDays) * 100).toFixed(1);
    
    document.getElementById('daysFilled').textContent = `${filledDays} / ${totalDays}`;
    document.getElementById('daysRemaining').textContent = remaining;
    
    // Update progress bar
    const progressFill = document.getElementById('progressFill');
    progressFill.style.width = `${Math.max(parseFloat(percentage), 5)}%`; // Min 5% to show 0%
    progressFill.textContent = `${percentage}%`;
}

function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth < 1) currentMonth = 12;
    if (currentMonth > 12) currentMonth = 1;
    document.getElementById('monthSelect').value = currentMonth;
    renderCalendar();
}

function renderCalendar() {
    const daysInMonth = new Date(2024, currentMonth, 0).getDate();
    document.getElementById('monthSelect').value = currentMonth;
    
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayOfYear = getDayOfYear(currentMonth, day);
        const hasTimes = prayerTimesData[dayOfYear];
        
        const dayDiv = document.createElement('div');
        dayDiv.className = `calendar-day ${hasTimes ? 'day-filled' : 'day-empty'}`;
        dayDiv.innerHTML = `
            <div class="day-number">${day}</div>
            <div class="day-status">${hasTimes ? 'Filled' : 'Empty'}</div>
        `;
        dayDiv.addEventListener('click', () => openEditModal(day, dayOfYear));
        
        grid.appendChild(dayDiv);
    }
}

function getDayOfYear(month, day) {
    const date = new Date(2024, month - 1, day);
    const start = new Date(2024, 0, 0);
    const diff = date - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function openEditModal(day, dayOfYear) {
    const existing = prayerTimesData[dayOfYear] || {};
    
    // Set modal title
    document.getElementById('modalDateLabel').textContent = `${monthNames[currentMonth - 1]} ${day}`;
    document.getElementById('modalDayOfYear').textContent = dayOfYear;
    
    // Store current editing context
    document.getElementById('editDay').value = day;
    document.getElementById('editMonth').value = currentMonth;
    document.getElementById('editDayOfYear').value = dayOfYear;
    
    // Format time helper
    const formatTime = (t) => t ? t.substring(0, 5) : '';
    
    // Fill form with existing times or empty
    document.getElementById('editSehri').value = formatTime(existing.sehri_time);
    document.getElementById('editFajr').value = formatTime(existing.fajr_time);
    document.getElementById('editSunriseStart').value = formatTime(existing.sunrise_start_time || existing.sunrise_time);
    document.getElementById('editSunriseEnd').value = formatTime(existing.sunrise_end_time);
    document.getElementById('editIstiwaStart').value = formatTime(existing.istiwa_start_time || existing.istiwa_time);
    document.getElementById('editIstiwaEnd').value = formatTime(existing.istiwa_end_time);
    document.getElementById('editZohr').value = formatTime(existing.zohr_time);
    document.getElementById('editAsrHanafi').value = formatTime(existing.asr_hanafi_time);
    document.getElementById('editAsrShafii').value = formatTime(existing.asr_shafii_time);
    document.getElementById('editSunsetStart').value = formatTime(existing.sunset_start_time || existing.sunset_time);
    document.getElementById('editSunsetEnd').value = formatTime(existing.sunset_end_time);
    document.getElementById('editMaghrib').value = formatTime(existing.maghrib_time || existing.maghrib_hanafi_time);
    document.getElementById('editEshaHanafi').value = formatTime(existing.esha_hanafi_time);
    document.getElementById('editEshaShafii').value = formatTime(existing.esha_shafii_time);
    
    // Show/hide delete button based on whether times exist
    document.getElementById('deleteTimesBtn').style.display = existing.id ? 'inline-block' : 'none';
    
    // Show modal
    document.getElementById('editPrayerModal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('editPrayerModal').classList.add('hidden');
}

// Make closeEditModal globally available for onclick handlers
window.closeEditModal = closeEditModal;

async function saveDayTimes() {
    const day = parseInt(document.getElementById('editDay').value);
    const month = parseInt(document.getElementById('editMonth').value);
    const dayOfYear = parseInt(document.getElementById('editDayOfYear').value);
    
    const maghribValue = document.getElementById('editMaghrib').value;
    
    const times = {
        dayOfYear,
        month,
        day,
        sehri: document.getElementById('editSehri').value,
        fajr: document.getElementById('editFajr').value,
        sunriseStart: document.getElementById('editSunriseStart').value,
        sunriseEnd: document.getElementById('editSunriseEnd').value,
        sunrise: document.getElementById('editSunriseStart').value, // For backward compatibility
        istiwaStart: document.getElementById('editIstiwaStart').value,
        istiwaEnd: document.getElementById('editIstiwaEnd').value,
        istiwa: document.getElementById('editIstiwaStart').value, // For backward compatibility
        zohr: document.getElementById('editZohr').value,
        asrHanafi: document.getElementById('editAsrHanafi').value,
        asrShafii: document.getElementById('editAsrShafii').value,
        sunsetStart: document.getElementById('editSunsetStart').value,
        sunsetEnd: document.getElementById('editSunsetEnd').value,
        sunset: document.getElementById('editSunsetStart').value, // For backward compatibility
        maghrib: maghribValue,
        maghribHanafi: maghribValue, // Same for both
        maghribShafii: maghribValue, // Same for both
        eshaHanafi: document.getElementById('editEshaHanafi').value,
        eshaShafii: document.getElementById('editEshaShafii').value
    };
    
    // Validate at least one field is filled
    const hasAnyTime = Object.values(times).some(v => v && typeof v === 'string' && v.includes(':'));
    if (!hasAnyTime) {
        alert('Please enter at least one prayer time.');
        return;
    }
    
    try {
        const response = await apiRequest('/prayer-times/bulk', {
            method: 'POST',
            body: JSON.stringify({ times: [times] })
        });
        
        if (!response.ok) {
            throw new Error('Save failed');
        }
        
        // Reload data and update UI
        await loadAllPrayerTimes();
        renderCalendar();
        closeEditModal();
        
        alert('Prayer times saved successfully!');
    } catch (error) {
        alert('Error saving prayer times: ' + error.message);
    }
}

async function deleteDayTimes() {
    if (!confirm('Are you sure you want to delete prayer times for this day?')) {
        return;
    }
    
    const dayOfYear = parseInt(document.getElementById('editDayOfYear').value);
    
    const existing = prayerTimesData[dayOfYear];
    if (!existing || !existing.id) {
        alert('No times to delete.');
        return;
    }
    
    try {
        const response = await apiRequest(`/prayer-times/${existing.id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Delete failed');
        }
        
        // Reload data and update UI
        await loadAllPrayerTimes();
        renderCalendar();
        closeEditModal();
        
        alert('Prayer times deleted successfully!');
    } catch (error) {
        alert('Error deleting prayer times: ' + error.message);
    }
}

// Make functions globally available for onclick handlers
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
window.updateUserRole = updateUserRole;
window.toggleUserStatus = toggleUserStatus;
window.editAdjustment = editAdjustment;
