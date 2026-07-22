/**
 * Racer Statistics System - Enhanced Version (Pro)
 * Dashboard riêng cho từng tay đua với giao diện đẹp mắt
 * Load dữ liệu users từ Firestore và đối chiếu qua Biệt danh (Nickname)
 */

class RacerStatsSystem {
    constructor() {
        this.allRacers = [];        // Users có role = 'racer'
        this.allRecords = [];       // Tất cả kỷ lục
        this.racerRecords = {};     // Records theo racer nickname
        this.selectedRacer = null;
        this.charts = {};
        this.isLoaded = false;
        
        console.log('📊 RacerStatsSystem initialized');
        this.loadExternalLibraries();
    }

    // Helper lấy avatar chất lượng cao hoặc sinh initials avatar
    getRacerAvatar(racer, nickname) {
        if (racer) {
            if (racer.photoBase64 && racer.photoBase64.trim() !== '') {
                return racer.photoBase64;
            }
            if (racer.photoURL && racer.photoURL.trim() !== '' && !racer.photoURL.startsWith('custom_avatar_')) {
                return racer.photoURL;
            }
        }
        const name = nickname || (racer ? (racer.nickname || racer.displayName) : '') || 'Racer';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=38bdf8&bold=true&size=128`;
    }

    // Helper lấy ảnh xe (hoặc placeholder nếu chưa load/chưa có ảnh)
    getCarImageUrl(carName) {
        if (carName && window.allCars) {
            const matched = window.allCars.find(c => c.name === carName);
            if (matched && matched.imageUrl) return matched.imageUrl;
        }
        return `https://placehold.co/128x128/1e293b/06b6d4?text=${encodeURIComponent(carName || 'Xe')}`;
    }

    // Helper lấy ảnh pet (hoặc placeholder nếu chưa load/chưa có ảnh)
    getPetImageUrl(petName) {
        if (petName && window.allPets) {
            const matched = window.allPets.find(p => p.name === petName);
            if (matched && matched.imageUrl) return matched.imageUrl;
        }
        return `https://placehold.co/128x128/1e293b/a855f7?text=${encodeURIComponent(petName || 'Pet')}`;
    }

    // Load cars và pets để phục vụ tìm kiếm combo hình ảnh
    async loadCarsAndPets() {
        if (!window.allCars || window.allCars.length === 0) {
            try {
                const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
                if (window.firestoreDb) {
                    const snap = await getDocs(collection(window.firestoreDb, "gameCars"));
                    window.allCars = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            } catch (e) {
                console.error("Error loading cars for stats:", e);
            }
        }
        if (!window.allPets || window.allPets.length === 0) {
            try {
                const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
                if (window.firestoreDb) {
                    const snap = await getDocs(collection(window.firestoreDb, "gamePets"));
                    window.allPets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                }
            } catch (e) {
                console.error("Error loading pets for stats:", e);
            }
        }
    }

    // Load các thư viện cần thiết
    loadExternalLibraries() {
        // Load jsPDF cho export PDF
        if (!document.querySelector('script[src*="jspdf"]')) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            document.head.appendChild(script);
            
            const script2 = document.createElement('script');
            script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
            document.head.appendChild(script2);
        }
    }

    // Load dữ liệu users với role "racer" - SỬ DỤNG DỮ LIỆU ĐÃ CÓ SẴN
    loadRacersFromCache() {
        // Sử dụng allUsers đã load sẵn trong configdata.js thay vì query lại Firestore
        if (window.allUsers && window.allUsers.length > 0) {
            this.allRacers = window.allUsers; // Lấy toàn bộ users để đối chiếu qua biệt danh
            console.log(`✅ Loaded ${this.allRacers.length} users from cache`);
            return this.allRacers;
        }
        
        console.log('⚠️ window.allUsers not ready yet');
        return [];
    }

    // Load records - SỬ DỤNG DỮ LIỆU ĐÃ CÓ SẴN
    loadRecordsFromCache() {
        // Sử dụng allRecords đã load sẵn trong configdata.js
        if (window.allRecords && window.allRecords.length > 0) {
            this.allRecords = window.allRecords;
            console.log(`✅ Loaded ${this.allRecords.length} records from cache`);
            return this.allRecords;
        }
        console.log('⚠️ window.allRecords not ready yet');
        return [];
    }

    // Khởi tạo tab Thống kê tay đua
    async init() {
        console.log('🚀 Initializing racer stats tab...');
        await this.loadAndProcessData();
    }

    // Load và process data - TỐI ƯU: dùng cache trước
    async loadAndProcessData() {
        await this.loadCarsAndPets();
        if (this.isLoaded && this.allRacers.length > 0) {
            console.log('📊 Data already loaded, re-rendering UI...');
            this.updateOverviewStats();
            this.renderRacerList();
            return;
        }

        try {
            console.log('📊 Loading racer stats data...');
            
            this.loadRacersFromCache();
            this.loadRecordsFromCache();
            
            if (this.allRacers.length > 0 && this.allRecords.length > 0) {
                console.log('✅ Data loaded from cache immediately');
                this.processRecordsByRacer();
                this.isLoaded = true;
                this.updateOverviewStats();
                this.renderRacerList();
                return;
            }
            
            console.log('⏳ Waiting for data from configdata.js...');
            let attempts = 0;
            const maxAttempts = 25;
            
            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 200));
                this.loadRacersFromCache();
                this.loadRecordsFromCache();
                
