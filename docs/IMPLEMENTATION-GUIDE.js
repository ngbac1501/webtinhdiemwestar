/**
 * IMPLEMENTATION GUIDE - Hướng dẫn triển khai các module mới
 * 
 * Tệp này hướng dẫn cách tích hợp tất cả module mới vào dự án hiện tại
 */

// ============================================================================
// 1. UPDATE index.html - Thêm scripts
// ============================================================================

/*
Thêm vào cuối thẻ <body>, TRƯỚC đóng tag </body>:

<script src="theme-manager.js"></script>
<script src="data-export-import.js"></script>
<script src="notification-system.js"></script>
<script src="search-filters.js"></script>
<script src="user-profile.js"></script>
<script src="performance-optimizer.js"></script>
<script type="module" src="index.js"></script>
*/

// ============================================================================
// 2. INTEGRATE vào index.js - Thêm kịp thời các event listeners
// ============================================================================

// THÊM vào đầu index.js (sau Firebase imports):
/*
// Import tất cả modules nếu chưa được import
// Các modules này sẽ tự khởi tạo khi được load

// Listen for theme changes
window.addEventListener('themeChanged', (e) => {
    console.log('Theme changed to:', e.detail.theme);
    // Có thể trigger re-render UI ở đây nếu cần
});

// Listen for global search
window.addEventListener('globalSearch', (e) => {
    console.log('Global search:', e.detail.query);
    // Implement search logic
});

// Listen for notifications from real-time updates
if (window.onSnapshot) {
    // Khi có update từ Firestore, trigger notification
    onSnapshot(collection(db, 'raceRecords'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                notificationSystem.addNotification({
                    type: 'success',
                    title: '🏆 Record mới!',
                    message: `${data.racerName} đạt record: ${data.mapName}`,
                    duration: 8000
                });
                
                // Record event
                performanceOptimizer.recordEvent('new_record', data);
            }
        });
    });
}
*/

// ============================================================================
// 3. THÊM Theme Toggle Button - vào HTML header
// ============================================================================

/*
<button data-theme-toggle style="
    background: linear-gradient(135deg, rgba(0, 243, 255, 0.1), rgba(0, 102, 255, 0.1));
    border: 1px solid rgba(0, 243, 255, 0.2);
    color: var(--neon-cyan);
    padding: 10px 16px;
    border-radius: 20px;
    cursor: pointer;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
">
    <i class="fas fa-moon"></i>
    <span id="theme-label">Dark</span>
</button>

<script>
    // Update label on theme change
    window.addEventListener('themeChanged', (e) => {
        const label = document.getElementById('theme-label');
        if (label) {
            label.textContent = e.detail.theme === 'dark' ? 'Light' : 'Dark';
        }
    });
</script>
*/

// ============================================================================
// 4. THÊM User Profile Widget - vào header/navbar
// ============================================================================

/*
<div id="user-profile-widget" style="cursor: pointer; padding: 10px; border-radius: 8px; transition: all 0.2s ease;" 
     onmouseover="this.style.background='rgba(0,243,255,0.05)'" 
     onmouseout="this.style.background='transparent'">
    <!-- Will be populated by user-profile.js -->
</div>

<script>
    // Populate profile widget when user is loaded
    document.addEventListener('userLoaded', (e) => {
        const widget = document.getElementById('user-profile-widget');
        if (widget && userProfileManager) {
            widget.innerHTML = userProfileManager.getProfileWidget();
        }
    });
</script>
*/

// ============================================================================
// 5. THÊM EXPORT/IMPORT BUTTONS - vào admin panel (configdata.html)
// ============================================================================

