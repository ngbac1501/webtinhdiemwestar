import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    getDocs,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    limit,
    writeBatch,
    serverTimestamp,
    onSnapshot,
    where
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { performanceOptimizer } from "./js/modules/performance-optimizer.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDtFpBAuZ_3JHmMXq1uVShq4sm0zK9xqEI",
    authDomain: "tinhdiemtheog.firebaseapp.com",
    projectId: "tinhdiemtheog",
    storageBucket: "tinhdiemtheog.firebasestorage.app",
    messagingSenderId: "52564586448",
    appId: "1:52564586448:web:983bdc321423b81f5a53d5",
    measurementId: "G-PFTMHMTF6J"
};

// Global variables
let db, auth;
let currentUser = null;
let isAdminUser = false;
let currentTab = 'dashboard';
let currentEditingItem = null;
let currentCollection = '';
let unsubscribeFunctions = {};
let dashboardLoaded = false;  // Khai báo biến để tránh ReferenceError

let topRacers = [];
let topRacersLoading = false;

// Chart instances
let carsRarityChart = null;
let recordsMonthChart = null;

// Filter variables
let carsFilters = {
    rarity: 'all',
    type: 'all',
    search: ''
};

let mapsFilters = {
    difficulty: 'all',
    search: ''
};

let petsFilters = {
    rarity: 'all',
    type: 'all',
    search: ''
};

let usersFilters = {
    role: 'all',
    status: 'all',
    isAdmin: 'all',
    isNewUser: 'all',
    search: ''
};

let recordsFilters = {
    map: 'all',
    racer: '',
    car: '',
    time: 'all',
    garbage: 'all',
    sort: 'time_asc'
};

let allCars = [];
let allPets = [];
let filteredCars = [];
let filteredMaps = [];
let filteredPets = [];
let filteredUsers = [];

// Chart instances
let usersRoleChart = null;  // THÊM MỚI
let mapsDifficultyChart = null;  // THÊM MỚI

// Pagination variables
let currentPage = {
    'gameCars': 1,
    'gameMaps': 1,
    'gamePets': 1,
    'raceRecords': 1,
    'users': 1,
    'notifications': 1,
    'banners': 1
};

const itemsPerPage = 10;
let allRecords = [];
let filteredRecords = [];
let selectedRecords = new Set(); // Cho bulk delete
let deletedRecordsBackup = []; // Cho undo delete
let undoTimeoutId = null; // Timer cho undo toast
let allUsers = [];
let allNotifications = [];
let filteredNotifications = [];
let unreadNotificationCount = 0;
let notificationFilters = {
    type: 'all',
    status: 'all'
};
let allMaps = [];
let currentMapFilter = 'all';
let isTop10View = false;

// Initialize Firebase
const initFirebase = async () => {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Export db cho các modules sử dụng
        window.firestoreDb = db;

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                await checkAdminStatus(user);
            } else {
                window.location.href = 'login.html';
            }
        });
    } catch (error) {
        console.error("Firebase initialization error:", error);
        showMessage("Lỗi khởi tạo Firebase!", true);
    }
};

// Check admin status and load user info
const checkAdminStatus = async (user) => {
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            isAdminUser = userData.isAdmin || false;

            if (isAdminUser) {
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('app').classList.remove('hidden');

                document.getElementById('user-name').textContent = user.displayName || 'Admin';
                document.getElementById('user-email').textContent = user.email;

                // Cập nhật hiển thị tên và nickname ở realtime-status
                const displayName = userData.displayName || user.displayName || 'Admin';
                const nickname = userData.nickname || '';
                const statusText = nickname ? `${displayName} (${nickname})` : displayName;
                document.getElementById('realtime-status').textContent = statusText;

                // Hiển thị avatar - ưu tiên Base64 nếu có
                const avatarEl = document.getElementById('user-avatar');
                if (userData.photoBase64) {
                    avatarEl.src = userData.photoBase64;
                } else if (userData.photoURL) {
                    avatarEl.src = userData.photoURL;
                } else if (user.photoURL) {
                    avatarEl.src = user.photoURL;
                }

                // Add error handler for broken images (403 Forbidden from FB/Google)
                avatarEl.onerror = function () {
                    this.onerror = null; // Prevent infinite loop
                    this.src = 'assets/images/default-avatar.png';
                };

                // Tải dữ liệu dashboard khi vào trang
                await loadDashboardStats();

                // Setup realtime listeners
                setupRealtimeListeners();

                // Load notifications
                await loadNotifications();
            } else {
                showMessage("Bạn không có quyền truy cập trang này!", true);
                setTimeout(() => window.location.href = 'index.html', 2000);
            }
        } else {
            showMessage("Không tìm thấy thông tin người dùng!", true);
            setTimeout(() => window.location.href = 'index.html', 2000);
        }
    } catch (error) {
        console.error("Error checking admin status:", error);
        showMessage("Lỗi kiểm tra quyền truy cập!", true);
    }
};

// Setup realtime listeners
const setupRealtimeListeners = () => {
    console.log("Setting up realtime listeners...");

    // Listener cho banner
    if (!unsubscribeFunctions.banners) {
        unsubscribeFunctions.banners = onSnapshot(collection(db, "banners"), async (snapshot) => {
            if (currentTab === 'banners') {
                await loadCollectionData('banners', currentPage['banners'] || 1);
            }
        });
    }

    // Listener cho xe
    if (!unsubscribeFunctions.gameCars) {
        unsubscribeFunctions.gameCars = onSnapshot(collection(db, "gameCars"), async (snapshot) => {
            document.getElementById('total-cars').textContent = snapshot.size;

            // Cập nhật chart khi ở tab dashboard
            if (currentTab === 'dashboard') {
                updateCarsRarityChart(snapshot);
            }

            // Cập nhật table khi ở tab cars
            if (currentTab === 'cars') {
                await loadCollectionData('gameCars', currentPage['gameCars']);
            }
        });
    }

    // Listener cho kỷ lục
    if (!unsubscribeFunctions.raceRecords) {
        unsubscribeFunctions.raceRecords = onSnapshot(collection(db, "raceRecords"), async (snapshot) => {
            document.getElementById('total-records').textContent = snapshot.size;

            // Cập nhật chart khi ở tab dashboard
            if (currentTab === 'dashboard') {
                updateRecordsMonthChart(snapshot);
            }

            // Luôn cập nhật allRecords và export ra window
            allRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            window.allRecords = allRecords; // Export cho các modules khác sử dụng

            // Tự động đồng bộ kỷ lục cao nhất của các bản đồ
            if (typeof window.syncMapRecordsWithRecordsTab === 'function') {
                window.syncMapRecordsWithRecordsTab();
            }

            // Cập nhật table khi ở tab records
            if (currentTab === 'records') {
                filterRecords(currentPage['raceRecords']);
            }
        });
    }

    // Listener cho người dùng
    if (!unsubscribeFunctions.users) {
        unsubscribeFunctions.users = onSnapshot(collection(db, "users"), (snapshot) => {
            document.getElementById('total-users').textContent = snapshot.size;

            // Luôn cập nhật allUsers và export ra window
            allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            window.allUsers = allUsers; // Export cho các modules khác sử dụng

            if (currentTab === 'users') {
                const totalItems = allUsers.length;
                const totalPages = Math.ceil(totalItems / itemsPerPage);
                const startIndex = (currentPage['users'] - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const pageData = allUsers.slice(startIndex, endIndex);
                renderTable('users', pageData);
                renderPagination('users', totalItems, currentPage['users']);
            }
        });
    }


    // Listener cho notifications
    if (!unsubscribeFunctions.notifications) {
        unsubscribeFunctions.notifications = onSnapshot(
            query(collection(db, "notifications"), orderBy("timestamp", "desc")),
            async (snapshot) => {
                allNotifications = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    read: doc.data().read !== undefined ? doc.data().read : false
                }));

                // Cập nhật số lượng thông báo chưa đọc
                updateNotificationCount();

                // Cập nhật tổng số thông báo
                document.getElementById('total-notifications').textContent = allNotifications.length;

                // Cập nhật table khi ở tab notifications
                if (currentTab === 'notifications') {
                    renderNotifications();
                }
            }
        );
    }

    // Listener cho activity log
    if (!unsubscribeFunctions.activityLog) {
        unsubscribeFunctions.activityLog = onSnapshot(
            query(collection(db, "activityLog"), orderBy("timestamp", "desc"), limit(5)),
            (snapshot) => {
                if (currentTab === 'dashboard') {
                    loadRecentActivity(snapshot);
                }
            }
        );
    }
};

// Load dashboard stats
const loadDashboardStats = async () => {
    try {
        console.log("Loading dashboard stats...");

        const [carsSnapshot, recordsSnapshot, usersSnapshot, notificationsSnapshot, mapsSnapshot, petsSnapshot] = await Promise.all([
            performanceOptimizer.fetchWithCache('gameCars', async () => { const snap = await getDocs(collection(db, "gameCars")); return snap; }),
            performanceOptimizer.fetchWithCache('raceRecords', async () => { const snap = await getDocs(collection(db, "raceRecords")); return snap; }),
            performanceOptimizer.fetchWithCache('users', async () => { const snap = await getDocs(collection(db, "users")); return snap; }),
            getDocs(query(collection(db, "notifications"), orderBy("timestamp", "desc"))), // Realtime better for notifications
            performanceOptimizer.fetchWithCache('gameMaps', async () => { const snap = await getDocs(collection(db, "gameMaps")); return snap; }),
            performanceOptimizer.fetchWithCache('gamePets', async () => { const snap = await getDocs(collection(db, "gamePets")); return snap; })
        ]);

        // Update basic stats
        document.getElementById('total-cars').textContent = carsSnapshot.size;
        document.getElementById('total-records').textContent = recordsSnapshot.size;
        document.getElementById('total-users').textContent = usersSnapshot.size;
        document.getElementById('total-notifications').textContent = notificationsSnapshot.size;

        // Update additional stats
        const totalMapsEl = document.getElementById('total-maps');
        const totalPetsEl = document.getElementById('total-pets');
        if (totalMapsEl) totalMapsEl.textContent = mapsSnapshot.size;
        if (totalPetsEl) totalPetsEl.textContent = petsSnapshot.size;

        // Calculate active users
        let activeUsersCount = 0;
        let adminUsersCount = 0;
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.status === 'active') activeUsersCount++;
            if (userData.isAdmin === true) adminUsersCount++;
        });

        const activeUsersEl = document.getElementById('active-users');
        const adminUsersEl = document.getElementById('admin-users');
        if (activeUsersEl) activeUsersEl.textContent = activeUsersCount;
        if (adminUsersEl) adminUsersEl.textContent = adminUsersCount;

        // Calculate today's records
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let todayRecordsCount = 0;

        recordsSnapshot.forEach(doc => {
            const recordData = doc.data();
            if (recordData.timestamp) {
                const recordDate = new Date(recordData.timestamp);
                recordDate.setHours(0, 0, 0, 0);
                if (recordDate.getTime() === today.getTime()) {
                    todayRecordsCount++;
                }
            }
        });

        const recordsTodayEl = document.getElementById('records-today');
        const recordsTodayCountEl = document.getElementById('records-today-count');
        if (recordsTodayEl) recordsTodayEl.textContent = todayRecordsCount;
        if (recordsTodayCountEl) recordsTodayCountEl.textContent = todayRecordsCount;

        // Calculate new users (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        let newUsersCount = 0;

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.createdAt) {
                const createdDate = new Date(userData.createdAt);
                if (createdDate >= sevenDaysAgo) {
                    newUsersCount++;
                }
            }
        });

        const newUsersEl = document.getElementById('new-users');
        if (newUsersEl) newUsersEl.textContent = newUsersCount;

        // Update charts
        updateCarsRarityChart(carsSnapshot);
        updateRecordsMonthChart(recordsSnapshot);
        updateUsersRoleChart(usersSnapshot);
        updateMapsDifficultyChart(mapsSnapshot);

        // Load recent activity
        await loadRecentActivity();

        // Load top racers
        await loadTopRacers();

        dashboardLoaded = true;
        console.log("Dashboard stats loaded");

    } catch (error) {
        console.error("Error loading dashboard stats:", error);
    }
};



// Refresh dashboard
window.refreshDashboard = async () => {
    await loadDashboardStats();
    showMessage("Đã làm mới dashboard!");
};

// Helper function needed for avatar colors
window.getAvatarColor = (name) => {
    const colors = [
        'linear-gradient(135deg, #00f3ff, #0066ff)',
        'linear-gradient(135deg, #9d00ff, #ff0066)',
        'linear-gradient(135deg, #00ff9d, #00f3ff)',
        'linear-gradient(135deg, #ff0066, #9d00ff)',
        'linear-gradient(135deg, #0066ff, #00ff9d)',
        'linear-gradient(135deg, #ffa726, #ff0066)'
    ];
    if (!name || name === 'Unknown') return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
};

window.getDifficultyColorClass = (difficulty) => {
    const difficultyMap = {
        'Dễ': 'difficulty-easy',
        'Trung bình': 'difficulty-medium',
        'Khó': 'difficulty-hard',
        'Rất khó': 'difficulty-very-hard',
        'Cực khó': 'difficulty-extreme',
        '3 sao': 'difficulty-easy',
        '4 sao': 'difficulty-medium',
        '5 sao': 'difficulty-hard',
        '6 sao': 'difficulty-very-hard',
        '7 sao': 'difficulty-extreme',
        'Dễ (3 sao)': 'difficulty-easy',
        'Trung bình (4 sao)': 'difficulty-medium',
        'Khó (5 sao)': 'difficulty-hard',
        'Rất khó (6 sao)': 'difficulty-very-hard',
        'Cực khó (7 sao)': 'difficulty-extreme'
    };
    return difficultyMap[difficulty] || '';
};

// Parse race time (Helper reused)
window.parseRaceTime = (timeString) => {
    if (!timeString || timeString === "--'--'--" || timeString === "N/A") return Infinity;
    try {
        let cleanTime = timeString.trim();
        if (cleanTime.includes(':')) cleanTime = cleanTime.replace(/:/g, "'");
        const parts = cleanTime.split("'");
        if (parts.length >= 2) {
            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseInt(parts[1]) || 0;
            const milliseconds = parts.length > 2 ? (parseInt(parts[2]) || 0) : 0;
            return minutes * 60 + seconds + milliseconds / 100;
        }
        return Infinity;
    } catch (error) {
        return Infinity;
    }
};

// Get best record for a map from allRecords (Tab Kỷ lục)
window.getBestRecordForMap = (mapName) => {
    if (!mapName || !allRecords || allRecords.length === 0) return null;

    const cleanName = mapName.trim().toLowerCase();
    const mapRecords = allRecords.filter(r => {
        if (!r || !r.mapName) return false;
        return r.mapName.trim().toLowerCase() === cleanName;
    });

    if (mapRecords.length === 0) return null;

    const getTimeInSec = (r) => {
        if (!r) return Infinity;
        if (r.timeInSeconds !== undefined && r.timeInSeconds !== null && r.timeInSeconds !== '') {
            const parsed = parseFloat(r.timeInSeconds);
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
        if (r.timeString && window.parseRaceTime) {
            return window.parseRaceTime(r.timeString);
        }
        return Infinity;
    };

    mapRecords.sort((a, b) => {
        const diff = getTimeInSec(a) - getTimeInSec(b);
        if (Math.abs(diff) > 0.0001) return diff;
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
    });

    const best = mapRecords[0];
    const bestSec = getTimeInSec(best);
    if (bestSec === Infinity) return null;

    return {
        recordTime: best.timeString || '--\'--\'--',
        recordRacer: best.racerName || 'N/A',
        recordCar: best.car || 'N/A',
        recordPet: best.pet || 'N/A',
        recordRacerIndex: best.racerIndex !== undefined ? best.racerIndex : 0,
        timeInSeconds: bestSec,
        recordId: best.id
    };
};

// Auto sync map best records with raceRecords collection and Firestore
window.syncMapRecordsWithRecordsTab = async (targetMapName = null) => {
    try {
        if (!allMaps || allMaps.length === 0) return;

        const mapsToSync = targetMapName
            ? allMaps.filter(m => (m.name || '').trim().toLowerCase() === targetMapName.trim().toLowerCase())
            : allMaps;

        for (const mapItem of mapsToSync) {
            const bestRec = window.getBestRecordForMap(mapItem.name);
            const newTime = bestRec ? bestRec.recordTime : "--'--'--";
            const newRacer = bestRec ? bestRec.recordRacer : "";
            const newCar = bestRec ? bestRec.recordCar : "";
            const newPet = bestRec ? bestRec.recordPet : "";
            const newRacerIndex = bestRec ? bestRec.recordRacerIndex : -1;

            const needsUpdate = mapItem.recordTime !== newTime ||
                                mapItem.recordRacer !== newRacer ||
                                mapItem.recordCar !== newCar ||
                                mapItem.recordPet !== newPet ||
                                mapItem.recordRacerIndex !== newRacerIndex;

            if (needsUpdate) {
                mapItem.recordTime = newTime;
                mapItem.recordRacer = newRacer;
                mapItem.recordCar = newCar;
                mapItem.recordPet = newPet;
                mapItem.recordRacerIndex = newRacerIndex;

                if (db && mapItem.id) {
                    const mapRef = doc(db, "gameMaps", mapItem.id);
                    await updateDoc(mapRef, {
                        recordTime: newTime,
                        recordRacer: newRacer,
                        recordCar: newCar,
                        recordPet: newPet,
                        recordRacerIndex: newRacerIndex,
                        lastUpdated: serverTimestamp()
                    }).catch(err => console.warn(`Auto-sync warning for map ${mapItem.name}:`, err));
                }
            }
        }

        if (currentTab === 'maps') {
            filterMaps(currentPage['gameMaps'] || 1);
        }
    } catch (e) {
        console.error("Error in syncMapRecordsWithRecordsTab:", e);
    }
};

// Update cars rarity chart
const updateCarsRarityChart = (carsSnapshot) => {
    try {
        const chartElement = document.getElementById('cars-rarity-chart');
        if (!chartElement) return;

        if (carsRarityChart) {
            carsRarityChart.destroy();
            carsRarityChart = null;
        }

        const rarityCounts = {
            'Thần Thoại': 0,
            'Huyền Thoại': 0,
            'Hiếm': 0,
            'Thường': 0
        };

        carsSnapshot.forEach(doc => {
            const data = doc.data();
            const rarity = data.rarity || 'Thường';
            rarityCounts[rarity] = (rarityCounts[rarity] || 0) + 1;
        });

        const ctx = chartElement.getContext('2d');
        carsRarityChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(rarityCounts),
                datasets: [{
                    data: Object.values(rarityCounts),
                    backgroundColor: [
                        'rgba(157, 0, 255, 0.8)',
                        'rgba(255, 0, 102, 0.8)',
                        'rgba(0, 102, 255, 0.8)',
                        'rgba(100, 116, 139, 0.8)'
                    ],
                    borderWidth: 2,
                    borderColor: 'rgba(18, 18, 26, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e2e8f0',
                            font: { size: 12 }
                        }
                    }
                }
            }
        });

        // Update total count
        const totalEl = document.getElementById('cars-rarity-total');
        if (totalEl) {
            const total = Object.values(rarityCounts).reduce((a, b) => a + b, 0);
            totalEl.textContent = `${total} xe`;
        }

        chartElement.style.width = '100%';
        chartElement.style.height = '250px';

    } catch (error) {
        console.error("Error updating cars rarity chart:", error);
    }
};

// Update records month chart
const updateRecordsMonthChart = (recordsSnapshot) => {
    try {
        const chartElement = document.getElementById('records-month-chart');
        if (!chartElement) return;

        // Destroy existing chart if it exists
        if (recordsMonthChart) {
            recordsMonthChart.destroy();
            recordsMonthChart = null;
        }

        // Calculate monthly counts
        const monthlyCounts = {};
        recordsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.timestamp) {
                const date = new Date(data.timestamp);
                const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
                monthlyCounts[monthYear] = (monthlyCounts[monthYear] || 0) + 1;
            }
        });

        // Sort months chronologically
        const sortedMonths = Object.keys(monthlyCounts).sort((a, b) => {
            const [monthA, yearA] = a.split('/').map(Number);
            const [monthB, yearB] = b.split('/').map(Number);
            return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1);
        });

        const counts = sortedMonths.map(month => monthlyCounts[month]);
        const ctx = chartElement.getContext('2d');

        // Create new chart
        recordsMonthChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedMonths,
                datasets: [{
                    label: 'Số kỷ lục',
                    data: counts,
                    borderColor: 'rgba(0, 243, 255, 0.8)',
                    backgroundColor: 'rgba(0, 243, 255, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: 'rgba(0, 243, 255, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#e2e8f0',
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(0, 243, 255, 0.3)',
                        borderWidth: 1,
                        cornerRadius: 6
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            maxRotation: 45,
                            font: {
                                size: 10
                            }
                        },
                        title: {
                            display: true,
                            text: 'Tháng/Năm',
                            color: '#94a3b8',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            stepSize: 1,
                            precision: 0,
                            font: {
                                size: 10
                            }
                        },
                        title: {
                            display: true,
                            text: 'Số kỷ lục',
                            color: '#94a3b8',
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        },
                        beginAtZero: true
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                animation: {
                    duration: 750,
                    easing: 'easeInOutQuart'
                }
            }
        });

        // Update total count
        const totalEl = document.getElementById('records-month-total');
        if (totalEl) {
            const total = Object.values(monthlyCounts).reduce((a, b) => a + b, 0);
            totalEl.textContent = `${total} kỷ lục`;
        }

        // Set chart dimensions
        chartElement.style.width = '100%';
        chartElement.style.height = '250px';

        // Add responsive behavior
        const resizeHandler = () => {
            if (recordsMonthChart) {
                recordsMonthChart.resize();
            }
        };

        // Remove existing listener if any, then add new one
        window.removeEventListener('resize', resizeHandler);
        window.addEventListener('resize', resizeHandler);

        console.log(`Biểu đồ tháng đã cập nhật: ${sortedMonths.length} tháng, ${counts.reduce((a, b) => a + b, 0)} kỷ lục`);

    } catch (error) {
        console.error("Lỗi khi cập nhật biểu đồ kỷ lục theo tháng:", error);

        // Show error message on chart container
        const chartElement = document.getElementById('records-month-chart');
        if (chartElement) {
            chartElement.innerHTML = `
                <div style="color: #f87171; text-align: center; padding: 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
                    <p>Không thể tải biểu đồ</p>
                    <small>${error.message || 'Vui lòng thử lại'}</small>
                </div>
            `;
        }
    }
};