                if (this.allRacers.length > 0 && this.allRecords.length > 0) {
                    console.log('✅ Data loaded from cache after waiting');
                    break;
                }
                attempts++;
            }
            
            if (this.allRacers.length === 0) {
                console.log('🔄 Fallback: Loading racers from Firestore...');
                await this.loadRacersFromFirestore();
            }
            
            if (this.allRecords.length === 0) {
                console.log('🔄 Fallback: Loading records from Firestore...');
                await this.loadRecordsFromFirestore();
            }

            this.processRecordsByRacer();
            this.isLoaded = true;
            this.updateOverviewStats();
            this.renderRacerList();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Lỗi tải dữ liệu. Vui lòng thử lại.');
        }
    }

    // Fallback: Load racers từ Firestore
    async loadRacersFromFirestore() {
        try {
            const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
            if (!window.firestoreDb) return [];
            
            const usersRef = collection(window.firestoreDb, 'users');
            const snapshot = await getDocs(usersRef);
            
            this.allRacers = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log(`✅ Loaded ${this.allRacers.length} users from Firestore`);
            return this.allRacers;
        } catch (error) {
            console.error('Error loading racers from Firestore:', error);
            return [];
        }
    }

    // Fallback: Load records từ Firestore
    async loadRecordsFromFirestore() {
        try {
            const { collection, getDocs, orderBy, query } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
            if (!window.firestoreDb) return [];
            
            const recordsRef = collection(window.firestoreDb, 'raceRecords');
            const recordsQuery = query(recordsRef, orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(recordsQuery);
            
            this.allRecords = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log(`✅ Loaded ${this.allRecords.length} records from Firestore`);
            return this.allRecords;
        } catch (error) {
            console.error('Error loading records from Firestore:', error);
            return [];
        }
    }

    // Hiển thị lỗi
    showError(message) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi tải dữ liệu',
            text: message,
            background: '#1e293b',
            color: '#fff'
        });
    }

    // Lấy tên hiển thị của racer - CHỈ DÙNG NICKNAME (BIỆT DANH)
    getRacerDisplayName(racer) {
        return racer.nickname ? racer.nickname.trim() : '';
    }

    // Process records và gán cho mỗi racer theo BIỆT DANH
    processRecordsByRacer() {
        this.racerRecords = {};
        const registeredNicknames = new Set();
        
        // 1. Thêm các users có biệt danh từ Firestore
        this.allRacers.forEach(racer => {
            const nameKey = this.getRacerDisplayName(racer);
            if (!nameKey) return; // Bỏ qua nếu không có biệt danh
            
            registeredNicknames.add(nameKey.toLowerCase());
            this.racerRecords[nameKey] = {
                racer: racer,
                records: [],
                totalRecords: 0,
                bestTimes: {},
                mapsPlayed: new Set(),
                carsUsed: new Set(),
                petsUsed: new Set(),
                firstRecord: null,
                lastRecord: null
            };
        });

        // 2. Quét toàn bộ records để tìm các tay đua tự do (chưa đăng ký/guest)
        this.allRecords.forEach(record => {
            const racerName = record.racerName ? record.racerName.trim() : '';
            if (!racerName) return;

            const lowerName = racerName.toLowerCase();
            
            // Tìm xem tên trong kỷ lục đã tồn tại chưa (case-insensitive)
            let existingKey = Object.keys(this.racerRecords).find(k => k.toLowerCase() === lowerName);

            if (!existingKey) {
                // Tạo một guest racer profile
                this.racerRecords[racerName] = {
                    racer: {
                        nickname: racerName,
                        displayName: racerName,
                        photoURL: null,
                        email: 'guest@westar.team',
                        role: 'racer',
                        isGuest: true
                    },
                    records: [],
                    totalRecords: 0,
                    bestTimes: {},
                    mapsPlayed: new Set(),
                    carsUsed: new Set(),
                    petsUsed: new Set(),
                    firstRecord: null,
                    lastRecord: null
                };
                registeredNicknames.add(lowerName);
            }
        });

        // 3. Phân bổ kỷ lục cho các nhóm biệt danh
        this.allRecords.forEach(record => {
            const racerName = record.racerName ? record.racerName.trim() : '';
            if (!racerName) return;

            const key = Object.keys(this.racerRecords).find(k => k.toLowerCase() === racerName.toLowerCase());
            if (key) {
                this.racerRecords[key].records.push(record);
                this.racerRecords[key].totalRecords++;
                this.racerRecords[key].mapsPlayed.add(record.mapName);
                if (record.car) this.racerRecords[key].carsUsed.add(record.car);
                if (record.pet) this.racerRecords[key].petsUsed.add(record.pet);

                // Track best times per map
                const mapName = record.mapName;
                const time = record.timeInSeconds || Infinity;
                if (!this.racerRecords[key].bestTimes[mapName] || time < this.racerRecords[key].bestTimes[mapName].time) {
                    this.racerRecords[key].bestTimes[mapName] = {
                        time: time,
                        car: record.car,
                        pet: record.pet,
                        date: record.timestamp
                    };
                }

                // Track activity dates
                const recordDate = record.timestamp ? new Date(record.timestamp) : null;
                if (recordDate) {
                    if (!this.racerRecords[key].firstRecord || recordDate < this.racerRecords[key].firstRecord) {
                        this.racerRecords[key].firstRecord = recordDate;
                    }
                    if (!this.racerRecords[key].lastRecord || recordDate > this.racerRecords[key].lastRecord) {
                        this.racerRecords[key].lastRecord = recordDate;
                    }
                }
            }
        });

        // Sắp xếp thứ hạng (ranking) theo số lượng kỷ lục nhiều nhất
        const sortedRacers = Object.entries(this.racerRecords)
            .sort((a, b) => b[1].totalRecords - a[1].totalRecords);
        
        sortedRacers.forEach(([name, data], index) => {
            this.racerRecords[name].ranking = index + 1;
        });
    }

    // Cập nhật thẻ tổng quan bên ngoài
    updateOverviewStats() {
        const totalRacers = Object.keys(this.racerRecords).length;
        const totalRecords = this.allRecords.length;
        const totalMaps = new Set(this.allRecords.map(r => r.mapName)).size;
        
        // Tìm tay đua nắm giữ nhiều kỷ lục nhất
        let topRacer = 'N/A';
        let maxRecords = 0;
        Object.entries(this.racerRecords).forEach(([name, data]) => {
            if (data.totalRecords > maxRecords) {
                maxRecords = data.totalRecords;
                topRacer = name;
            }
        });

        const el1 = document.getElementById('racer-stats-total');
        const el2 = document.getElementById('racer-stats-records');
        const el3 = document.getElementById('racer-stats-maps');
        const el4 = document.getElementById('racer-stats-top');
        
        if (el1) el1.innerHTML = totalRacers;
        if (el2) el2.innerHTML = totalRecords;
        if (el3) el3.innerHTML = totalMaps;
        if (el4) el4.innerHTML = topRacer;
    }

    // Render danh sách nổi bật (Gương mặt nổi bật) và thiết lập Autocomplete
    renderRacerList() {
        this.setupAutocompleteSearch();
        this.renderTopRacersCarousel();
    }

    // Setup tính năng tìm kiếm thông minh tự động hoàn thành
    setupAutocompleteSearch() {
        const searchInput = document.getElementById('racer-pro-search');
        const resultsDropdown = document.getElementById('racer-pro-search-results');
        
        if (!searchInput || !resultsDropdown) return;

        // Reset input
        searchInput.value = '';
        resultsDropdown.innerHTML = '';
        resultsDropdown.classList.add('hidden');

        searchInput.addEventListener('input', () => {
            const val = searchInput.value.toLowerCase().trim();
            if (!val) {
                resultsDropdown.classList.add('hidden');
                return;
            }

            const matches = Object.keys(this.racerRecords)
                .filter(k => k.toLowerCase().includes(val))
                .sort((a, b) => this.racerRecords[b].totalRecords - this.racerRecords[a].totalRecords)
                .slice(0, 5);

            if (matches.length === 0) {
                resultsDropdown.innerHTML = `<div class="p-3 text-slate-500 text-sm">Không tìm thấy tay đua</div>`;
            } else {
                resultsDropdown.innerHTML = matches.map(name => {
                    const racerData = this.racerRecords[name];
                    const avatar = this.getRacerAvatar(racerData.racer, name);
                    return `
                        <div class="flex items-center gap-3 p-3 hover:bg-slate-700/50 cursor-pointer transition-colors"
                             onclick="window.racerStatsTab.selectRacer('${name.replace(/'/g, "\\'")}')">
                            <img src="${avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-600 bg-slate-800" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=38bdf8&bold=true'">
                            <div class="flex-1 min-w-0">
                                <div class="text-white font-bold text-sm truncate">${name}</div>
                                <div class="text-xs text-slate-400">${racerData.totalRecords} kỷ lục</div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
            resultsDropdown.classList.remove('hidden');
        });

        // Đóng dropdown khi click bên ngoài
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !resultsDropdown.contains(e.target)) {
                resultsDropdown.classList.add('hidden');
            }
        });
    }

    // Render danh sách top tay đua nổi bật ở slider ngang
    renderTopRacersCarousel() {
        const carousel = document.getElementById('top-racers-carousel');
        if (!carousel) return;

        const top6 = Object.entries(this.racerRecords)
            .sort((a, b) => b[1].totalRecords - a[1].totalRecords)
            .slice(0, 6);

        if (top6.length === 0) {
            carousel.innerHTML = '<div class="text-slate-500 text-sm py-2">Chưa có dữ liệu nổi bật</div>';
            return;
        }

        carousel.innerHTML = top6.map(([name, data]) => {
            const avatar = this.getRacerAvatar(data.racer, name);
            return `
                <div class="flex-shrink-0 cursor-pointer bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/50 hover:border-cyan-500/50 rounded-xl p-3 min-w-[140px] flex flex-col items-center transition-all duration-300 transform hover:-translate-y-1 hover:shadow-lg"
                     onclick="window.racerStatsTab.selectRacer('${name.replace(/'/g, "\\'")}')">
                    <img src="${avatar}" class="w-12 h-12 rounded-full object-cover mb-2 border-2 border-slate-600 bg-slate-800" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=38bdf8&bold=true'">
                    <span class="text-white font-bold text-xs truncate max-w-[120px]">${name}</span>
                    <span class="text-[10px] text-cyan-400 mt-1 flex items-center gap-1 font-semibold">
                        <i class="fas fa-trophy text-[9px]"></i> ${data.totalRecords}
                    </span>
                </div>
            `;
        }).join('');
    }

    // Chọn tay đua và kết xuất giao diện chi tiết
    selectRacer(racerName) {
        this.selectedRacer = racerName;
        const data = this.racerRecords[racerName];
        
        if (!data) {
            console.error('Racer data not found:', racerName);
            return;
        }

        // Đóng dropdown tìm kiếm và reset input
        const dropdown = document.getElementById('racer-pro-search-results');
        const input = document.getElementById('racer-pro-search');
        if (dropdown) dropdown.classList.add('hidden');
        if (input) input.value = '';

        // Hiển thị khung thông tin chi tiết và ẩn trạng thái trống
        const emptyState = document.getElementById('racer-pro-empty-state');
        const proDashboard = document.getElementById('racer-pro-dashboard');
        
        if (emptyState) emptyState.classList.add('hidden');
        if (proDashboard) proDashboard.classList.remove('hidden');

        // 1. Cập nhật Banner & Profile Header
        this.updateRacerHeader(racerName, data);
        
        // 2. Tính toán và hiển thị các chỉ số chi tiết
        this.updateRacerStats(data);
        
        // 3. Render biểu đồ phân bố sử dụng Xe và Pet
        this.renderRacerCharts(data);
        
        // 4. Điền bảng kỷ lục tốt nhất (Map Performance)
        this.renderBestTimesTable(data);
        
        // 5. Kết xuất dòng lịch sử hoạt động (Timeline)
        this.renderRecentTimeline(data);
    }

    // Cập nhật Profile Header
    updateRacerHeader(name, data) {
        const racer = data.racer;
        const avatar = this.getRacerAvatar(racer, name);
        
        // Avatar
        const avatarEl = document.getElementById('racer-pro-avatar');
        if (avatarEl) {
            avatarEl.src = avatar;
            avatarEl.onerror = function() {
                this.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=0f172a&color=38bdf8&bold=true';
            };
        }
        
        // Tên
        const nameEl = document.getElementById('racer-pro-name');
        if (nameEl) nameEl.textContent = name;
        
        // Level Hạng dựa vào kỷ lục
        const rankEl = document.getElementById('racer-pro-rank');
        if (rankEl) {
            const count = data.totalRecords;
            let rankText = 'Tập Sự';
            if (count >= 50) rankText = 'Thần Thoại';
            else if (count >= 30) rankText = 'Huyền Thoại';
            else if (count >= 20) rankText = 'Cao Thủ';
            else if (count >= 10) rankText = 'Kim Cương';
            else if (count >= 5) rankText = 'Bạch Kim';
            else if (count >= 3) rankText = 'Vàng';
            else if (count >= 2) rankText = 'Bạc';
            rankEl.textContent = rankText;
        }
        
        // Ngày hoạt động mới nhất
        const lastActiveEl = document.getElementById('racer-pro-last-active');
        if (lastActiveEl) {
            const date = data.lastRecord ? data.lastRecord.toLocaleDateString('vi-VN') : '--/--/----';
            lastActiveEl.textContent = date;
        }
    }

    // Cập nhật các chỉ số trọng tâm
    updateRacerStats(data) {
        // Tổng kỷ lục
        const recordsEl = document.getElementById('stat-total-records');
        if (recordsEl) recordsEl.textContent = data.totalRecords;
        
        // Số lượng Map đạt Top 1 tuyệt đối (thành tích tốt nhất toàn server)
        const top1El = document.getElementById('stat-top1-count');
        if (top1El) {
            const top1Count = this.calculateTop1MapsCount(data.racer.nickname);
            top1El.innerHTML = `${top1Count} <span class="text-sm font-normal text-slate-400">map</span>`;
        }

        // Bản đồ thi đấu nhiều nhất (Map Tủ)
        const favMapEl = document.getElementById('stat-fav-map');
        const favMapCountEl = document.getElementById('stat-fav-map-count');
        
        if (favMapEl && favMapCountEl) {
            const mapCounts = {};
            data.records.forEach(r => {
                mapCounts[r.mapName] = (mapCounts[r.mapName] || 0) + 1;
            });
            const sortedMaps = Object.entries(mapCounts).sort((a, b) => b[1] - a[1]);
            if (sortedMaps.length > 0) {
                favMapEl.textContent = sortedMaps[0][0];
                favMapCountEl.textContent = `${sortedMaps[0][1]} lần đua`;
            } else {
                favMapEl.textContent = 'Chưa có';
                favMapCountEl.textContent = '0 lần đua';
            }
        }

        // Combo yêu thích (Xe + Pet sử dụng nhiều nhất)
        this.updateFavoriteCombo(data);
    }

    // Tính toán số map mà tay đua này đang giữ kỷ lục tuyệt đối trên toàn hệ thống
    calculateTop1MapsCount(nickname) {
        if (!nickname) return 0;
        const bestTimePerMap = {};

        // Tìm thời gian nhanh nhất của mỗi map trên toàn server
        this.allRecords.forEach(rec => {
            const map = rec.mapName;
            const time = rec.timeInSeconds || Infinity;
            if (!bestTimePerMap[map] || time < bestTimePerMap[map].time) {
                bestTimePerMap[map] = {
                    time: time,
                    racerName: rec.racerName
                };
            }
        });

        // Đếm số map tay đua này thắng tuyệt đối
        let top1Count = 0;
        Object.values(bestTimePerMap).forEach(best => {
            if (best.racerName && best.racerName.toLowerCase() === nickname.toLowerCase()) {
                top1Count++;
            }
        });

        return top1Count;
    }

    // Cập nhật Combo yêu thích nhất
    updateFavoriteCombo(data) {
        const carEl = document.getElementById('stat-fav-car');
        const petEl = document.getElementById('stat-fav-pet');
        
        // Tìm xe nhiều nhất
        const carCounts = {};
        data.records.forEach(r => { if (r.car) carCounts[r.car] = (carCounts[r.car] || 0) + 1; });
        const topCar = Object.entries(carCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

        // Tìm pet nhiều nhất
        const petCounts = {};
        data.records.forEach(r => { if (r.pet) petCounts[r.pet] = (petCounts[r.pet] || 0) + 1; });
        const topPet = Object.entries(petCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

        // Lấy link ảnh xe
        if (carEl) {
            carEl.title = topCar || 'Không dùng xe';
            carEl.src = this.getCarImageUrl(topCar);
        }

        // Lấy link ảnh pet
        if (petEl) {
            petEl.title = topPet || 'Không dùng pet';
            petEl.src = this.getPetImageUrl(topPet);
        }
    }

    // Render 2 biểu đồ tròn: Tỷ lệ sử dụng xe và Tỷ lệ sử dụng pet
    renderRacerCharts(data) {
        // Hủy biểu đồ cũ nếu có
        if (this.charts.cars) { this.charts.cars.destroy(); this.charts.cars = null; }
        if (this.charts.pets) { this.charts.pets.destroy(); this.charts.pets = null; }

        const colors = ['#00f3ff', '#9d00ff', '#00ff9d', '#ff0066', '#ffcc00', '#0066ff', '#ff6600', '#00ccff'];

        // 1. Tỷ lệ Xe
        const carCounts = {};
        data.records.forEach(r => { if (r.car) carCounts[r.car] = (carCounts[r.car] || 0) + 1; });
        const sortedCars = Object.entries(carCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const carCanvas = document.getElementById('pro-chart-cars');

        if (carCanvas && sortedCars.length > 0) {
            this.charts.cars = new Chart(carCanvas, {
                type: 'doughnut',
                data: {
                    labels: sortedCars.map(c => c[0]),
                    datasets: [{
                        data: sortedCars.map(c => c[1]),
                        backgroundColor: colors.slice(0, sortedCars.length),
                        borderColor: '#1e293b',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#e2e8f0', usePointStyle: true, boxWidth: 6, font: { size: 10 } } }
                    }
                }
            });
        }

        // 2. Tỷ lệ Pet
        const petCounts = {};
        data.records.forEach(r => { if (r.pet) petCounts[r.pet] = (petCounts[r.pet] || 0) + 1; });
        const sortedPets = Object.entries(petCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const petCanvas = document.getElementById('pro-chart-pets');

        if (petCanvas && sortedPets.length > 0) {
            this.charts.pets = new Chart(petCanvas, {
                type: 'doughnut',
                data: {
                    labels: sortedPets.map(p => p[0]),
                    datasets: [{
                        data: sortedPets.map(p => p[1]),
                        backgroundColor: colors.slice(0, sortedPets.length),
                        borderColor: '#1e293b',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#e2e8f0', usePointStyle: true, boxWidth: 6, font: { size: 10 } } }
                    }
                }
            });
        }
    }

    // Render bảng Map Performance
    renderBestTimesTable(data) {
        const tbody = document.getElementById('pro-map-records-body');
        const mapsPlayedCount = document.getElementById('total-maps-played');
        
        if (!tbody) return;

        const sortedMaps = Object.entries(data.bestTimes)
            .sort((a, b) => a[1].time - b[1].time);

        if (mapsPlayedCount) mapsPlayedCount.textContent = sortedMaps.length;

        if (sortedMaps.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-4 py-8 text-center text-slate-500">
                        <i class="fas fa-inbox text-2xl mb-2"></i>
                        <p>Chưa có kỷ lục nào</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = sortedMaps.map(([mapName, bt]) => {
            const timeStr = this.formatTime(bt.time);
            
            // Tìm thứ hạng của tay đua này trên bản đồ đó so với các tay đua khác
            const globalRank = this.calculateGlobalRankOnMap(mapName, data.racer.nickname);
            let rankBadge = `<span class="px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 font-semibold text-xs">Hạng ${globalRank}</span>`;
            if (globalRank === 1) {
                rankBadge = `<span class="px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold text-xs flex items-center gap-1 w-max"><i class="fas fa-crown"></i> Top 1</span>`;
            } else if (globalRank === 2) {
                rankBadge = `<span class="px-2.5 py-0.5 rounded-full bg-slate-400/20 text-slate-300 border border-slate-400/30 font-bold text-xs flex items-center gap-1 w-max">Hạng 2</span>`;
            } else if (globalRank === 3) {
                rankBadge = `<span class="px-2.5 py-0.5 rounded-full bg-amber-600/20 text-amber-400 border border-amber-600/30 font-bold text-xs flex items-center gap-1 w-max">Hạng 3</span>`;
            }

            const combo = [];
            if (bt.car) combo.push(bt.car);
            if (bt.pet) combo.push(bt.pet);
            const comboStr = combo.join(' + ') || 'N/A';

            return `
                <tr class="hover:bg-slate-700/30 transition-colors">
                    <td class="px-4 py-3.5 text-white font-bold">${mapName}</td>
                    <td class="px-4 py-3.5">${rankBadge}</td>
                    <td class="px-4 py-3.5 font-mono text-cyan-400 font-bold">${timeStr}</td>
                    <td class="px-4 py-3.5 text-slate-400 text-xs">${comboStr}</td>
                </tr>
            `;
        }).join('');
    }

    // Tính toán thứ hạng của một tay đua trên 1 bản đồ cụ thể
    calculateGlobalRankOnMap(mapName, nickname) {
        if (!nickname) return '--';

        // Lấy kỷ lục tốt nhất của từng tay đua trên map này
        const racerBests = {};
        this.allRecords.forEach(rec => {
            if (rec.mapName !== mapName) return;
            const racer = rec.racerName;
            const time = rec.timeInSeconds || Infinity;

            if (!racerBests[racer] || time < racerBests[racer]) {
                racerBests[racer] = time;
            }
        });

        // Sắp xếp tăng dần
        const sortedList = Object.entries(racerBests)
            .sort((a, b) => a[1] - b[1])
            .map(entry => entry[0].toLowerCase());

        // Tìm thứ hạng
        const idx = sortedList.indexOf(nickname.toLowerCase());
        return idx !== -1 ? idx + 1 : sortedList.length + 1;
    }

    // Render Timeline 20 kỷ lục gần nhất
    renderRecentTimeline(data) {
        const container = document.getElementById('pro-timeline-container');
        if (!container) return;

        const recent20 = data.records.slice(0, 20);

        if (recent20.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center text-slate-500">
                    <p>Chưa ghi nhận hoạt động</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recent20.map(record => {
            const dateStr = record.timestamp ? new Date(record.timestamp).toLocaleString('vi-VN') : 'N/A';
            const timeStr = this.formatTime(record.timeInSeconds);
            const combo = [];
            if (record.car) combo.push(record.car);
            if (record.pet) combo.push(record.pet);
            const comboStr = combo.join(' + ') || 'Không dùng combo';

            return `
                <div class="relative pl-6 pb-6">
                    <!-- Dot -->
                    <div class="absolute -left-1.5 top-1.5 bg-cyan-500 w-3 h-3 rounded-full border border-slate-900 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></div>
                    
                    <div class="text-xs text-slate-400 mb-1 font-semibold flex items-center gap-2">
                        <i class="far fa-clock"></i> ${dateStr}
                    </div>
                    <h4 class="text-white font-extrabold text-sm flex items-center gap-2">
                        ${record.mapName}
                        <span class="font-mono text-cyan-400 font-bold">${timeStr}</span>
                    </h4>
                    <p class="text-xs text-slate-400 mt-1">
                        <i class="fas fa-info-circle mr-1 text-slate-500"></i> ${comboStr}
                    </p>
                </div>
            `;
        }).join('');
    }

    // Thiết lập dropdown tìm kiếm trong Compare Modal
    setupCompareSearch() {
        const input = document.getElementById('compare-search-input');
        const results = document.getElementById('compare-search-results');
        if (!input || !results) return;

        input.value = '';
        results.innerHTML = '';

        input.addEventListener('input', () => {
            const val = input.value.toLowerCase().trim();
            if (!val) {
                results.innerHTML = '';
                return;
            }

            // Lọc ra các tay đua khác Racer 1
            const matches = Object.keys(this.racerRecords)
                .filter(k => k.toLowerCase() !== this.selectedRacer.toLowerCase() && k.toLowerCase().includes(val))
                .slice(0, 5);

            if (matches.length === 0) {
                results.innerHTML = `<div class="p-3 text-slate-500 text-sm">Không tìm thấy đối thủ</div>`;
            } else {
                results.innerHTML = matches.map(name => {
                    const racerData = this.racerRecords[name];
                    const avatar = this.getRacerAvatar(racerData.racer, name);
                    return `
                        <div class="flex items-center gap-3 p-3 hover:bg-slate-800 cursor-pointer transition-colors"
                             onclick="window.racerStatsTab.selectCompareRacer2('${name.replace(/'/g, "\\'")}')">
                            <img src="${avatar}" class="w-8 h-8 rounded-full object-cover border border-slate-600 bg-slate-800" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0f172a&color=38bdf8&bold=true'">
                            <div>
                                <div class="text-white font-bold text-sm">${name}</div>
                                <div class="text-xs text-slate-400">${racerData.totalRecords} kỷ lục</div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        });
    }

    // Chọn đối thủ so sánh thứ 2
    selectCompareRacer2(name2) {
        // Cập nhật thông tin Racer 2
        const r2Data = this.racerRecords[name2];
        if (!r2Data) return;

        const avatar2 = document.getElementById('compare-avatar-2');
        const avatar2Icon = document.getElementById('compare-avatar-2-icon');
        const name2El = document.getElementById('compare-name-2');
        const dropdown = document.getElementById('compare-search-2-container');

        if (name2El) {
            name2El.textContent = name2;
            name2El.className = 'font-bold text-white text-lg truncate cursor-pointer';
        }
        if (avatar2) {
            avatar2.src = this.getRacerAvatar(r2Data.racer, name2);
            avatar2.classList.remove('hidden');
        }
        if (avatar2Icon) avatar2Icon.classList.add('hidden');
        if (dropdown) dropdown.classList.add('hidden');

        // Bật hiển thị kết quả so sánh
        const emptyState = document.getElementById('compare-empty-state');
        const results = document.getElementById('compare-results-container');
        if (emptyState) emptyState.classList.add('hidden');
        if (results) results.classList.remove('hidden');

        // Tính toán so sánh
        this.renderComparisonData(this.selectedRacer, name2);
    }

    // Kết xuất giao diện so sánh chỉ số giữa 2 tay đua
    renderComparisonData(n1, n2) {
        const d1 = this.racerRecords[n1];
        const d2 = this.racerRecords[n2];

        // 1. So sánh tổng kỷ lục
        const total1 = d1.totalRecords;
        const total2 = d2.totalRecords;
        const totalEl1 = document.getElementById('compare-stat-total-1');
        const totalEl2 = document.getElementById('compare-stat-total-2');
        if (totalEl1) totalEl1.textContent = total1;
        if (totalEl2) totalEl2.textContent = total2;

        const totalMax = Math.max(total1, total2, 1);
        const barTotal1 = document.getElementById('compare-bar-total-1');
        const barTotal2 = document.getElementById('compare-bar-total-2');
        if (barTotal1) barTotal1.style.width = `${(total1 / totalMax) * 100}%`;
        if (barTotal2) barTotal2.style.width = `${(total2 / totalMax) * 100}%`;

        // 2. So sánh số Map Top 1 tuyệt đối
        const top1Count1 = this.calculateTop1MapsCount(n1);
        const top1Count2 = this.calculateTop1MapsCount(n2);
        const top1El1 = document.getElementById('compare-stat-top1-1');
        const top1El2 = document.getElementById('compare-stat-top1-2');
        if (top1El1) top1El1.textContent = `${top1Count1} map`;
        if (top1El2) top1El2.textContent = `${top1Count2} map`;

        const top1Max = Math.max(top1Count1, top1Count2, 1);
        const barTop1_1 = document.getElementById('compare-bar-top1-1');
        const barTop1_2 = document.getElementById('compare-bar-top1-2');
        if (barTop1_1) barTop1_1.style.width = `${(top1Count1 / top1Max) * 100}%`;
        if (barTop1_2) barTop1_2.style.width = `${(top1Count2 / top1Max) * 100}%`;

        // 3. So sánh chi tiết từng bản đồ (Comparison Table)
        const th1 = document.getElementById('th-name-1');
        const th2 = document.getElementById('th-name-2');
        if (th1) th1.textContent = n1;
        if (th2) th2.textContent = n2;

        const tbody = document.getElementById('compare-maps-body');
        if (!tbody) return;

        // Lấy danh sách map chung
        const maps1 = Object.keys(d1.bestTimes);
        const maps2 = Object.keys(d2.bestTimes);
        const allMapsSet = new Set([...maps1, ...maps2]);
        const sortedAllMaps = Array.from(allMapsSet).sort();

        if (sortedAllMaps.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="px-4 py-8 text-center text-slate-500">
                        Không có dữ liệu bản đồ để so sánh
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = sortedAllMaps.map(mapName => {
            const time1 = d1.bestTimes[mapName]?.time;
            const time2 = d2.bestTimes[mapName]?.time;

            let timeStr1 = '--:--';
            let timeStr2 = '--:--';
            let diffStr = '';
            
            if (time1) timeStr1 = this.formatTime(time1);
            if (time2) timeStr2 = this.formatTime(time2);

            let style1 = 'text-slate-400';
            let style2 = 'text-slate-400';

            if (time1 && time2) {
                if (time1 < time2) {
                    style1 = 'text-emerald-400 font-bold';
                    diffStr = `<span class="text-emerald-400 text-xs font-semibold"><i class="fas fa-caret-left mr-1"></i> -${(time2 - time1).toFixed(2)}s</span>`;
                } else if (time2 < time1) {
                    style2 = 'text-emerald-400 font-bold';
                    diffStr = `<span class="text-purple-400 text-xs font-semibold">+${(time1 - time2).toFixed(2)}s <i class="fas fa-caret-right ml-1"></i></span>`;
                } else {
                    style1 = 'text-white';
                    style2 = 'text-white';
                    diffStr = '<span class="text-slate-500 text-xs">Hòa</span>';
                }
            }

            return `
                <tr class="hover:bg-slate-800/40 border-b border-slate-800/30 transition-colors">
                    <td class="px-4 py-3 text-white font-bold">${mapName}</td>
                    <td class="px-4 py-3 font-mono text-center ${style1}">${timeStr1}</td>
                    <td class="px-4 py-3 text-center">${diffStr}</td>
                    <td class="px-4 py-3 font-mono text-center ${style2}">${timeStr2}</td>
                </tr>
            `;
        }).join('');
    }

    // Refresh dữ liệu
    async refresh() {
        this.selectedRacer = null;
        this.isLoaded = false;
        this.allRacers = [];
        this.allRecords = [];
        
        // Hiện skeleton nạp dữ liệu
        const proDashboard = document.getElementById('racer-pro-dashboard');
        const emptyState = document.getElementById('racer-pro-empty-state');
        if (proDashboard) proDashboard.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');

        await this.forceLoadData();

        Swal.fire({
            icon: 'success',
            title: 'Đã làm mới!',
            text: 'Dữ liệu thống kê tay đua đã được cập nhật',
            background: '#1e293b',
            color: '#fff',
            timer: 1500
        });
    }

    // Force load data
    async forceLoadData() {
        try {
            console.log('📊 Force loading racer stats data...');
            this.loadRacersFromCache();
            this.loadRecordsFromCache();
            
            if (this.allRacers.length > 0 && this.allRecords.length > 0) {
                this.processRecordsByRacer();
                this.isLoaded = true;
                this.updateOverviewStats();
                this.renderRacerList();
                return;
            }
            
            console.log('⏳ Waiting for data...');
            let attempts = 0;
            while (attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 250));
                this.loadRacersFromCache();
                this.loadRecordsFromCache();
                
                if (this.allRacers.length > 0 && this.allRecords.length > 0) {
                    break;
                }
                attempts++;
            }
            
            if (this.allRacers.length === 0) {
                await this.loadRacersFromFirestore();
            }
            if (this.allRecords.length === 0) {
                await this.loadRecordsFromFirestore();
            }
            
            this.processRecordsByRacer();
            this.isLoaded = true;
            this.updateOverviewStats();
            this.renderRacerList();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Lỗi tải dữ liệu. Vui lòng thử lại.');
        }
    }

    // Xuất báo cáo PDF
    async exportPDF() {
        if (!this.selectedRacer) {
            Swal.fire({
                icon: 'info',
                title: 'Chọn tay đua',
                text: 'Vui lòng chọn một tay đua để xuất báo cáo PDF',
                background: '#1e293b',
                color: '#fff'
            });
            return;
        }

        if (typeof window.jspdf === 'undefined') {
            Swal.fire({
                icon: 'info',
                title: 'Đang tải thư viện...',
                text: 'Vui lòng đợi vài giây rồi thử lại',
                background: '#1e293b',
                color: '#fff',
                timer: 2000
            });
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const data = this.racerRecords[this.selectedRacer];

        // Header Title
        doc.setFontSize(22);
        doc.setTextColor(6, 182, 212);
        doc.text(`BAO CAO THANH TICH - ${this.selectedRacer.toUpperCase()}`, 20, 20);

        // Xuất ngày
        doc.setFontSize(10);
        doc.setTextColor(148, 163, 184);
        doc.text(`Ngay xuat: ${new Date().toLocaleString('vi-VN')}`, 20, 28);
        doc.line(20, 32, 190, 32);

        // Chỉ số tổng quan
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.setFillColor(30, 41, 59);
        doc.rect(20, 38, 170, 30, 'F');
        
        doc.setFontSize(11);
        doc.setTextColor(226, 232, 240);
        doc.text(`Tong so ky luc: ${data.totalRecords}`, 25, 45);
        doc.text(`Ban do da tham gia: ${data.mapsPlayed.size}`, 25, 52);
        
        const top1Count = this.calculateTop1MapsCount(this.selectedRacer);
        doc.text(`So ban do giu Top 1 tuyet doi: ${top1Count}`, 25, 59);
        doc.text(`Bieng danh: ${this.selectedRacer}`, 25, 64);

        // Bảng Kỷ Lục Tốt Nhất Theo Map
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text('BANG KỶ LUC TOT NHAT THEO MAP', 20, 80);

        const tableData = Object.entries(data.bestTimes)
            .sort((a, b) => a[1].time - b[1].time)
            .map(([mapName, bt]) => {
                const combo = [];
                if (bt.car) combo.push(bt.car);
                if (bt.pet) combo.push(bt.pet);
                return [
                    mapName, 
                    this.formatTime(bt.time), 
                    combo.join(' + ') || 'N/A'
                ];
            });

        doc.autoTable({
            startY: 85,
            head: [['Ten Ban Do', 'Thoi Gian Tot Nhat', 'Combo Su Dung']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [6, 182, 212] }
        });

        // Tải xuống file
        doc.save(`Westar_Racer_Stats_${this.selectedRacer.replace(/\s/g, '_')}.pdf`);

        Swal.fire({
            icon: 'success',
            title: 'Xuất PDF thành công!',
            text: `Bản báo cáo đã được tải xuống`,
            background: '#1e293b',
            color: '#fff',
            timer: 2000
        });
    }

    // Format thời gian thành dạng MM'SS"MS
    formatTime(seconds) {
        if (!seconds || seconds === Infinity || isNaN(seconds)) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.round((seconds % 1) * 100);
        return `${String(mins).padStart(2, '0')}'${String(secs).padStart(2, '0')}"${String(ms).padStart(2, '0')}`;
    }
}