/*
<!-- Thêm vào toolbar hoặc menu -->
<div style="display: flex; gap: 10px;">
    <button onclick="handleExportJSON()" class="speed-button">
        <i class="fas fa-download"></i> Export JSON
    </button>
    <button onclick="handleExportCSV()" class="speed-button">
        <i class="fas fa-table"></i> Export CSV
    </button>
    <button onclick="handleImportData()" class="speed-button">
        <i class="fas fa-upload"></i> Import Data
    </button>
    <button onclick="handleExportFullBackup()" class="speed-button">
        <i class="fas fa-save"></i> Full Backup
    </button>
</div>

<!-- Hidden input for file upload -->
<input type="file" id="import-file" style="display: none;" accept=".json,.csv">

<script>
// JavaScript functions
async function handleExportJSON() {
    try {
        const data = [];
        // Collect data từ Firestore
        const snapshot = await getDocs(collection(db, 'gameCars'));
        snapshot.forEach(doc => {
            data.push({ id: doc.id, ...doc.data() });
        });
        
        await dataExportImport.exportToJSON(data, 'cars-backup');
        
        notificationSystem.addNotification({
            type: 'success',
            title: 'Export thành công',
            message: `Đã xuất ${data.length} xe`
        });
    } catch (error) {
        notificationSystem.addNotification({
            type: 'error',
            title: 'Export thất bại',
            message: error.message
        });
    }
}

async function handleExportCSV() {
    try {
        const data = [];
        const snapshot = await getDocs(collection(db, 'gameCars'));
        snapshot.forEach(doc => {
            data.push({ id: doc.id, ...doc.data() });
        });
        
        await dataExportImport.exportToCSV(data, 'cars-backup');
        
        notificationSystem.addNotification({
            type: 'success',
            title: 'Export CSV thành công',
            message: `Đã xuất ${data.length} xe`
        });
    } catch (error) {
        notificationSystem.addNotification({
            type: 'error',
            title: 'Export thất bại',
            message: error.message
        });
    }
}

async function handleImportData() {
    const input = document.getElementById('import-file');
    input.onclick = () => {
        input.onchange = async (e) => {
            try {
                const file = e.target.files[0];
                let result;
                
                if (file.name.endsWith('.json')) {
                    result = await dataExportImport.importFromJSON(file);
                } else if (file.name.endsWith('.csv')) {
                    result = await dataExportImport.importFromCSV(file);
                }
                
                if (result.success) {
                    notificationSystem.addNotification({
                        type: 'success',
                        title: 'Import thành công',
                        message: `Đã import ${result.count} items`
                    });
                }
            } catch (error) {
                notificationSystem.addNotification({
                    type: 'error',
                    title: 'Import thất bại',
                    message: error.message
                });
            }
        };
    };
    input.click();
}

async function handleExportFullBackup() {
    try {
        await dataExportImport.exportFullDatabase(db, [
            'gameCars',
            'gameMaps',
            'gamePets',
            'users',
            'raceRecords'
        ]);
        
        notificationSystem.addNotification({
            type: 'success',
            title: 'Backup thành công',
            message: 'Toàn bộ database đã được backup'
        });
    } catch (error) {
        notificationSystem.addNotification({
            type: 'error',
            title: 'Backup thất bại',
            message: error.message
        });
    }
}
</script>
*/

// ============================================================================
// 6. CACHE DATA TRONG FIRESTORE LISTENERS
// ============================================================================

/*
// Trong index.js, khi load data từ Firestore:

const fetchGameDataFromFirestore = async () => {
    try {
        // Thử lấy từ cache trước
        let ALL_MAPS = await performanceOptimizer.getCachedData('all-maps');
        
        if (!ALL_MAPS) {
            // Nếu không có cache, fetch từ Firestore
            const mapsSnapshot = await getDocs(collection(db, "gameMaps"));
            ALL_MAPS = mapsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Cache lại
            await performanceOptimizer.cacheData('all-maps', ALL_MAPS, 30*60*1000);
        }
        
        // Record event
        await performanceOptimizer.recordEvent('fetch_maps', { count: ALL_MAPS.length });
        
        return ALL_MAPS;
    } catch (error) {
        notificationSystem.addNotification({
            type: 'error',
            title: 'Lỗi tải dữ liệu',
            message: error.message
        });
    }
};
*/

// ============================================================================
// 7. SETUP LAZY LOADING CHO IMAGES
// ============================================================================

/*
// Trong index.html, đặt data-src thay vì src:
<img data-src="path/to/image.jpg" alt="Map" />

// Trong index.js, gọi:
document.addEventListener('DOMContentLoaded', () => {
    performanceOptimizer.setupLazyLoading();
});
*/

// ============================================================================
// 8. TRACK USER ANALYTICS
// ============================================================================

/*
// Track when user performs actions
const trackUserAction = async (action, details = {}) => {
    await performanceOptimizer.recordEvent('user_action', {
        action,
        ...details,
        timestamp: new Date().toISOString()
    });
};

// Examples:
trackUserAction('viewed_map', { mapName: 'Desert Race' });
trackUserAction('joined_race', { racerCount: 4 });
trackUserAction('completed_race', { placement: 1, time: "01'23'45" });

// View analytics
const analytics = await performanceOptimizer.getAnalyticsSummary(24); // 24 hours
console.log(analytics);
*/

// ============================================================================
// 9. HANDLE FIRESTORE REAL-TIME UPDATES WITH NOTIFICATIONS
// ============================================================================