// Update users role chart
const updateUsersRoleChart = (usersSnapshot) => {
    try {
        const chartElement = document.getElementById('users-role-chart');
        if (!chartElement) return;

        if (usersRoleChart) {
            usersRoleChart.destroy();
            usersRoleChart = null;
        }

        const roleCounts = {
            'admin': 0,
            'racer': 0,
            'viewer': 0
        };

        usersSnapshot.forEach(doc => {
            const data = doc.data();
            const role = data.role || 'viewer';
            roleCounts[role] = (roleCounts[role] || 0) + 1;
        });

        const ctx = chartElement.getContext('2d');
        usersRoleChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Quản trị viên', 'Tay đua', 'Người xem'],
                datasets: [{
                    data: [roleCounts.admin, roleCounts.racer, roleCounts.viewer],
                    backgroundColor: [
                        'rgba(157, 0, 255, 0.8)',
                        'rgba(0, 243, 255, 0.8)',
                        'rgba(100, 116, 139, 0.8)'
                    ],
                    borderWidth: 2,
                    borderColor: 'rgba(18, 18, 26, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e2e8f0',
                            font: { size: 12 }
                        }
                    }
                }
            }
        });

        // Update total count
        const totalEl = document.getElementById('users-role-total');
        if (totalEl) {
            const total = roleCounts.admin + roleCounts.racer + roleCounts.viewer;
            totalEl.textContent = `${total} người`;
        }

        chartElement.style.width = '100%';
        chartElement.style.height = '250px';

    } catch (error) {
        console.error("Error updating users role chart:", error);
    }
};

// Update maps difficulty chart
const updateMapsDifficultyChart = (mapsSnapshot) => {
    try {
        const chartElement = document.getElementById('maps-difficulty-chart');
        if (!chartElement) return;

        if (mapsDifficultyChart) {
            mapsDifficultyChart.destroy();
            mapsDifficultyChart = null;
        }

        const difficultyCounts = {
            'Dễ (3 sao)': 0,
            'Trung bình (4 sao)': 0,
            'Khó (5 sao)': 0,
            'Rất khó (6 sao)': 0,
            'Cực khó (7 sao)': 0
        };

        mapsSnapshot.forEach(doc => {
            const data = doc.data();
            let difficulty = data.difficulty || 'Trung bình (4 sao)';
            // Chuẩn hóa dữ liệu cũ
            if (difficulty === 'Dễ' || difficulty === '3 sao') difficulty = 'Dễ (3 sao)';
            else if (difficulty === 'Trung bình' || difficulty === '4 sao') difficulty = 'Trung bình (4 sao)';
            else if (difficulty === 'Khó' || difficulty === '5 sao') difficulty = 'Khó (5 sao)';
            else if (difficulty === 'Rất khó' || difficulty === '6 sao') difficulty = 'Rất khó (6 sao)';
            else if (difficulty === 'Cực khó' || difficulty === '7 sao') difficulty = 'Cực khó (7 sao)';
            
            difficultyCounts[difficulty] = (difficultyCounts[difficulty] || 0) + 1;
        });

        const ctx = chartElement.getContext('2d');
        mapsDifficultyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(difficultyCounts),
                datasets: [{
                    label: 'Số lượng map',
                    data: Object.values(difficultyCounts),
                    backgroundColor: [
                        'rgba(34, 197, 94, 0.8)',
                        'rgba(234, 179, 8, 0.8)',
                        'rgba(249, 115, 22, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(147, 51, 234, 0.8)'
                    ],
                    borderWidth: 2,
                    borderColor: 'rgba(18, 18, 26, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            maxRotation: 45
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#94a3b8',
                            stepSize: 1
                        },
                        beginAtZero: true
                    }
                }
            }
        });

        // Update total count
        const totalEl = document.getElementById('maps-difficulty-total');
        if (totalEl) {
            const total = Object.values(difficultyCounts).reduce((a, b) => a + b, 0);
            totalEl.textContent = `${total} map`;
        }

        chartElement.style.width = '100%';
        chartElement.style.height = '250px';

    } catch (error) {
        console.error("Error updating maps difficulty chart:", error);
    }
};

// Load recent activity
window.loadRecentActivity = async (snapshot = null) => {
    try {
        const activityList = document.getElementById('recent-activity');
        if (!activityList) return;

        // Hiển thị loading
        activityList.innerHTML = `
                    <div class="text-center py-4">
                        <div class="loading-spinner mx-auto"></div>
                        <p class="mt-2 text-slate-500">Đang tải hoạt động...</p>
                    </div>
                `;

        let activityData = [];

        if (snapshot && typeof snapshot.forEach === 'function') {
            snapshot.forEach(doc => {
                activityData.push({ id: doc.id, ...doc.data() });
            });
        } else {
            try {
                const activityRef = collection(db, "activityLog");
                const q = query(activityRef, orderBy("timestamp", "desc"), limit(5));
                const querySnapshot = await getDocs(q);

                querySnapshot.forEach(doc => {
                    activityData.push({ id: doc.id, ...doc.data() });
                });
            } catch (queryError) {
                console.error("Error querying activityLog:", queryError);
            }
        }

        if (activityData.length === 0) {
            activityList.innerHTML = '<p class="text-center text-slate-500 py-4">Không có hoạt động gần đây</p>';
            return;
        }

        // Render activity items
        activityList.innerHTML = '';
        activityData.forEach(data => {
            const timeAgo = getTimeAgo(data.timestamp?.toDate() || new Date());
            const type = data.type || 'info';
            const action = data.action || 'Hoạt động';
            const userEmail = data.userEmail || 'System';

            const activityItem = document.createElement('div');
            activityItem.className = 'flex items-center justify-between p-3 hover:bg-slate-800/30 rounded-lg';
            activityItem.innerHTML = `
                        <div class="flex items-center">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center mr-3"
                                style="background: ${getActivityColor(type)}">
                                <i class="fas ${getActivityIcon(type)} text-xs"></i>
                            </div>
                            <div>
                                <p class="font-medium text-sm">${action}</p>
                                <p class="text-xs text-slate-400">${userEmail} • ${timeAgo}</p>
                            </div>
                        </div>
                        <span class="text-xs px-2 py-1 rounded" style="background: ${getActivityColor(type)}20; color: ${getActivityColor(type)}">
                            ${type}
                        </span>
                    `;
            activityList.appendChild(activityItem);
        });

    } catch (error) {
        console.error("Error loading activity:", error);
        const activityList = document.getElementById('recent-activity');
        if (activityList) {
            activityList.innerHTML = `
                        <div class="text-center py-4 text-red-500">
                            <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                            <p>Lỗi tải hoạt động: ${error.message}</p>
                        </div>
                    `;
        }
    }
};

// Get time ago
const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " năm trước";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " tháng trước";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " ngày trước";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " giờ trước";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " phút trước";
    return "vừa xong";
};

// Get activity color
const getActivityColor = (type) => {
    const colors = {
        'create': '#00f3ff',
        'update': '#9d00ff',
        'delete': '#ff0066',
        'user': '#00ff9d',
        'system': '#ffa726'
    };
    return colors[type] || '#00f3ff';
};

// Get activity icon
const getActivityIcon = (type) => {
    const icons = {
        'create': 'fa-plus',
        'update': 'fa-edit',
        'delete': 'fa-trash',
        'user': 'fa-user',
        'system': 'fa-cog'
    };
    return icons[type] || 'fa-info-circle';
};

// Log activity
const logActivity = async (type, action, details = {}) => {
    try {
        await addDoc(collection(db, "activityLog"), {
            type,
            action,
            userEmail: currentUser.email,
            userId: currentUser.uid,
            timestamp: serverTimestamp(),
            ...details
        });
    } catch (error) {
        console.error("Error logging activity:", error);
    }
};

// ============ CARS FILTER ============
window.filterCars = (page = 1) => {
    const rarityFilter = document.getElementById('cars-filter-rarity');
    const typeFilter = document.getElementById('cars-filter-type');
    const searchInput = document.getElementById('cars-search');

    if (rarityFilter) carsFilters.rarity = rarityFilter.value;
    if (typeFilter) carsFilters.type = typeFilter.value;
    if (searchInput) carsFilters.search = searchInput.value.toLowerCase();

    filteredCars = allCars.filter(car => {
        // Filter by rarity
        if (carsFilters.rarity !== 'all' && car.rarity !== carsFilters.rarity) {
            return false;
        }

        // Filter by type
        if (carsFilters.type !== 'all' && car.type !== carsFilters.type) {
            return false;
        }

        // Filter by search
        if (carsFilters.search) {
            const searchTerm = carsFilters.search;
            const name = (car.name || '').toLowerCase();
            const type = (car.type || '').toLowerCase();

            if (!name.includes(searchTerm) && !type.includes(searchTerm)) {
                return false;
            }
        }

        return true;
    });

    renderFilteredCars(page);
};

const renderFilteredCars = (page) => {
    currentPage['gameCars'] = page;

    const totalItems = filteredCars.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredCars.slice(startIndex, endIndex);

    renderTable('gameCars', pageData);
    renderPagination('gameCars', totalItems, page);
};

window.resetCarsFilter = () => {
    const rarityFilter = document.getElementById('cars-filter-rarity');
    const typeFilter = document.getElementById('cars-filter-type');
    const searchInput = document.getElementById('cars-search');

    if (rarityFilter) rarityFilter.value = 'all';
    if (typeFilter) typeFilter.value = 'all';
    if (searchInput) searchInput.value = '';

    carsFilters = { rarity: 'all', type: 'all', search: '' };
    filteredCars = [...allCars];
    renderFilteredCars(1);
    showMessage("Đã reset bộ lọc xe");
};

// ============ MAPS FILTER ============
window.filterMaps = (page = 1) => {
    const difficultyFilter = document.getElementById('maps-filter-difficulty');
    const searchInput = document.getElementById('maps-search');

    if (difficultyFilter) mapsFilters.difficulty = difficultyFilter.value;
    if (searchInput) mapsFilters.search = searchInput.value.toLowerCase();

    filteredMaps = allMaps.filter(map => {
        // Filter by difficulty (chuẩn hóa khi so sánh để tương thích dữ liệu cũ)
        if (mapsFilters.difficulty !== 'all') {
            const normalizedDiffMap = {
                'Dễ': 'Dễ (3 sao)', '3 sao': 'Dễ (3 sao)', 'Dễ (3 sao)': 'Dễ (3 sao)',
                'Trung bình': 'Trung bình (4 sao)', '4 sao': 'Trung bình (4 sao)', 'Trung bình (4 sao)': 'Trung bình (4 sao)',
                'Khó': 'Khó (5 sao)', '5 sao': 'Khó (5 sao)', 'Khó (5 sao)': 'Khó (5 sao)',
                'Rất khó': 'Rất khó (6 sao)', '6 sao': 'Rất khó (6 sao)', 'Rất khó (6 sao)': 'Rất khó (6 sao)',
                'Cực khó': 'Cực khó (7 sao)', '7 sao': 'Cực khó (7 sao)', 'Cực khó (7 sao)': 'Cực khó (7 sao)'
            };
            if (normalizedDiffMap[map.difficulty] !== normalizedDiffMap[mapsFilters.difficulty]) {
                return false;
            }
        }

        // Filter by search
        if (mapsFilters.search) {
            const searchTerm = mapsFilters.search;
            const name = (map.name || '').toLowerCase();
            const recordRacer = (map.recordRacer || '').toLowerCase();

            if (!name.includes(searchTerm) && !recordRacer.includes(searchTerm)) {
                return false;
            }
        }

        return true;
    });

    renderFilteredMaps(page);
};

const renderFilteredMaps = (page) => {
    currentPage['gameMaps'] = page;

    const totalItems = filteredMaps.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredMaps.slice(startIndex, endIndex);

    renderTable('gameMaps', pageData);
    renderPagination('gameMaps', totalItems, page);
};

window.resetMapsFilter = () => {
    const difficultyFilter = document.getElementById('maps-filter-difficulty');
    const searchInput = document.getElementById('maps-search');

    if (difficultyFilter) difficultyFilter.value = 'all';
    if (searchInput) searchInput.value = '';

    mapsFilters = { difficulty: 'all', search: '' };
    filteredMaps = [...allMaps];
    renderFilteredMaps(1);
    showMessage("Đã reset bộ lọc bản đồ");
};

// ============ PETS FILTER ============
window.filterPets = (page = 1) => {
    const rarityFilter = document.getElementById('pets-filter-rarity');
    const typeFilter = document.getElementById('pets-filter-type');
    const searchInput = document.getElementById('pets-search');

    if (rarityFilter) petsFilters.rarity = rarityFilter.value;
    if (typeFilter) petsFilters.type = typeFilter.value;
    if (searchInput) petsFilters.search = searchInput.value.toLowerCase();

    filteredPets = allPets.filter(pet => {
        // Filter by rarity
        if (petsFilters.rarity !== 'all' && pet.rarity !== petsFilters.rarity) {
            return false;
        }

        // Filter by type
        if (petsFilters.type !== 'all' && pet.type !== petsFilters.type) {
            return false;
        }

        // Filter by search
        if (petsFilters.search) {
            const searchTerm = petsFilters.search;
            const name = (pet.name || '').toLowerCase();
            const type = (pet.type || '').toLowerCase();
            const skillName = (pet.skill?.name || '').toLowerCase();

            if (!name.includes(searchTerm) && !type.includes(searchTerm) && !skillName.includes(searchTerm)) {
                return false;
            }
        }

        return true;
    });

    renderFilteredPets(page);
};

const renderFilteredPets = (page) => {
    currentPage['gamePets'] = page;

    const totalItems = filteredPets.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredPets.slice(startIndex, endIndex);

    renderTable('gamePets', pageData);
    renderPagination('gamePets', totalItems, page);
};

window.resetPetsFilter = () => {
    const rarityFilter = document.getElementById('pets-filter-rarity');
    const typeFilter = document.getElementById('pets-filter-type');
    const searchInput = document.getElementById('pets-search');

    if (rarityFilter) rarityFilter.value = 'all';
    if (typeFilter) typeFilter.value = 'all';
    if (searchInput) searchInput.value = '';

    petsFilters = { rarity: 'all', type: 'all', search: '' };
    filteredPets = [...allPets];
    renderFilteredPets(1);
    showMessage("Đã reset bộ lọc pet");
};

// ============ USERS FILTER ============
window.filterUsers = () => {
    const roleFilter = document.getElementById('users-filter-role');
    const statusFilter = document.getElementById('users-filter-status');
    const adminFilter = document.getElementById('users-filter-admin');
    const newUserFilter = document.getElementById('users-filter-newuser');
    const searchInput = document.getElementById('users-search');

    if (roleFilter) usersFilters.role = roleFilter.value;
    if (statusFilter) usersFilters.status = statusFilter.value;
    if (adminFilter) usersFilters.isAdmin = adminFilter.value;
    if (newUserFilter) usersFilters.isNewUser = newUserFilter.value;
    if (searchInput) usersFilters.search = searchInput.value.toLowerCase();

    filteredUsers = allUsers.filter(user => {
        // Filter by role
        if (usersFilters.role !== 'all' && user.role !== usersFilters.role) {
            return false;
        }

        // Filter by status
        if (usersFilters.status !== 'all' && user.status !== usersFilters.status) {
            return false;
        }

        // Filter by admin status
        if (usersFilters.isAdmin !== 'all') {
            const isAdmin = user.isAdmin || false;
            if (usersFilters.isAdmin === 'true' && !isAdmin) return false;
            if (usersFilters.isAdmin === 'false' && isAdmin) return false;
        }

        // Filter by new user (người dùng mới - đăng ký trong 7 ngày)
        if (usersFilters.isNewUser !== 'all') {
            const createdAt = user.createdAt ? new Date(user.createdAt).getTime() : 0;
            const now = new Date().getTime();
            const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
            const isNewUser = createdAt > sevenDaysAgo;

            if (usersFilters.isNewUser === 'true' && !isNewUser) return false;
            if (usersFilters.isNewUser === 'false' && isNewUser) return false;
        }

        // Filter by search
        if (usersFilters.search) {
            const searchTerm = usersFilters.search;
            const email = (user.email || '').toLowerCase();
            const displayName = (user.displayName || '').toLowerCase();
            const nickname = (user.nickname || '').toLowerCase();

            if (!email.includes(searchTerm) && !displayName.includes(searchTerm) && !nickname.includes(searchTerm)) {
                return false;
            }
        }

        return true;
    });

    renderFilteredUsers(1);
};

const renderFilteredUsers = (page) => {
    currentPage['users'] = page;

    const totalItems = filteredUsers.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredUsers.slice(startIndex, endIndex);

    renderTable('users', pageData);
    renderPagination('users', totalItems, page);
};

window.resetUsersFilter = () => {
    const roleFilter = document.getElementById('users-filter-role');
    const statusFilter = document.getElementById('users-filter-status');
    const adminFilter = document.getElementById('users-filter-admin');
    const newUserFilter = document.getElementById('users-filter-newuser');
    const searchInput = document.getElementById('users-search');

    if (roleFilter) roleFilter.value = 'all';
    if (statusFilter) statusFilter.value = 'all';
    if (adminFilter) adminFilter.value = 'all';
    if (newUserFilter) newUserFilter.value = 'all';
    if (searchInput) searchInput.value = '';

    usersFilters = { role: 'all', status: 'all', isAdmin: 'all', isNewUser: 'all', search: '' };
    filteredUsers = [...allUsers];
    renderFilteredUsers(1);
    showMessage("Đã reset bộ lọc người dùng");
};

// Populate dynamic filter options
const populateFilterOptions = async () => {
    try {
        // Populate car types
        const carTypes = [...new Set(allCars.map(car => car.type).filter(Boolean))];
        const carTypeFilter = document.getElementById('cars-filter-type');
        if (carTypeFilter) {
            carTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                carTypeFilter.appendChild(option);
            });
        }

        // Populate pet types
        const petTypes = [...new Set(allPets.map(pet => pet.type).filter(Boolean))];
        const petTypeFilter = document.getElementById('pets-filter-type');
        if (petTypeFilter) {
            petTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                petTypeFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error populating filter options:", error);
    }
};