// Khởi tạo global instance
window.racerStatsTab = new RacerStatsSystem();

// Các hàm toàn cục gọi từ onclick trong HTML
window.filterRacerList = () => window.racerStatsTab.filterRacerList();
window.refreshRacerStats = () => window.racerStatsTab.refresh();
window.exportRacerPDF = () => window.racerStatsTab.exportPDF();
window.toggleCompareSection = () => {
    // Open the new compare modal
    const modal = document.getElementById('racer-pro-compare-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Setup Racer 1 info
        const r1Name = window.racerStatsTab.selectedRacer;
        const r1Data = window.racerStatsTab.racerRecords[r1Name];
        
        const avatar1 = document.getElementById('compare-avatar-1');
        const name1 = document.getElementById('compare-name-1');
        if (name1) name1.textContent = r1Name || 'Chọn Tay Đua';
        if (avatar1) avatar1.src = window.racerStatsTab.getRacerAvatar(r1Data?.racer, r1Name);
        
        // Reset Racer 2 info
        const avatar2 = document.getElementById('compare-avatar-2');
        const avatar2Icon = document.getElementById('compare-avatar-2-icon');
        const name2 = document.getElementById('compare-name-2');
        if (name2) name2.textContent = 'Chọn Đối Thủ';
        if (name2) name2.className = 'font-bold text-slate-400 text-lg truncate cursor-pointer';
        if (avatar2) {
            avatar2.src = 'https://ui-avatars.com/api/?name=Racer&background=0f172a&color=38bdf8&bold=true';
            avatar2.classList.add('hidden');
        }
        if (avatar2Icon) avatar2Icon.classList.remove('hidden');
        
        // Hide compare details, show empty state
        const emptyState = document.getElementById('compare-empty-state');
        const results = document.getElementById('compare-results-container');
        if (emptyState) emptyState.classList.remove('hidden');
        if (results) results.classList.add('hidden');
        
        // Populate Racer 2 list
        window.racerStatsTab.setupCompareSearch();
    }
};

window.closeProCompareModal = () => {
    const modal = document.getElementById('racer-pro-compare-modal');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
};

console.log('✅ RacerStatsSystem Pro loaded successfully');
