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
    
    // Month select
    document.getElementById('loadMonthBtn').addEventListener('click', loadMonth);
    
    // Save prayer times
    document.getElementById('savePrayerTimesBtn').addEventListener('click', savePrayerTimes);
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

// Prayer Times management
async function loadMonth() {
    const month = document.getElementById('monthSelect').value;
    
    try {
        const response = await apiRequest(`/prayer-times/admin/month/${month}`);
        const times = await response.json();
        
        generatePrayerTimesTable(parseInt(month), times);
    } catch (error) {
        console.error('Error loading month:', error);
        generatePrayerTimesTable(parseInt(month), []);
    }
}

function generatePrayerTimesTable(month, existingTimes) {
    const daysInMonth = new Date(2024, month, 0).getDate(); // Using 2024 as reference (leap year)
    const tbody = document.getElementById('prayerTimesBody');
    
    // Create lookup for existing times
    const timesMap = {};
    existingTimes.forEach(t => {
        timesMap[t.day] = t;
    });
    
    let html = '';
    
    for (let day = 1; day <= daysInMonth; day++) {
        const existing = timesMap[day] || {};
        const formatTime = (t) => t ? t.substring(0, 5) : '';
        
        html += `
            <tr data-day="${day}" data-month="${month}">
                <td><strong>${day}</strong></td>
                <td><input type="text" class="time-input" data-field="sehri" value="${formatTime(existing.sehri_time)}" placeholder="05:00"></td>
                <td><input type="text" class="time-input" data-field="fajr" value="${formatTime(existing.fajr_time)}" placeholder="05:15"></td>
                <td><input type="text" class="time-input" data-field="sunrise" value="${formatTime(existing.sunrise_time)}" placeholder="06:30"></td>
                <td><input type="text" class="time-input" data-field="istiwa" value="${formatTime(existing.istiwa_time)}" placeholder="12:15"></td>
                <td><input type="text" class="time-input" data-field="zohr" value="${formatTime(existing.zohr_time)}" placeholder="12:20"></td>
                <td><input type="text" class="time-input" data-field="asrHanafi" value="${formatTime(existing.asr_hanafi_time)}" placeholder="15:45"></td>
                <td><input type="text" class="time-input" data-field="asrShafii" value="${formatTime(existing.asr_shafii_time)}" placeholder="15:15"></td>
                <td><input type="text" class="time-input" data-field="sunset" value="${formatTime(existing.sunset_time)}" placeholder="18:00"></td>
                <td><input type="text" class="time-input" data-field="maghribHanafi" value="${formatTime(existing.maghrib_hanafi_time)}" placeholder="18:05"></td>
                <td><input type="text" class="time-input" data-field="maghribShafii" value="${formatTime(existing.maghrib_shafii_time)}" placeholder="18:03"></td>
                <td><input type="text" class="time-input" data-field="eshaHanafi" value="${formatTime(existing.esha_hanafi_time)}" placeholder="19:15"></td>
                <td><input type="text" class="time-input" data-field="eshaShafii" value="${formatTime(existing.esha_shafii_time)}" placeholder="19:10"></td>
            </tr>
        `;
    }
    
    tbody.innerHTML = html;
}

async function savePrayerTimes() {
    const rows = document.querySelectorAll('#prayerTimesBody tr');
    const times = [];
    
    rows.forEach(row => {
        const day = parseInt(row.dataset.day);
        const month = parseInt(row.dataset.month);
        
        // Calculate day of year
        const date = new Date(2024, month - 1, day);
        const start = new Date(2024, 0, 0);
        const diff = date - start;
        const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        const getValue = (field) => {
            const input = row.querySelector(`input[data-field="${field}"]`);
            return input ? input.value : '';
        };
        
        // Only include if at least one time is filled
        const sehri = getValue('sehri');
        if (sehri) {
            times.push({
                dayOfYear,
                month,
                day,
                sehri,
                fajr: getValue('fajr'),
                sunrise: getValue('sunrise'),
                istiwa: getValue('istiwa'),
                zohr: getValue('zohr'),
                asrHanafi: getValue('asrHanafi'),
                asrShafii: getValue('asrShafii'),
                sunset: getValue('sunset'),
                maghribHanafi: getValue('maghribHanafi'),
                maghribShafii: getValue('maghribShafii'),
                eshaHanafi: getValue('eshaHanafi'),
                eshaShafii: getValue('eshaShafii')
            });
        }
    });
    
    if (times.length === 0) {
        alert('No prayer times to save. Please enter at least one day\'s times.');
        return;
    }
    
    const saveStatus = document.getElementById('saveStatus');
    saveStatus.textContent = 'Saving...';
    saveStatus.className = 'save-status';
    
    try {
        const response = await apiRequest('/prayer-times/bulk', {
            method: 'POST',
            body: JSON.stringify({ times })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Save failed');
        }
        
        saveStatus.textContent = `✓ Saved! ${result.inserted} new, ${result.updated} updated`;
        saveStatus.className = 'save-status success';
    } catch (error) {
        saveStatus.textContent = `✗ Error: ${error.message}`;
        saveStatus.className = 'save-status error';
    }
}

// Make functions globally available for onclick handlers
window.approveRequest = approveRequest;
window.rejectRequest = rejectRequest;
window.updateUserRole = updateUserRole;
window.toggleUserStatus = toggleUserStatus;
window.editAdjustment = editAdjustment;