// Load collection data
const loadCollectionData = async (collectionName, page = 1) => {
    try {
        currentPage[collectionName] = page;

        if (collectionName === 'raceRecords') {
            await loadRecordsData(page);
        } else if (collectionName === 'users') {
            await loadUsersData(page);
        } else {
            const querySnapshot = await getDocs(collection(db, collectionName));
            const allData = [];

            querySnapshot.forEach((doc) => {
                allData.push({ id: doc.id, ...doc.data() });
            });

            // Store in appropriate global array
            if (collectionName === 'gameCars') {
                allCars = [...allData];

                // Populate filter options after loading
                await populateFilterOptions();

                filterCars(page);
            } else if (collectionName === 'gameMaps') {
                allMaps = [...allData];
                filterMaps(page);
            } else if (collectionName === 'gamePets') {
                allPets = [...allData];

                // Populate filter options after loading
                await populateFilterOptions();

                filterPets(page);
            } else {
                const totalItems = allData.length;
                const totalPages = Math.ceil(totalItems / itemsPerPage);
                const startIndex = (page - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const pageData = allData.slice(startIndex, endIndex);

                renderTable(collectionName, pageData);
                renderPagination(collectionName, totalItems, page);
            }
        }
    } catch (error) {
        console.error(`Error loading ${collectionName}:`, error);
        showMessage(`Lỗi tải dữ liệu ${collectionName}!`, true);
    }
};

// Render table
const renderTable = (collectionName, data) => {
    const collectionToTabMap = {
        'gameCars': 'cars',
        'gameMaps': 'maps',
        'gamePets': 'pets',
        'raceRecords': 'records',
        'users': 'users',
        'banners': 'banners'
    };

    const tabName = collectionToTabMap[collectionName];
    if (!tabName) return;

    const tableBody = document.getElementById(`${tabName}-table-body`);
    if (!tableBody) return;

    tableBody.innerHTML = '';

    // Empty state với UI đẹp
    if (data.length === 0) {
        const colSpan = collectionName === 'raceRecords' ? 9 :
            collectionName === 'users' ? 8 :
                collectionName === 'gameMaps' ? 7 :
                    collectionName === 'banners' ? 5 : 6;

        const emptyIcons = {
            'gameCars': 'fa-car',
            'gameMaps': 'fa-map',
            'gamePets': 'fa-paw',
            'raceRecords': 'fa-trophy',
            'users': 'fa-users',
            'banners': 'fa-image'
        };

        const emptyTitles = {
            'gameCars': 'Chưa có xe nào',
            'gameMaps': 'Chưa có bản đồ nào',
            'gamePets': 'Chưa có pet nào',
            'raceRecords': 'Chưa có kỷ lục nào',
            'users': 'Chưa có người dùng nào',
            'banners': 'Chưa có banner nào'
        };

        const emptyDescriptions = {
            'gameCars': 'Bắt đầu bằng cách thêm xe đầu tiên vào bộ sưu tập',
            'gameMaps': 'Thêm bản đồ đua để bắt đầu ghi nhận kỷ lục',
            'gamePets': 'Thêm pet để tăng sức mạnh cho tay đua',
            'raceRecords': 'Các kỷ lục sẽ xuất hiện khi có dữ liệu đua',
            'users': 'Người dùng sẽ xuất hiện khi đăng nhập vào hệ thống',
            'banners': 'Thêm banner để trình chiếu tại trang chủ'
        };

        tableBody.innerHTML = `
            <tr>
                <td colspan="${colSpan}">
                    <div class="empty-state">
                        <i class="fas ${emptyIcons[collectionName]} empty-state-icon"></i>
                        <h3 class="empty-state-title">${emptyTitles[collectionName]}</h3>
                        <p class="empty-state-description">${emptyDescriptions[collectionName]}</p>
                        ${collectionName !== 'users' && collectionName !== 'raceRecords' ? `
                            <button onclick="openAddModal('${collectionName}')" class="empty-state-btn">
                                <i class="fas fa-plus"></i>Thêm mới
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    data.forEach((item, index) => {
        const row = document.createElement('tr');
        const globalIndex = (currentPage[collectionName] - 1) * itemsPerPage + index + 1;

        switch (collectionName) {
            case 'banners':
                const bannerImage = item.imageUrl || 'https://via.placeholder.com/120x60/1a1a2e/00f3ff?text=Banner';
                row.innerHTML = `
                    <td>
                        <div class="map-image-cell">
                            <img src="${bannerImage}" 
                                 alt="${item.title || 'Banner'}" 
                                 class="map-thumbnail !w-[100px] !h-[50px] object-cover rounded"
                                 style="width: 100px; height: 50px;"
                                 onclick="viewMapImage('${bannerImage}', '${item.title || 'Banner'}')"
                                 onerror="this.src='https://via.placeholder.com/120x60/1a1a2e/00f3ff?text=Banner'">
                        </div>
                    </td>
                    <td><div class="map-name-with-image">${item.title || 'N/A'}</div></td>
                    <td>${item.order !== undefined ? item.order : 0}</td>
                    <td>
                        <span class="difficulty-badge ${item.active !== false ? 'difficulty-easy' : 'difficulty-very-hard'}">
                            ${item.active !== false ? 'Hoạt động' : 'Ẩn'}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button onclick="editItem('${collectionName}', '${item.id}')" class="btn-edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteItem('${collectionName}', '${item.id}', '${item.title || 'Banner'}')" class="btn-delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                break;
            case 'gameCars':
                const carImage = item.imageUrl || 'https://via.placeholder.com/60x40/1a1a2e/00f3ff?text=Car';
                row.innerHTML = `
        <td>
            <div class="map-image-cell">
                <img src="${carImage}" 
                     alt="${item.name || 'Xe'}" 
                     class="map-thumbnail"
                     onclick="viewMapImage('${carImage}', '${item.name || 'Xe'}')"
                     onerror="this.src='https://via.placeholder.com/60x40/1a1a2e/00f3ff?text=Car'">
                <div>
                    <div class="map-name-with-image">${item.name || 'N/A'}</div>
                    <div class="text-xs text-slate-400 mt-1">${item.type || 'N/A'}</div>
                </div>
            </div>
        </td>
        <td><span class="rarity-badge ${getRarityClass(item.rarity)}">${item.rarity || 'N/A'}</span></td>
        <td>${item.speed || 'N/A'}</td>
        <td>${item.acceleration || 'N/A'}</td>
        <td>
            <div class="action-buttons">
                <button onclick="editItem('${collectionName}', '${item.id}')" class="btn-edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItem('${collectionName}', '${item.id}', '${item.name}')" class="btn-delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
                break;

            case 'gameMaps':
                const mapImage = item.imageUrl || 'https://via.placeholder.com/60x40/1a1a2e/00f3ff?text=Map';
                const bestRec = window.getBestRecordForMap ? window.getBestRecordForMap(item.name) : null;
                const displayTime = bestRec ? bestRec.recordTime : (item.recordTime || '--\'--\'--');
                const displayRacer = bestRec ? bestRec.recordRacer : (item.recordRacer || 'N/A');
                const displayCar = bestRec ? bestRec.recordCar : (item.recordCar || 'N/A');
                const displayPet = bestRec ? bestRec.recordPet : (item.recordPet || 'N/A');

                row.innerHTML = `
                            <td>
                                <div class="map-image-cell">
                                    <img src="${mapImage}" 
                                         alt="${item.name || 'Bản đồ'}" 
                                         class="map-thumbnail"
                                         onclick="viewMapImage('${mapImage}', '${item.name || 'Bản đồ'}')"
                                         onerror="this.src='https://via.placeholder.com/60x40/1a1a2e/00f3ff?text=Map'">
                                    <div>
                                        <div class="map-name-with-image">${item.name || 'N/A'}</div>
                                        <div class="text-slate-400 mt-1 flex items-center gap-0.5">
                                            ${(() => {
                                                let starCount = 3;
                                                const lowerDiff = (item.difficulty || '').toLowerCase();
                                                if (lowerDiff.includes('3 sao') || lowerDiff.includes('dễ') || lowerDiff.includes('easy')) starCount = 3;
                                                else if (lowerDiff.includes('4 sao') || lowerDiff.includes('trung bình') || lowerDiff.includes('medium')) starCount = 4;
                                                else if (lowerDiff.includes('5 sao') || lowerDiff.includes('khó') || lowerDiff.includes('hard')) starCount = 5;
                                                else if (lowerDiff.includes('6 sao') || lowerDiff.includes('rất khó') || lowerDiff.includes('expert')) starCount = 6;
                                                else if (lowerDiff.includes('7 sao') || lowerDiff.includes('cực khó') || lowerDiff.includes('extreme')) starCount = 7;
                                                else starCount = 0;
                                                
                                                if (starCount > 0) {
                                                    let starsHTML = '';
                                                    for (let i = 0; i < starCount; i++) {
                                                        starsHTML += `<i class="fas fa-star text-[8px] text-amber-400"></i>`;
                                                    }
                                                    return starsHTML;
                                                }
                                                return item.difficulty || 'N/A';
                                            })()}
                                         </div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span class="difficulty-badge ${getDifficultyColorClass(item.difficulty)}">
                                     ${item.difficulty || 'N/A'}
                                </span>
                            </td>
                            <td class="font-mono text-cyan-300 font-bold">${displayTime}</td>
                            <td class="font-semibold text-slate-200">${displayRacer}</td>
                            <td>${displayCar}</td>
                            <td>${displayPet}</td>
                            <td>
                                <div class="action-buttons">
                                    <button onclick="editItem('${collectionName}', '${item.id}')" class="btn-edit">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteItem('${collectionName}', '${item.id}', '${item.name}')" class="btn-delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        `;
                break;

            case 'gamePets':
                const petImage = item.imageUrl || 'https://via.placeholder.com/60x40/1a1a2e/00f3ff?text=Pet';
                row.innerHTML = `
        <td>
            <div class="map-image-cell">
                <img src="${petImage}" 
                     alt="${item.name || 'Pet'}" 
                     class="map-thumbnail"
                     onclick="viewMapImage('${petImage}', '${item.name || 'Pet'}')"
                     onerror="this.src='https://via.placeholder.com/60x40/1a1a2e/00f3ff?text=Pet'">
                <div>
                    <div class="map-name-with-image">${item.name || 'N/A'}</div>
                    <div class="text-xs text-slate-400 mt-1">${item.skill?.name || 'N/A'}</div>
                </div>
            </div>
        </td>
        <td>${item.type || 'N/A'}</td>
        <td><span class="rarity-badge ${getRarityClass(item.rarity)}">${item.rarity || 'N/A'}</span></td>
        <td>
            <div class="action-buttons">
                <button onclick="editItem('${collectionName}', '${item.id}')" class="btn-edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItem('${collectionName}', '${item.id}', '${item.name}')" class="btn-delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
                break;

            case 'raceRecords':
                const date = item.timestamp ? new Date(item.timestamp).toLocaleDateString('vi-VN') : 'N/A';

                // THAY ĐỔI: Escape chuỗi name an toàn hơn
                const deleteItemName = `${item.mapName || 'N/A'} - ${item.timeString || 'N/A'}`;
                const safeDeleteName = deleteItemName.replace(/'/g, "\\'").replace(/"/g, '\\"');

                // Check if this record is selected
                const isChecked = selectedRecords.has(item.id) ? 'checked' : '';

                // Detect record issues
                const issues = window.getRecordIssues(item, allRecords);
                const hasIssues = issues.length > 0;
                
                // Add styling to row
                if (hasIssues) {
                    row.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                    row.style.borderLeft = '3px solid #ef4444';
                } else {
                    row.style.backgroundColor = '';
                    row.style.borderLeft = '';
                }

                let issueBadgeHtml = '';
                if (hasIssues) {
                    issueBadgeHtml = `
                        <div class="text-rose-400 text-[10px] mt-1 flex items-center gap-1 cursor-help" title="Lỗi: ${issues.join(', ')}">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span class="font-semibold bg-rose-500/10 px-1 rounded truncate max-w-[150px]">${issues[0]}${issues.length > 1 ? ` (+${issues.length - 1})` : ''}</span>
                        </div>
                    `;
                }

                row.innerHTML = `
        <td>
            <input type="checkbox" class="bulk-checkbox record-checkbox" 
                   data-id="${item.id}" ${isChecked}
                   onchange="toggleRecordSelection('${item.id}')">
        </td>
        <td class="font-semibold">${globalIndex}</td>
        <td>
            <div class="font-semibold">${item.mapName || 'N/A'}</div>
            ${issueBadgeHtml}
        </td>
        <td>${item.racerName || 'N/A'}</td>
        <td class="font-mono font-bold ${globalIndex <= 3 && !hasIssues ? 'text-yellow-400' : ''}">${item.timeString || 'N/A'}</td>
        <td>${item.car || 'N/A'}</td>
        <td class="text-sm">${date}</td>
        <td>
            <div class="action-buttons">
                <button onclick="editItem('${collectionName}', '${item.id}')" class="btn-edit" title="Chỉnh sửa">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteItem('${collectionName}', '${item.id}', \`${safeDeleteName}\`)" class="btn-delete" title="Xóa">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
                break;

            case 'users':
                const userId = item.uid || item.id || 'N/A';
                const userEmail = item.email || 'N/A';
                const userName = item.displayName || 'N/A';
                const userNickname = item.nickname || 'N/A';
                const userRole = item.role || 'viewer';
                const isAdminValue = item.isAdmin || false;
                const userStatus = item.status || 'active';
                // Ưu tiên photoBase64 (ảnh mới nhất), nếu không có thì dùng photoURL
                const avatarSrc = item.photoBase64 || item.photoURL || '';

                const safeUserId = String(userId).replace(/'/g, "\\'");
                const safeUserEmail = String(userEmail).replace(/'/g, "\\'");

                // Get first letter for placeholder
                const firstLetter = userName !== 'N/A' ? userName.charAt(0).toUpperCase() :
                    (userEmail !== 'N/A' ? userEmail.charAt(0).toUpperCase() : '?');

                row.innerHTML = `
        <td>
            <div class="user-avatar-cell">
                ${avatarSrc ?
                        `<img src="${avatarSrc}" alt="${userName}" class="user-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                     <div class="user-avatar-placeholder" style="display: none;">${firstLetter}</div>` :
                        `<div class="user-avatar-placeholder">${firstLetter}</div>`
                    }
            </div>
        </td>
        <td>${userEmail}</td>
        <td>${userName}</td>
        <td>${userNickname}</td>
        <td>
            <span class="px-2 py-1 rounded text-xs ${userRole === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                        userRole === 'racer' ? 'bg-cyan-500/20 text-cyan-400' :
                            'bg-slate-500/20 text-slate-400'
                    }">
                ${userRole === 'admin' ? 'Quản trị viên' :
                        userRole === 'racer' ? 'Tay đua' : 'Người xem'}
            </span>
        </td>
        <td>
            <span class="px-2 py-1 rounded text-xs ${isAdminValue ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'
                    }">
                ${isAdminValue ? 'Có' : 'Không'}
            </span>
        </td>
        <td>
            <span class="px-2 py-1 rounded text-xs ${userStatus === 'active' ? 'bg-green-500/20 text-green-400' :
                        userStatus === 'banned' ? 'bg-red-500/20 text-red-400' :
                            'bg-orange-500/20 text-orange-400'
                    }">
                ${userStatus === 'active' ? 'Hoạt động' :
                        userStatus === 'banned' ? 'Bị cấm' : 'Không hoạt động'}
            </span>
        </td>
        <td>
            <div class="action-buttons">
                <button onclick="editUser('${safeUserId}')" class="btn-edit" title="Chỉnh sửa người dùng">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deleteUser('${safeUserId}', '${safeUserEmail}')" class="btn-delete" title="Xóa người dùng">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
                break;
        }

        tableBody.appendChild(row);
    });
};

// Get rarity class
const getRarityClass = (rarity) => {
    const classes = {
        'Thần Thoại': 'rarity-mythical',
        'Huyền Thoại': 'rarity-legendary',
        'Hiếm': 'rarity-rare',
        'Thường': 'rarity-common'
    };
    return classes[rarity] || 'rarity-common';
};

// Get difficulty class
const getDifficultyClass = (difficulty) => {
    const classes = {
        'Dễ': 'difficulty-easy',
        'Trung bình': 'difficulty-medium',
        'Khó': 'difficulty-hard',
        'Rất khó': 'difficulty-very-hard',
        'Cực khó': 'difficulty-extreme',
        '3 sao': 'difficulty-easy',
        '4 sao': 'difficulty-medium',
        '5 sao': 'difficulty-hard',
        '6 sao': 'difficulty-very-hard',
        '7 sao': 'difficulty-extreme',
        'Dễ (3 sao)': 'difficulty-easy',
        'Trung bình (4 sao)': 'difficulty-medium',
        'Khó (5 sao)': 'difficulty-hard',
        'Rất khó (6 sao)': 'difficulty-very-hard',
        'Cực khó (7 sao)': 'difficulty-extreme'
    };
    return classes[difficulty] || '';
};

// Render pagination
const renderPagination = (collectionName, totalItems, currentPageNum) => {
    const collectionToTabMap = {
        'gameCars': 'cars',
        'gameMaps': 'maps',
        'gamePets': 'pets',
        'raceRecords': 'records',
        'users': 'users',
        'banners': 'banners'
    };

    const tabName = collectionToTabMap[collectionName];
    if (!tabName) return;

    const paginationDiv = document.getElementById(`${tabName}-pagination`);
    if (!paginationDiv) return;

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let paginationHTML = '';

    // Previous button
    paginationHTML += `
                <button onclick="changePage('${tabName}', ${currentPageNum - 1})" 
                        class="page-button ${currentPageNum === 1 ? 'disabled' : ''}"
                        ${currentPageNum === 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-left"></i>
                </button>
            `;

    // Page numbers
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPageNum - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
                    <button onclick="changePage('${tabName}', ${i})" 
                            class="page-button ${i === currentPageNum ? 'active' : ''}">
                        ${i}
                    </button>
                `;
    }

    // Next button
    paginationHTML += `
                <button onclick="changePage('${tabName}', ${currentPageNum + 1})" 
                        class="page-button ${currentPageNum === totalPages ? 'disabled' : ''}"
                        ${currentPageNum === totalPages ? 'disabled' : ''}>
                    <i class="fas fa-chevron-right"></i>
                </button>
            `;

    // Page info
    paginationHTML += `
                <span class="text-slate-400 ml-4">
                    Trang ${currentPageNum} / ${totalPages} (${totalItems} mục)
                </span>
            `;

    paginationDiv.innerHTML = paginationHTML;
};

// Change page
window.changePage = (tabName, page) => {
    const tabToCollectionMap = {
        'cars': 'gameCars',
        'maps': 'gameMaps',
        'pets': 'gamePets',
        'records': 'raceRecords',
        'users': 'users',
        'banners': 'banners'
    };

    const collectionName = tabToCollectionMap[tabName];
    if (!collectionName) return;

    if (collectionName === 'raceRecords') {
        renderFilteredRecords(page);
    } else if (collectionName === 'users') {
        renderFilteredUsers(page);
    } else if (collectionName === 'gameCars') {
        renderFilteredCars(page);
    } else if (collectionName === 'gameMaps') {
        renderFilteredMaps(page);
    } else if (collectionName === 'gamePets') {
        renderFilteredPets(page);
    } else {
        loadCollectionData(collectionName, page);
    }
};

// Switch tabs
window.switchTab = async (tab) => {
    currentTab = tab;

    // Update tab buttons (Legacy)
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${tab}'`)) {
            btn.classList.add('active');
        }
    });

    // Update new cd-nav-link active states
    document.querySelectorAll('.cd-nav-link').forEach(btn => btn.classList.remove('active'));
    const navBtn = document.getElementById('nav-' + tab);
    if (navBtn) navBtn.classList.add('active');

    // Close sidebar on mobile if open
    if (window.innerWidth <= 1024) {
        if (typeof window.toggleSidebar === 'function') {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && sidebar.classList.contains('open')) {
                window.toggleSidebar();
            }
        }
    }

    // Hide all tab contents
    document.querySelectorAll('.tab-pane').forEach(content => {
        content.classList.add('hidden');
    });

    // Show current tab content
    const tabElement = document.getElementById(`${tab}-tab`);
    if (tabElement) {
        tabElement.classList.remove('hidden');
    }

    // Load data for the tab
    if (tab === 'dashboard') {
        await loadDashboardStats();
    } else if (tab === 'records') {
        // QUAN TRỌNG: Load maps TRƯỚC để getRecordIssues() hoạt động đúng khi render
        if (allMaps.length === 0) {
            try {
                const mapsSnapshot = await getDocs(collection(db, "gameMaps"));
                allMaps = mapsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
                console.error("Error loading maps:", error);
            }
        }

        // Sau khi đã có allMaps, mới load và render records
        if (allRecords.length === 0) {
            await loadRecordsData(1);
        } else {
            populateRecordsMapFilter();
            filterRecordsNew();
        }
    } else if (tab === 'users') {
        if (allUsers.length === 0) {
            await loadUsersData(1);
        } else {
            await loadUsersData(currentPage['users']);
        }
    } else if (tab === 'notifications') {
        if (allNotifications.length === 0) {
            await loadNotifications();
        } else {
            renderNotifications();
        }
    } else if (tab === 'racer-stats') {
        if (window.racerStatsTab) {
            await window.racerStatsTab.init();
        } else {
            console.error("CRITICAL ERROR: window.racerStatsTab is undefined!");
            alert("Lỗi: Đối tượng window.racerStatsTab chưa được khởi tạo. Có thể do lỗi tải script racer-stats.js.");
        }
    } else {
        const collections = {
            'cars': 'gameCars',
            'maps': 'gameMaps',
            'pets': 'gamePets',
            'banners': 'banners'
        };
        const collectionName = collections[tab];
        if (collectionName) {
            await loadCollectionData(collectionName, currentPage[collectionName] || 1);
        }
    }
};