/*
// Trong index.js hoặc configdata.js:

// Listen for new records
const setupRecordListener = () => {
    if (!onSnapshot) return;
    
    onSnapshot(collection(db, 'raceRecords'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const record = change.doc.data();
                
                // Show notification
                notificationSystem.addNotification({
                    type: 'success',
                    title: '🏆 Record mới',
                    message: `${record.racerName} đạt record: ${record.time}`,
                    duration: 8000
                });
                
                // Update cache
                performanceOptimizer.recordEvent('new_record', record);
                
                // Trigger page update
                window.dispatchEvent(new CustomEvent('recordAdded', { detail: record }));
            }
        });
    });
};

// Listen for new users
const setupUserListener = () => {
    if (!onSnapshot) return;
    
    onSnapshot(collection(db, 'users'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const user = change.doc.data();
                
                notificationSystem.addNotification({
                    type: 'info',
                    title: '👤 Người dùng mới',
                    message: `${user.displayName} đã tham gia`
                });
            }
        });
    });
};

setupRecordListener();
setupUserListener();
*/

// ============================================================================
// 10. CONFIGURATION & CUSTOMIZATION
// ============================================================================

/*
// Customize notification duration (in ms)
notificationSystem.notificationDuration = 8000;

// Customize cache expiry
performanceOptimizer.cacheExpiry = 60 * 60 * 1000; // 1 hour

// Customize theme colors
themeManager.lightColors['--neon-cyan'] = '#0088cc';
themeManager.darkColors['--neon-cyan'] = '#00f3ff';

// Customize search filters
searchFiltersManager.filters = {
    difficulty: ['Easy', 'Medium', 'Hard', 'Insane'],
    rarity: ['Common', 'Uncommon', 'Rare', 'Epic']
};
*/

// ============================================================================
// 11. DEBUGGING & MONITORING
// ============================================================================

/*
// Check cache status
const cacheStats = await performanceOptimizer.getCacheStats();
console.log('Cache Stats:', cacheStats);

// Check analytics
const analytics = await performanceOptimizer.getAnalyticsSummary(24);
console.log('Analytics:', analytics);

// Check performance metrics
const metrics = performanceOptimizer.getPerformanceMetrics();
console.log('Performance Metrics:', metrics);

// Clear cache if needed
await performanceOptimizer.clearAllCache();

// Get all notifications
console.log('Notifications:', notificationSystem.notifications);

// Get search history
console.log('Search History:', searchFiltersManager.searchHistory);
*/

// ============================================================================
// 12. TESTING
// ============================================================================

/*
// Test theme toggle
function testTheme() {
    console.log('Testing theme toggle...');
    themeManager.toggleTheme();
    console.log('Current theme:', themeManager.getCurrentTheme());
}

// Test notifications
function testNotifications() {
    notificationSystem.addNotification({
        type: 'success',
        title: 'Test Success',
        message: 'This is a success notification'
    });
    
    notificationSystem.addNotification({
        type: 'error',
        title: 'Test Error',
        message: 'This is an error notification'
    });
    
    notificationSystem.addNotification({
        type: 'warning',
        title: 'Test Warning',
        message: 'This is a warning notification'
    });
}

// Test export
async function testExport() {
    const testData = [
        { id: 1, name: 'Test Car', rarity: 'Rare' },
        { id: 2, name: 'Test Car 2', rarity: 'Epic' }
    ];
    
    await dataExportImport.exportToJSON(testData, 'test-data');
}

// Test caching
async function testCache() {
    const testData = { test: 'data' };
    await performanceOptimizer.cacheData('test-key', testData);
    const cached = await performanceOptimizer.getCachedData('test-key');
    console.log('Cached data:', cached);
}

// Run all tests
function runAllTests() {
    console.log('=== Running Tests ===');
    testTheme();
    testNotifications();
    testExport();
    testCache();
    console.log('=== Tests Complete ===');
}

// Call in console: runAllTests()
*/

// ============================================================================
// NOTES
// ============================================================================

/*
✅ Checklist triển khai:
□ Copy 6 file mới vào thư mục dự án
□ Thêm script tags vào index.html
□ Import vào configdata.html cũng
□ Thêm theme toggle button vào header
□ Thêm export/import buttons vào admin panel
□ Setup Firestore listeners cho notifications
□ Test tất cả tính năng
□ Clear browser cache/localStorage nếu gặp vấn đề
□ Xem console.log để debug

⚠️ Lưu ý:
- Tất cả modules đều là singleton (chỉ khởi tạo một lần)
- LocalStorage được dùng để lưu preferences
- IndexedDB được dùng để lưu cache
- Tất cả are non-blocking, async/await
- Compatible với tất cả modern browsers

📱 Mobile compatibility:
- Responsive design
- Touch-friendly buttons
- Swipe support sẽ được thêm trong update tiếp theo

🔒 Security:
- Tất cả data được validate trước khi lưu
- Firebase security rules vẫn được apply
- No sensitive data in localStorage/IndexedDB
*/
