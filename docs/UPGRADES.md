# 🚀 WeStar Admin - Hệ Thống Tính Điểm Thành Tích v2.0

## 📋 Mục Lục
- [Nâng cấp mới](#-nâng-cấp-mới)
- [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [API Reference](#-api-reference)

---

## ✨ Nâng cấp mới

### 1. 🎨 Dark/Light Mode Toggle
**File:** `theme-manager.js`

Cho phép người dùng chuyển đổi giữa chế độ tối/sáng với:
- ✅ Tự động theo chế độ hệ thống
- ✅ Lưu trữ tùy chọn trong localStorage
- ✅ Cập nhật CSS variables động
- ✅ Hỗ trợ tất cả các trang

```javascript
// Sử dụng
themeManager.setTheme('dark');      // Chế độ tối
themeManager.toggleTheme();         // Chuyển đổi
themeManager.setAutoTheme();        // Tự động
```

**Thêm vào HTML:**
```html
<button data-theme-toggle>
    <i class="fas fa-moon"></i> Toggle Theme
</button>
```

---

### 2. 💾 Export/Import Data
**File:** `data-export-import.js`

Quản lý xuất/nhập dữ liệu:
- ✅ Export sang JSON, CSV, HTML Report
- ✅ Import từ JSON, CSV
- ✅ Backup toàn bộ database
- ✅ Import vào Firestore với validation

```javascript
// Export JSON
await dataExportImport.exportToJSON(data, 'backup-name');

// Export CSV
await dataExportImport.exportToCSV(data, 'backup-name');

// Import JSON
const result = await dataExportImport.importFromJSON(file);

// Import CSV
const result = await dataExportImport.importFromCSV(file);

// Full database backup
await dataExportImport.exportFullDatabase(db, ['gameMaps', 'gameCars', 'gamePets']);

// Import to Firestore
await dataExportImport.importToFirestore(db, 'gameCars', data);
```

---

### 3. 🔔 Real-time Notifications
**File:** `notification-system.js`

Hệ thống thông báo toàn cục:
- ✅ Toast notifications
- ✅ Bell icon với badge
- ✅ Notification panel
- ✅ Persistent & auto-dismiss
- ✅ Lưu lịch sử

```javascript
// Thêm notification
notificationSystem.addNotification({
    type: 'success',        // success, error, warning, info
    title: 'Thành công',
    message: 'Dữ liệu đã lưu',
    duration: 5000,
    icon: 'fas fa-check',
    persistent: false
});

// Event listeners
notificationSystem.on('newRecord', (data) => {
    notificationSystem.addNotification({
        type: 'info',
        title: 'Record mới',
        message: `${data.racer} đạt record mới: ${data.time}`
    });
});

// Clear all
notificationSystem.clearAll();
```

---

### 4. 🔍 Advanced Search & Filters
**File:** `search-filters.js`

Tìm kiếm nâng cao toàn cục:
- ✅ Autocomplete suggestions
- ✅ Lịch sử tìm kiếm
- ✅ Advanced filters
- ✅ Type-ahead search

```javascript
// Perform search
const results = searchFiltersManager.performSearch('query');

// Add to history
searchFiltersManager.addToSearchHistory('query');

// Clear history
searchFiltersManager.clearSearchHistory();

// Listen for global search
window.addEventListener('globalSearch', (e) => {
    console.log('Search query:', e.detail.query);
});
```

---

### 5. 👤 User Profile & Achievements
**File:** `user-profile.js`

Hệ thống profil người dùng:
- ✅ Profile page với stats
- ✅ Achievement badges
- ✅ Favorite cars/pets
- ✅ Recent races history
- ✅ Level system

```javascript
// Load profile page
await userProfileManager.createProfilePage();

// Get profile widget
const widget = userProfileManager.getProfileWidget();

// Get profile summary
const stats = userProfileManager.userStats;

// Update profile picture
await userProfileManager.updateProfilePicture(file);
```

**Profile Stats:**
- Total races
- Top position
- Best time
- Win rate
- Total points
- Current streak

---

### 6. ⚡ Performance Optimization
**File:** `performance-optimizer.js`

Tối ưu hóa hiệu suất:
- ✅ IndexedDB caching (30 min expiry)
- ✅ Lazy loading images
- ✅ Infinite scroll support
- ✅ Request batching & deduplication
- ✅ Throttle & debounce utilities
- ✅ Analytics event tracking
- ✅ Performance metrics

```javascript
// Cache data
await performanceOptimizer.cacheData('key', data, 30*60*1000);

// Get cached data
const data = await performanceOptimizer.getCachedData('key');

// Batch requests
const result = await performanceOptimizer.batchRequest('key', fetchFn);

// Lazy load images
performanceOptimizer.setupLazyLoading();

// Infinite scroll
performanceOptimizer.setupInfiniteScroll(container, loadMoreFn);

// Throttle/Debounce
const throttled = performanceOptimizer.throttle(fn, 100);
const debounced = performanceOptimizer.debounce(fn, 300);

// Record event
await performanceOptimizer.recordEvent('user_action', { data: 'value' });

// Get analytics
const summary = await performanceOptimizer.getAnalyticsSummary(24);

// Performance metrics
const metrics = performanceOptimizer.getPerformanceMetrics();

// Clear cache
await performanceOptimizer.clearAllCache();

// Get cache stats
const stats = await performanceOptimizer.getCacheStats();
```

---

## 🚀 Hướng dẫn sử dụng

### Bước 1: Import các module vào HTML

```html
<!-- Theme Manager -->
<script src="theme-manager.js"></script>

<!-- Data Export/Import -->
<script src="data-export-import.js"></script>

<!-- Notifications -->
<script src="notification-system.js"></script>

<!-- Search & Filters -->
<script src="search-filters.js"></script>

<!-- User Profile -->
<script src="user-profile.js"></script>

<!-- Performance -->
<script src="performance-optimizer.js"></script>
```

### Bước 2: Sử dụng trong file index.js/configdata.js

```javascript
// Example: Listen for new records
notificationSystem.on('newRecord', async (data) => {
    // Cache the data
    await performanceOptimizer.cacheData('records', data);

    // Show notification
    notificationSystem.addNotification({
        type: 'success',
        title: 'Record mới',
        message: `${data.racerName} đạt record mới!`
    });

    // Record analytics
    await performanceOptimizer.recordEvent('new_record', data);
});

// Example: Before export
async function handleExport() {
    const data = await getDocs(collection(db, "gameCars"));
    const cars = data.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    await dataExportImport.exportToJSON(cars, 'cars-backup');
    
    notificationSystem.addNotification({
        type: 'success',
        title: 'Export thành công',
        message: `Đã xuất ${cars.length} xe`
    });
}
```

---

## 📁 Cấu trúc dự án

```
WebTinhDiem/
├── index.html                    # Dashboard chính
├── index.js                      # Logic dashboard
├── login.html                    # Trang đăng nhập
├── login.js                      # Logic đăng nhập
├── configdata.html              # Admin panel
├── configdata.js                # Logic admin
├── map-detail.html              # Chi tiết bản đồ
├── map-detail.js                # Logic chi tiết
│
├── theme-manager.js             # ✨ Dark/Light mode
├── data-export-import.js        # 💾 Export/Import
├── notification-system.js       # 🔔 Notifications
├── search-filters.js            # 🔍 Search & Filters
├── user-profile.js              # 👤 User Profile
├── performance-optimizer.js     # ⚡ Performance
│
└── logoWS.png                   # Logo
```

---

## 🔌 API Reference

### Theme Manager
```javascript
themeManager.setTheme(theme)           // 'light', 'dark', 'auto'
themeManager.toggleTheme()             // Toggle current theme
themeManager.getCurrentTheme()         // Get current theme
themeManager.getSystemTheme()          // Get system preference
themeManager.getThemeStatus()          // Get theme status string
themeManager.getToggleIcon()           // Get icon for toggle button
```

### Data Export/Import
```javascript
await dataExportImport.exportToJSON(data, filename)
await dataExportImport.exportToCSV(data, filename)
await dataExportImport.importFromJSON(file)
await dataExportImport.importFromCSV(file)
await dataExportImport.exportFullDatabase(db, collections)
await dataExportImport.importToFirestore(db, collection, data)
dataExportImport.generateReport(data, title)
```

### Notification System
```javascript
notificationSystem.addNotification(options)
notificationSystem.removeNotification(id)
notificationSystem.clearAll()
notificationSystem.on(eventName, callback)
notificationSystem.emit(eventName, data)
```

### Search & Filters
```javascript
searchFiltersManager.performSearch(query)
searchFiltersManager.addToSearchHistory(query)
searchFiltersManager.clearSearchHistory()
searchFiltersManager.showFilterPanel()
```

### User Profile
```javascript
await userProfileManager.createProfilePage()
userProfileManager.loadUserStats()
userProfileManager.getProfileWidget()
userProfileManager.updateProfilePicture(file)
userProfileManager.getProfileURL(userId)
```

### Performance Optimizer
```javascript
await performanceOptimizer.cacheData(key, data, expiryMs)
await performanceOptimizer.getCachedData(key)
await performanceOptimizer.batchRequest(key, fetchFn, delay)
performanceOptimizer.setupLazyLoading()
performanceOptimizer.setupInfiniteScroll(container, loadMoreFn)
performanceOptimizer.throttle(fn, delay)
performanceOptimizer.debounce(fn, delay)
await performanceOptimizer.recordEvent(eventName, data)
await performanceOptimizer.getAnalyticsSummary(hours)
performanceOptimizer.getPerformanceMetrics()
await performanceOptimizer.clearAllCache()
```

---

## 🎯 Các nâng cấp tiếp theo

- [ ] PWA Support (offline mode, install app)
- [ ] Bottom navigation mobile
- [ ] Swipe gestures
- [ ] Advanced analytics dashboard
- [ ] Prediction system
- [ ] Leaderboard improvements
- [ ] Social features
- [ ] Video tutorials
- [ ] API documentation UI
- [ ] Audit log system

---

## 📞 Support

Nếu gặp vấn đề:
1. Kiểm tra console để xem lỗi
2. Xem analytics events: `await performanceOptimizer.getAnalyticsSummary()`
3. Kiểm tra cache: `await performanceOptimizer.getCacheStats()`
4. Clear cache: `await performanceOptimizer.clearAllCache()`

---

## 📝 License

WeStar Admin © 2026