// Load maps for filter
const loadMapsForFilter = async () => {
    try {
        const mapsSnapshot = await getDocs(collection(db, "gameMaps"));
        const mapFilter = document.getElementById('map-filter');

        mapFilter.innerHTML = '<option value="all">Tất cả bản đồ</option>';

        allMaps = [];
        mapsSnapshot.forEach(doc => {
            const mapData = { id: doc.id, ...doc.data() };
            allMaps.push(mapData);
        });

        // Sắp xếp bản đồ theo tên
        allMaps.sort((a, b) => a.name.localeCompare(b.name));

        // Thêm option "Top 10" cho mỗi map
        allMaps.forEach(map => {
            const option = document.createElement('option');
            option.value = `top10_${map.id}`;
            option.textContent = `🏆 ${map.name} - Top 10`;
            option.style.color = '#00f3ff';
            option.style.fontWeight = 'bold';
            option.style.backgroundColor = '#12121a';
            mapFilter.appendChild(option);
        });

        console.log("Loaded maps for filter:", allMaps.length, "maps");

    } catch (error) {
        console.error("Error loading maps for filter:", error);
    }
};

// Get all system map names for autocompletion
const getSystemMapNames = () => {
    const mapNames = new Set();
    
    // Add from allMaps
    if (Array.isArray(allMaps)) {
        allMaps.forEach(m => {
            if (m.name) mapNames.add(m.name);
        });
    }
    
    // Add from allRecords
    if (Array.isArray(allRecords)) {
        allRecords.forEach(r => {
            if (r.mapName) mapNames.add(r.mapName);
        });
    }
    
    const sortedNames = [...mapNames];
    sortedNames.sort((a, b) => a.localeCompare(b));
    return sortedNames;
};

// Helpers for record validation & cleanup
window.getRecordIssues = (record, recordsList) => {
    const issues = [];
    if (!record.mapName || !record.mapName.trim()) {
        issues.push("Thiếu tên bản đồ");
    } else {
        const mapExists = allMaps.some(m => (m.name || '').trim().toLowerCase() === (record.mapName || '').trim().toLowerCase());
        if (!mapExists) {
            issues.push("Bản đồ không tồn tại");
        }
    }
    
    if (!record.racerName || !record.racerName.trim()) {
        issues.push("Thiếu tên tay đua");
    }
    
    const secs = parseFloat(record.timeInSeconds);
    if (isNaN(secs) || secs <= 0) {
        issues.push("Thời gian không hợp lệ (<= 0)");
    } else if (secs < 15) {
        issues.push("Thời gian quá nhanh (< 15 giây)");
    } else if (secs >= 120) {
        issues.push("Thời gian quá lâu (>= 2 phút)");
    }
    
    if (!record.timeString || !record.timeString.trim()) {
        issues.push("Thiếu chuỗi thời gian");
    } else {
        const parsedSecs = window.parseRaceTime(record.timeString);
        if (parsedSecs === Infinity) {
            issues.push("Định dạng thời gian sai");
        } else if (Math.abs(parsedSecs - secs) > 0.5) {
            issues.push("Bất đồng bộ giây và chuỗi");
        }
    }
    
    if (recordsList) {
        const matchKey = `${(record.mapName || '').trim().toLowerCase()}_${(record.racerName || '').trim().toLowerCase()}_${(record.timeString || '').trim().toLowerCase()}`;
        const duplicatesCount = recordsList.filter(r => {
            const key = `${(r.mapName || '').trim().toLowerCase()}_${(r.racerName || '').trim().toLowerCase()}_${(r.timeString || '').trim().toLowerCase()}`;
            return key === matchKey;
        }).length;
        if (duplicatesCount > 1) {
            issues.push("Bản ghi trùng lặp");
        }
    }
    
    return issues;
};

// Sync fields globally
window.syncTimeString = (secVal) => {
    const sec = parseFloat(secVal);
    if (!isNaN(sec) && sec > 0) {
        const minutes = Math.floor(sec / 60);
        const remainingSecs = sec % 60;
        const wholeSecs = Math.floor(remainingSecs);
        const ms = Math.round((remainingSecs - wholeSecs) * 100);
        
        const mmStr = String(minutes).padStart(2, '0');
        const ssStr = String(wholeSecs).padStart(2, '0');
        const msStr = String(ms).padStart(2, '0');
        
        const strInput = document.getElementById('record-timeString');
        if (strInput) {
            strInput.value = `${mmStr}'${ssStr}'${msStr}`;
        }
    }
};

window.syncTimeSeconds = (strVal) => {
    if (!strVal) return;
    let cleanTime = strVal.trim();
    if (cleanTime.includes(':')) cleanTime = cleanTime.replace(/:/g, "'");
    if (cleanTime.includes('.')) cleanTime = cleanTime.replace(/\./g, "'");
    const parts = cleanTime.split("'");
    if (parts.length >= 2) {
        const minutes = parseInt(parts[0]) || 0;
        const seconds = parseInt(parts[1]) || 0;
        const milliseconds = parts.length > 2 ? (parseInt(parts[2]) || 0) : 0;
        const totalSecs = minutes * 60 + seconds + milliseconds / 100;
        
        const secInput = document.getElementById('record-timeInSeconds');
        if (secInput && !isNaN(totalSecs)) {
            secInput.value = totalSecs.toFixed(2);
        }
    }
};

// Bulk Cleanup of Garbage Records (>= 2 minutes)
window.bulkCleanGarbage = async () => {
    const garbageRecords = allRecords.filter(record => {
        const secs = parseFloat(record.timeInSeconds);
        return !isNaN(secs) && secs >= 120;
    });

    if (garbageRecords.length === 0) {
        Swal.fire({
            title: 'Không có kỷ lục rác!',
            text: 'Không phát hiện kỷ lục nào từ 2 phút trở lên (>= 120 giây).',
            icon: 'success',
            confirmButtonColor: '#3b82f6'
        });
        return;
    }

    // Build a table or list of records to show in Swal
    let recordsListHtml = `
        <p class="text-slate-300 text-sm mb-3">Tìm thấy <strong>${garbageRecords.length}</strong> kỷ lục từ 2 phút trở lên:</p>
        <div style="max-height: 250px; overflow-y: auto; text-align: left; margin: 15px 0; border: 1px solid #334155; padding: 10px; border-radius: 8px; background-color: #0f172a; border-left: 4px solid #ef4444;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #cbd5e1;">
                <thead>
                    <tr style="border-bottom: 1px solid #1e293b; color: #94a3b8; font-weight: bold;">
                        <th style="padding: 6px; text-align: left;">Bản đồ</th>
                        <th style="padding: 6px; text-align: left;">Tay đua</th>
                        <th style="padding: 6px; text-align: right;">Thời gian</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    garbageRecords.forEach(r => {
        recordsListHtml += `
            <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 6px; font-weight: 600; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.mapName || 'N/A'}</td>
                <td style="padding: 6px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.racerName || 'N/A'}</td>
                <td style="padding: 6px; text-align: right; font-family: monospace; color: #f43f5e; font-weight: bold;">${r.timeString || 'N/A'} (${r.timeInSeconds}s)</td>
            </tr>
        `;
    });
    
    recordsListHtml += `
                </tbody>
            </table>
        </div>
        <p class="text-rose-400 text-xs font-bold mt-2"><i class="fas fa-exclamation-triangle mr-1"></i> Hành động này sẽ xóa vĩnh viễn các kỷ lục trên!</p>
    `;

    const result = await Swal.fire({
        title: 'Xác nhận dọn dẹp?',
        html: recordsListHtml,
        icon: 'warning',
        width: '500px',
        showCancelButton: true,
        confirmButtonColor: '#ff0066',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fas fa-trash-alt mr-2"></i>Xác nhận xóa',
        cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
        Swal.fire({
            title: 'Đang dọn dẹp...',
            text: 'Vui lòng chờ trong giây lát.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const batch = writeBatch(db);
        garbageRecords.forEach(record => {
            batch.delete(doc(db, "raceRecords", record.id));
        });
        await batch.commit();

        allRecords = allRecords.filter(r => !garbageRecords.some(gr => gr.id === r.id));
        filteredRecords = filteredRecords.filter(r => !garbageRecords.some(gr => gr.id === r.id));
        window.filterRecordsNew();

        Swal.fire({
            title: 'Đã hoàn thành!',
            text: `Đã dọn dẹp thành công ${garbageRecords.length} kỷ lục rác.`,
            icon: 'success',
            confirmButtonColor: '#3b82f6'
        });
    } catch (error) {
        console.error("Error bulk cleaning records:", error);
        Swal.fire({
            title: 'Lỗi!',
            text: 'Có lỗi xảy ra trong quá trình dọn dẹp.',
            icon: 'error',
            confirmButtonColor: '#3b82f6'
        });
    }
};

// Bulk Cleanup of Duplicate Records (Same map, racer & time)
window.bulkCleanDuplicates = async () => {
    // Group by mapName, racerName and timeInSeconds
    const groups = {};
    allRecords.forEach(record => {
        const map = (record.mapName || '').trim().toLowerCase();
        const racer = (record.racerName || '').trim().toLowerCase();
        const time = record.timeInSeconds;
        if (!map || !racer || time === undefined) return; // ignore invalid ones
        const key = `${map}_${racer}_${time}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(record);
    });

    const duplicateRecords = [];
    Object.values(groups).forEach(group => {
        if (group.length > 1) {
            // Keep the first one, add the rest to duplicates array
            for (let i = 1; i < group.length; i++) {
                duplicateRecords.push(group[i]);
            }
        }
    });

    if (duplicateRecords.length === 0) {
        Swal.fire({
            title: 'Không có kỷ lục trùng lặp!',
            text: 'Không phát hiện kỷ lục nào bị gửi trùng lặp (cùng map, cùng người chơi, cùng thời gian).',
            icon: 'success',
            confirmButtonColor: '#3b82f6'
        });
        return;
    }

    // Build a table or list of records to show in Swal
    let recordsListHtml = `
        <p class="text-slate-300 text-sm mb-3">Tìm thấy <strong>${duplicateRecords.length}</strong> kỷ lục trùng lặp:</p>
        <div style="max-height: 250px; overflow-y: auto; text-align: left; margin: 15px 0; border: 1px solid #334155; padding: 10px; border-radius: 8px; background-color: #0f172a; border-left: 4px solid #f59e0b;">
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #cbd5e1;">
                <thead>
                    <tr style="border-bottom: 1px solid #1e293b; color: #94a3b8; font-weight: bold;">
                        <th style="padding: 6px; text-align: left;">Bản đồ</th>
                        <th style="padding: 6px; text-align: left;">Tay đua</th>
                        <th style="padding: 6px; text-align: right;">Thời gian (Bị xóa)</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    duplicateRecords.forEach(r => {
        recordsListHtml += `
            <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 6px; font-weight: 600; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.mapName || 'N/A'}</td>
                <td style="padding: 6px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.racerName || 'N/A'}</td>
                <td style="padding: 6px; text-align: right; font-family: monospace; color: #fbbf24; font-weight: bold;">${r.timeString || 'N/A'} (${r.timeInSeconds}s)</td>
            </tr>
        `;
    });
    
    recordsListHtml += `
                </tbody>
            </table>
        </div>
        <p class="text-amber-400 text-xs font-bold mt-2"><i class="fas fa-exclamation-triangle mr-1"></i> Hành động này sẽ xóa vĩnh viễn các bản ghi phụ và CHỈ GIỮ LẠI thành tích tốt nhất của mỗi người!</p>
    `;

    const result = await Swal.fire({
        title: 'Xác nhận dọn dẹp trùng lặp?',
        html: recordsListHtml,
        icon: 'warning',
        width: '500px',
        showCancelButton: true,
        confirmButtonColor: '#f59e0b',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fas fa-trash-alt mr-2"></i>Xác nhận xóa',
        cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
        Swal.fire({
            title: 'Đang dọn dẹp...',
            text: 'Vui lòng chờ trong giây lát.',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        const batch = writeBatch(db);
        duplicateRecords.forEach(record => {
            batch.delete(doc(db, "raceRecords", record.id));
        });
        await batch.commit();

        allRecords = allRecords.filter(r => !duplicateRecords.some(dr => dr.id === r.id));
        filteredRecords = filteredRecords.filter(r => !duplicateRecords.some(dr => dr.id === r.id));
        window.filterRecordsNew();

        Swal.fire({
            title: 'Đã hoàn thành!',
            text: `Đã dọn dẹp thành công ${duplicateRecords.length} kỷ lục trùng lặp.`,
            icon: 'success',
            confirmButtonColor: '#3b82f6'
        });
    } catch (error) {
        console.error("Error bulk cleaning duplicate records:", error);
        Swal.fire({
            title: 'Lỗi!',
            text: 'Có lỗi xảy ra trong quá trình dọn dẹp.',
            icon: 'error',
            confirmButtonColor: '#3b82f6'
        });
    }
};

// ============ RECORDS FILTER - MỚI ============
window.filterRecordsNew = () => {
    const mapFilter = document.getElementById('records-filter-map');
    const racerInput = document.getElementById('records-filter-racer');
    const carInput = document.getElementById('records-filter-car');
    const timeFilter = document.getElementById('records-filter-time');
    const sortSelect = document.getElementById('records-sort');
    const invalidIcon = document.getElementById('map-invalid-icon');

    let mapVal = 'all';
    if (mapFilter) {
        const val = mapFilter.value.trim();
        if (val !== '') {
            mapVal = val;
            
            // Check if matches any map name in the system
            const systemMaps = getSystemMapNames();
            const hasMatch = systemMaps.some(name => name.toLowerCase().includes(val.toLowerCase()));
            if (!hasMatch) {
                if (invalidIcon) invalidIcon.classList.remove('hidden');
                
                // Debounce showMessage so it doesn't spam during typing
                if (window.mapValidationTimeout) clearTimeout(window.mapValidationTimeout);
                window.mapValidationTimeout = setTimeout(() => {
                    showMessage(`Không có bản đồ "${val}"!`, true);
                }, 800);
            } else {
                if (invalidIcon) invalidIcon.classList.add('hidden');
                if (window.mapValidationTimeout) clearTimeout(window.mapValidationTimeout);
            }
        } else {
            if (invalidIcon) invalidIcon.classList.add('hidden');
            if (window.mapValidationTimeout) clearTimeout(window.mapValidationTimeout);
        }
    }

    recordsFilters.map = mapVal;
    if (racerInput) recordsFilters.racer = racerInput.value.toLowerCase();
    if (carInput) recordsFilters.car = carInput.value.toLowerCase();
    if (timeFilter) recordsFilters.time = timeFilter.value;
    if (sortSelect) recordsFilters.sort = sortSelect.value;
    
    const garbageFilter = document.getElementById('records-filter-garbage');
    if (garbageFilter) recordsFilters.garbage = garbageFilter.value;

    filteredRecords = allRecords.filter(record => {
        // Filter by map (partial match case-insensitive)
        if (recordsFilters.map !== 'all') {
            const recordMap = (record.mapName || '').toLowerCase();
            const filterMap = recordsFilters.map.toLowerCase();
            if (!recordMap.includes(filterMap)) {
                return false;
            }
        }

        // Filter by racer name
        if (recordsFilters.racer) {
            const racerName = (record.racerName || '').toLowerCase();
            if (!racerName.includes(recordsFilters.racer)) {
                return false;
            }
        }

        // Filter by car
        if (recordsFilters.car) {
            const carName = (record.car || '').toLowerCase();
            if (!carName.includes(recordsFilters.car)) {
                return false;
            }
        }

        // Filter by time range
        if (recordsFilters.time !== 'all') {
            const timeInSeconds = record.timeInSeconds || 0;
            switch (recordsFilters.time) {
                case 'under_60':
                    if (timeInSeconds >= 60) return false;
                    break;
                case '60_to_90':
                    if (timeInSeconds < 60 || timeInSeconds >= 90) return false;
                    break;
                case '90_to_120':
                    if (timeInSeconds < 90 || timeInSeconds >= 120) return false;
                    break;
                case 'over_120':
                    if (timeInSeconds < 120) return false;
                    break;
            }
        }

        // Filter by garbage/issues
        if (recordsFilters.garbage && recordsFilters.garbage !== 'all') {
            const issues = window.getRecordIssues(record, allRecords);
            const hasIssue = issues.length > 0;
            
            switch (recordsFilters.garbage) {
                case 'any_issue':
                    if (!hasIssue) return false;
                    break;
                case 'invalid_map':
                    if (!issues.includes("Bản đồ không tồn tại") && !issues.includes("Thiếu tên bản đồ")) return false;
                    break;
                case 'invalid_time':
                    if (!issues.includes("Thời gian không hợp lệ (<= 0)") && !issues.includes("Thiếu chuỗi thời gian") && !issues.includes("Định dạng thời gian sai") && !issues.includes("Bất đồng bộ giây và chuỗi")) return false;
                    break;
                case 'suspicious_time':
                    if (!issues.includes("Thời gian quá nhanh (< 15 giây)") && !issues.includes("Thời gian quá lâu (> 3 phút)")) return false;
                    break;
                case 'duplicate':
                    if (!issues.includes("Bản ghi trùng lặp")) return false;
                    break;
                case 'missing_info':
                    if (!issues.includes("Thiếu tên bản đồ") && !issues.includes("Thiếu tên tay đua") && !issues.includes("Thiếu chuỗi thời gian")) return false;
                    break;
            }
        }

        return true;
    });

    // Apply sorting
    switch (recordsFilters.sort) {
        case 'time_asc':
            filteredRecords.sort((a, b) => (a.timeInSeconds || 0) - (b.timeInSeconds || 0));
            break;
        case 'time_desc':
            filteredRecords.sort((a, b) => (b.timeInSeconds || 0) - (a.timeInSeconds || 0));
            break;
        case 'date_new':
            filteredRecords.sort((a, b) => {
                const dateA = new Date(a.timestamp || 0);
                const dateB = new Date(b.timestamp || 0);
                return dateB - dateA;
            });
            break;
        case 'date_old':
            filteredRecords.sort((a, b) => {
                const dateA = new Date(a.timestamp || 0);
                const dateB = new Date(b.timestamp || 0);
                return dateA - dateB;
            });
            break;
        case 'map_name':
            filteredRecords.sort((a, b) => (a.mapName || '').localeCompare(b.mapName || ''));
            break;
        case 'racer_name':
            filteredRecords.sort((a, b) => (a.racerName || '').localeCompare(b.racerName || ''));
            break;
    }

    updateRecordsFilterDisplay();
    renderFilteredRecords(1);
};

// Update filter display
const updateRecordsFilterDisplay = () => {
    const resultEl = document.getElementById('records-filter-result');
    const countEl = document.getElementById('records-count-display');

    if (!resultEl || !countEl) return;

    let filterText = 'Hiển thị: ';
    const activeFilters = [];

    if (recordsFilters.map !== 'all') {
        activeFilters.push(`Map: ${recordsFilters.map}`);
    }
    if (recordsFilters.racer) {
        activeFilters.push(`Racer: "${recordsFilters.racer}"`);
    }
    if (recordsFilters.car) {
        activeFilters.push(`Xe: "${recordsFilters.car}"`);
    }
    if (recordsFilters.time !== 'all') {
        const timeLabels = {
            'under_60': 'Dưới 1 phút',
            '60_to_90': '1-1.5 phút',
            '90_to_120': '1.5-2 phút',
            'over_120': 'Trên 2 phút'
        };
        activeFilters.push(timeLabels[recordsFilters.time]);
    }
    if (recordsFilters.garbage && recordsFilters.garbage !== 'all') {
        const garbageLabels = {
            'any_issue': 'Có lỗi/rác ⚠️',
            'invalid_map': 'Map không tồn tại 🗺️',
            'invalid_time': 'Thời gian lỗi ⏱️',
            'suspicious_time': 'Thời gian nghi vấn ⚡',
            'duplicate': 'Trùng lặp 👥',
            'missing_info': 'Thiếu thông tin 📁'
        };
        activeFilters.push(`Lọc: ${garbageLabels[recordsFilters.garbage] || recordsFilters.garbage}`);
    }

    if (activeFilters.length > 0) {
        filterText += activeFilters.join(' • ');
    } else {
        filterText = 'Hiển thị tất cả kỉ lục';
    }

    resultEl.textContent = filterText;
    countEl.textContent = `${filteredRecords.length} kỉ lục`;
};

// Render filtered records
const renderFilteredRecords = (page) => {
    currentPage['raceRecords'] = page;

    const totalItems = filteredRecords.length;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredRecords.slice(startIndex, endIndex);

    renderTable('raceRecords', pageData);
    renderPagination('raceRecords', totalItems, page);
};

// Reset records filter
window.resetRecordsFilter = () => {
    const mapFilter = document.getElementById('records-filter-map');
    const racerInput = document.getElementById('records-filter-racer');
    const carInput = document.getElementById('records-filter-car');
    const timeFilter = document.getElementById('records-filter-time');
    const garbageFilter = document.getElementById('records-filter-garbage');
    const sortSelect = document.getElementById('records-sort');
    const invalidIcon = document.getElementById('map-invalid-icon');

    if (mapFilter) mapFilter.value = '';
    if (invalidIcon) invalidIcon.classList.add('hidden');
    if (racerInput) racerInput.value = '';
    if (carInput) carInput.value = '';
    if (timeFilter) timeFilter.value = 'all';
    if (garbageFilter) garbageFilter.value = 'all';
    if (sortSelect) sortSelect.value = 'time_asc';

    recordsFilters = {
        map: 'all',
        racer: '',
        car: '',
        time: 'all',
        garbage: 'all',
        sort: 'time_asc'
    };

    filteredRecords = [...allRecords];
    filterRecordsNew();
    showMessage("Đã reset bộ lọc kỉ lục");
};

// Toggle Top 10 view
window.toggleTop10View = () => {
    const top10Section = document.getElementById('top10-by-map');
    const allRecordsSection = document.getElementById('all-records-table');
    const toggleBtn = document.getElementById('top10-toggle-text');

    if (top10Section.classList.contains('hidden')) {
        // Show top 10 for current filtered map
        if (recordsFilters.map !== 'all') {
            showTop10ForCurrentMap();
        } else {
            showMessage("Vui lòng chọn một bản đồ cụ thể để xem Top 10", true);
        }
    } else {
        // Hide top 10, show all records
        top10Section.classList.add('hidden');
        allRecordsSection.classList.remove('hidden');
        if (toggleBtn) toggleBtn.textContent = 'Xem Top 10';
    }
};

const showTop10ForCurrentMap = async () => {
    if (recordsFilters.map === 'all') {
        showMessage("Vui lòng chọn một bản đồ cụ thể!", true);
        return;
    }

    const top10Section = document.getElementById('top10-by-map');
    const allRecordsSection = document.getElementById('all-records-table');
    const toggleBtn = document.getElementById('top10-toggle-text');
    const tableBody = document.getElementById('top10-table-body');

    // Hiển thị loading ngay lập tức
    allRecordsSection.classList.add('hidden');
    top10Section.classList.remove('hidden');
    if (toggleBtn) toggleBtn.textContent = 'Quay lại danh sách';

    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="text-center py-8">
                <div class="loading-spinner mx-auto mb-4"></div>
                <p class="text-slate-500">Đang tải top 10...</p>
            </td>
        </tr>
    `;

    try {
        // THÊM: Đảm bảo allMaps đã được load
        if (allMaps.length === 0) {
            const mapsSnapshot = await getDocs(collection(db, "gameMaps"));
            allMaps = mapsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        const selectedMap = allMaps.find(map => map.name === recordsFilters.map);

        if (!selectedMap) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-8 text-red-500">
                        <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                        <p class="text-lg">Không tìm thấy bản đồ!</p>
                    </td>
                </tr>
            `;
            return;
        }

        document.getElementById('top10-map-title').innerHTML =
            `<i class="fas fa-trophy mr-2 text-yellow-400"></i>Top 10 Kỉ lục - ${selectedMap.name}`;

        // Sử dụng setTimeout để UI có thể render trước
        setTimeout(() => {
            const mapRecords = allRecords
                .filter(record => record.mapName === selectedMap.name)
                .sort((a, b) => a.timeInSeconds - b.timeInSeconds)
                .slice(0, 10);

            if (mapRecords.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-8 text-slate-500">
                            <i class="fas fa-clock text-3xl mb-3"></i>
                            <p class="text-lg">Chưa có kỉ lục nào cho bản đồ này</p>
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = '';
            mapRecords.forEach((record, index) => {
                const row = document.createElement('tr');
                const rank = index + 1;
                const date = record.timestamp ? new Date(record.timestamp).toLocaleDateString('vi-VN') : 'N/A';

                let rankClass = '';
                let rankIcon = '';

                if (rank === 1) {
                    rankClass = 'top-1';
                    rankIcon = '🥇';
                } else if (rank === 2) {
                    rankClass = 'top-2';
                    rankIcon = '🥈';
                } else if (rank === 3) {
                    rankClass = 'top-3';
                    rankIcon = '🥉';
                } else {
                    rankIcon = `#${rank}`;
                }

                row.className = rankClass;
                row.innerHTML = `
                    <td class="text-center">
                        <div class="text-xl font-bold">${rankIcon}</div>
                    </td>
                    <td class="font-semibold">${record.racerName || 'N/A'}</td>
                    <td class="font-mono font-bold text-lg ${rank <= 3 ? 'text-yellow-400' : 'text-cyan-400'}">
                        ${record.timeString || 'N/A'}
                    </td>
                    <td>${record.car || 'N/A'}</td>
                    <td>${record.pet || 'N/A'}</td>
                    <td class="text-sm text-slate-400">${date}</td>
                    <td>
                        <div class="action-buttons">
                            <button onclick="editItem('raceRecords', '${record.id}')" class="btn-edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="deleteItem('raceRecords', '${record.id}', \`${record.mapName}\`)" class="btn-delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        }, 0);

    } catch (error) {
        console.error("Error loading top 10:", error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-8 text-red-500">
                    <i class="fas fa-exclamation-triangle text-3xl mb-3"></i>
                    <p class="text-lg">Có lỗi xảy ra khi tải dữ liệu</p>
                    <p class="text-sm mt-2">${error.message}</p>
                </td>
            </tr>
        `;
    }
};
// Populate map filter options
const populateRecordsMapFilter = () => {
    const datalist = document.getElementById('records-map-list');
    if (!datalist) return;

    // Clear existing options
    datalist.innerHTML = '';

    // Get all system map names
    const mapNames = getSystemMapNames();

    mapNames.forEach(mapName => {
        const option = document.createElement('option');
        option.value = mapName;
        datalist.appendChild(option);
    });
};

// Close top 10 view
window.closeTop10View = () => {
    isTop10View = false;
    document.getElementById('top10-by-map').classList.add('hidden');
    document.getElementById('all-records-table').classList.remove('hidden');
    document.getElementById('map-filter').value = 'all';
    currentMapFilter = 'all';
    filterRecords(1);
};

// Sort records by map
window.sortRecordsByMap = () => {
    filteredRecords.sort((a, b) => {
        const mapA = a.mapName || '';
        const mapB = b.mapName || '';
        return mapA.localeCompare(mapB);
    });

    filterRecords(currentPage['raceRecords']);
    showMessage("Đã sắp xếp theo tên bản đồ");
};

// Load records data
const loadRecordsData = async (page = 1) => {
    try {
        currentPage['raceRecords'] = page;

        const recordsQuery = query(collection(db, "raceRecords"), orderBy("timeInSeconds", "asc"));
        const querySnapshot = await getDocs(recordsQuery);
        allRecords = [];

        querySnapshot.forEach((doc) => {
            allRecords.push({ id: doc.id, ...doc.data() });
        });

        // Tự động xóa kỷ lục không hợp lệ (thời gian > 180 giây)
        await cleanupInvalidRecords();

        // Populate map filter dropdown
        populateRecordsMapFilter();

        // Apply filter
        filteredRecords = [...allRecords];
        filterRecordsNew();

    } catch (error) {
        console.error("Error loading records:", error);
        showMessage("Lỗi tải dữ liệu kỉ lục!", true);
    }
};

// Hàm xóa kỷ lục không hợp lệ (thời gian > 180 giây)
const cleanupInvalidRecords = async () => {
    try {
        const batch = writeBatch(db);
        let deletedCount = 0;

        allRecords.forEach((record) => {
            if (record.timeInSeconds > 180) {
                batch.delete(doc(db, "raceRecords", record.id));
                deletedCount++;
                console.log(`🗑️ Tự động xóa kỷ lục không hợp lệ: ${record.mapName} - ${record.racerName} (${record.timeInSeconds}s)`);
            }
        });

        if (deletedCount > 0) {
            await batch.commit();
            // Cập nhật lại mảng allRecords
            allRecords = allRecords.filter(record => record.timeInSeconds <= 180);
            console.log(`✅ Đã xóa ${deletedCount} kỷ lục vượt quá 3 phút`);
        }
    } catch (error) {
        console.error("Error cleaning up invalid records:", error);
    }
};

// Filter records
const filterRecords = (page = 1) => {
    currentPage['raceRecords'] = page;

    if (currentMapFilter !== 'all' && !isTop10View) {
        const selectedMap = allMaps.find(map => map.id === currentMapFilter);
        if (selectedMap) {
            filteredRecords = allRecords.filter(record => record.mapName === selectedMap.name);
        } else {
            filteredRecords = [...allRecords];
        }
    } else {
        filteredRecords = [...allRecords];
    }

    filteredRecords.sort((a, b) => a.timeInSeconds - b.timeInSeconds);

    const totalItems = filteredRecords.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredRecords.slice(startIndex, endIndex);

    renderTable('raceRecords', pageData);
    renderPagination('raceRecords', totalItems, page);
};

// Delete all records
window.deleteAllRecords = async () => {
    if (!confirm("⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA TẤT CẢ KỶ LỤC KHÔNG?\n\nHành động này không thể hoàn tác!")) {
        return;
    }

    try {
        const batch = writeBatch(db);
        const recordsSnapshot = await getDocs(collection(db, "raceRecords"));

        let deleteCount = 0;
        recordsSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            deleteCount++;
        });

        await batch.commit();
        showMessage(`✅ Đã xóa ${deleteCount} kỷ lục thành công!`);
        await loadRecordsData(1);
    } catch (error) {
        console.error("Error deleting all records:", error);
        showMessage("Lỗi khi xóa kỷ lục!", true);
    }
};

// Load users data
const loadUsersData = async (page = 1) => {
    try {
        currentPage['users'] = page;
        const querySnapshot = await getDocs(collection(db, "users"));
        allUsers = [];

        querySnapshot.forEach((doc) => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });

        filteredUsers = [...allUsers];
        renderFilteredUsers(page);
    } catch (error) {
        console.error("Error loading users:", error);
        showMessage("Lỗi tải dữ liệu người dùng!", true);
    }
};

// Update user role
window.updateUserRole = async (userId, newRole) => {
    try {
        await updateDoc(doc(db, "users", userId), { role: newRole });
        showMessage("Đã cập nhật vai trò người dùng!");
    } catch (error) {
        console.error("Error updating user role:", error);
        showMessage("Lỗi khi cập nhật vai trò!", true);
    }
};

// Update user admin status
window.updateUserAdminStatus = async (userId, isAdmin) => {
    try {
        await updateDoc(doc(db, "users", userId), { isAdmin: isAdmin === 'true' });
        showMessage("Đã cập nhật quyền admin!");
    } catch (error) {
        console.error("Error updating admin status:", error);
        showMessage("Lỗi khi cập nhật quyền admin!", true);
    }
};

// Update user status
window.updateUserStatus = async (userId, status) => {
    try {
        const updateData = {
            status: status,
            lastUpdated: serverTimestamp()
        };

        await updateDoc(doc(db, "users", userId), updateData);
        showMessage(`Đã cập nhật trạng thái người dùng thành: ${status === 'banned' ? 'Bị cấm' : 'Hoạt động'}!`);

        // Log activity
        await logActivity('update', `Cập nhật trạng thái người dùng: ${status}`, {
            userId: userId,
            status: status
        });
    } catch (error) {
        console.error("Error updating user status:", error);
        showMessage("Lỗi khi cập nhật trạng thái!", true);
    }
};

// Update user display name
window.updateUserDisplayName = async (userId, displayName) => {
    try {
        if (!displayName || displayName.trim() === '') {
            showMessage("Tên hiển thị không được để trống!", true);
            return;
        }

        await updateDoc(doc(db, "users", userId), {
            displayName: displayName.trim(),
            lastUpdated: serverTimestamp()
        });

        showMessage("Đã cập nhật tên hiển thị!");

        // Log activity
        await logActivity('update', `Cập nhật tên hiển thị người dùng: ${displayName}`, {
            userId: userId
        });

    } catch (error) {
        console.error("Error updating display name:", error);
        showMessage("Lỗi khi cập nhật tên hiển thị!", true);
    }
};

// Update user nickname
window.updateUserNickname = async (userId, nickname) => {
    try {
        await updateDoc(doc(db, "users", userId), {
            nickname: nickname.trim(),
            lastUpdated: serverTimestamp()
        });

        showMessage("Đã cập nhật biệt danh!");

        // Log activity
        await logActivity('update', `Cập nhật biệt danh người dùng: ${nickname}`, {
            userId: userId
        });

    } catch (error) {
        console.error("Error updating nickname:", error);
        showMessage("Lỗi khi cập nhật biệt danh!", true);
    }
};

// Edit user
window.editUser = async (userId) => {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));

        if (!userDoc.exists()) {
            showMessage("Không tìm thấy người dùng!", true);
            return;
        }

        currentEditingItem = { id: userDoc.id, ...userDoc.data() };
        currentCollection = 'users';

        document.getElementById('modal-title').textContent = 'Chỉnh sửa Người dùng';
        generateForm('user');
        document.getElementById('modal').classList.remove('hidden');

    } catch (error) {
        console.error("Error loading user:", error);
        showMessage("Lỗi tải thông tin người dùng!", true);
    }
};

// Delete user
window.deleteUser = async (userId, userEmail) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa người dùng "${userEmail}" không?\n\nLưu ý: Điều này chỉ xóa thông tin trong Firestore, không xóa tài khoản Authentication.`)) return;

    try {
        await deleteDoc(doc(db, "users", userId));
        showMessage("Đã xóa thông tin người dùng!");
        loadUsersData(currentPage['users']);
    } catch (error) {
        console.error("Error deleting user:", error);
        showMessage("Lỗi khi xóa người dùng!", true);
    }
};

// Load notifications
const loadNotifications = async () => {
    try {
        const notificationsRef = collection(db, "notifications");
        const q = query(notificationsRef, orderBy("createdAt", "desc") || orderBy("timestamp", "desc"));
        const snapshot = await getDocs(q);

        allNotifications = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            read: doc.data().read !== undefined ? doc.data().read : false
        }));

        // Sort by date (newest first)
        allNotifications.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt) : (a.timestamp ? new Date(a.timestamp) : new Date(0));
            const dateB = b.createdAt ? new Date(b.createdAt) : (b.timestamp ? new Date(b.timestamp) : new Date(0));
            return dateB - dateA;
        });

        updateNotificationCount();

        if (currentTab === 'notifications') {
            renderNotifications();
        }

    } catch (error) {
        console.error("Error loading notifications:", error);
        try {
            const notificationsRef = collection(db, "notifications");
            const q = query(notificationsRef, orderBy("timestamp", "desc"));
            const snapshot = await getDocs(q);

            allNotifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                read: doc.data().read !== undefined ? doc.data().read : false
            }));

            allNotifications.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : (a.timestamp ? new Date(a.timestamp) : new Date(0));
                const dateB = b.createdAt ? new Date(b.createdAt) : (b.timestamp ? new Date(b.timestamp) : new Date(0));
                return dateB - dateA;
            });

            updateNotificationCount();

            if (currentTab === 'notifications') {
                renderNotifications();
            }
        } catch (error2) {
            console.error("Error loading notifications with timestamp:", error2);
        }
    }
};

// Update notification count
const updateNotificationCount = () => {
    unreadNotificationCount = allNotifications.filter(n => !n.read).length;

    const notificationBadge = document.getElementById('notification-count');
    const tabBadge = document.getElementById('notification-tab-count');
    const unreadElement = document.getElementById('unread-notifications');

    if (unreadNotificationCount > 0) {
        if (notificationBadge) {
            notificationBadge.textContent = unreadNotificationCount;
            notificationBadge.classList.remove('hidden');
        }
        if (tabBadge) {
            tabBadge.textContent = unreadNotificationCount;
            tabBadge.classList.remove('hidden');
        }
        if (unreadElement) {
            unreadElement.textContent = `${unreadNotificationCount} chưa đọc`;
            unreadElement.className = 'text-sm text-red-400';
        }
    } else {
        if (notificationBadge) notificationBadge.classList.add('hidden');
        if (tabBadge) tabBadge.classList.add('hidden');
        if (unreadElement) {
            unreadElement.textContent = '0 chưa đọc';
            unreadElement.className = 'text-sm text-slate-400';
        }
    }
};

// Render notifications
const renderNotifications = () => {
    const notificationsList = document.getElementById('notifications-list');
    if (!notificationsList) return;

    // Apply filters
    applyNotificationFilters();

    // Update stats
    updateNotificationStats();

    notificationsList.innerHTML = '';

    if (filteredNotifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="text-center py-16">
                <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-slate-800/50 to-slate-900/50 flex items-center justify-center">
                    <i class="fas fa-bell-slash text-3xl text-slate-600"></i>
                </div>
                <h3 class="text-lg font-bold text-white mb-2">Không có thông báo</h3>
                <p class="text-slate-400 text-sm">
                    ${notificationFilters.type !== 'all' || notificationFilters.status !== 'all'
                ? 'Không tìm thấy thông báo phù hợp với bộ lọc'
                : 'Chưa có thông báo nào được gửi'}
                </p>
            </div>
        `;
        return;
    }

    filteredNotifications.forEach(notification => {
        const notificationDate = notification.createdAt || notification.timestamp;
        const timeAgo = getTimeAgo(new Date(notificationDate));
        const isUnread = !notification.read;

        // Get type-specific colors
        const typeColors = {
            'system': { bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', text: 'text-blue-400', icon: 'fa-cog' },
            'info': { bg: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', icon: 'fa-info-circle' },
            'record': { bg: 'from-yellow-500/20 to-orange-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: 'fa-trophy' },
            'success': { bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30', text: 'text-green-400', icon: 'fa-check-circle' },
            'warning': { bg: 'from-orange-500/20 to-red-500/20', border: 'border-orange-500/30', text: 'text-orange-400', icon: 'fa-exclamation-triangle' },
            'error': { bg: 'from-red-500/20 to-pink-500/20', border: 'border-red-500/30', text: 'text-red-400', icon: 'fa-times-circle' }
        };

        const typeColor = typeColors[notification.type] || typeColors['info'];

        const notificationCard = document.createElement('div');
        notificationCard.className = `
            bg-slate-900/40 backdrop-blur-md rounded-xl p-4 
            transition-all duration-300 cursor-pointer
            hover:scale-[1.01] hover:shadow-lg
            ${isUnread
                ? `border border-cyan-500/30 hover:shadow-cyan-500/20 bg-cyan-500/5`
                : `hover:shadow-white/5 ${notification.read ? 'opacity-70' : ''}`
            }
        `;

        notificationCard.innerHTML = `
            <div class="flex items-start gap-4">
                <!-- Icon -->
                <div class="w-10 h-10 rounded-lg bg-gradient-to-br ${typeColor.bg} border ${typeColor.border} flex items-center justify-center flex-shrink-0">
                    <i class="fas ${typeColor.icon} ${typeColor.text}"></i>
                </div>
                
                <!-- Content -->
                <div class="flex-1 min-w-0">
                    <!-- Title Row -->
                    <div class="flex items-center gap-2 mb-2">
                        <h4 class="text-white font-bold text-sm">${notification.title || 'Thông báo'}</h4>
                        ${notification.important
                ? '<span class="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-xs font-bold flex items-center gap-1"><i class="fas fa-star"></i>QUAN TRỌNG</span>'
                : ''}
                        ${isUnread
                ? '<span class="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>'
                : ''}
                    </div>
                    
                    <!-- Content -->
                    <p class="text-slate-300 text-sm mb-3 line-clamp-2">${notification.content || ''}</p>
                    
                    <!-- Meta Info -->
                    <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span class="flex items-center gap-1">
                            <i class="fas fa-clock"></i>
                            ${timeAgo}
                        </span>
                        <span class="flex items-center gap-1">
                            <i class="fas fa-user"></i>
                            ${notification.sender || 'Hệ thống'}
                        </span>
                        <span class="flex items-center gap-1">
                            <i class="fas fa-users"></i>
                            ${getTargetDisplayName(notification.target)}
                        </span>
                        <span class="flex items-center gap-1 ${typeColor.text}">
                            <i class="fas fa-tag"></i>
                            ${getTypeDisplayName(notification.type)}
                        </span>
                    </div>
                </div>
                
                <!-- Actions -->
                <div class="flex flex-col gap-2 flex-shrink-0">
                    ${!notification.read ? `
                        <button onclick="markNotificationAsRead('${notification.id}', event)" 
                                class="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 transition-all text-xs font-medium flex items-center gap-1.5"
                                title="Đánh dấu đã đọc">
                            <i class="fas fa-check"></i>
                            Đọc
                        </button>
                    ` : `
                        <span class="px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg border border-green-500/30 text-xs font-medium flex items-center gap-1.5">
                            <i class="fas fa-check-circle"></i>
                            Đã đọc
                        </span>
                    `}
                    <button onclick="deleteNotification('${notification.id}', event)" 
                            class="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/30 transition-all text-xs font-medium flex items-center gap-1.5"
                            title="Xóa thông báo">
                        <i class="fas fa-trash"></i>
                        Xóa
                    </button>
                </div>
            </div>
        `;

        notificationsList.appendChild(notificationCard);
    });
};

// Apply notification filters
const applyNotificationFilters = () => {
    filteredNotifications = allNotifications.filter(notification => {
        // Filter by type
        if (notificationFilters.type !== 'all' && notification.type !== notificationFilters.type) {
            return false;
        }

        // Filter by status
        if (notificationFilters.status === 'unread' && notification.read) {
            return false;
        }
        if (notificationFilters.status === 'read' && !notification.read) {
            return false;
        }

        return true;
    });
};

// Filter notifications
window.filterNotifications = () => {
    const typeFilter = document.getElementById('notification-filter-type');
    const statusFilter = document.getElementById('notification-filter-status');

    if (typeFilter) notificationFilters.type = typeFilter.value;
    if (statusFilter) notificationFilters.status = statusFilter.value;

    renderNotifications();
};

// Update notification stats
const updateNotificationStats = () => {
    const totalCount = allNotifications.length;
    const unreadCount = allNotifications.filter(n => !n.read).length;

    // Count today's notifications
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = allNotifications.filter(n => {
        const nDate = new Date(n.createdAt || n.timestamp);
        nDate.setHours(0, 0, 0, 0);
        return nDate.getTime() === today.getTime();
    }).length;

    // Update UI
    const totalEl = document.getElementById('total-notifications-count');
    const unreadEl = document.getElementById('unread-notifications-count');
    const todayEl = document.getElementById('today-notifications-count');

    if (totalEl) totalEl.textContent = totalCount;
    if (unreadEl) unreadEl.textContent = unreadCount;
    if (todayEl) todayEl.textContent = todayCount;
};

// Get type display name
const getTypeDisplayName = (type) => {
    const types = {
        'system': 'Hệ thống',
        'info': 'Thông tin',
        'record': 'Kỷ lục',
        'success': 'Thành công',
        'warning': 'Cảnh báo',
        'error': 'Lỗi'
    };
    return types[type] || type;
};

// Get notification icon
const getNotificationIcon = (type) => {
    const icons = {
        'record': 'fa-trophy',
        'system': 'fa-cog',
        'info': 'fa-info-circle',
        'warning': 'fa-exclamation-triangle',
        'success': 'fa-check-circle',
        'error': 'fa-times-circle'
    };
    return icons[type] || 'fa-bell';
};

// Get notification color
const getNotificationColor = (type) => {
    const colors = {
        'record': 'text-yellow-400',
        'system': 'text-cyan-400',
        'info': 'text-blue-400',
        'warning': 'text-orange-400',
        'success': 'text-green-400',
        'error': 'text-red-400'
    };
    return colors[type] || 'text-slate-400';
};

// Get target display name
const getTargetDisplayName = (target) => {
    const targets = {
        'all': 'Tất cả người dùng',
        'admins': 'Chỉ Admin',
        'racers': 'Chỉ tay đua',
        'viewers': 'Chỉ người xem'
    };
    return targets[target] || target;
};

// Send notification
window.sendNotification = async () => {
    const sendBtn = event.target;
    try {
        const title = document.getElementById('notification-title').value.trim();
        const content = document.getElementById('notification-content').value.trim();
        const type = document.getElementById('notification-type').value;
        const target = document.getElementById('notification-target').value;
        const important = document.getElementById('notification-important').checked;

        if (!title || !content) {
            showMessage("Vui lòng nhập tiêu đề và nội dung!", true);
            return;
        }

        // Disable button to prevent double submit
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';

        const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const notificationData = {
            title,
            content,
            type,
            target,
            important,
            sender: currentUser.email,
            senderId: currentUser.displayName || currentUser.email,
            read: false,
            createdAt: new Date().toISOString(),
            timestamp: new Date().toISOString()
        };

        // Lấy danh sách tất cả users
        const usersSnapshot = await getDocs(collection(db, "users"));

        // Lọc user theo target
        let targetUsers = usersSnapshot.docs;
        if (target !== 'all') {
            targetUsers = usersSnapshot.docs.filter(userDoc => {
                const userData = userDoc.data();
                if (target === 'admin') return userData.isAdmin || userData.role === 'admin';
                if (target === 'viewer') return !userData.isAdmin && userData.role !== 'admin';
                return true;
            });
        }

        if (targetUsers.length === 0) {
            showMessage("Không tìm thấy người dùng nào phù hợp!", true);
            sendBtn.disabled = false;
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi thông báo ngay';
            return;
        }

        // Gửi thông báo vào subcollection của từng user (users/{uid}/notifications/{id})
        // Đây là nơi index.js lắng nghe qua onSnapshot
        const writePromises = targetUsers.map(userDoc => {
            const userNotifRef = doc(db, "users", userDoc.id, "notifications", notificationId);
            return setDoc(userNotifRef, notificationData);
        });
        await Promise.all(writePromises);

        // Cũng lưu vào root collection notifications/ để admin xem trong configdata
        await setDoc(doc(db, "notifications", notificationId), notificationData);

        // Clear form
        document.getElementById('notification-title').value = '';
        document.getElementById('notification-content').value = '';
        document.getElementById('notification-type').value = 'system';
        document.getElementById('notification-target').value = 'all';
        document.getElementById('notification-important').checked = false;

        showMessage(`✅ Đã gửi thông báo thành công tới ${targetUsers.length} người dùng!`);

        // Re-enable button
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi thông báo ngay';

        await loadNotifications();

        await logActivity('create', `Đã gửi thông báo: ${title}`, {
            target: target,
            important: important,
            recipientCount: targetUsers.length
        });

    } catch (error) {
        console.error("Error sending notification:", error);
        showMessage("Lỗi khi gửi thông báo: " + error.message, true);

        // Re-enable button
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi thông báo ngay';
    }
};

// Mark notification as read
window.markNotificationAsRead = async (notificationId, event) => {
    if (event) event.stopPropagation();

    try {
        await updateDoc(doc(db, "notifications", notificationId), {
            read: true
        });

        // Update local data
        const notification = allNotifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
        }

        showMessage("✓ Đã đánh dấu đã đọc");
        renderNotifications();

    } catch (error) {
        console.error("Error marking notification as read:", error);
        showMessage("Lỗi khi đánh dấu đã đọc!", true);
    }
};

// Mark all notifications as read
window.markAllNotificationsAsRead = async () => {
    try {
        const batch = writeBatch(db);
        const unreadNotifications = allNotifications.filter(n => !n.read);

        if (unreadNotifications.length === 0) {
            showMessage("Không có thông báo nào chưa đọc!");
            return;
        }

        unreadNotifications.forEach(notification => {
            const notificationRef = doc(db, "notifications", notification.id);
            batch.update(notificationRef, { read: true });
        });

        await batch.commit();
        showMessage(`Đã đánh dấu ${unreadNotifications.length} thông báo là đã đọc!`);
        await loadNotifications();

    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        showMessage("Lỗi khi đánh dấu tất cả đã đọc!", true);
    }
};

// Delete notification
window.deleteNotification = async (notificationId, event) => {
    if (event) event.stopPropagation();

    if (!confirm("Bạn có chắc chắn muốn xóa thông báo này không?")) return;

    try {
        await deleteDoc(doc(db, "notifications", notificationId));

        // Update local data
        allNotifications = allNotifications.filter(n => n.id !== notificationId);

        showMessage("✓ Đã xóa thông báo");
        renderNotifications();

    } catch (error) {
        console.error("Error deleting notification:", error);
        showMessage("Lỗi khi xóa thông báo!", true);
    }
};

// Delete all notifications
window.deleteAllNotifications = async () => {
    if (!confirm("⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA TẤT CẢ THÔNG BÁO KHÔNG?\n\nHành động này không thể hoàn tác!")) return;

    try {
        const batch = writeBatch(db);
        const notificationsSnapshot = await getDocs(collection(db, "notifications"));

        let deleteCount = 0;
        notificationsSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            deleteCount++;
        });

        await batch.commit();
        showMessage(`✅ Đã xóa ${deleteCount} thông báo thành công!`);
        await loadNotifications();

    } catch (error) {
        console.error("Error deleting all notifications:", error);
        showMessage("Lỗi khi xóa thông báo!", true);
    }
};

// Refresh notifications
window.refreshNotifications = async () => {
    const notificationsList = document.getElementById('notifications-list');
    if (notificationsList) {
        notificationsList.innerHTML = `
            <div class="text-center py-12 text-slate-500">
                <div class="loading-spinner mx-auto mb-4"></div>
                <p>Đang làm mới...</p>
            </div>
        `;
    }

    await loadNotifications();
    showMessage("✓ Đã làm mới danh sách thông báo");
};

// Open notification modal
window.openNotificationModal = () => {
    document.getElementById('notification-modal').classList.remove('hidden');
};

// Close notification modal
window.closeNotificationModal = () => {
    document.getElementById('notification-modal').classList.add('hidden');
};

// Open send notification modal
window.openSendNotificationModal = () => {
    switchTab('notifications');
    setTimeout(() => {
        const formElement = document.getElementById('notification-title');
        if (formElement) {
            formElement.scrollIntoView({ behavior: 'smooth' });
            formElement.focus();
        }
    }, 100);
};

// View map image
window.viewMapImage = (imageUrl, mapName) => {
    document.getElementById('image-viewer-title').textContent = mapName;
    document.getElementById('image-viewer-img').src = imageUrl;
    document.getElementById('image-viewer-modal').classList.remove('hidden');
};

// Close image viewer
window.closeImageViewer = () => {
    document.getElementById('image-viewer-modal').classList.add('hidden');
};

// Generate unique ID
const generateUniqueId = (prefix) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}_${timestamp}_${random}`;
};

// Open add modal
window.openAddModal = (type) => {
    try {
        currentEditingItem = null;

        const typeToCollectionMap = {
            'car': 'gameCars',
            'map': 'gameMaps',
            'pet': 'gamePets',
            'record': 'raceRecords',
            'user': 'users',
            'banner': 'banners'
        };

        currentCollection = typeToCollectionMap[type] || '';

        const titles = {
            'car': 'Thêm Xe mới',
            'map': 'Thêm Bản đồ mới',
            'pet': 'Thêm Pet mới',
            'record': 'Thêm Kỷ lục mới',
            'user': 'Thêm Người dùng mới',
            'banner': 'Thêm Banner mới'
        };

        document.getElementById('modal-title').textContent = titles[type] || 'Thêm mới';
        generateForm(type);
        document.getElementById('modal').classList.remove('hidden');
    } catch (e) {
        console.error("Lỗi trong openAddModal:", e);
        if (typeof Swal !== 'undefined') Swal.fire('Lỗi JS', e.message, 'error');
        else alert('Lỗi: ' + e.message);
    }
};

// Generate form
const generateForm = (type) => {
    try {
        const form = document.getElementById('modal-form');
        form.innerHTML = '';

        const forms = {
            'car': generateCarForm(),
            'map': generateMapForm(),
            'pet': generatePetForm(),
            'record': generateRecordForm(),
            'user': generateUserForm(),
            'banner': typeof generateBannerForm === 'function' ? generateBannerForm() : ''
        };

        form.innerHTML = forms[type] || '<p>Form không khả dụng</p>';
    } catch (e) {
        console.error("Lỗi trong generateForm:", e);
        throw e; // throw up to openAddModal
    }
};

// Generate car form
const generateCarForm = () => {
    const isEditMode = !!currentEditingItem;


    return `
                <div class="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-4">
                    <i class="fas fa-key mr-2"></i>
                    ${isEditMode ? 'Đang chỉnh sửa xe:' : 'ID mới sẽ được tự động tạo:'}
                    <span class="font-bold ml-2">${isEditMode ? currentEditingItem.id : generateUniqueId('car')}</span>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="field-group">
                        <label class="field-label">Tên Xe *</label>
                        <input type="text" id="car-name" class="field-input" placeholder="Cực Dạ Chi Tinh EXA" value="${currentEditingItem?.name || ''}" required>
                    </div>
                    <div class="field-group">
                        <label class="field-label">Loại Xe *</label>
                        <input type="text" id="car-type" class="field-input" placeholder="Xe Siêu Cấp" value="${currentEditingItem?.type || ''}" required>
                    </div>
                    <div class="field-group">
                        <label class="field-label">Độ hiếm *</label>
                        <select id="car-rarity" class="field-input" required>
                            <option value="">Chọn độ hiếm</option>
                            <option value="Thường" ${currentEditingItem?.rarity === 'Thường' ? 'selected' : ''}>Thường</option>
                            <option value="Hiếm" ${currentEditingItem?.rarity === 'Hiếm' ? 'selected' : ''}>Hiếm</option>
                            <option value="Huyền Thoại" ${currentEditingItem?.rarity === 'Huyền Thoại' ? 'selected' : ''}>Huyền Thoại</option>
                            <option value="Thần Thoại" ${currentEditingItem?.rarity === 'Thần Thoại' ? 'selected' : ''}>Thần Thoại</option>
                        </select>
                    </div>
                    <div class="field-group">
                        <label class="field-label">Tốc độ (Speed) *</label>
                        <input type="number" id="car-speed" class="field-input" placeholder="328" value="${currentEditingItem?.speed || ''}" required min="0">
                    </div>
                    <div class="field-group">
                        <label class="field-label">Acceleration *</label>
                        <input type="number" id="car-acceleration" class="field-input" placeholder="96" value="${currentEditingItem?.acceleration || ''}" required min="0">
                    </div>
                    <div class="field-group col-span-2">
                        <label class="field-label">Ảnh Xe (URL)</label>
                        <input type="text" id="car-imageUrl" class="field-input" placeholder="https://..." value="${currentEditingItem?.imageUrl || ''}">
                    </div>
                </div>
                <p class="text-sm text-slate-400 mt-4">* Trường bắt buộc</p>
            `;
};

// Generate map form
const generateMapForm = () => {
    const isEditMode = !!currentEditingItem;
    const bestRec = currentEditingItem?.name && window.getBestRecordForMap ? window.getBestRecordForMap(currentEditingItem.name) : null;
    const defaultTime = bestRec ? bestRec.recordTime : (currentEditingItem?.recordTime || '');
    const defaultRacer = bestRec ? bestRec.recordRacer : (currentEditingItem?.recordRacer || '');
    const defaultCar = bestRec ? bestRec.recordCar : (currentEditingItem?.recordCar || '');
    const defaultPet = bestRec ? bestRec.recordPet : (currentEditingItem?.recordPet || '');

    return `
                <div class="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-4">
                    <i class="fas fa-key mr-2"></i>
                    ${isEditMode ? 'Đang chỉnh sửa bản đồ:' : 'ID mới sẽ được tự động tạo:'}
                    <span class="font-bold ml-2">${isEditMode ? currentEditingItem.id : generateUniqueId('map')}</span>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="field-group">
                        <label class="field-label">Tên Bản đồ *</label>
                        <input type="text" id="map-name" class="field-input" placeholder="Đại Lộ 1" value="${currentEditingItem?.name || ''}" required>
                    </div>
                    <div class="field-group">
                        <label class="field-label">Độ khó *</label>
                        <select id="map-difficulty" class="field-input" required>
                            <option value="">Chọn độ khó</option>
                            <option value="3 sao" ${currentEditingItem?.difficulty === '3 sao' || currentEditingItem?.difficulty === 'Dễ (3 sao)' || currentEditingItem?.difficulty === 'Dễ' ? 'selected' : ''}>3 sao</option>
                            <option value="4 sao" ${currentEditingItem?.difficulty === '4 sao' || currentEditingItem?.difficulty === 'Trung bình (4 sao)' || currentEditingItem?.difficulty === 'Trung bình' ? 'selected' : ''}>4 sao</option>
                            <option value="5 sao" ${currentEditingItem?.difficulty === '5 sao' || currentEditingItem?.difficulty === 'Khó (5 sao)' || currentEditingItem?.difficulty === 'Khó' ? 'selected' : ''}>5 sao</option>
                            <option value="6 sao" ${currentEditingItem?.difficulty === '6 sao' || currentEditingItem?.difficulty === 'Rất khó (6 sao)' || currentEditingItem?.difficulty === 'Rất khó' ? 'selected' : ''}>6 sao</option>
                            <option value="7 sao" ${currentEditingItem?.difficulty === '7 sao' || currentEditingItem?.difficulty === 'Cực khó (7 sao)' || currentEditingItem?.difficulty === 'Cực khó' ? 'selected' : ''}>7 sao</option>
                        </select>
                    </div>
                    <div class="field-group">
                        <label class="field-label">Số vòng đua *</label>
                        <input type="number" id="map-laps" class="field-input" placeholder="2" value="${currentEditingItem?.laps || 2}" min="1" max="10" required>
                    </div>
                    <div class="field-group">
                        <label class="field-label">Record Time <span class="text-[10px] text-cyan-400 font-normal ml-1">(Auto theo Kỷ Lục)</span></label>
                        <input type="text" id="map-recordTime" class="field-input bg-slate-800/50" placeholder="01'04'23" value="${defaultTime}">
                    </div>
                    <div class="field-group">
                        <label class="field-label">Record Racer <span class="text-[10px] text-cyan-400 font-normal ml-1">(Auto theo Kỷ Lục)</span></label>
                        <input type="text" id="map-recordRacer" class="field-input bg-slate-800/50" placeholder="Tên tay đua" value="${defaultRacer}">
                    </div>
                    <div class="field-group">
                        <label class="field-label">Record Car <span class="text-[10px] text-cyan-400 font-normal ml-1">(Auto theo Kỷ Lục)</span></label>
                        <input type="text" id="map-recordCar" class="field-input bg-slate-800/50" placeholder="Tên xe" value="${defaultCar}">
                    </div>
                    <div class="field-group">
                        <label class="field-label">Record Pet <span class="text-[10px] text-cyan-400 font-normal ml-1">(Auto theo Kỷ Lục)</span></label>
                        <input type="text" id="map-recordPet" class="field-input bg-slate-800/50" placeholder="Tên pet" value="${defaultPet}">
                    </div>
                    <div class="field-group col-span-2">
                        <label class="field-label">Mô tả</label>
                        <textarea id="map-description" class="field-input" rows="3">${currentEditingItem?.description || ''}</textarea>
                    </div>
                    <div class="field-group col-span-2">
                        <label class="field-label">Video Best Record (URL)</label>
                        <input type="text" id="map-videoUrl" class="field-input" placeholder="https://..." value="${currentEditingItem?.videoUrl || currentEditingItem?.bestRecordVideo || ''}">
                    </div>
                    <div class="field-group col-span-2">
                        <label class="field-label">Ảnh Bản đồ (URL)</label>
                        <input type="text" id="map-imageUrl" class="field-input" placeholder="https://..." value="${currentEditingItem?.imageUrl || ''}">
                    </div>
                </div>
                <p class="text-xs text-cyan-400 mt-3 flex items-center gap-1.5 bg-cyan-500/10 p-2 rounded border border-cyan-500/20">
                    <i class="fas fa-sync-alt"></i> các trường Record Time, Record Racer, Record Car, Record Pet tự động đồng bộ theo kỷ lục cao nhất của bản đồ ở Tab Kỷ lục.
                </p>
            `;
};

// Generate pet form
const generatePetForm = () => {
    const isEditMode = !!currentEditingItem;

    return `
                <div class="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-4">
                    <i class="fas fa-key mr-2"></i>
                    ${isEditMode ? 'Đang chỉnh sửa pet:' : 'ID mới sẽ được tự động tạo:'}
                    <span class="font-bold ml-2">${isEditMode ? currentEditingItem.id : generateUniqueId('pet')}</span>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="field-group">
                        <label class="field-label">Tên Pet *</label>
                        <input type="text" id="pet-name" class="field-input" placeholder="Ngọc Tỉ Thần Hổ" value="${currentEditingItem?.name || ''}" required>
                    </div>
                    <div class="field-group">
                        <label class="field-label">Loại Pet *</label>
                        <input type="text" id="pet-type" class="field-input" placeholder="Hổ" value="${currentEditingItem?.type || ''}" required>
                    </div>
                    <div class="field-group">
                        <label class="field-label">Độ hiếm *</label>
                        <select id="pet-rarity" class="field-input" required>
                            <option value="">Chọn độ hiếm</option>
                            <option value="Thường" ${currentEditingItem?.rarity === 'Thường' ? 'selected' : ''}>Thường</option>
                            <option value="Hiếm" ${currentEditingItem?.rarity === 'Hiếm' ? 'selected' : ''}>Hiếm</option>
                            <option value="Huyền Thoại" ${currentEditingItem?.rarity === 'Huyền Thoại' ? 'selected' : ''}>Huyền Thoại</option>
                            <option value="Thần Thoại" ${currentEditingItem?.rarity === 'Thần Thoại' ? 'selected' : ''}>Thần Thoại</option>
                        </select>
                    </div>
                    <div class="field-group">
                        <label class="field-label">Tên Skill</label>
                        <input type="text" id="pet-skillName" class="field-input" placeholder="Uy Vũ Hổ Vương" value="${currentEditingItem?.skill?.name || ''}">
                    </div>
                    <div class="field-group">
                        <label class="field-label">Mô tả Skill</label>
                        <input type="text" id="pet-skillDesc" class="field-input" placeholder="Tăng 15% tốc độ..." value="${currentEditingItem?.skill?.description || ''}">
                    </div>
                    <div class="field-group col-span-2">
                        <label class="field-label">Ảnh Pet (URL)</label>
                        <input type="text" id="pet-imageUrl" class="field-input" placeholder="https://..." value="${currentEditingItem?.imageUrl || ''}">
                    </div>
                </div>
                <p class="text-sm text-slate-400 mt-4">* Trường bắt buộc</p>
            `;
};

// Generate record form
const generateRecordForm = () => {
    const isEditMode = !!currentEditingItem;
    
    // Generate suggestions datalists
    const mapSuggestionsHtml = (allMaps || []).map(m => `<option value="${m.name || ''}">`).join('');
    
    // Unique racers from allRecords
    const uniqueRacers = Array.from(new Set((allRecords || []).map(r => r.racerName).filter(Boolean)));
    const racerSuggestionsHtml = uniqueRacers.map(r => `<option value="${r}">`).join('');
    
    // Unique cars from allCars
    const carSuggestionsHtml = (allCars || []).map(c => `<option value="${c.name || ''}">`).join('');
    
    // Unique pets from allPets
    const petSuggestionsHtml = (allPets || []).map(p => `<option value="${p.name || ''}">`).join('');

    return `
                <div class="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-4 flex items-center justify-between">
                    <div>
                        <i class="fas fa-key mr-2 text-cyan-400"></i>
                        ${isEditMode ? `Đang sửa kỷ lục ID: <span class="font-mono font-bold text-cyan-300">${currentEditingItem.id}</span>` : 'ID kỷ lục mới sẽ được tự động tạo'}
                    </div>
                </div>
                
                <!-- Suggestions Datalists -->
                <datalist id="form-map-suggestions">${mapSuggestionsHtml}</datalist>
                <datalist id="form-racer-suggestions">${racerSuggestionsHtml}</datalist>
                <datalist id="form-car-suggestions">${carSuggestionsHtml}</datalist>
                <datalist id="form-pet-suggestions">${petSuggestionsHtml}</datalist>

                <div class="grid grid-cols-2 gap-4">
                    <div class="field-group">
                        <label class="field-label">Tên Bản đồ *</label>
                        <input type="text" id="record-mapName" list="form-map-suggestions" class="field-input" placeholder="Nhập hoặc chọn bản đồ..." value="${currentEditingItem?.mapName || ''}" required>
                    </div>
                    <div class="field-group">
                        <label class="field-label">Tên Tay đua *</label>
                        <input type="text" id="record-racerName" list="form-racer-suggestions" class="field-input" placeholder="Nhập hoặc chọn tay đua..." value="${currentEditingItem?.racerName || ''}" required>
                    </div>
                    <div class="field-group">
                        <label class="field-label">Index Tay đua (0-3)</label>
                        <input type="number" id="record-racerIndex" class="field-input" placeholder="0" value="${currentEditingItem?.racerIndex !== undefined ? currentEditingItem.racerIndex : ''}" min="0" max="3">
                    </div>
                    <div class="field-group">
                        <label class="field-label">Xe sử dụng</label>
                        <input type="text" id="record-car" list="form-car-suggestions" class="field-input" placeholder="Chọn xe..." value="${currentEditingItem?.car || ''}">
                    </div>
                    <div class="field-group">
                        <label class="field-label">Pet sử dụng</label>
                        <input type="text" id="record-pet" list="form-pet-suggestions" class="field-input" placeholder="Chọn pet..." value="${currentEditingItem?.pet || ''}">
                    </div>
                    
                    <div class="col-span-2 border-t border-slate-700/50 my-2"></div>
                    
                    <div class="field-group">
                        <label class="field-label">Thời gian (giây) *</label>
                        <input type="number" step="0.01" id="record-timeInSeconds" class="field-input font-mono font-bold text-cyan-300" placeholder="Ví dụ: 72.33" value="${currentEditingItem?.timeInSeconds || ''}" required min="0" oninput="window.syncTimeString(this.value)">
                    </div>
                    <div class="field-group">
                        <label class="field-label">Thời gian (Chuỗi MM'SS'MS) *</label>
                        <input type="text" id="record-timeString" class="field-input font-mono font-bold text-cyan-300" placeholder="Ví dụ: 01'12'33" value="${currentEditingItem?.timeString || ''}" required oninput="window.syncTimeSeconds(this.value)">
                        <p class="text-[10px] text-slate-500 mt-1">Hệ thống hỗ trợ tự động đồng bộ qua lại giữa Số giây và Chuỗi</p>
                    </div>
                </div>
                <p class="text-sm text-slate-400 mt-4">* Trường bắt buộc</p>
            `;
};

// Generate user form
const generateUserForm = () => {
    const isEditMode = !!currentEditingItem;

    if (!isEditMode) {
        return `
                <div class="bg-slate-500/10 border border-slate-500/30 rounded-lg p-4 mb-4">
                    <i class="fas fa-info-circle mr-2"></i>
                    Không thể thêm người dùng mới qua trang này. Người dùng phải đăng ký qua Authentication.
                </div>
                <div class="text-center py-8">
                    <i class="fas fa-user-slash text-4xl text-slate-500 mb-4"></i>
                    <p class="text-slate-400">Tính năng thêm người dùng không khả dụng.</p>
                    <p class="text-sm text-slate-500 mt-2">Vui lòng sử dụng Firebase Authentication Console để thêm người dùng mới.</p>
                </div>
            `;
    }

    return `
                <div class="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-4">
                    <i class="fas fa-user mr-2"></i>
                    Đang chỉnh sửa người dùng: <span class="font-bold ml-2">${currentEditingItem.email || 'N/A'}</span>
                </div>
                
                <div class="grid grid-cols-1 gap-4">
                    <div class="field-group">
                        <label class="field-label">Email (Không thể thay đổi)</label>
                        <input type="email" class="field-input bg-slate-800/50 cursor-not-allowed" 
                               value="${currentEditingItem.email || ''}" disabled>
                        <p class="text-xs text-slate-500 mt-1">Email là ID duy nhất và không thể thay đổi</p>
                    </div>

                    <div class="field-group">
                        <label class="field-label">📸 Ảnh đại diện (Avatar)</label>
                        <div class="flex gap-3 items-start mb-3">
                            <div class="flex-1">
                                <input type="file" id="admin-user-avatar-input" accept="image/*" 
                                       class="hidden" 
                                       onchange="handleAdminUserAvatarChange(event)">
                                <button type="button" onclick="document.getElementById('admin-user-avatar-input').click()" 
                                        class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-all w-full">
                                    <i class="fas fa-upload mr-2"></i>Tải ảnh lên
                                </button>
                                <p class="text-xs text-slate-500 mt-2">JPG, PNG, WebP (tối đa 2MB)</p>
                            </div>
                            
                            <div class="w-20 h-20 flex-shrink-0">
                                <div class="w-20 h-20 rounded-full border border-slate-600 overflow-hidden bg-slate-800 flex items-center justify-center">
                                    ${currentEditingItem.photoURL ? `
                                        <img id="admin-user-avatar-preview" src="${currentEditingItem.photoURL}" 
                                             alt="Avatar" class="w-full h-full object-cover"
                                             onerror="this.src='https://via.placeholder.com/80/1a1a2e/666?text=User'">
                                    ` : `
                                        <img id="admin-user-avatar-preview" src="https://via.placeholder.com/80/1a1a2e/666?text=User" 
                                             alt="Avatar" class="w-full h-full object-cover">
                                    `}
                                </div>
                            </div>
                        </div>
                        <input type="text" id="user-photoURL" class="field-input hidden" 
                               value="${currentEditingItem.photoURL || ''}">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="field-group">
                            <label class="field-label">Tên hiển thị *</label>
                            <input type="text" id="user-displayName" class="field-input" 
                                   placeholder="Nguyễn Văn A" 
                                   value="${currentEditingItem.displayName || ''}" required>
                        </div>

                        <div class="field-group">
                            <label class="field-label">Biệt danh</label>
                            <input type="text" id="user-nickname" class="field-input" 
                                   placeholder="ProRacer123" 
                                   value="${currentEditingItem.nickname || ''}">
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="field-group">
                            <label class="field-label">Vai trò *</label>
                            <select id="user-role" class="field-input" required>
                                <option value="viewer" ${currentEditingItem.role === 'viewer' ? 'selected' : ''}>Người xem</option>
                                <option value="racer" ${currentEditingItem.role === 'racer' ? 'selected' : ''}>Tay đua</option>
                                <option value="admin" ${currentEditingItem.role === 'admin' ? 'selected' : ''}>Quản trị viên</option>
                            </select>
                        </div>

                        <div class="field-group">
                            <label class="field-label">Trạng thái *</label>
                            <select id="user-status" class="field-input" required>
                                <option value="active" ${currentEditingItem.status === 'active' ? 'selected' : ''}>Hoạt động</option>
                                <option value="inactive" ${currentEditingItem.status === 'inactive' ? 'selected' : ''}>Không hoạt động</option>
                                <option value="banned" ${currentEditingItem.status === 'banned' ? 'selected' : ''}>Bị cấm</option>
                            </select>
                        </div>
                    </div>

                    <div class="field-group">
                        <label class="field-label flex items-center gap-2">
                            <input type="checkbox" id="user-isAdmin" 
                                   ${currentEditingItem.isAdmin ? 'checked' : ''}>
                            <span>Cấp quyền Admin</span>
                        </label>
                        <p class="text-xs text-orange-400 mt-1">
                            <i class="fas fa-exclamation-triangle mr-1"></i>
                            Cẩn thận khi cấp quyền admin cho người dùng!
                        </p>
                    </div>

                    <div class="bg-slate-800/30 rounded-lg p-4">
                        <h4 class="text-sm font-semibold text-slate-300 mb-2">
                            <i class="fas fa-info-circle mr-2"></i>Thông tin bổ sung
                        </h4>
                        <div class="grid grid-cols-2 gap-2 text-xs text-slate-400">
                            <div>
                                <span class="font-semibold">UID:</span> ${currentEditingItem.uid || currentEditingItem.id || 'N/A'}
                            </div>
                            <div>
                                <span class="font-semibold">Ngày tạo:</span> 
                                ${currentEditingItem.createdAt ? new Date(currentEditingItem.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                            </div>
                        </div>
                    </div>
                </div>

                <p class="text-sm text-slate-400 mt-4">* Trường bắt buộc</p>
            `;
};
// Generate banner form
const generateBannerForm = () => {
    return `
        <div class="space-y-6">
            <div class="field-group">
                <label class="field-label">Tiêu đề Banner</label>
                <input type="text" id="banner-title" class="field-input" 
                       placeholder="Ví dụ: Chào mừng đến với WeStar" 
                       value="${currentEditingItem?.title || ''}">
            </div>

            <div class="field-group">
                <label class="field-label">URL Hình Ảnh *</label>
                <div class="flex items-center space-x-3">
                    <div class="relative flex-1">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i class="fas fa-link text-slate-500"></i>
                        </div>
                        <input type="text" id="banner-imageUrl" class="field-input pl-10" 
                               placeholder="https://example.com/banner.jpg" 
                               value="${currentEditingItem?.imageUrl || ''}" required
                               onchange="document.getElementById('admin-banner-preview').src = this.value || 'https://via.placeholder.com/800x400/1a1a2e/00f3ff?text=Banner'">
                    </div>
                </div>
                <div class="mt-4 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 w-full aspect-video shadow-inner">
                    <img id="admin-banner-preview" 
                         src="${currentEditingItem?.imageUrl || 'https://via.placeholder.com/800x400/1a1a2e/00f3ff?text=Banner'}" 
                         alt="Banner preview" 
                         class="w-full h-full object-cover"
                         onerror="this.src='https://via.placeholder.com/800x400/1a1a2e/00f3ff?text=Error'">
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="field-group">
                    <label class="field-label">Kiểu hiển thị ảnh (Object Fit)</label>
                    <select id="banner-objectFit" class="field-input">
                        <option value="cover" ${currentEditingItem?.objectFit === 'cover' ? 'selected' : ''}>Bao phủ (Cover - mặc định)</option>
                        <option value="contain" ${currentEditingItem?.objectFit === 'contain' ? 'selected' : ''}>Thu nhỏ vừa vặn (Contain)</option>
                        <option value="fill" ${currentEditingItem?.objectFit === 'fill' ? 'selected' : ''}>Kéo giãn (Fill)</option>
                    </select>
                </div>

                <div class="field-group">
                    <label class="field-label">Căn chỉnh vị trí ảnh (Object Position)</label>
                    <select id="banner-objectPosition" class="field-input">
                        <option value="center" ${currentEditingItem?.objectPosition === 'center' ? 'selected' : ''}>Giữa (Center - mặc định)</option>
                        <option value="top" ${currentEditingItem?.objectPosition === 'top' ? 'selected' : ''}>Trên cùng (Top)</option>
                        <option value="bottom" ${currentEditingItem?.objectPosition === 'bottom' ? 'selected' : ''}>Dưới cùng (Bottom)</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="field-group">
                    <label class="field-label">Thứ tự hiển thị</label>
                    <input type="number" id="banner-order" class="field-input" 
                           placeholder="0" 
                           value="${currentEditingItem?.order !== undefined ? currentEditingItem.order : 0}">
                </div>
                
                <div class="field-group flex flex-col justify-center">
                    <label class="field-label">Trạng thái</label>
                    <label class="flex items-center cursor-pointer group mt-2">
                        <input type="checkbox" id="banner-active" class="sr-only" 
                               ${currentEditingItem?.active !== false ? 'checked' : ''}>
                        <div class="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-cyan-500 transition-colors">
                            <div class="w-5 h-5 bg-white rounded-full mt-0.5 ml-0.5 peer-checked:translate-x-5 transition-transform shadow-md"></div>
                        </div>
                        <span class="ml-3 text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Hoạt động</span>
                    </label>
                </div>
            </div>

            <p class="text-sm text-slate-400 mt-4">* Trường bắt buộc</p>
        </div>
    `;
};

// Edit item
window.editItem = async (collection, id) => {
    try {
        const docRef = doc(db, collection, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentEditingItem = { id: docSnap.id, ...docSnap.data() };
            currentCollection = collection;

            const titles = {
                'gameCars': 'Chỉnh sửa Xe',
                'gameMaps': 'Chỉnh sửa Bản đồ',
                'gamePets': 'Chỉnh sửa Pet',
                'raceRecords': 'Chỉnh sửa Kỷ lục',
                'users': 'Chỉnh sửa Người dùng',
                'banners': 'Chỉnh sửa Banner'
            };

            document.getElementById('modal-title').textContent = titles[collection] || 'Chỉnh sửa';

            const typeMap = {
                'gameCars': 'car',
                'gameMaps': 'map',
                'gamePets': 'pet',
                'raceRecords': 'record',
                'users': 'user',
                'banners': 'banner'
            };

            generateForm(typeMap[collection]);
            document.getElementById('modal').classList.remove('hidden');
        }
    } catch (error) {
        console.error("Lỗi trong editItem:", error);
        if (typeof Swal !== 'undefined') Swal.fire('Lỗi', 'Lỗi tải dữ liệu: ' + error.message, 'error');
        else alert('Lỗi tải dữ liệu: ' + error.message);
    }
};

// Delete item
window.deleteItem = async (collection, id, name) => {
    // Sử dụng SweetAlert2 thay vì confirm
    const result = await Swal.fire({
        title: 'Xác nhận xóa?',
        html: `Bạn có chắc muốn xóa <strong>"${name}"</strong>?<br><small class="text-slate-400">${collection === 'raceRecords' ? 'Bạn có thể hoàn tác trong vòng 5 giây' : ''}</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff0066',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fas fa-trash-alt mr-2"></i>Xóa',
        cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
        // Backup cho undo (chỉ với raceRecords)
        if (collection === 'raceRecords') {
            const record = allRecords.find(r => r.id === id);
            if (record) {
                deletedRecordsBackup = [{ ...record }];
            }
        }

        await deleteDoc(doc(db, collection, id));

        if (collection === 'raceRecords') {
            // Xóa khỏi local arrays
            allRecords = allRecords.filter(r => r.id !== id);
            filteredRecords = filteredRecords.filter(r => r.id !== id);
            filterRecordsNew();

            // Đồng bộ lại kỷ lục bản đồ
            if (typeof window.syncMapRecordsWithRecordsTab === 'function') {
                window.syncMapRecordsWithRecordsTab();
            }

            // Hiển thị undo toast
            showUndoToast(`Đã xóa kỷ lục "${name}"`);
        } else if (collection === 'users') {
            showMessage("Đã xóa thành công!");
            await loadUsersData(currentPage['users']);
        } else {
            showMessage("Đã xóa thành công!");
            loadCollectionData(collection, currentPage[collection]);
        }
    } catch (error) {
        console.error("Error deleting item:", error);
        showMessage("Lỗi khi xóa!", true);
    }
};

// Hàm xử lý kỷ lục trùng lặp
// - Xóa kỷ lục trùng: cùng map, racer, car, pet, thời gian
// - Xóa kỷ lục vượt quá 3 phút
const handleDuplicateRecords = async (newRecord) => {
    try {
        const recordsSnapshot = await getDocs(collection(db, "raceRecords"));
        const batch = writeBatch(db);
        let deletedCount = 0;

        recordsSnapshot.forEach((doc) => {
            const existingRecord = doc.data();

            // Kiểm tra 1: Xóa kỷ lục nếu trùng (cùng map, racer, car, pet, time)
            const isSameMap = existingRecord.mapName === newRecord.mapName;
            const isSameRacer = existingRecord.racerName === newRecord.racerName;
            const isSameCar = existingRecord.car === newRecord.car;
            const isSamePet = existingRecord.pet === newRecord.pet;
            const isSameTime = existingRecord.timeInSeconds === newRecord.timeInSeconds;

            if (isSameMap && isSameRacer && isSameCar && isSamePet && isSameTime) {
                // Xóa kỷ lục cũ vì trùng lặp
                batch.delete(doc.ref);
                deletedCount++;
                console.log(`🗑️ Xóa kỷ lục trùng lặp: ${existingRecord.mapName} - ${existingRecord.racerName}`);
            }

            // Kiểm tra 2: Xóa kỷ lục nếu thời gian > 3 phút (180 giây)
            else if (existingRecord.timeInSeconds > 180) {
                batch.delete(doc.ref);
                deletedCount++;
                console.log(`🗑️ Xóa kỷ lục vượt quá 3 phút: ${existingRecord.mapName} - ${existingRecord.racerName} (${existingRecord.timeInSeconds}s)`);
            }
        });

        // Xóa kỷ lục cũ nếu có record mới cùng map
        if (deletedCount > 0) {
            await batch.commit();
            console.log(`✅ Đã xóa ${deletedCount} kỷ lục trùng lặp hoặc không hợp lệ`);
        }
    } catch (error) {
        console.error("Error handling duplicate records:", error);
    }
};

// Biến lưu instance cropper cho admin avatar
let adminCropper = null;

// Hàm xử lý thay đổi ảnh avatar khi admin chỉnh sửa người dùng
window.handleAdminUserAvatarChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        showMessage('Kích thước file không được vượt quá 2MB', true);
        return;
    }

    if (!file.type.startsWith('image/')) {
        showMessage('Vui lòng chọn file ảnh', true);
        return;
    }

    try {
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;

            // Đặt ảnh vào modal crop
            const cropImage = document.getElementById('admin-crop-image');
            cropImage.src = base64;

            // Mở modal crop
            document.getElementById('admin-crop-image-modal').classList.remove('hidden');
            document.getElementById('admin-crop-image-modal').classList.add('flex');

            // Khởi tạo Cropper
            if (adminCropper) {
                adminCropper.destroy();
            }

            setTimeout(() => {
                adminCropper = new Cropper(cropImage, {
                    aspectRatio: 1,
                    viewMode: 1,
                    autoCropArea: 1,
                    responsive: true,
                    restore: true,
                    guides: true,
                    highlight: true,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: true,
                    background: true,
                    modal: true,
                });
            }, 100);
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Lỗi khi xử lý ảnh:', error);
        showMessage('Lỗi khi xử lý ảnh. Vui lòng thử lại.', true);
    }
};

// Save item
window.saveItem = async () => {
    try {
        if (!currentCollection) {
            showMessage("Lỗi: Không xác định được loại dữ liệu!", true);
            return;
        }

        let data = {};
        let idToUse = '';

        switch (currentCollection) {
            case 'gameCars':
                data = {
                    name: document.getElementById('car-name').value.trim(),
                    type: document.getElementById('car-type').value.trim(),
                    rarity: document.getElementById('car-rarity').value,
                    speed: parseInt(document.getElementById('car-speed').value),
                    acceleration: parseInt(document.getElementById('car-acceleration').value),
                    imageUrl: document.getElementById('car-imageUrl').value.trim()
                };
                idToUse = currentEditingItem ? currentEditingItem.id : generateUniqueId('car');
                break;

            case 'gameMaps':
                const mapNameVal = document.getElementById('map-name').value.trim();
                const bestRecSave = window.getBestRecordForMap ? window.getBestRecordForMap(mapNameVal) : null;

                data = {
                    name: mapNameVal,
                    difficulty: document.getElementById('map-difficulty').value,
                    laps: parseInt(document.getElementById('map-laps').value) || 2,
                    recordTime: bestRecSave ? bestRecSave.recordTime : document.getElementById('map-recordTime').value.trim(),
                    recordRacer: bestRecSave ? bestRecSave.recordRacer : document.getElementById('map-recordRacer').value.trim(),
                    recordCar: bestRecSave ? bestRecSave.recordCar : document.getElementById('map-recordCar').value.trim(),
                    recordPet: bestRecSave ? bestRecSave.recordPet : document.getElementById('map-recordPet').value.trim(),
                    recordRacerIndex: bestRecSave ? bestRecSave.recordRacerIndex : (currentEditingItem?.recordRacerIndex !== undefined ? currentEditingItem.recordRacerIndex : -1),
                    description: document.getElementById('map-description').value.trim(),
                    videoUrl: (document.getElementById('map-videoUrl')?.value || '').trim(),
                    imageUrl: document.getElementById('map-imageUrl').value.trim()
                };
                idToUse = currentEditingItem ? currentEditingItem.id : generateUniqueId('map');
                break;

            case 'gamePets':
                data = {
                    name: document.getElementById('pet-name').value.trim(),
                    type: document.getElementById('pet-type').value.trim(),
                    rarity: document.getElementById('pet-rarity').value,
                    skill: {
                        name: document.getElementById('pet-skillName').value.trim(),
                        description: document.getElementById('pet-skillDesc').value.trim()
                    },
                    imageUrl: document.getElementById('pet-imageUrl').value.trim()
                };
                idToUse = currentEditingItem ? currentEditingItem.id : generateUniqueId('pet');
                break;

            case 'raceRecords':
                const recordId = currentEditingItem ? currentEditingItem.id :
                    `${document.getElementById('record-mapName').value.trim().replace(/\s+/g, '_')}_${Date.now()}`;
                data = {
                    mapName: document.getElementById('record-mapName').value.trim(),
                    racerName: document.getElementById('record-racerName').value.trim(),
                    racerIndex: parseInt(document.getElementById('record-racerIndex').value) || 0,
                    timeInSeconds: parseFloat(document.getElementById('record-timeInSeconds').value),
                    timeString: document.getElementById('record-timeString').value.trim(),
                    car: document.getElementById('record-car').value.trim(),
                    pet: document.getElementById('record-pet').value.trim(),
                    timestamp: new Date().toISOString()
                };

                // Kiểm tra thời gian trên 3 phút (180 giây)
                if (data.timeInSeconds > 180) {
                    showMessage("❌ Kỷ lục không hợp lệ: Thời gian vượt quá 3 phút (180 giây)!", true);
                    return;
                }

                idToUse = recordId;
                break;

            case 'users':
                if (!currentEditingItem) {
                    showMessage("Không thể thêm người dùng mới qua trang này!", true);
                    closeModal();
                    return;
                }

                data = {
                    displayName: document.getElementById('user-displayName').value.trim(),
                    nickname: document.getElementById('user-nickname').value.trim(),
                    photoURL: document.getElementById('user-photoURL').value.trim(),
                    role: document.getElementById('user-role').value,
                    status: document.getElementById('user-status').value,
                    isAdmin: document.getElementById('user-isAdmin').checked,
                    lastUpdated: serverTimestamp()
                };

                // Giữ lại các trường quan trọng không được thay đổi
                if (currentEditingItem.email) data.email = currentEditingItem.email;
                if (currentEditingItem.uid) data.uid = currentEditingItem.uid;
                if (currentEditingItem.createdAt) data.createdAt = currentEditingItem.createdAt;

                idToUse = currentEditingItem.id;
                break;

            case 'banners':
                data = {
                    title: document.getElementById('banner-title').value.trim(),
                    imageUrl: document.getElementById('banner-imageUrl').value.trim(),
                    order: parseInt(document.getElementById('banner-order').value) || 0,
                    active: document.getElementById('banner-active').checked,
                    objectFit: document.getElementById('banner-objectFit').value,
                    objectPosition: document.getElementById('banner-objectPosition').value
                };
                idToUse = currentEditingItem ? currentEditingItem.id : generateUniqueId('banner');
                break;

            default:
                showMessage(`Loại dữ liệu không hợp lệ: ${currentCollection}`, true);
                return;
        }

        if (!validateFormData(currentCollection, data)) {
            showMessage("Vui lòng điền đầy đủ các trường bắt buộc!", true);
            return;
        }

        if (currentEditingItem) {
            await updateDoc(doc(db, currentCollection, currentEditingItem.id), data);
            showMessage("Đã cập nhật thành công!");

            // Log activity
            const itemName = data.name || data.displayName || data.mapName || data.title || 'Item';
            await logActivity('update', `Đã cập nhật ${getCollectionDisplayName(currentCollection)}: ${itemName}`, {
                collection: currentCollection,
                itemId: currentEditingItem.id
            });
        } else {
            // Kiểm tra nếu là record, xử lý trùng lặp
            if (currentCollection === 'raceRecords') {
                await handleDuplicateRecords(data);
            }

            await setDoc(doc(db, currentCollection, idToUse), data);
            showMessage("Đã thêm mới thành công!");

            // Log activity
            const itemName = data.name || data.displayName || data.mapName || data.title || 'Item';
            await logActivity('create', `Đã thêm mới ${getCollectionDisplayName(currentCollection)}: ${itemName}`, {
                collection: currentCollection,
                itemId: idToUse
            });
        }

        closeModal();
        switchTab(currentTab);

    } catch (error) {
        console.error("Error saving item:", error);
        showMessage("Lỗi khi lưu dữ liệu!", true);
    }
};

// Get collection display name
const getCollectionDisplayName = (collection) => {
    const names = {
        'gameCars': 'Xe',
        'gameMaps': 'Bản đồ',
        'gamePets': 'Pet',
        'raceRecords': 'Kỷ lục',
        'users': 'Người dùng',
        'banners': 'Banner'
    };
    return names[collection] || collection;
};

// Validate form data
const validateFormData = (collection, data) => {
    switch (collection) {
        case 'gameCars':
            return data.name && data.type && data.rarity && data.speed && data.acceleration;
        case 'gameMaps':
            return data.name && data.difficulty;
        case 'gamePets':
            return data.name && data.type && data.rarity;
        case 'raceRecords':
            return data.mapName && data.racerName && data.timeInSeconds && data.timeString;
        case 'users':
            return data.displayName && data.role && data.status;
        case 'banners':
            return !!data.imageUrl;
        default:
            return true;
    }
};

// Close modal
window.closeModal = () => {
    document.getElementById('modal').classList.add('hidden');
    currentEditingItem = null;
    currentCollection = '';
};

// Show message
const showMessage = (message, isError = false) => {
    const container = document.getElementById('status-message');
    const className = isError
        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-2xl p-4 rounded-xl'
        : 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-2xl p-4 rounded-xl';

    container.innerHTML = `<div class="flex items-center justify-center">
                <i class="fas ${isError ? 'fa-exclamation-triangle' : 'fa-check-circle'} mr-3"></i>
                <span>${message}</span>
            </div>`;
    container.className = `fixed top-6 right-6 transition-all duration-300 transform opacity-100 translate-y-0 ${className}`;
    container.style.zIndex = '9999';

    setTimeout(() => {
        container.classList.add('opacity-0', 'translate-y-[-20px]');
        container.classList.remove('opacity-100', 'translate-y-0');
    }, 4000);
};

// Logout
window.logout = async () => {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Logout error:", error);
        showMessage("Lỗi khi đăng xuất!", true);
    }
};

// Reset all records to 00'00'00
window.handleResetAllRecords = async () => {
    if (!confirm("⚠️ CẢNH BÁO: Bạn có chắc chắn muốn thiết lập lại record của TÂT CẢ các map về 00'00'00 không?\n\nHành động này sẽ xóa tất cả kỷ lục hiện có và không thể hoàn tác!")) {
        return;
    }

    try {
        showMessage("⏳ Đang thiết lập lại record của tất cả các map...", false);

        const mapsSnapshot = await getDocs(collection(db, "gameMaps"));
        let updatedCount = 0;
        const batch = writeBatch(db);

        mapsSnapshot.forEach((docSnap) => {
            const mapRef = doc(db, "gameMaps", docSnap.id);
            batch.update(mapRef, {
                recordTime: "00'00'00",
                recordRacer: "",
                recordCar: "",
                recordPet: "",
                recordRacerIndex: -1,
                lastUpdated: serverTimestamp()
            });
            updatedCount++;
        });

        await batch.commit();

        showMessage(`✅ Đã làm mới record của ${updatedCount} map về 00'00'00`);

        // Refresh lại dữ liệu
        if (currentTab === 'maps') {
            await loadCollectionData('gameMaps', currentPage['gameMaps']);
        }

        // Log activity
        await logActivity('update', `Đã reset tất cả records về 00'00'00`, {
            mapsAffected: updatedCount
        });

    } catch (error) {
        console.error("Lỗi khi làm mới record:", error);
        showMessage("❌ Có lỗi xảy ra khi làm mới record. Vui lòng thử lại!", true);
    }
};

// Migrate map difficulties to star format
window.handleMigrateMapDifficulties = async () => {
    if (!confirm("⚠️ Bạn có chắc chắn muốn chuyển đổi độ khó của tất cả các bản đồ sang số sao không?\n\nVí dụ:\n- Dễ -> 3 sao\n- Trung bình -> 4 sao\n- Khó -> 5 sao\n- Rất khó -> 6 sao\n- Cực khó -> 7 sao")) {
        return;
    }

    try {
        showMessage("⏳ Đang chuyển đổi độ khó các bản đồ...", false);

        const mapsSnapshot = await getDocs(collection(db, "gameMaps"));
        let updatedCount = 0;
        const batch = writeBatch(db);

        const difficultyMigrationMap = {
            'Dễ': '3 sao',
            'Dễ (3 sao)': '3 sao',
            'Trung bình': '4 sao',
            'Trung bình (4 sao)': '4 sao',
            'Khó': '5 sao',
            'Khó (5 sao)': '5 sao',
            'Rất khó': '6 sao',
            'Rất khó (6 sao)': '6 sao',
            'Cực khó': '7 sao',
            'Cực khó (7 sao)': '7 sao'
        };

        mapsSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const currentDiff = data.difficulty;
            if (difficultyMigrationMap[currentDiff]) {
                const mapRef = doc(db, "gameMaps", docSnap.id);
                batch.update(mapRef, {
                    difficulty: difficultyMigrationMap[currentDiff],
                    lastUpdated: serverTimestamp()
                });
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
            showMessage(`✅ Đã chuyển đổi độ khó của ${updatedCount} bản đồ sang số sao thành công!`);
        } else {
            showMessage(`ℹ️ Không tìm thấy bản đồ nào cần chuyển đổi (hoặc đã được chuyển đổi hết).`);
        }

        // Refresh data
        if (currentTab === 'maps') {
            await loadCollectionData('gameMaps', currentPage['gameMaps']);
        }

        // Log activity
        await logActivity('update', `Đã chuyển đổi độ khó của ${updatedCount} bản đồ sang số sao`, {
            mapsAffected: updatedCount
        });

    } catch (error) {
        console.error("Lỗi khi chuyển đổi độ khó:", error);
        showMessage("❌ Lỗi khi chuyển đổi độ khó: " + error.message, true);
    }
};

// ===== CROP MODAL FUNCTIONS FOR ADMIN AVATAR =====

// Hàm đóng modal crop avatar admin
window.closeAdminCropModal = () => {
    document.getElementById('admin-crop-image-modal').classList.add('hidden');
    document.getElementById('admin-crop-image-modal').classList.remove('flex');

    if (adminCropper) {
        adminCropper.destroy();
        adminCropper = null;
    }

    // Reset input file
    document.getElementById('admin-user-avatar-input').value = '';
};

// Hàm áp dụng crop cho avatar admin
window.applyAdminCrop = () => {
    if (!adminCropper) {
        showMessage('Lỗi: Không thể cắt ảnh. Vui lòng thử lại.', true);
        return;
    }

    try {
        // Lấy canvas từ cropper
        const canvas = adminCropper.getCroppedCanvas({
            maxWidth: 4096,
            maxHeight: 4096,
            fillColor: '#fff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high',
        });

        // Chuyển sang Base64
        const base64 = canvas.toDataURL('image/jpeg', 0.8);

        // Cập nhật preview
        const preview = document.getElementById('admin-user-avatar-preview');
        preview.src = base64;

        // Lưu Base64 vào input hidden
        document.getElementById('user-photoURL').value = base64;

        // Đóng modal
        closeAdminCropModal();

        showMessage('✅ Ảnh được cắt và tải lên thành công!');
    } catch (error) {
        console.error('Lỗi khi cắt ảnh:', error);
        showMessage('Lỗi khi cắt ảnh. Vui lòng thử lại.', true);
    }
};

// Hàm quay ảnh trong crop modal
window.rotateCropImageAdmin = () => {
    if (adminCropper) {
        adminCropper.rotate(45);
    }
};

// Hàm lật ảnh theo chiều ngang trong crop modal
window.flipCropImageHAdmin = () => {
    if (adminCropper) {
        const imageData = adminCropper.getImageData();
        adminCropper.setImageData({
            ...imageData,
            scaleX: (imageData.scaleX || 1) * -1,
        });
    }
};

// Hàm lật ảnh theo chiều dọc trong crop modal
window.flipCropImageVAdmin = () => {
    if (adminCropper) {
        const imageData = adminCropper.getImageData();
        adminCropper.setImageData({
            ...imageData,
            scaleY: (imageData.scaleY || 1) * -1,
        });
    }
};

// Hàm đặt tỷ lệ khung hình trong crop modal
window.setCropAspectRatioAdmin = (ratio) => {
    if (adminCropper) {
        adminCropper.setAspectRatio(ratio);
    }
};

// Initialize the app
initFirebase();

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const userAvatar = document.getElementById('user-avatar');
    if (userAvatar) {
        userAvatar.addEventListener('click', () => {
            const userMenu = document.getElementById('user-menu');
            if (userMenu) {
                userMenu.classList.toggle('hidden');
            }
        });
    }

    document.addEventListener('click', (e) => {
        const userAvatar = document.getElementById('user-avatar');
        const userMenu = document.getElementById('user-menu');

        if (userAvatar && userMenu) {
            if (!e.target.closest('#user-avatar') && !e.target.closest('#user-menu')) {
                userMenu.classList.add('hidden');
            }
        }
    });
});

// ========== SKELETON LOADING FUNCTIONS ==========

// Hiển thị skeleton loading cho table
const showSkeletonTable = (tableBodyId, rows = 5, cols = 6) => {
    const tableBody = document.getElementById(tableBodyId);
    if (!tableBody) return;

    let skeletonHTML = '';
    for (let i = 0; i < rows; i++) {
        skeletonHTML += '<tr>';
        for (let j = 0; j < cols; j++) {
            const width = j === 0 ? '40px' : (j === cols - 1 ? '100px' : 'auto');
            skeletonHTML += `
                <td>
                    <div class="skeleton skeleton-text" style="width: ${width === 'auto' ? Math.random() * 40 + 60 + '%' : width}; height: 20px;"></div>
                </td>
            `;
        }
        skeletonHTML += '</tr>';
    }
    tableBody.innerHTML = skeletonHTML;
};

// Hiển thị skeleton loading cho cards
const showSkeletonCards = (containerId, count = 4) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    let skeletonHTML = '';
    for (let i = 0; i < count; i++) {
        skeletonHTML += `
            <div class="skeleton skeleton-card"></div>
        `;
    }
    container.innerHTML = skeletonHTML;
};

// ========== BULK DELETE FUNCTIONS ==========

// Toggle chọn một record
window.toggleRecordSelection = (recordId) => {
    if (selectedRecords.has(recordId)) {
        selectedRecords.delete(recordId);
    } else {
        selectedRecords.add(recordId);
    }
    updateBulkActionsUI();
};

// Toggle chọn tất cả records
window.toggleSelectAllRecords = (checkbox) => {
    const checkboxes = document.querySelectorAll('.record-checkbox');

    if (checkbox.checked) {
        // Chọn tất cả records đang hiển thị
        checkboxes.forEach(cb => {
            selectedRecords.add(cb.dataset.id);
            cb.checked = true;
        });
    } else {
        // Bỏ chọn tất cả
        checkboxes.forEach(cb => {
            selectedRecords.delete(cb.dataset.id);
            cb.checked = false;
        });
    }
    updateBulkActionsUI();
};

// Cập nhật UI bulk actions
const updateBulkActionsUI = () => {
    const bulkActions = document.getElementById('bulk-actions');
    const bulkCount = document.getElementById('bulk-count');
    const selectAllCheckbox = document.getElementById('select-all-records');

    if (selectedRecords.size > 0) {
        bulkActions.classList.add('show');
        bulkCount.textContent = selectedRecords.size;
    } else {
        bulkActions.classList.remove('show');
    }

    // Update "select all" checkbox state
    const checkboxes = document.querySelectorAll('.record-checkbox');
    if (selectAllCheckbox && checkboxes.length > 0) {
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        const someChecked = Array.from(checkboxes).some(cb => cb.checked);
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;
    }
};

// Hủy bulk select
window.cancelBulkSelect = () => {
    selectedRecords.clear();
    document.querySelectorAll('.record-checkbox').forEach(cb => cb.checked = false);
    const selectAllCheckbox = document.getElementById('select-all-records');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    updateBulkActionsUI();
};

// Bulk delete records
window.bulkDeleteRecords = async () => {
    if (selectedRecords.size === 0) {
        showMessage('Vui lòng chọn ít nhất một kỷ lục để xóa', true);
        return;
    }

    const count = selectedRecords.size;

    // Confirm với SweetAlert2
    const result = await Swal.fire({
        title: 'Xác nhận xóa?',
        html: `Bạn có chắc muốn xóa <strong>${count}</strong> kỷ lục đã chọn?<br><small class="text-slate-400">Bạn có thể hoàn tác trong vòng 5 giây</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff0066',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fas fa-trash-alt mr-2"></i>Xóa tất cả',
        cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
        // Backup dữ liệu để có thể undo
        deletedRecordsBackup = [];
        for (const recordId of selectedRecords) {
            const record = allRecords.find(r => r.id === recordId);
            if (record) {
                deletedRecordsBackup.push({ ...record });
            }
        }

        // Xóa từ Firestore
        const batch = writeBatch(db);
        for (const recordId of selectedRecords) {
            const docRef = doc(db, 'raceRecords', recordId);
            batch.delete(docRef);
        }
        await batch.commit();

        // Xóa khỏi local arrays
        allRecords = allRecords.filter(r => !selectedRecords.has(r.id));
        filteredRecords = filteredRecords.filter(r => !selectedRecords.has(r.id));

        // Clear selection
        selectedRecords.clear();
        updateBulkActionsUI();

        // Refresh table
        filterRecordsNew();

        // Hiển thị undo toast
        showUndoToast(`Đã xóa ${count} kỷ lục`);

    } catch (error) {
        console.error('Lỗi khi xóa records:', error);
        showMessage('Lỗi khi xóa kỷ lục. Vui lòng thử lại!', true);
    }
};

// ========== UNDO DELETE FUNCTIONS ==========

// Hiển thị undo toast
const showUndoToast = (message) => {
    const toast = document.getElementById('undo-toast');
    const toastText = document.getElementById('undo-toast-text');
    const timerBar = document.getElementById('undo-timer-bar');

    if (!toast || !toastText) return;

    toastText.textContent = message;

    // Reset animation
    if (timerBar) {
        timerBar.style.animation = 'none';
        timerBar.offsetHeight; // Trigger reflow
        timerBar.style.animation = 'timer-countdown 5s linear forwards';
    }

    // Show toast
    toast.classList.add('show');

    // Clear previous timeout
    if (undoTimeoutId) {
        clearTimeout(undoTimeoutId);
    }

    // Hide toast after 5 seconds
    undoTimeoutId = setTimeout(() => {
        hideUndoToast();
        deletedRecordsBackup = []; // Clear backup after timeout
    }, 5000);
};

// Ẩn undo toast
const hideUndoToast = () => {
    const toast = document.getElementById('undo-toast');
    if (toast) {
        toast.classList.remove('show');
    }
};

// Hoàn tác xóa
window.undoDelete = async () => {
    if (deletedRecordsBackup.length === 0) {
        showMessage('Không có dữ liệu để hoàn tác', true);
        return;
    }

    // Clear timeout
    if (undoTimeoutId) {
        clearTimeout(undoTimeoutId);
        undoTimeoutId = null;
    }

    try {
        // Khôi phục dữ liệu vào Firestore
        const batch = writeBatch(db);
        for (const record of deletedRecordsBackup) {
            const docRef = doc(db, 'raceRecords', record.id);
            const { id, ...recordData } = record; // Remove id from data
            batch.set(docRef, recordData);
        }
        await batch.commit();

        // Khôi phục vào local arrays
        allRecords.push(...deletedRecordsBackup);

        const count = deletedRecordsBackup.length;
        deletedRecordsBackup = [];

        // Hide toast
        hideUndoToast();

        // Refresh table
        filterRecordsNew();

        showMessage(`✅ Đã hoàn tác ${count} kỷ lục!`);

    } catch (error) {
        console.error('Lỗi khi hoàn tác:', error);
        showMessage('Lỗi khi hoàn tác. Vui lòng thử lại!', true);
    }
};