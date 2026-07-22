import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, setDoc, deleteDoc, getDoc, onSnapshot, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, setPersistence, browserLocalPersistence, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { performanceOptimizer } from "./js/modules/performance-optimizer.js";


window.toggleSidebar = () => {
    const sidebar = document.querySelector('.sidebar-admin');
    const overlay = document.getElementById('sidebar-overlay');
    const body = document.body;

    if (!sidebar) return;

    
    if (window.innerWidth >= 1024) {
        body.classList.toggle('sidebar-collapsed');
        const isCollapsed = body.classList.contains('sidebar-collapsed');
        localStorage.setItem('sidebar-collapsed', isCollapsed);
    } else {
        
        body.classList.toggle('sidebar-active');
        if (overlay) {
            overlay.classList.toggle('active');
        }
    }
};


if (window.innerWidth >= 1024 && localStorage.getItem('sidebar-collapsed') === 'true') {
    document.body.classList.add('sidebar-collapsed');
}


document.addEventListener('DOMContentLoaded', () => {
    const sidebarLinks = document.querySelectorAll('.sidebar-admin a, .sidebar-admin button');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 1024) {
                const overlay = document.getElementById('sidebar-overlay');
                document.body.classList.remove('sidebar-active');
                if (overlay) overlay.classList.remove('active');
            }
        });
    });
});


let ALL_MAPS = [];
let ALL_CARS = [];
let ALL_PETS = [];


const fetchGameDataFromFirestore = async () => {
    try {
        const normalizeTimeFormat = (timeString) => {
            if (!timeString || typeof timeString !== 'string') return null;
            const trimmed = timeString.trim();
            if (!trimmed) return null;
            if (trimmed.match(/^\d{2}'\d{2}'\d{2}$/)) return trimmed;
            if (trimmed.includes(":")) {
                const match = trimmed.match(/^(\d+):(\d+)\.?(\d+)?$/);
                if (match) {
                    const mm = match[1].padStart(2, '0');
                    const ss = match[2].padStart(2, '0');
                    const ms = (match[3] || '00').padStart(2, '0');
                    return `${mm}'${ss}'${ms}`;
                }
            }
            if (/^\d+$/.test(trimmed)) {
                const totalSeconds = timeToSeconds(trimmed);
                if (totalSeconds) return secondsToTimeString(totalSeconds);
            }
            return null;
        };

        const fetchAllData = async () => {
            const [mapsSnapshot, carsSnapshot, petsSnapshot] = await Promise.all([
                getDocs(collection(db, "gameMaps")),
                getDocs(collection(db, "gameCars")),
                getDocs(collection(db, "gamePets"))
            ]);
            
            return {
                maps: mapsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), recordTime: normalizeTimeFormat(doc.data().recordTime) })),
                cars: carsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(car => car.name),
                pets: petsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(pet => pet.name)
            };
        };

        
        const data = await performanceOptimizer.fetchWithCache('gameMasterData', fetchAllData);

        ALL_MAPS = data.maps;
        ALL_CARS = data.cars;
        ALL_PETS = data.pets;

        window.ALL_MAPS = ALL_MAPS;
        window.ALL_CARS = ALL_CARS;
        window.ALL_PETS = ALL_PETS;

        setupMapDatalist();

        return { ALL_MAPS, ALL_CARS, ALL_PETS, loadedAt: new Date().toISOString() };
    } catch (error) {
        console.error("❌ Lỗi khi tải dữ liệu từ Firestore:", error);
        displayMessage("Không thể tải dữ liệu từ Firestore. Vui lòng kiểm tra kết nối.", true);
        return { ALL_MAPS: [], ALL_CARS: [], ALL_PETS: [], error: error.message };
    }
};


const fetchRacerStatistics = async () => {
    try {


        const recordsSnapshot = await getDocs(collection(db, "raceRecords"));
        window.ALL_RACE_RECORDS = recordsSnapshot.docs.map(doc => doc.data());

        
        const racerStats = new Map();
        
        const comboStats = new Map();
        
        const mapComboStats = new Map();

        recordsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const car = (data.car || "").trim();
            const pet = (data.pet || "").trim();
            const mName = (data.mapName || "").trim();

            
            if (data.racerName) {
                const racerName = data.racerName.trim();
                racerStats.set(racerName, (racerStats.get(racerName) || 0) + 1);
            }

            
            if (car && pet) {
                const comboKey = `${car}|${pet}`;
                const comboData = comboStats.get(comboKey) || {
                    car: car,
                    pet: pet,
                    count: 0
                };
                comboData.count += 1;
                comboStats.set(comboKey, comboData);

                
                if (mName) {
                    if (!mapComboStats.has(mName)) mapComboStats.set(mName, new Map());
                    const mCombos = mapComboStats.get(mName);
                    const mComboData = mCombos.get(comboKey) || { car: car, pet: pet, count: 0 };
                    mComboData.count += 1;
                    mCombos.set(comboKey, mComboData);
                }
            }
        });

        
        const topRacers = Array.from(racerStats.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        const topCombos = Array.from(comboStats.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        
        window.MAP_COMBOS = {};
        mapComboStats.forEach((combosMap, mName) => {
            window.MAP_COMBOS[mName] = Array.from(combosMap.values())
                .sort((a, b) => b.count - a.count)
                .slice(0, 4);
        });
        console.log("📊 Đã nạp Combo cho các Map:", Object.keys(window.MAP_COMBOS));

        
        const recordHolderStats = new Map();

        
        const mapsSnapshot = await getDocs(collection(db, "gameMaps"));

        mapsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const recordRacer = data.recordRacer;
            const recordTime = data.recordTime;

            
            if (recordRacer && recordTime &&
                recordTime !== "00'00'00" &&
                recordTime !== "--'--'--") {

                const count = recordHolderStats.get(recordRacer) || 0;
                recordHolderStats.set(recordRacer, count + 1);
            }
        });

        const topRecordHolders = Array.from(recordHolderStats.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        console.log("✅ Đã tải thống kê:", {
            topRacers,
            topCombos,
            topRecordHolders
        });

        return { topRacers, topCombos, topRecordHolders };
    } catch (error) {
        console.error("❌ Lỗi khi tải thống kê:", error);
        return { topRacers: [], topCombos: [], topRecordHolders: [] };
    }
};


const firebaseConfig = {
    apiKey: "AIzaSyDtFpBAuZ_3JHmMXq1uVShq4sm0zK9xqEI",
    authDomain: "tinhdiemtheog.firebaseapp.com",
    projectId: "tinhdiemtheog",
    storageBucket: "tinhdiemtheog.firebasestorage.app",
    messagingSenderId: "52564586448",
    appId: "1:52564586448:web:983bdc321423b81f5a53d5",
    measurementId: "G-PFTMHMTF6J"
};

const getRaceDocRef = () => doc(db, "raceState", "current");

let db, auth;
let userId = null;
let isAdminUser = false;
let isAuthReady = false;
let ALL_USERS = [];
let racersCacheLoaded = false;
const NUM_RACERS = 4;
const getNumRacers = () => {
    return (raceState && raceState.is1vs1Mode) ? 2 : 4;
};
let mapIdToScroll = null;
let tempMapEdits = new Map(); 
let isEditing = false; 
let currentBOTab = 1; // Tab BO đang được chọn khi ở chế độ 1vs1
let scoreboardBOTab = 1; // Tab BO của bảng tổng kết
window._scoreboardBOTabUserOverride = false;


const defaultMapData = () => ({
    id: crypto.randomUUID(),
    name: '',
    times: new Array(getNumRacers()).fill(null),
    cars: new Array(getNumRacers()).fill(null),
    pets: new Array(getNumRacers()).fill(null),
});

const defaultState = {
    racers: [
        { name: '', kingMap: '', banMaps: ['', ''] },
        { name: '', kingMap: '', banMaps: ['', ''] },
        { name: '', kingMap: '', banMaps: ['', ''] },
        { name: '', kingMap: '', banMaps: ['', ''] },
    ],
    firstMapBtc: '',
    maps: [],
    version: 8, 
    isTeamMode: false,
    is1vs1Mode: false,
    teamNames: ['Team 1', 'Team 2'],
    bo1vs1Format: 'BO9' // 'BO9' = chạm 5 thắng, 'BO7' = chạm 4 thắng
};

let raceState = defaultState;


const setupMapDatalist = () => {
    
    const mapDatalist = document.getElementById('map-suggestions');
    const carDatalist = document.getElementById('car-suggestions');
    const petDatalist = document.getElementById('pet-suggestions');

    if (!mapDatalist || !carDatalist || !petDatalist) {
        console.warn("Không tìm thấy các datalist, sẽ thử lại sau");
        return;
    }

    
    mapDatalist.innerHTML = ALL_MAPS.map(map => `<option value="${map.name}">${map.name}</option>`).join('');
    carDatalist.innerHTML = ALL_CARS.map(car => `<option value="${car.name}">${car.name}</option>`).join('');
    petDatalist.innerHTML = ALL_PETS.map(pet => `<option value="${pet.name}">${pet.name}</option>`).join('');
};

const timeToSeconds = (timeString) => {
    if (!timeString || typeof timeString !== 'string') return null;
    timeString = timeString.trim();

    const match = timeString.match(/(\d+)'(\d+)'(\d+)/);
    if (match) {
        const minutes = parseInt(match[1]) || 0;
        const seconds = parseInt(match[2]) || 0;
        const milliseconds = parseInt(match[3]) || 0;
        let totalSeconds = minutes * 60 + seconds;
        totalSeconds += milliseconds / 100;
        return totalSeconds > 0 ? totalSeconds : null;
    }

    if (timeString.length >= 5 && /^\d+$/.test(timeString)) {
        let ms = parseInt(timeString.slice(-2));
        let ss = parseInt(timeString.slice(-4, -2));
        let mm = parseInt(timeString.slice(0, -4));
        let totalSeconds = mm * 60 + ss + (ms / 100);
        return totalSeconds > 0 ? totalSeconds : null;
    }
    return null;
};

const secondsToTimeString = (totalSeconds) => {
    if (totalSeconds === null || totalSeconds === undefined || totalSeconds <= 0) return "--'--'--";
    const totalMs = Math.round(totalSeconds * 100);
    const ms = totalMs % 100;
    const totalS = Math.floor(totalMs / 100);
    const seconds = totalS % 60;
    const minutes = Math.floor(totalS / 60);
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(minutes)}'${pad(seconds)}'${pad(ms)}`;
}

const displayMessage = (message, isError = false) => {
    showStatusMessage(message, isError);
};

const saveRaceState = async (newState) => {
    const stateToSave = newState;
    try {
        await setDoc(getRaceDocRef(), stateToSave, { merge: false });
    } catch (error) {
        console.error("Lỗi khi lưu trạng thái:", error);
        displayMessage("Lỗi khi lưu dữ liệu!", true);
    }
};


window.handleResetAllRecords = async () => {
    if (!confirm("⚠️ CẢNH BÁO: Bạn có chắc chắn muốn thiết lập lại record của TẤT CẢ các map về 00'00'00 không?\n\nHành động này sẽ xóa tất cả kỷ lục hiện có và không thể hoàn tác!")) {
        return;
    }

    try {
        
        displayMessage("⏳ Đang thiết lập lại record của tất cả các map...", false);

        
        let updatedCount = 0;

        for (const map of ALL_MAPS) {
            try {
                
                await setDoc(doc(db, "gameMaps", map.id), {
                    recordTime: "00'00'00",
                    recordRacer: "",
                    recordCar: "",
                    recordPet: "",
                    recordRacerIndex: -1
                }, { merge: true });

                updatedCount++;
                console.log(`Đã reset record cho map: ${map.name}`);
            } catch (error) {
                console.error(`Lỗi khi reset record cho map ${map.name}:`, error);
            }
        }

        
        await fetchGameDataFromFirestore();

        
        updateStatistics();

        
        const successMessage = `✅ Đã làm mới record của ${updatedCount} map về 00'00'00`;
        displayMessage(successMessage, false);

        
        console.log(`Đã reset record cho ${updatedCount}/${ALL_MAPS.length} map`);

    } catch (error) {
        console.error("Lỗi khi làm mới record:", error);
        displayMessage("❌ Có lỗi xảy ra khi làm mới record. Vui lòng thử lại!", true);
    }
};




const checkAndUpdateRecordForLatestMap = async () => {
    try {
        const stats = calculateStatistics();

        
        if (stats.latestCompletedMapIndex >= 0) {
            const latestMap = raceState.maps[stats.latestCompletedMapIndex];

            
            const activeTimes = latestMap.times ? latestMap.times.slice(0, getNumRacers()) : [];
            const isMapCompleted = activeTimes.length > 0 && activeTimes.every(time => {
                return time && time.trim() && time.trim() !== "--'--'--" && timeToSeconds(time) > 0;
            });

            if (!isMapCompleted) {
                console.log(`Map ${latestMap.name} chưa hoàn thành, bỏ qua kiểm tra record`);
                return;
            }

            const timesInSeconds = activeTimes.map(timeToSeconds);
            const validTimes = timesInSeconds.filter(t => t > 0);

            if (validTimes.length === getNumRacers()) { 
                const bestTimeInMap = Math.min(...validTimes);
                const bestRacerIndexInMap = timesInSeconds.indexOf(bestTimeInMap);

                
                const bestCar = latestMap.cars && latestMap.cars[bestRacerIndexInMap] || '';
                const bestPet = latestMap.pets && latestMap.pets[bestRacerIndexInMap] || '';
                const bestRacerName = raceState.racers[bestRacerIndexInMap]?.name || `Tay Đua ${bestRacerIndexInMap + 1}`;

                
                const mapKey = `checked_${latestMap.name}_${stats.latestCompletedMapIndex}`;
                const lastCheckedTime = localStorage.getItem(mapKey);
                const now = Date.now();

                
                if (!lastCheckedTime || (now - parseInt(lastCheckedTime) > 30000)) {
                    
                    const isUpdated = await updateMapRecord(latestMap.name, {
                        timeInSeconds: bestTimeInMap,
                        timeString: secondsToTimeString(bestTimeInMap),
                        racerName: bestRacerName,
                        racerIndex: bestRacerIndexInMap,
                        car: bestCar,
                        pet: bestPet,
                        timestamp: new Date().toISOString()
                    });

                    if (isUpdated) {
                        displayMessage(`🎉 Đã cập nhật kỷ lục mới cho ${map.name}: ${secondsToTimeString(bestTimeInMap)}! (Xe: ${bestCar}, Pet: ${bestPet})`, false);
                        
                        await fetchGameDataFromFirestore();
                        
                        updateStatistics();

                        
                        const mapRow = document.getElementById(`map-row-${map.id}`);
                        if (mapRow) {
                            mapRow.classList.add('record-updated');
                            setTimeout(() => {
                                mapRow.classList.remove('record-updated');
                            }, 2000);
                        }
                    }
                    
                    localStorage.setItem(mapKey, now.toString());
                } else {
                    console.log(`Đã kiểm tra record cho ${latestMap.name} gần đây, bỏ qua`);
                }
            }
        }
    } catch (error) {
        console.error("Lỗi khi kiểm tra và cập nhật record:", error);
    }
};


const recentNotifications = new Map();
const NOTIFICATION_COOLDOWN = 5000; 


const isDuplicateNotification = (notificationData) => {
    const key = `${notificationData.type}_${notificationData.content || notificationData.message}`;

    if (recentNotifications.has(key)) {
        const lastTime = recentNotifications.get(key);
        const now = Date.now();

        
        if (now - lastTime < NOTIFICATION_COOLDOWN) {
            console.log(`⚠️ Bỏ qua thông báo trùng lặp: ${key}`);
            return true;
        }
    }

    
    recentNotifications.set(key, Date.now());

    
    setTimeout(() => {
        recentNotifications.delete(key);
    }, 10000);

    return false;
};


const sendNotificationToAllUsers = async (notificationData) => {
    try {
        
        if (isDuplicateNotification(notificationData)) {
            console.log("Thông báo đã được gửi gần đây, bỏ qua");
            return true;
        }

        const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const notificationToSave = {
            title: notificationData.title || "Thông báo",
            content: notificationData.content || notificationData.message || "",
            type: notificationData.type || "info",
            target: notificationData.target || "all",
            important: notificationData.important || false,
            sender: notificationData.sender || "Hệ thống",
            senderId: notificationData.senderId || "system",
            read: false,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            extraData: notificationData.extraData || null
        };

        
        const usersSnapshot = await getDocs(collection(db, "users"));
        const batch = [];

        usersSnapshot.docs.forEach(userDoc => {
            const userNotificationRef = doc(db, "users", userDoc.id, "notifications", notificationId);
            batch.push(setDoc(userNotificationRef, notificationToSave));
        });

        if (batch.length > 0) {
            await Promise.all(batch);
            console.log(`✅ Đã gửi thông báo tới ${batch.length} người dùng:`, notificationToSave);
        } else {
            
            
            await setDoc(doc(db, "notifications", notificationId), notificationToSave);
            console.warn("⚠️ Không tìm thấy người dùng nào trong DB, lưu vào global notifications");
        }

        return true;
    } catch (error) {
        console.error("❌ Lỗi khi gửi thông báo:", error);
        return false;
    }
};

const normalizeTimeFormat = (timeString) => {
    if (!timeString) return "--'--'--";

    const trimmed = timeString.trim();

    
    if (trimmed.includes("'")) {
        return trimmed;
    }

    
    if (trimmed.includes(":")) {
        return trimmed.replace(':', "'").replace('.', "'");
    }

    
    if (/^\d+$/.test(trimmed)) {
        const totalSeconds = timeToSeconds(trimmed);
        return secondsToTimeString(totalSeconds);
    }

    return trimmed;
};


const calculateStatistics = () => {
    const stats = {
        completedMaps: 0,
        latestCompletedMap: null,
        latestCompletedMapName: "Chưa có",
        latestCompletedMapIndex: -1,
        latestCompletedMapImageUrl: null,
        latestCompletedMapDescription: "Map mới nhất", 
        bestTimeInLatestMap: null,
        bestTimeInLatestMapString: "--'--'--",
        bestTimeRacerInLatestMap: "-",
        bestTimeCarInLatestMap: "-",
        bestTimePetInLatestMap: "-",
        currentRunningMap: null,
        currentMapRecordTime: "--'--'--",
        currentMapRecordRacer: "-",
        currentMapRecordCar: "-",
        currentMapRecordPet: "-"
    };

    
    let latestCompletedIndex = -1;

    raceState.maps.forEach((map, index) => {
        const hasAllTimes = map.times && map.times.every(time =>
            time && time.trim() && time.trim() !== "--'--'--" && timeToSeconds(time) > 0
        );

        if (hasAllTimes) {
            stats.completedMaps++;

            
            if (index > latestCompletedIndex) {
                latestCompletedIndex = index;
                stats.latestCompletedMap = map.name;
                stats.latestCompletedMapName = map.name;
                stats.latestCompletedMapIndex = index;

                
                const mapInfo = ALL_MAPS.find(m => (m.name || "").trim() === (map.name || "").trim());
                if (mapInfo) {
                    if (mapInfo.imageUrl) {
                        stats.latestCompletedMapImageUrl = mapInfo.imageUrl;
                    }
                    if (mapInfo.description) {
                        stats.latestCompletedMapDescription = mapInfo.description;
                    }
                }
            }
        }
    });

    
    if (stats.latestCompletedMapIndex >= 0) {
        const latestMap = raceState.maps[stats.latestCompletedMapIndex];
        const timesInSeconds = latestMap.times.map(timeToSeconds);
        const validTimes = timesInSeconds.filter(t => t > 0);

        if (validTimes.length > 0) {
            const bestTimeInMap = Math.min(...validTimes);
            const bestRacerIndexInMap = timesInSeconds.indexOf(bestTimeInMap);

            stats.bestTimeInLatestMap = bestTimeInMap;
            stats.bestTimeInLatestMapString = secondsToTimeString(bestTimeInMap);
            stats.bestTimeRacerInLatestMap = raceState.racers[bestRacerIndexInMap]?.name || `Tay Đua ${bestRacerIndexInMap + 1}`;

            
            if (latestMap.cars && latestMap.cars[bestRacerIndexInMap]) {
                stats.bestTimeCarInLatestMap = latestMap.cars[bestRacerIndexInMap];
            }

            if (latestMap.pets && latestMap.pets[bestRacerIndexInMap]) {
                stats.bestTimePetInLatestMap = latestMap.pets[bestRacerIndexInMap];
            }
        }
    }

    
    for (let i = 0; i < raceState.maps.length; i++) {
        const map = raceState.maps[i];
        const hasAllTimes = map.times && map.times.every(time =>
            time && time.trim() && time.trim() !== "--'--'--" && timeToSeconds(time) > 0
        );

        if (!hasAllTimes) {
            stats.currentRunningMap = map.name;

            
            const mapInfo = ALL_MAPS.find(m => (m.name || "").trim() === (map.name || "").trim());
            if (mapInfo) {
                stats.currentMapRecordTime = mapInfo.recordTime || "--'--'--";
                stats.currentMapRecordRacer = mapInfo.recordRacer || "-";
                stats.currentMapRecordCar = mapInfo.recordCar || "-";
                stats.currentMapRecordPet = mapInfo.recordPet || "-";
            }
            break;
        }
    }

    
    if (stats.completedMaps === raceState.maps.length && raceState.maps.length > 0) {
        stats.currentRunningMap = "Chưa có (Đã hoàn thành tất cả)";
    }

    
    for (let i = 0; i < raceState.maps.length; i++) {
        const map = raceState.maps[i];
        const hasAllTimes = map.times && map.times.every(time =>
            time && time.trim() && time.trim() !== "--'--'--" && timeToSeconds(time) > 0
        );

        if (!hasAllTimes) {
            stats.currentRunningMap = map.name;

            
            const mapInfo = ALL_MAPS.find(m => (m.name || "").trim() === (map.name || "").trim());
            if (mapInfo && mapInfo.recordTime) {
                
                let recordTimeFormatted = mapInfo.recordTime;
                if (recordTimeFormatted.includes(":")) {
                    
                    recordTimeFormatted = recordTimeFormatted.replace(':', "'").replace('.', "'");
                }

                stats.currentMapRecordTime = recordTimeFormatted;
                stats.currentMapRecordRacer = mapInfo.recordRacer || "-";
                stats.currentMapRecordCar = mapInfo.recordCar || "-";
                stats.currentMapRecordPet = mapInfo.recordPet || "-";
            }
            break;
        }
    }

    return stats;
};

const updateStatistics = () => {
    const stats = calculateStatistics();

    
    document.getElementById('completed-maps-count').textContent = stats.completedMaps;

    
    const mapNameElement = document.getElementById('latest-completed-map-name');
    const mapImageElement = document.getElementById('latest-map-image');
    const mapPlaceholderElement = document.getElementById('latest-map-placeholder');
    const mapImageContainer = document.getElementById('latest-completed-map-image');
    const statsCard = mapImageContainer.closest('.stats-card');
    const mapIndicator = document.getElementById('map-indicator');

    
    const mapDescriptionElement = document.getElementById('latest-map-description');

    if (stats.latestCompletedMapName !== "Chưa có" && stats.latestCompletedMapName) {
        mapNameElement.textContent = stats.latestCompletedMapName;

        
        if (mapDescriptionElement) {
            mapDescriptionElement.textContent = stats.latestCompletedMapDescription || "Chi tiết map";

            
            if (stats.latestCompletedMapDescription && stats.latestCompletedMapDescription.length > 30) {
                mapDescriptionElement.setAttribute('data-tooltip', stats.latestCompletedMapDescription);
                mapDescriptionElement.style.cursor = 'help';
            } else {
                mapDescriptionElement.removeAttribute('data-tooltip');
                mapDescriptionElement.style.cursor = 'default';
            }
        }

        if (stats.latestCompletedMapImageUrl) {
            
            statsCard.classList.add('has-map-image');
            if (mapIndicator) mapIndicator.classList.remove('hidden');

            mapImageElement.src = stats.latestCompletedMapImageUrl;
            mapImageElement.alt = stats.latestCompletedMapName;
            mapImageElement.style.display = 'block';
            mapPlaceholderElement.style.display = 'none';

            
            mapImageElement.style.opacity = '0';
            mapImageElement.style.transition = 'opacity 0.8s ease';

            mapImageElement.onload = function () {
                setTimeout(() => {
                    mapImageElement.style.opacity = '1';

                    
                    if (gsap) {
                        gsap.to(mapImageContainer, {
                            duration: 1,
                            boxShadow: "0 0 25px rgba(0, 243, 255, 0.4), 0 0 40px rgba(0, 102, 255, 0.2)",
                            ease: "power2.out"
                        });
                    }
                }, 100);
            };

            
            mapImageElement.onerror = function () {
                console.warn(`Không thể tải hình ảnh map: ${stats.latestCompletedMapImageUrl}`);
                statsCard.classList.remove('has-map-image');
                if (mapIndicator) mapIndicator.classList.add('hidden');
                mapImageElement.style.display = 'none';
                mapPlaceholderElement.style.display = 'flex';
                mapPlaceholderElement.innerHTML = `<i class="fas fa-map text-cyan-400 text-2xl"></i>`;
            };
        } else {
            statsCard.classList.remove('has-map-image');
            if (mapIndicator) mapIndicator.classList.add('hidden');
            mapImageElement.style.display = 'none';
            mapPlaceholderElement.style.display = 'flex';
            mapPlaceholderElement.innerHTML = `<i class="fas fa-map text-cyan-400 text-2xl"></i>`;
        }
    } else {
        statsCard.classList.remove('has-map-image');
        if (mapIndicator) mapIndicator.classList.add('hidden');
        mapNameElement.textContent = "Chưa có";

        
        if (mapDescriptionElement) {
            mapDescriptionElement.textContent = "Chưa có map hoàn thành";
        }

        mapImageElement.style.display = 'none';
        mapPlaceholderElement.style.display = 'flex';
        mapPlaceholderElement.innerHTML = `<i class="fas fa-map text-slate-600 text-2xl"></i>`;
    }

    
    document.getElementById('best-time').textContent = stats.bestTimeInLatestMapString;

    
    if (stats.bestTimeRacerInLatestMap !== "-") {
        document.getElementById('best-time-racer').textContent = stats.bestTimeRacerInLatestMap;
        document.getElementById('best-time-car').textContent = stats.bestTimeCarInLatestMap !== "-" ? stats.bestTimeCarInLatestMap : "Chưa có";
        document.getElementById('best-time-pet').textContent = stats.bestTimePetInLatestMap !== "-" ? stats.bestTimePetInLatestMap : "Chưa có";
    } else {
        document.getElementById('best-time-racer').textContent = "-";
        document.getElementById('best-time-car').textContent = "-";
        document.getElementById('best-time-pet').textContent = "-";
    }

    
    const nextMapImageContainer = document.getElementById('next-map-image-container');
    const nextMapImage = document.getElementById('next-map-image-content');
    const nextMapPlaceholder = document.getElementById('next-map-placeholder');
    const nextMapName = document.getElementById('next-map-name');
    const difficultyBadge = document.getElementById('next-map-difficulty').querySelector('span');
    const difficultyText = document.getElementById('difficulty-text');

    
    let nextMap = null;
    for (let i = 0; i < raceState.maps.length; i++) {
        const map = raceState.maps[i];
        const hasAllTimes = map.times && map.times.every(time =>
            time && time.trim() && time.trim() !== "--'--'--" && timeToSeconds(time) > 0
        );

        if (!hasAllTimes) {
            nextMap = map;
            break;
        }
    }

    if (nextMap) {
        
        document.getElementById('current-running-map').textContent = nextMap.name;

        
        const mapInfo = ALL_MAPS.find(m => (m.name || "").trim() === (nextMap.name || "").trim());

        
        if (nextMapName) {
            nextMapName.textContent = nextMap.name;
        }

        
        if (mapInfo && mapInfo.difficulty) {
            const difficulty = mapInfo.difficulty.toLowerCase();
            const difficultyClasses = {
                'easy': 'difficulty-easy',
                'dễ': 'difficulty-easy',
                '3 sao': 'difficulty-easy',
                'dễ (3 sao)': 'difficulty-easy',
                'medium': 'difficulty-medium',
                'trung bình': 'difficulty-medium',
                '4 sao': 'difficulty-medium',
                'trung bình (4 sao)': 'difficulty-medium',
                'hard': 'difficulty-hard',
                'khó': 'difficulty-hard',
                '5 sao': 'difficulty-hard',
                'khó (5 sao)': 'difficulty-hard',
                'expert': 'difficulty-expert',
                'rất khó': 'difficulty-expert',
                '6 sao': 'difficulty-expert',
                'rất khó (6 sao)': 'difficulty-expert',
                'extreme': 'difficulty-extreme',
                'cực khó': 'difficulty-extreme',
                '7 sao': 'difficulty-extreme',
                'cực khó (7 sao)': 'difficulty-extreme'
            };

            
            Object.values(difficultyClasses).forEach(cls => {
                difficultyBadge.classList.remove(cls);
            });

            
            const difficultyClass = difficultyClasses[difficulty] || 'difficulty-medium';
            difficultyBadge.classList.add(difficultyClass);

            
            if (difficultyText) {
                let starCount = 3;
                if (difficulty.includes('3 sao') || difficulty.includes('dễ') || difficulty.includes('easy')) {
                    starCount = 3;
                } else if (difficulty.includes('4 sao') || difficulty.includes('trung bình') || difficulty.includes('medium')) {
                    starCount = 4;
                } else if (difficulty.includes('5 sao') || difficulty.includes('khó') || difficulty.includes('hard')) {
                    starCount = 5;
                } else if (difficulty.includes('6 sao') || difficulty.includes('rất khó') || difficulty.includes('expert')) {
                    starCount = 6;
                } else if (difficulty.includes('7 sao') || difficulty.includes('cực khó') || difficulty.includes('extreme')) {
                    starCount = 7;
                } else {
                    starCount = 0;
                }

                if (starCount > 0) {
                    let starsHTML = '';
                    for (let i = 0; i < starCount; i++) {
                        starsHTML += `<i class="fas fa-star text-yellow-400 text-2xl drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]"></i>`;
                    }
                    difficultyBadge.innerHTML = `<span class="flex items-center gap-1">${starsHTML}</span>`;
                } else {
                    difficultyBadge.innerHTML = `<span class="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-white text-[10px] flex items-center border border-white/10"><i class="fas fa-signal mr-1"></i>${mapInfo.difficulty}</span>`;
                }
            }
        } else {
            
            difficultyBadge.className = 'text-xs px-3 py-1 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700';
            if (difficultyText) {
                difficultyText.textContent = "Không xác định";
            }
        }

        if (mapInfo && mapInfo.imageUrl) {
            
            nextMapImageContainer.classList.add('has-next-map-image');

            nextMapImage.src = mapInfo.imageUrl;
            nextMapImage.alt = nextMap.name;
            nextMapImage.style.display = 'block';
            nextMapPlaceholder.style.display = 'none';

            
            nextMapImage.style.opacity = '0';
            nextMapImage.style.transition = 'opacity 0.8s ease';

            nextMapImage.onload = function () {
                setTimeout(() => {
                    nextMapImage.style.opacity = '1';

                    
                    if (gsap) {
                        gsap.to(document.getElementById('next-map-image'), {
                            duration: 1,
                            boxShadow: "0 0 25px rgba(0, 243, 255, 0.4), 0 0 40px rgba(0, 102, 255, 0.2)",
                            ease: "power2.out"
                        });
                    }
                }, 100);
            };

            
            nextMapImage.onerror = function () {
                console.warn(`Không thể tải hình ảnh map: ${mapInfo.imageUrl}`);
                nextMapImageContainer.classList.remove('has-next-map-image');
                nextMapImage.style.display = 'none';
                nextMapPlaceholder.style.display = 'flex';
                nextMapPlaceholder.innerHTML = `
                    <i class="fas fa-map-marked-alt text-3xl text-cyan-400 mb-2"></i>
                    <span class="text-xs text-slate-400 text-center px-2">${nextMap.name}</span>
                `;
            };
        } else {
            nextMapImageContainer.classList.remove('has-next-map-image');
            nextMapImage.style.display = 'none';
            nextMapPlaceholder.style.display = 'flex';
            nextMapPlaceholder.innerHTML = `
                <i class="fas fa-map-marked-alt text-3xl text-cyan-400 mb-2"></i>
                <span class="text-xs text-slate-400 text-center px-2">${nextMap.name}</span>
            `;
        }
    } else {
        
        document.getElementById('current-running-map').textContent = "Đã hoàn thành tất cả";
        if (nextMapName) {
            nextMapName.textContent = "Đã hoàn thành";
        }

        
        difficultyBadge.className = 'text-xs px-3 py-1 rounded-full font-bold bg-slate-800 text-slate-300 border border-slate-700';
        if (difficultyText) {
            difficultyText.textContent = "Đã hoàn thành";
            difficultyBadge.innerHTML = `<i class="fas fa-flag-checkered mr-1 text-green-400"></i><span id="difficulty-text">Đã hoàn thành</span>`;
        }

        nextMapImageContainer.classList.remove('has-next-map-image');
        nextMapImage.style.display = 'none';
        nextMapPlaceholder.style.display = 'flex';
        nextMapPlaceholder.innerHTML = `
            <i class="fas fa-flag-checkered text-3xl text-green-400 mb-2"></i>
            <span class="text-xs text-slate-400 text-center px-2">Đã hoàn thành tất cả map</span>
        `;
    }

    
    if (stats.currentMapRecordTime !== "--'--'--" && stats.currentMapRecordTime !== "00'00'00") {
        
        const timeValueElement = document.getElementById('current-best-time-value');
        if (timeValueElement) {
            timeValueElement.textContent = stats.currentMapRecordTime;
        }

        
        const bestRacerElement = document.getElementById('current-best-racer');
        if (bestRacerElement) {
            
            const racerName = stats.currentMapRecordRacer;
            const userInfo = ALL_USERS.find(u =>
                (u.nickname && u.nickname.trim() === racerName.trim()) ||
                (u.displayName && u.displayName.trim() === racerName.trim())
            );

            const avatarSrc = (userInfo && userInfo.photoBase64) ? userInfo.photoBase64 :
                (userInfo && userInfo.photoURL && userInfo.photoURL !== 'logoWS.png') ? userInfo.photoURL : null;

            const userAvatar = avatarSrc ?
                `<img src="${avatarSrc}" class="w-8 h-8 rounded-full object-cover border-2 border-white/20 shadow-lg animate-pulse-subtle" alt="avatar">` :
                `<div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 opacity-70">
                    <i class="fas fa-user-ninja text-slate-500 text-xs"></i>
                </div>`;

            bestRacerElement.innerHTML = `
                <div class="flex items-center space-x-3 justify-end group cursor-help">
                    <div class="text-right">
                        <div class="text-xs font-black text-white truncate leading-tight group-hover:text-cyan-400 transition-colors">${stats.currentMapRecordRacer}</div>
                        <div class="text-[8px] text-slate-500 uppercase tracking-widest font-black opacity-60">Record Holder</div>
                    </div>
                    ${userAvatar}
                </div>
            `;
        }

        
        const bestCarElement = document.getElementById('current-best-car');
        if (bestCarElement) {
            const carInfo = ALL_CARS.find(c => c.name === stats.currentMapRecordCar);
            const carIcon = carInfo && carInfo.imageUrl ?
                `<img src="${carInfo.imageUrl}" class="w-5 h-5 object-contain mr-1 inline-block" alt="car">` :
                `<i class="fas fa-car mr-1 text-cyan-400"></i>`;

            bestCarElement.innerHTML = `
                ${carIcon}
                <span>${stats.currentMapRecordCar !== "-" ? stats.currentMapRecordCar : "Không có"}</span>
            `;
        }

        const bestPetElement = document.getElementById('current-best-pet');
        if (bestPetElement) {
            const petInfo = ALL_PETS.find(p => p.name === stats.currentMapRecordPet);
            const petIcon = petInfo && petInfo.imageUrl ?
                `<img src="${petInfo.imageUrl}" class="w-5 h-5 object-contain mr-1 inline-block" alt="pet">` :
                `<i class="fas fa-paw mr-1 text-purple-400"></i>`;

            bestPetElement.innerHTML = `
                ${petIcon}
                <span>${stats.currentMapRecordPet !== "-" ? stats.currentMapRecordPet : "Không có"}</span>
            `;
        }

        const equipmentContainer = document.getElementById('current-best-equipment');
        if (equipmentContainer) {
            equipmentContainer.classList.remove('hidden');
        }
    } else if (stats.currentMapRecordTime === "00'00'00") {
        document.getElementById('current-best-time-value').textContent = "00'00'00";
        document.getElementById('current-best-racer').innerHTML = `
            <div class="flex items-center space-x-2 justify-end opacity-50">
                <span class="text-[10px] font-bold text-slate-500 italic">No Record</span>
                <i class="fas fa-user-circle text-slate-700 text-xl"></i>
            </div>
        `;
        document.getElementById('current-best-car').innerHTML = `
            <i class="fas fa-car mr-1 text-slate-500"></i>
            <span class="text-slate-500">-</span>
        `;
        document.getElementById('current-best-pet').innerHTML = `
            <i class="fas fa-paw mr-1 text-slate-500"></i>
            <span class="text-slate-500">-</span>
        `;
    } else {
        
        document.getElementById('current-best-time-value').textContent = "--'--'--";
        document.getElementById('current-best-racer').innerHTML = `
            <div class="flex items-center space-x-2 justify-end opacity-30">
                <span class="text-[10px] font-bold text-slate-500">-</span>
                <i class="fas fa-user-circle text-slate-700 text-xl"></i>
            </div>
        `;
        document.getElementById('current-best-car').innerHTML = `
            <i class="fas fa-car mr-1 text-cyan-400"></i>
            <span>-</span>
        `;
        document.getElementById('current-best-pet').innerHTML = `
            <i class="fas fa-paw mr-1 text-purple-400"></i>
            <span>-</span>
        `;
    }

    
    const racerCountEl = document.getElementById('racer-count-badge');
    if (racerCountEl) {
        racerCountEl.textContent = getNumRacers();
    }

    
    const mapCountEl = document.getElementById('map-count');
    if (mapCountEl) {
        mapCountEl.textContent = raceState.maps.length;
    }

    
    const progressBar = document.getElementById('race-progress-bar');
    if (progressBar && raceState.maps.length > 0) {
        const progress = (stats.completedMapsCount / raceState.maps.length) * 100;
        progressBar.style.width = `${progress}%`;
    }
};


const renderHallOfFame = async () => {
    const topRacersList = document.getElementById('top-racers-list');
    const topCombosList = document.getElementById('top-combos-list');
    const topRecordHoldersList = document.getElementById('top-record-holders-list');

    if (!topRacersList || !topCombosList || !topRecordHoldersList) return;

    try {
        const { topRacers, topCombos, topRecordHolders } = await fetchRacerStatistics();

        
        if (topRacers.length === 0) {
            topRacersList.innerHTML = `
                <div class="text-center text-slate-500 py-3">
                    <i class="fas fa-inbox text-xl mb-2"></i>
                    <p class="text-xs">Chưa có dữ liệu</p>
                </div>
            `;
        } else {
            topRacersList.innerHTML = topRacers.map((racer, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                const medal = medals[index] || '';
                const bgClass = 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10';

                
                const userInfo = ALL_USERS.find(u =>
                    (u.nickname && u.nickname.trim() === racer.name.trim()) ||
                    (u.displayName && u.displayName.trim() === racer.name.trim())
                );

                const avatarSrc = (userInfo && userInfo.photoBase64) ? userInfo.photoBase64 :
                    (userInfo && userInfo.photoURL && userInfo.photoURL !== 'logoWS.png') ? userInfo.photoURL : null;

                const userAvatar = avatarSrc ?
                    `<img src="${avatarSrc}" class="w-8 h-8 rounded-lg object-cover border border-white/10 shadow-lg" alt="avatar">` :
                    `<span class="text-xl w-8 h-8 flex items-center justify-center bg-black/20 rounded-lg flex-shrink-0 font-bold text-white shadow-inner">
                        ${medal || index + 1}
                    </span>`;
                return `
                    <div class="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r ${bgClass} border hover:scale-[1.02] transition-all duration-300 cursor-pointer shadow-lg hover:shadow-amber-500/10"
                         onclick="openRacerMatchesModal('${racer.name.replace(/'/g, "\\\'")}')">
                        <div class="flex items-center space-x-3 flex-1 min-w-0">
                            ${userAvatar}
                            <div class="min-w-0 flex-1">
                                <div class="font-black text-white text-sm truncate uppercase tracking-tight">${racer.name}</div>
                                <div class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${racer.count} Trận Đấu</div>
                            </div>
                        </div>
                        <div class="flex space-x-0.5 text-[8px] opacity-50">
                            ${index < 3 ? '⭐⭐⭐' : '⭐'}
                        </div>
                    </div>
                `;            }).join('');
        }

        
        if (topRecordHolders.length === 0) {
            topRecordHoldersList.innerHTML = `
        <div class="text-center text-slate-500 py-3">
            <i class="fas fa-inbox text-xl mb-2"></i>
            <p class="text-xs">Chưa có dữ liệu</p>
        </div>
    `;
        } else {
            topRecordHoldersList.innerHTML = topRecordHolders.map((holder, index) => {
                const crowns = ['👑', '🏆', '🎖️'];
                const crown = crowns[index] || '';
                const bgClass = 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'; 

                
                const holderName = holder.name;
                const userInfo = ALL_USERS.find(u =>
                    (u.nickname && u.nickname.trim() === holderName.trim()) ||
                    (u.displayName && u.displayName.trim() === holderName.trim())
                );

                const avatarSrc = (userInfo && userInfo.photoBase64) ? userInfo.photoBase64 :
                    (userInfo && userInfo.photoURL && userInfo.photoURL !== 'logoWS.png') ? userInfo.photoURL : null;

                const userAvatar = avatarSrc ?
                    `<img src="${avatarSrc}" class="w-8 h-8 rounded-lg object-cover border border-white/10 shadow-lg" alt="avatar">` :
                    `<span class="text-xl w-8 h-8 flex items-center justify-center bg-black/20 rounded-lg flex-shrink-0 shadow-inner">
                        ${crown || index + 1}
                    </span>`;

                return `
                    <div class="flex items-center justify-between p-3 rounded-xl ${bgClass} border hover:scale-[1.02] transition-all duration-300 cursor-pointer shadow-lg hover:shadow-cyan-500/10"
                         onclick="openRecordHolderModal('${holder.name.replace(/'/g, "\\\'")}')">
                        <div class="flex items-center space-x-3 flex-1 min-w-0">
                            ${userAvatar}
                            <div class="min-w-0 flex-1">
                                <div class="font-black text-white text-sm truncate uppercase tracking-tight">${holder.name}</div>
                                <div class="text-[10px] text-white/50 font-black uppercase tracking-widest">${holder.count} Kỷ Lục</div>
                            </div>
                        </div>
                        <i class="fas fa-chevron-right text-[10px] text-slate-700"></i>
                    </div>
                `;
            }).join('');
        }

        
        if (topCombos.length === 0) {
            topCombosList.innerHTML = `
                <div class="text-center text-slate-500 py-3">
                    <i class="fas fa-inbox text-xl mb-2"></i>
                    <p class="text-xs">Chưa có dữ liệu</p>
                </div>
            `;
        } else {
            topCombosList.innerHTML = topCombos.map((combo, index) => {
                const bgClass = index === 0 ? 'from-purple-500/10 to-pink-500/5 border-purple-500/20' : 'from-slate-800/20 to-slate-700/10 border-slate-700/30';

                return `
                    <div class="p-3 rounded-xl bg-gradient-to-br ${bgClass} border hover:scale-[1.02] transition-all duration-300 group">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em]">Rank #${index + 1}</span>
                            <span class="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-black">
                                ${combo.count} Lần sử dụng
                            </span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 min-w-0">
                            <div class="flex items-center bg-black/30 p-2 rounded-lg border border-slate-800/50 min-w-0">
                                ${(() => {
                        const carInfo = ALL_CARS.find(c => (c.name || '').trim() === (combo.car || '').trim());
                        return carInfo && carInfo.imageUrl ?
                            `<img src="${carInfo.imageUrl}" class="w-8 h-8 object-contain mr-2 flex-shrink-0 group-hover:scale-110 transition-transform" alt="car">` :
                            `<i class="fas fa-car text-cyan-400 mr-2 flex-shrink-0"></i>`;
                    })()}
                                <span class="text-white text-[10px] font-bold truncate flex-1 min-w-0">${combo.car}</span>
                            </div>
                            <div class="flex items-center bg-black/30 p-2 rounded-lg border border-slate-800/50 min-w-0">
                                ${(() => {
                        const petInfo = ALL_PETS.find(p => (p.name || '').trim() === (combo.pet || '').trim());
                        return petInfo && petInfo.imageUrl ?
                            `<img src="${petInfo.imageUrl}" class="w-8 h-8 object-contain mr-2 flex-shrink-0 group-hover:scale-110 transition-transform" alt="pet">` :
                            `<i class="fas fa-paw text-pink-400 mr-2 flex-shrink-0"></i>`;
                    })()}
                                <span class="text-white text-[10px] font-bold truncate flex-1 min-w-0">${combo.pet}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Stagger entrance animation for Hall of Fame items
        if (typeof gsap !== 'undefined') {
            gsap.from("#top-racers-list > div", {
                opacity: 0,
                x: -30,
                duration: 0.5,
                stagger: 0.05,
                ease: "power2.out"
            });
            gsap.from("#top-record-holders-list > div", {
                opacity: 0,
                x: 30,
                duration: 0.5,
                stagger: 0.05,
                ease: "power2.out"
            });
            gsap.from("#top-combos-list > div", {
                opacity: 0,
                y: 30,
                duration: 0.5,
                stagger: 0.1,
                ease: "power2.out"
            });
        }

    } catch (error) {
        console.error("❌ Lỗi khi render vinh danh:", error);
        topRacersList.innerHTML = '<div class="text-center text-red-400 py-3 text-xs">Lỗi tải dữ liệu</div>';
        topCombosList.innerHTML = '<div class="text-center text-red-400 py-3 text-xs">Lỗi tải dữ liệu</div>';
        topRecordHoldersList.innerHTML = '<div class="text-center text-red-400 py-3 text-xs">Lỗi tải dữ liệu</div>';
    }
};
// --- 1vs1 Mode BO Helper Functions ---
const get1vs1MatchState = (maps) => {
    // Xác định số wins cần để thắng BO nhỏ
    const format = (raceState && raceState.bo1vs1Format) ? raceState.bo1vs1Format : 'BO9';
    const winTarget = format === 'BO7' ? 4 : 5; // BO7: chạm 4, BO9: chạm 5
    const maxGames = format === 'BO7' ? 7 : 9;

    const state = {
        bo1: { maps: [], wins: [0, 0], winner: null, ended: false },
        bo2: { maps: [], wins: [0, 0], winner: null, ended: false },
        bo3: { maps: [], wins: [0, 0], winner: null, ended: false },
        overallScore: [0, 0],
        matchWinner: null,
        currentBO: 1,
        mapBOs: new Array(maps.length).fill(1),
        winTarget,
        format
    };

    let currentBO = 1;

    for (let i = 0; i < maps.length; i++) {
        const map = maps[i];
        
        let mapWinner = null;
        const times = map.times || [null, null];
        const t1 = timeToSeconds(times[0]);
        const t2 = timeToSeconds(times[1]);
        
        if (t1 !== null && t1 > 0 && (t2 === null || t2 <= 0)) {
            mapWinner = 0;
        } else if (t2 !== null && t2 > 0 && (t1 === null || t1 <= 0)) {
            mapWinner = 1;
        } else if (t1 !== null && t1 > 0 && t2 !== null && t2 > 0) {
            if (t1 < t2) {
                mapWinner = 0;
            } else if (t2 < t1) {
                mapWinner = 1;
            }
        }

        state.mapBOs[i] = currentBO;

        if (currentBO === 1) {
            state.bo1.maps.push({ map, mapIndex: i, winner: mapWinner });
            if (mapWinner !== null) {
                state.bo1.wins[mapWinner]++;
            }
            if (state.bo1.wins[0] === winTarget) {
                state.bo1.winner = 0;
                state.bo1.ended = true;
                state.overallScore[0]++;
                currentBO = 2;
            } else if (state.bo1.wins[1] === winTarget) {
                state.bo1.winner = 1;
                state.bo1.ended = true;
                state.overallScore[1]++;
                currentBO = 2;
            }
        } else if (currentBO === 2) {
            state.bo2.maps.push({ map, mapIndex: i, winner: mapWinner });
            if (mapWinner !== null) {
                state.bo2.wins[mapWinner]++;
            }
            if (state.bo2.wins[0] === winTarget) {
                state.bo2.winner = 0;
                state.bo2.ended = true;
                state.overallScore[0]++;
                if (state.overallScore[0] === 2) {
                    state.matchWinner = 0;
                } else {
                    currentBO = 3;
                }
            } else if (state.bo2.wins[1] === winTarget) {
                state.bo2.winner = 1;
                state.bo2.ended = true;
                state.overallScore[1]++;
                if (state.overallScore[1] === 2) {
                    state.matchWinner = 1;
                } else {
                    currentBO = 3;
                }
            }
        } else if (currentBO === 3) {
            state.bo3.maps.push({ map, mapIndex: i, winner: mapWinner });
            if (mapWinner !== null) {
                state.bo3.wins[mapWinner]++;
            }
            
            const w0 = state.bo3.wins[0];
            const w1 = state.bo3.wins[1];
            if (w0 >= maxGames || (w0 >= winTarget && w0 - w1 >= 2)) {
                state.bo3.winner = 0;
                state.bo3.ended = true;
                state.overallScore[0]++;
                state.matchWinner = 0;
            } else if (w1 >= maxGames || (w1 >= winTarget && w1 - w0 >= 2)) {
                state.bo3.winner = 1;
                state.bo3.ended = true;
                state.overallScore[1]++;
                state.matchWinner = 1;
            }
        }
    }

    state.currentBO = currentBO;
    return state;
};

const get1vs1DuplicateEquipment = (maps) => {
    const matchState = get1vs1MatchState(maps);
    const duplicates = {
        0: { cars: new Set(), pets: new Set() },
        1: { cars: new Set(), pets: new Set() }
    };

    const checkDuplicatesForSubset = (subset, racerIndex) => {
        const seenCars = {};
        
        subset.forEach(({ map, mapIndex }) => {
            const car = (map.cars && map.cars[racerIndex] || '').trim();
            
            if (car && car !== '' && car.toLowerCase() !== 'none') {
                if (seenCars[car] !== undefined) {
                    duplicates[racerIndex].cars.add(car);
                } else {
                    seenCars[car] = mapIndex;
                }
            }
        });
    };

    const bo12Maps = [];
    const bo3Maps = [];
    matchState.mapBOs.forEach((bo, mapIndex) => {
        const map = maps[mapIndex];
        if (bo === 1 || bo === 2) {
            bo12Maps.push({ map, mapIndex });
        } else if (bo === 3) {
            bo3Maps.push({ map, mapIndex });
        }
    });

    checkDuplicatesForSubset(bo12Maps, 0);
    checkDuplicatesForSubset(bo12Maps, 1);
    checkDuplicatesForSubset(bo3Maps, 0);
    checkDuplicatesForSubset(bo3Maps, 1);

    return duplicates;
};

// --- Validation Functions ---
const validateUniqueCars = (state) => {
    const errors = [];
    const requiredMapNames = getRequiredMapNames(state);

    for (let racerIndex = 0; racerIndex < getNumRacers(); racerIndex++) {
        const usageMap = new Map();

        state.maps.forEach((map, mapIndex) => {
            const carName = (map.cars && map.cars[racerIndex]) || '';
            const trimmedCarName = carName.trim();
            const isFixedMap = requiredMapNames.includes(map.name.trim());

            if (trimmedCarName && !isFixedMap) {
                if (usageMap.has(trimmedCarName)) {
                    usageMap.get(trimmedCarName).push(mapIndex);
                } else {
                    usageMap.set(trimmedCarName, [mapIndex]);
                }
            }
        });

        usageMap.forEach((mapIndices, car) => {
            if (mapIndices.length > 1) {
                errors.push({ racerIndex: racerIndex, car: car, mapIndices: mapIndices });
            }
        });
    }
    return errors;
};

const validateMapConfiguration = (state) => {
    const errors = [];
    const numRacers = state.is1vs1Mode ? 2 : state.racers.length;

    if (!state.firstMapBtc.trim()) {
        errors.push("Map BTC chưa được nhập. Vui lòng nhập Map BTC.");
    }

    if (state.is1vs1Mode) {
        // 1vs1 mode: validate ban maps instead of king maps
        const currentBtcMap = state.firstMapBtc.trim();
        const allBans = []; // flat list for cross-player duplicate check
        for (let i = 0; i < 2; i++) {
            const racer = state.racers[i];
            const bans = racer.banMaps || ['', ''];
            const ban1 = (bans[0] || '').trim();
            const ban2 = (bans[1] || '').trim();
            if (!ban1) errors.push(`Tay Đua ${i + 1} chưa cấm Map 1.`);
            if (!ban2) errors.push(`Tay Đua ${i + 1} chưa cấm Map 2.`);
            if (ban1 && ban2 && ban1 === ban2) errors.push(`Tay Đua ${i + 1}: 2 map cấm không được trùng nhau.`);
            if (ban1 && currentBtcMap && ban1 === currentBtcMap) errors.push(`Tay Đua ${i + 1}: Map cấm 1 không được trùng Map BTC.`);
            if (ban2 && currentBtcMap && ban2 === currentBtcMap) errors.push(`Tay Đua ${i + 1}: Map cấm 2 không được trùng Map BTC.`);
            if (ban1) allBans.push(ban1);
            if (ban2) allBans.push(ban2);
        }
    } else if (state.isTeamMode) {
        // 2vs2 mode: king map is per-team (racers[0] for team 1, racers[1] for team 2)
        // No need to validate king map for racers[2] and racers[3]
        const kingMaps = [];
        for (let i = 0; i < 2; i++) {
            const kingMapName = state.racers[i].kingMap ? state.racers[i].kingMap.trim() : '';
            if (!kingMapName) {
                errors.push(`King Map của Đội ${i + 1} chưa được nhập.`);
            } else {
                kingMaps.push(kingMapName);
            }
        }
        if (kingMaps.length === 2 && kingMaps.every(km => km)) {
            const uniqueKingMaps = new Set(kingMaps);
            if (uniqueKingMaps.size !== 2) {
                errors.push(`King Map của 2 đội không được trùng nhau.`);
            }
        }
    } else {
        const kingMaps = [];
        for (let i = 0; i < numRacers; i++) {
            const kingMapName = state.racers[i].kingMap ? state.racers[i].kingMap.trim() : '';
            if (!kingMapName) {
                errors.push(`King Map của Tay Đua ${i + 1} chưa được nhập.`);
            } else {
                kingMaps.push(kingMapName);
            }
        }
        if (kingMaps.length === numRacers && kingMaps.every(km => km)) {
            const uniqueKingMaps = new Set(kingMaps);
            if (uniqueKingMaps.size !== numRacers) {
                const duplicates = kingMaps.filter((item, index) => kingMaps.indexOf(item) !== index);
                const uniqueDuplicates = Array.from(new Set(duplicates));
                errors.push(`King Map bị trùng: ${uniqueDuplicates.join(', ')}. ${numRacers} King Map phải khác nhau.`);
            }
        }
    }

    return errors;
};

// --- Core Logic ---
const calculateMapPoints = (timeStrings, mapName) => {
    const numRacers = getNumRacers();
    const points = new Array(numRacers).fill(0);
    const timesInSeconds = timeStrings.map(ts => timeToSeconds(ts));
    
    if (raceState.is1vs1Mode) {
        const t0 = timesInSeconds[0];
        const t1 = timesInSeconds[1];
        
        if (t0 !== null && t0 > 0 && (t1 === null || t1 <= 0)) {
            points[0] = 1;
        } else if (t1 !== null && t1 > 0 && (t0 === null || t0 <= 0)) {
            points[1] = 1;
        } else if (t0 !== null && t0 > 0 && t1 !== null && t1 > 0) {
            if (t0 < t1) {
                points[0] = 1;
            } else if (t1 < t0) {
                points[1] = 1;
            }
        }
        return points;
    }

    const validTimes = timesInSeconds.filter(t => t !== null && t > 0);

    if (validTimes.length === 0) return points;

    const bestTime = Math.min(...validTimes);

    for (let i = 0; i < numRacers; i++) {
        const racerTime = timesInSeconds[i];
        if (racerTime === null || racerTime <= 0) {
            points[i] = 0;
            continue;
        }

        let racerKingMap = '';
        if (raceState.isTeamMode) {
            const teamLeadIndex = (i === 0 || i === 2) ? 0 : 1;
            racerKingMap = (raceState.racers[teamLeadIndex]?.kingMap || '').trim();
        } else {
            racerKingMap = (raceState.racers[i]?.kingMap || '').trim();
        }
        const isKingMapWinner = racerKingMap && racerKingMap === mapName.trim();

        if (racerTime === bestTime) {
            points[i] = isKingMapWinner ? 12 : 11;
            continue;
        }

        const diff = racerTime - bestTime;
        const baseScore = 10;
        const penalty = Math.floor(diff);
        let score = Math.max(0, baseScore - penalty);
        points[i] = score;
    }

    return points;
};


const calculateRanking = () => {
    const numRacers = getNumRacers();
    
    if (raceState.is1vs1Mode) {
        const matchState = get1vs1MatchState(raceState.maps);
        const rankingData = [0, 1].map(index => {
            const racer = raceState.racers[index];
            return {
                originalIndex: index,
                name: (racer && racer.name || '').trim() || `Tay Đua ${index + 1}`,
                totalScore: matchState.overallScore[index],
                mapWins: matchState.bo1.wins[index] + matchState.bo2.wins[index] + matchState.bo3.wins[index],
                rank: index + 1
            };
        });

        // Sort by BO score, then map wins
        rankingData.sort((a, b) => {
            if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
            return b.mapWins - a.mapWins;
        });

        let currentRank = 1;
        for (let i = 0; i < rankingData.length; i++) {
            if (i > 0 && (rankingData[i].totalScore < rankingData[i - 1].totalScore || 
                         (rankingData[i].totalScore === rankingData[i - 1].totalScore && rankingData[i].mapWins < rankingData[i - 1].mapWins))) {
                currentRank = i + 1;
            }
            rankingData[i].rank = currentRank;
        }
        return rankingData;
    }

    const rankingData = raceState.racers.map((racer, index) => ({
        originalIndex: index,
        name: (racer.name || '').trim() || `Tay Đua ${index + 1}`,
        totalScore: 0,
        rank: index + 1,
    }));

    raceState.maps.forEach(map => {
        const mapPoints = calculateMapPoints(map.times, map.name);
        mapPoints.forEach((points, racerIndex) => {
            if (rankingData[racerIndex]) {
                rankingData[racerIndex].totalScore += points;
            }
        });
    });

    rankingData.sort((a, b) => b.totalScore - a.totalScore);

    let currentRank = 1;
    for (let i = 0; i < rankingData.length; i++) {
        if (i > 0 && rankingData[i].totalScore < rankingData[i - 1].totalScore) {
            currentRank = i + 1;
        }
        rankingData[i].rank = currentRank;
    }

    return rankingData;
};

const calculateRacerTitles = () => {
    const vipTitles = {};

    // Khởi tạo danh hiệu trống cho mỗi tay đua
    if (raceState && raceState.racers) {
        raceState.racers.forEach(r => {
            if (r.name) {
                vipTitles[r.name.trim()] = [];
            }
        });
    }

    // 1. Thống kê kỷ lục từ ALL_MAPS
    if (window.ALL_MAPS) {
        window.ALL_MAPS.forEach(map => {
            if (map.recordRacer && map.recordTime && map.recordTime !== "00'00'00" && map.recordTime !== "--'--'--") {
                const racerName = map.recordRacer.trim();
                if (!vipTitles[racerName]) {
                    vipTitles[racerName] = [];
                }
                
                const diff = (map.difficulty || "").toLowerCase();
                const isHard = (diff === 'hard' || diff === 'expert' || diff === 'extreme' || 
                                diff === 'khó' || diff === 'rất khó' || diff === 'cực khó' ||
                                diff === '5 sao' || diff === '6 sao' || diff === '7 sao');
                
                vipTitles[racerName].push({
                    mapName: map.name,
                    isHard: isHard
                });
            }
        });
    }

    // 2. Tính toán độ lệch chuẩn thời gian để tìm tay đua kiên trì nhất
    const racerTimeLists = {};
    if (raceState && raceState.maps) {
        raceState.maps.forEach(map => {
            if (map.times) {
                map.times.forEach((timeStr, idx) => {
                    const racer = raceState.racers[idx];
                    if (racer && racer.name) {
                        const rName = racer.name.trim();
                        const timeSec = timeToSeconds(timeStr);
                        if (timeSec && timeSec > 0) {
                            if (!racerTimeLists[rName]) racerTimeLists[rName] = [];
                            racerTimeLists[rName].push(timeSec);
                        }
                    }
                });
            }
        });
    }

    const racerStdevs = [];
    Object.entries(racerTimeLists).forEach(([name, times]) => {
        if (times.length >= 3) {
            const avg = times.reduce((s, val) => s + val, 0) / times.length;
            const variance = times.reduce((s, val) => s + Math.pow(val - avg, 2), 0) / times.length;
            const stdev = Math.sqrt(variance);
            racerStdevs.push({ name, stdev });
        }
    });

    let bestConsistentRacer = null;
    if (racerStdevs.length > 0) {
        racerStdevs.sort((a, b) => a.stdev - b.stdev);
        bestConsistentRacer = racerStdevs[0].name;
    }

    // 3. Phân bổ danh hiệu cụ thể
    const finalTitles = {};
    if (raceState && raceState.racers) {
        raceState.racers.forEach(r => {
            if (!r.name) return;
            const rName = r.name.trim();
            finalTitles[rName] = [];

            const records = vipTitles[rName] || [];
            
            // Thần Gió (giữ >= 3 kỷ lục)
            if (records.length >= 3) {
                finalTitles[rName].push({
                    id: 'wind',
                    name: 'Thần Gió',
                    className: 'neon-badge-wind',
                    icon: 'fa-wind',
                    desc: `Nắm giữ ${records.length} kỷ lục bản đồ`
                });
            } else if (records.length >= 1) {
                // Phá Kỷ Lục (giữ >= 1 kỷ lục)
                finalTitles[rName].push({
                    id: 'breaker',
                    name: 'Phá Kỷ Lục',
                    className: 'neon-badge-breaker',
                    icon: 'fa-bolt',
                    desc: `Nắm giữ kỷ lục của ${records.length} bản đồ`
                });
            }

            // Drift Master (giữ kỷ lục ở map khó >= Hard)
            const hardRecords = records.filter(rec => rec.isHard);
            if (hardRecords.length >= 1) {
                finalTitles[rName].push({
                    id: 'drift',
                    name: 'Drift Master',
                    className: 'neon-badge-drift',
                    icon: 'fa-redo-alt',
                    desc: `Giữ kỷ lục trên bản đồ khó (${hardRecords.map(h => h.mapName).join(', ')})`
                });
            }

            // Kiên Trì (độ lệch chuẩn thời gian thấp nhất)
            if (rName === bestConsistentRacer) {
                finalTitles[rName].push({
                    id: 'stable',
                    name: 'Kiên Trì',
                    className: 'neon-badge-stable',
                    icon: 'fa-history',
                    desc: `Phong độ ổn định nhất đội đua (sai số chênh lệch thời gian cực thấp)`
                });
            }
        });
    }

    window.RACER_VIP_TITLES = finalTitles;
    console.log("🏆 Đã tính toán Danh hiệu VIP Tay đua:", finalTitles);
};

window.calculateRacerTitles = calculateRacerTitles;

const getRequiredMapNames = (state) => {
    const requiredMaps = [];
    if (state.firstMapBtc.trim()) {
        requiredMaps.push(state.firstMapBtc.trim());
    }

    // King maps only apply to non-1vs1 modes
    if (!state.is1vs1Mode) {
        const activeRacersCount = state.racers.length;
        for (let i = 0; i < activeRacersCount; i++) {
            const racer = state.racers[i];
            if (racer && (racer.kingMap || '').trim()) {
                requiredMaps.push((racer.kingMap || '').trim());
            }
        }
    }

    const uniqueRequiredMaps = Array.from(new Set(requiredMaps));
    return uniqueRequiredMaps.slice(0, 5);
};

const ensureInitialMaps = (currentState) => {
    const initialMapNames = getRequiredMapNames(currentState);
    const finalMaps = [];
    let mapsChanged = false;

    initialMapNames.forEach(name => {
        const trimmedName = name.trim();
        const existingMap = currentState.maps.find(m => m.name.trim() === trimmedName);

        if (existingMap) {
            const updatedMap = {
                ...defaultMapData(),
                ...existingMap,
                cars: existingMap.cars || defaultMapData().cars,
                pets: existingMap.pets || defaultMapData().pets,
            };
            finalMaps.push(updatedMap);
        } else {
            finalMaps.push({ ...defaultMapData(), name: trimmedName });
            mapsChanged = true;
        }
    });

    currentState.maps.forEach(map => {
        if (!initialMapNames.includes(map.name.trim())) {
            const updatedMap = {
                ...defaultMapData(),
                ...map,
                cars: map.cars || defaultMapData().cars,
                pets: map.pets || defaultMapData().pets,
            };
            finalMaps.push(updatedMap);
        }
    });

    const fixedMaps = finalMaps.filter(map => initialMapNames.includes(map.name.trim()));
    const freeMaps = finalMaps.filter(map => !initialMapNames.includes(map.name.trim()));

    const sortedFixedMaps = initialMapNames.map(name =>
        fixedMaps.find(m => m.name.trim() === name)
    ).filter(map => map);

    const newState = {
        ...currentState,
        maps: [...sortedFixedMaps, ...freeMaps],
    };

    return newState;
};

// --- Render Functions ---
const renderRacerInputs = () => {
    const container = document.getElementById('racer-names');
    container.innerHTML = '';
    document.getElementById('btc-map-name').value = raceState.firstMapBtc;

    // Thêm disabled cho ô Map BTC nếu không phải admin
    const btcMapInput = document.getElementById('btc-map-name');
    if (btcMapInput && !isAdminUser) {
        btcMapInput.disabled = true;
        btcMapInput.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-800');
    }

    raceState.racers.forEach((racer, index) => {
        const displayName = racer.name.trim() || `Tay Đua ${index + 1}`;
        const racerTitle = `${displayName} (Player ${index + 1})`;

        // Kiểm tra xem có phải admin không để thêm thuộc tính disabled
        const disabledAttr = !isAdminUser ? 'disabled' : '';
        const disabledClass = !isAdminUser ? 'opacity-50 cursor-not-allowed bg-slate-800' : '';
        const placeholderClass = !isAdminUser ? 'placeholder-slate-500' : '';

        const inputHtml = `
                <div class="neon-card p-5 hover:border-cyan-500/30 transition-all duration-300">
                    <div class="flex items-center mb-4 pb-3 border-b border-slate-800">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mr-3">
                            <span class="text-white font-bold">${index + 1}</span>
                        </div>
                        <label class="text-lg font-bold text-cyan-300">${racerTitle}</label>
                    </div>
                    <div class="mb-4">
                        <label for="racer-name-${index}" class="block text-sm font-medium text-slate-400 mb-2">
                            <i class="fas fa-user mr-1"></i> Tên Tay Đua
                        </label>
                        <input type="text" id="racer-name-${index}" value="${racer.name}" 
                            ${disabledAttr}
                            class="speed-input w-full text-center ${disabledClass} ${placeholderClass}" 
                            placeholder="${!isAdminUser ? 'Chỉ xem' : `Nhập tên tay đua (Player ${index + 1})`}" 
                            onchange="${isAdminUser ? `handleNameChange(this.value, ${index})` : ''}" />
                    </div>
                    <div>
                        <label for="king-map-${index}" class="block text-sm font-medium text-slate-400 mb-2">
                            <i class="fas fa-crown mr-1"></i> King Map
                        </label>
                        <input type="text" id="king-map-${index}" value="${racer.kingMap}" 
                            ${disabledAttr}
                            list="map-suggestions" class="speed-input w-full text-center ${disabledClass} ${placeholderClass}" 
                            placeholder="${!isAdminUser ? 'Chỉ xem' : 'Nhập King Map'}" 
                            onchange="${isAdminUser ? `handleKingMapChange(this.value, ${index})` : ''}" />
                        <p class="text-xs text-slate-500 mt-2 italic text-center">
                            <i class="fas fa-star text-amber-400 mr-1"></i> King Map Owner được 
                            <span class="text-amber-400 font-bold">+1 điểm</span> nếu về nhất map đó.
                        </p>
                    </div>
                </div>
            `;
        container.insertAdjacentHTML('beforeend', inputHtml);
    });
};

// === BO TAB BAR (1vs1 Mode) ===

const renderBOTabBar = (matchState) => {
    const container = document.getElementById('bo-tab-container');
    const statusText = document.getElementById('bo-tab-status-text');
    if (!container) return;

    if (!raceState.is1vs1Mode || !matchState) {
        container.classList.add('hidden');
        return;
    }

    // Chỉ hiển thị tab bar khi có ít nhất BO2 bắt đầu
    const hasBO2 = matchState.bo1.ended;
    const hasBO3 = matchState.bo2.ended && matchState.bo1.winner !== matchState.bo2.winner;

    if (!hasBO2) {
        container.classList.add('hidden');
        // Khi chỉ có BO1, đảm bảo currentBOTab = 1
        if (currentBOTab !== 1) {
            currentBOTab = 1;
        }
        return;
    }

    container.classList.remove('hidden');

    // Cập nhật tab BO2
    const btn2 = document.getElementById('bo-tab-btn-2');
    if (btn2) btn2.classList.remove('hidden');

    // Cập nhật tab BO3
    const btn3 = document.getElementById('bo-tab-btn-3');
    if (btn3) {
        if (hasBO3) {
            btn3.classList.remove('hidden');
        } else {
            btn3.classList.add('hidden');
            if (currentBOTab === 3) currentBOTab = 2;
        }
    }

    // Đảm bảo currentBOTab hợp lệ
    if (currentBOTab === 2 && !hasBO2) currentBOTab = 1;
    if (currentBOTab === 3 && !hasBO3) currentBOTab = hasBO2 ? 2 : 1;

    // Nếu tab hiện tại là BO cũ đã xong và đang xem BO mới hơn chưa được chọn, auto chuyển sang BO mới nhất
    const latestBO = hasBO3 ? 3 : (hasBO2 ? 2 : 1);
    if (!window._boTabUserOverride) {
        // Tự động nhảy sang BO mới nhất nếu user chưa tự chọn
        currentBOTab = latestBO;
    }

    // Render trạng thái mỗi tab
    [1, 2, 3].forEach(boNum => {
        const btn = document.getElementById(`bo-tab-btn-${boNum}`);
        if (!btn) return;

        btn.classList.remove('active', 'finished', 'winner-highlight');

        const boData = boNum === 1 ? matchState.bo1 : (boNum === 2 ? matchState.bo2 : matchState.bo3);

        if (currentBOTab === boNum) {
            btn.classList.add('active');
        } else if (boData && boData.ended && boData.winner !== null) {
            btn.classList.add('finished');
            const racerName = raceState.racers[boData.winner]?.name || `Tay đua ${boData.winner + 1}`;
            const wins0 = boData.wins[0];
            const wins1 = boData.wins[1];
            btn.innerHTML = `
                <span class="bo-tab-indicator w-2 h-2 rounded-full"></span>
                BO ${boNum}
                <span class="text-[10px] text-green-400 font-normal">${wins0}-${wins1}</span>
            `;
            btn.onclick = () => window.switchBOTab(boNum);
        }
    });

    // Status text
    if (statusText) {
        const p1Name = raceState.racers[0]?.name || 'Tay đua 1';
        const p2Name = raceState.racers[1]?.name || 'Tay đua 2';
        const bo1Str = `BO1: ${matchState.bo1.wins[0]}-${matchState.bo1.wins[1]}`;
        const bo2Str = hasBO2 ? ` | BO2: ${matchState.bo2.wins[0]}-${matchState.bo2.wins[1]}` : '';
        const bo3Str = hasBO3 ? ` | BO3: ${matchState.bo3.wins[0]}-${matchState.bo3.wins[1]}` : '';

        let summaryText = `${p1Name} vs ${p2Name} · ${bo1Str}${bo2Str}${bo3Str}`;
        if (matchState.matchWinner !== null) {
            const winner = raceState.racers[matchState.matchWinner]?.name || `Tay đua ${matchState.matchWinner + 1}`;
            summaryText += ` · 🏆 ${winner} THẮNG CHUNG CUỘC`;
        }
        statusText.textContent = summaryText;
    }
};

window.switchBOTab = (boNum) => {
    window._boTabUserOverride = true; // Đánh dấu user đã tự chọn tab
    currentBOTab = boNum;
    renderMapTables();

    // Cập nhật trạng thái active của các nút
    [1, 2, 3].forEach(n => {
        const btn = document.getElementById(`bo-tab-btn-${n}`);
        if (!btn) return;
        if (n === boNum) {
            btn.classList.add('active');
            btn.classList.remove('finished');
        } else {
            btn.classList.remove('active');
        }
    });
};

const renderMapTables = () => {
    const tbodyTimePoints = document.getElementById('map-time-points-body');
    const tbodyCarPet = document.getElementById('map-car-pet-body');
    tbodyTimePoints.innerHTML = '';
    tbodyCarPet.innerHTML = '';

    const numRacerCols = getNumRacers();
    const racerNames = raceState.racers.map((r, i) => r.name.trim() || `P${i + 1}`);
    const requiredMapNames = getRequiredMapNames(raceState);

    // Cập nhật colspan cho header chính
    const racerTimeHeader = document.getElementById('racer-time-header');
    if (racerTimeHeader) {
        racerTimeHeader.setAttribute('colspan', numRacerCols);
    }

    // Header Time
    const subHeaderTimePoints = document.getElementById('racer-sub-header-time-points');
    let subHeaderTimePointsHtml = '';
    subHeaderTimePointsHtml += `<th class="px-4 py-3 bg-slate-900/80"></th><th class="px-4 py-3 bg-slate-900/80"></th>`;
    for (let i = 0; i < numRacerCols; i++) {
        subHeaderTimePointsHtml += `<th class="px-4 py-3 text-center text-xs font-bold text-slate-300 border-l border-slate-700">${racerNames[i]}</th>`;
    }
    subHeaderTimePointsHtml += `<th class="px-4 py-3 bg-slate-900/80"></th>`;
    subHeaderTimePoints.innerHTML = subHeaderTimePointsHtml;

    // Header Car/Pet
    const subHeaderCarPet = document.getElementById('racer-sub-header-car-pet');
    let subHeaderCarPetHtml = '';
    subHeaderCarPetHtml += `<th class="px-4 py-3 bg-slate-900/80"></th><th class="px-4 py-3 bg-slate-900/80"></th>`;
    for (let i = 0; i < numRacerCols; i++) {
        subHeaderCarPetHtml += `<th class="px-4 py-3 text-center text-xs font-bold text-slate-300 border-l border-slate-700">${racerNames[i]}</th>`;
    }
    for (let i = 0; i < numRacerCols; i++) {
        subHeaderCarPetHtml += `<th class="px-4 py-3 text-center text-xs font-bold text-slate-300 border-l border-slate-700">${racerNames[i]}</th>`;
    }
    subHeaderCarPetHtml += `<th class="px-4 py-3 bg-slate-900/80"></th>`;
    subHeaderCarPet.innerHTML = subHeaderCarPetHtml;

    if (raceState.maps.length === 0) {
        tbodyTimePoints.innerHTML = `<tr><td colspan="${2 + numRacerCols * 2 + 1}" class="text-center py-8 text-slate-500">Chưa có bản đồ nào được thêm vào. Vui lòng cấu hình Map BTC và King Maps.</td></tr>`;
        tbodyCarPet.innerHTML = `<tr><td colspan="${2 + numRacerCols * 2 + 1}" class="text-center py-8 text-slate-500">Chưa có bản đồ nào được thêm vào. Vui lòng cấu hình Map BTC và King Maps.</td></tr>`;
        return;
    }

    const dupes = raceState.is1vs1Mode ? get1vs1DuplicateEquipment(raceState.maps) : null;
    const matchState = raceState.is1vs1Mode ? get1vs1MatchState(raceState.maps) : null;

    // Render BO Tab Bar (chỉ khi 1vs1)
    renderBOTabBar(matchState);

    // Lọc map theo BO tab khi ở chế độ 1vs1
    let mapsToRender;
    if (raceState.is1vs1Mode && matchState) {
        // Chỉ lấy những map thuộc BO đang xem, kèm theo globalMapIndex gốc
        mapsToRender = raceState.maps
            .map((map, globalIndex) => ({ map, globalIndex }))
            .filter(({ globalIndex }) => matchState.mapBOs[globalIndex] === currentBOTab);
    } else {
        mapsToRender = raceState.maps.map((map, globalIndex) => ({ map, globalIndex }));
    }

    mapsToRender.forEach(({ map, globalIndex: mapIndex }, localIndex) => {
        const displayIndex = localIndex + 1; // Số thứ tự hiển thị trong BO hiện tại
        const mapTimeStrings = map.times || new Array(numRacerCols).fill(null);
        const mapCars = map.cars || new Array(numRacerCols).fill(null);
        const mapPets = map.pets || new Array(numRacerCols).fill(null);
        const mapPoints = calculateMapPoints(mapTimeStrings, map.name);
        const isFixedMap = requiredMapNames.includes(map.name.trim());

        let mapTypeBadge = '';
        if (mapIndex === 0 && map.name.trim() === raceState.firstMapBtc.trim()) {
            mapTypeBadge = '<span class="text-xs bg-red-500 text-white px-2 py-1 rounded ml-2">BTC</span>';
        } else if (raceState.racers.some(r => r.kingMap.trim() === map.name.trim())) {
            mapTypeBadge = '<span class="text-xs bg-amber-500 text-white px-2 py-1 rounded ml-2">KING</span>';
        }

        // Thêm nhãn BO cho mode 1vs1
        if (raceState.is1vs1Mode && matchState) {
            const boNum = matchState.mapBOs[mapIndex] || 1;
            mapTypeBadge += `<span class="text-xs bg-cyan-500 text-white px-2 py-1 rounded ml-2">BO${boNum}</span>`;
        }

        // Tìm thông tin map từ ALL_MAPS để lấy imageUrl
        const mapInfo = ALL_MAPS.find(m => (m.name || "").trim() === (map.name || "").trim());
        const mapImageHtml = mapInfo && mapInfo.imageUrl ?
            `<img src="${mapInfo.imageUrl}" class="w-10 h-10 rounded-lg object-cover mr-3 border border-slate-700/50 shadow-sm" onerror="this.style.display='none'">` :
            `<div class="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mr-3 border border-slate-700/50">
                <i class="fas fa-map-marked-alt text-slate-600 text-xs"></i>
            </div>`;

        // Kiểm tra isAdminUser để hiển thị input hoặc text
        let mapNameDisplay;
        if (isAdminUser) {
            mapNameDisplay = isFixedMap ?
                `<div class="font-semibold text-white flex items-center">${mapImageHtml} ${map.name} ${mapTypeBadge}</div>` :
                `<div class="flex items-center">
                    ${mapImageHtml}
                    <input type="text" value="${map.name}" list="map-suggestions" onchange="handleMapNameChange(this.value, ${mapIndex})" class="speed-input w-full text-left text-sm" placeholder="Tên Map Tự Do" />
                </div>`;
        } else {
            // Người xem chỉ thấy text, không có input
            mapNameDisplay = `<div class="font-semibold text-white flex items-center">${mapImageHtml} ${map.name} ${mapTypeBadge}</div>`;
        }

        const rowBgClass = isFixedMap ? 'bg-slate-900/50' : 'bg-slate-800/30';

        let timeCellsHtml = '';
        let carCellsHtml = '';
        let petCellsHtml = '';

        for (let racerIndex = 0; racerIndex < numRacerCols; racerIndex++) {
            const timeString = mapTimeStrings[racerIndex] || '';
            const carValue = mapCars[racerIndex] || '';
            const petValue = mapPets[racerIndex] || '';

            const isCarDuplicated = raceState.is1vs1Mode && dupes && dupes[racerIndex] && dupes[racerIndex].cars.has(carValue);
            const carStyle = isCarDuplicated ? 'border: 1px solid #f59e0b !important; box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);' : '';
            const carTitle = isCarDuplicated ? 'Xe này bị trùng lặp trong BO này!' : '';

            const isPetDuplicated = raceState.is1vs1Mode && dupes && dupes[racerIndex] && dupes[racerIndex].pets.has(petValue);
            const petStyle = isPetDuplicated ? 'border: 1px solid #f59e0b !important; box-shadow: 0 0 10px rgba(245, 158, 11, 0.5);' : '';
            const petTitle = isPetDuplicated ? 'Pet này bị trùng lặp trong BO này!' : '';

            if (isAdminUser) {
                // Admin: Hiển thị input có thể chỉnh sửa
                const timeInputId = `time-${mapIndex}-${racerIndex}`;
                const carInputId = `car-${mapIndex}-${racerIndex}`;
                const petInputId = `pet-${mapIndex}-${racerIndex}`;

                timeCellsHtml += `
    <td class="px-2 py-3 text-center border-l border-slate-700" data-label="${racerNames[racerIndex]} - Thời gian">
        <input type="text" id="${timeInputId}" value="${timeString}" 
            data-map-index="${mapIndex}" data-racer-index="${racerIndex}"
            class="speed-input w-full text-center text-sm temp-edit-input" 
            placeholder="--'--'--" />
    </td>
`;

                carCellsHtml += `
    <td class="px-2 py-3 text-center border-l border-slate-700 relative group/cell" data-label="${racerNames[racerIndex]} - Xe" data-racer-group="true">
        <div class="flex items-center gap-1">
            <input type="text" id="${carInputId}" value="${carValue}" 
                data-map-index="${mapIndex}" data-racer-index="${racerIndex}"
                class="speed-input w-full text-center text-sm temp-edit-input" 
                style="${carStyle}" title="${carTitle}"
                placeholder="Xe" list="car-suggestions" />
            
            <button onclick="showComboModal(${mapIndex}, ${racerIndex}, '${map.name.replace(/'/g, "\\'")}')" 
                    class="text-amber-400 hover:text-amber-300 transition-all opacity-0 group-hover/cell:opacity-100 flex-shrink-0" 
                    title="Gợi ý Combo">
                <i class="fas fa-magic text-xs"></i>
            </button>
        </div>
    </td>
`;

                petCellsHtml += `
    <td class="px-2 py-3 text-center border-l border-slate-700" data-label="${racerNames[racerIndex]} - Pet">
        <input type="text" id="${petInputId}" value="${petValue}" 
            data-map-index="${mapIndex}" data-racer-index="${racerIndex}"
            class="speed-input w-full text-center text-sm temp-edit-input" 
            style="background: rgba(18, 18, 26, 0.6); margin: -8px 0; ${petStyle}" title="${petTitle}"
            placeholder="Pet" list="pet-suggestions" />
    </td>
`;
            } else {
                // Người xem: Hiển thị hình ảnh hoặc text nếu không có ảnh
                const displayTime = timeString || "--'--'--";

                // Tìm thông tin ảnh xe và pet
                const carInfo = ALL_CARS.find(c => c.name === carValue);
                const petInfo = ALL_PETS.find(p => p.name === petValue);

                const carHtml = carValue ? `
                    <div class="equipment-tag ${isCarDuplicated ? 'border-amber-500/80 bg-amber-500/10' : ''}" title="${carTitle}">
                        ${carInfo && carInfo.imageUrl ?
                        `<img src="${carInfo.imageUrl}" alt="${carValue}" onerror="this.parentElement.innerHTML='${carValue}'">` :
                        `<i class="fas fa-car text-cyan-400 mr-2"></i>`}
                        <span class="text-white font-medium">${carValue}</span>
                        ${isCarDuplicated ? `<i class="fas fa-exclamation-triangle text-amber-400 ml-1.5" title="Trùng lặp"></i>` : ''}
                    </div>` : `-`;

                const petHtml = petValue ? `
                    <div class="equipment-tag ${isPetDuplicated ? 'border-amber-500/80 bg-amber-500/10' : ''}" title="${petTitle}">
                        ${petInfo && petInfo.imageUrl ?
                        `<img src="${petInfo.imageUrl}" alt="${petValue}" onerror="this.parentElement.innerHTML='${petValue}'">` :
                        `<i class="fas fa-paw text-pink-400 mr-2"></i>`}
                        <span class="text-white font-medium">${petValue}</span>
                        ${isPetDuplicated ? `<i class="fas fa-exclamation-triangle text-amber-400 ml-1.5" title="Trùng lặp"></i>` : ''}
                    </div>` : `-`;

                timeCellsHtml += `
                        <td class="px-2 py-3 text-center border-l border-slate-700" data-label="${racerNames[racerIndex]} - Thời gian">
                            <div class="text-white font-medium bg-slate-800/50 rounded px-2 py-1.5">${displayTime}</div>
                        </td>
                    `;

                carCellsHtml += `
                        <td class="px-2 py-3 text-center border-l border-slate-700" data-label="${racerNames[racerIndex]} - Xe" data-racer-group="true">
                            <div class="flex justify-center">${carHtml}</div>
                        </td>
                    `;

                petCellsHtml += `
                        <td class="px-2 py-3 text-center border-l border-slate-700" data-label="${racerNames[racerIndex]} - Pet">
                            <div class="flex justify-center">${petHtml}</div>
                        </td>
                    `;
            }

        }

        const actionButtons = isAdminUser ?
            `<div class="flex flex-col gap-2">
                <button onclick="saveMapData(${mapIndex})" id="save-map-${mapIndex}" 
                    class="speed-button px-3 py-1 text-xs bg-green-600/20 border-green-500/30 hover:bg-green-600/30" 
                    title="Lưu dữ liệu map này">
                    <i class="fas fa-save mr-1"></i> Lưu
                </button>
                ${isFixedMap ?
                `<button disabled class="text-slate-600 p-2 cursor-not-allowed" title="Không thể xóa Map cố định (BTC/King)">
                        <i class="fas fa-trash-alt"></i>
                    </button>` :
                `<button onclick="deleteMap(${mapIndex})" 
                        class="text-red-400 hover:text-red-300 p-2 transition duration-150" 
                        title="Xóa Map Tự Do">
                        <i class="fas fa-trash-alt"></i>
                    </button>`
            }
            </div>` :
            `<div class="flex flex-col gap-2">
                <button disabled class="text-slate-600 p-2 cursor-not-allowed" title="Chế độ xem">
                    <i class="fas fa-save"></i>
                </button>
                <button disabled class="text-slate-600 p-2 cursor-not-allowed" title="Chế độ xem">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>`;

        const rowId = `map-row-${map.id}`;

        // Time/Points Row
        const timePointsRow = `
    <tr id="${rowId}" class="${rowBgClass} hover:bg-slate-700/50 transition-colors">
        <td class="px-4 py-3 text-center text-sm font-semibold text-slate-400 md:table-cell hidden">${displayIndex}</td>
        <td class="px-4 py-3 text-left map-name-column text-sm font-semibold map-header-cell">
            <span class="inline-block md:hidden mr-2">Trận ${displayIndex}:</span>
            <div class="inline-block">${mapNameDisplay}</div>
        </td>
        ${timeCellsHtml}
        <td class="px-4 py-3 text-center" data-label="Thao tác">${actionButtons}</td>
    </tr>
`;
        tbodyTimePoints.insertAdjacentHTML('beforeend', timePointsRow);

        const carPetActionButtons = isAdminUser ?
            `<div class="flex flex-col gap-2">
                <button onclick="saveMapCarsPets(${mapIndex})" id="save-car-pet-${mapIndex}" 
                    class="speed-button px-3 py-1 text-xs bg-green-600/20 border-green-500/30 hover:bg-green-600/30" 
                    title="Lưu Xe & Pet map này">
                    <i class="fas fa-save mr-1"></i> Lưu
                </button>
            </div>` :
            `<div class="flex flex-col gap-2">
                <button disabled class="text-slate-600 p-2 cursor-not-allowed" title="Chế độ xem">
                    <i class="fas fa-save"></i>
                </button>
            </div>`;

        // Car/Pet Row
        const carPetRow = `
                <tr class="${rowBgClass} hover:bg-slate-700/50 transition-colors">
                    <td class="px-4 py-3 text-center text-sm font-semibold text-slate-400 md:table-cell hidden">${displayIndex}</td>
                    <td class="px-4 py-3 text-left map-name-column text-sm font-semibold map-header-cell">
                        <span class="inline-block md:hidden mr-2">Trận ${displayIndex}:</span>
                        <div class="inline-block">${mapNameDisplay}</div>
                    </td>
                    ${carCellsHtml}
                    ${petCellsHtml}
                    <td class="px-4 py-3 text-center" data-label="Thao tác">${carPetActionButtons}</td>
                </tr>
            `;
        tbodyCarPet.insertAdjacentHTML('beforeend', carPetRow);
    });
};

// === SCOREBOARD BO TABS (Admin Panel) ===
const renderScoreboardBOTabBar = (matchState) => {
    const container = document.getElementById('scoreboard-bo-tab-container');
    if (!container) return;

    if (!raceState.is1vs1Mode || !matchState) {
        container.classList.add('hidden');
        return;
    }

    const hasBO2 = matchState.bo1.ended;
    const hasBO3 = matchState.bo2.ended && matchState.bo1.winner !== matchState.bo2.winner;

    if (!hasBO2) {
        container.classList.add('hidden');
        if (scoreboardBOTab !== 1) scoreboardBOTab = 1;
        return;
    }

    container.classList.remove('hidden');

    const latestBO = hasBO3 ? 3 : (hasBO2 ? 2 : 1);
    if (!window._scoreboardBOTabUserOverride) {
        scoreboardBOTab = latestBO;
    }

    if (scoreboardBOTab === 2 && !hasBO2) scoreboardBOTab = 1;
    if (scoreboardBOTab === 3 && !hasBO3) scoreboardBOTab = hasBO2 ? 2 : 1;

    let tabsHtml = `
        <div class="flex items-center gap-1 p-1 bg-slate-900/70 rounded-xl border border-slate-800/80 w-fit">
            <button id="scoreboard-bo-btn-1" onclick="window.switchScoreboardBOTab(1)"
                class="bo-tab-btn px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${scoreboardBOTab === 1 ? 'active' : ''}">
                <span class="bo-tab-indicator w-2 h-2 rounded-full"></span>
                BO 1
            </button>
            <button id="scoreboard-bo-btn-2" onclick="window.switchScoreboardBOTab(2)"
                class="bo-tab-btn px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${scoreboardBOTab === 2 ? 'active' : ''}">
                <span class="bo-tab-indicator w-2 h-2 rounded-full"></span>
                BO 2
            </button>
            <button id="scoreboard-bo-btn-3" onclick="window.switchScoreboardBOTab(3)"
                class="bo-tab-btn px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2 ${hasBO3 ? '' : 'hidden'} ${scoreboardBOTab === 3 ? 'active' : ''}">
                <span class="bo-tab-indicator w-2 h-2 rounded-full"></span>
                BO 3
            </button>
        </div>
    `;

    container.innerHTML = tabsHtml;

    [1, 2, 3].forEach(boNum => {
        const btn = document.getElementById(`scoreboard-bo-btn-${boNum}`);
        if (!btn) return;

        const boData = boNum === 1 ? matchState.bo1 : (boNum === 2 ? matchState.bo2 : matchState.bo3);

        if (scoreboardBOTab === boNum) {
            btn.classList.add('active');
        } else if (boData && boData.ended && boData.winner !== null) {
            btn.classList.add('finished');
            const wins0 = boData.wins[0];
            const wins1 = boData.wins[1];
            btn.innerHTML = `
                <span class="bo-tab-indicator w-2 h-2 rounded-full"></span>
                BO ${boNum}
                <span class="text-[10px] text-green-400 font-normal">${wins0}-${wins1}</span>
            `;
        }
    });
};

window.switchScoreboardBOTab = (boNum) => {
    window._scoreboardBOTabUserOverride = true;
    scoreboardBOTab = boNum;
    renderDetailedScoreboard(null);
};

const renderDetailedScoreboard = (rankingData) => {
    const thead = document.getElementById('detailed-scoreboard-header');
    const tbody = document.getElementById('detailed-scoreboard-body');
    const table = thead.closest('table');
    const container1vs1 = document.getElementById('detailed-scoreboard-1vs1-container');

    if (!raceState || raceState.maps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="100%" class="text-center py-20 text-slate-500">Chưa có dữ liệu.</td></tr>`;
        return;
    }

    const mapPointsMatrix = raceState.maps.map(map => calculateMapPoints(map.times, map.name));
    const matchState = raceState.is1vs1Mode ? get1vs1MatchState(raceState.maps) : null;

    if (raceState.is1vs1Mode && matchState) {
        // Render BO tab bar
        renderScoreboardBOTabBar(matchState);

        // Hide standard table, show 1vs1 cards container
        if (table) table.classList.add('hidden');
        if (container1vs1) {
            container1vs1.classList.remove('hidden');

            // Remove wrapper clipping so grid has no rounded corners
            const outerWrapper = container1vs1.closest('.table-responsive-wrapper') || container1vs1.parentElement;
            if (outerWrapper && outerWrapper !== container1vs1) {
                outerWrapper.style.borderRadius = '0';
                outerWrapper.style.overflow = 'visible';
                outerWrapper.style.border = 'none';
                outerWrapper.style.boxShadow = 'none';
                outerWrapper.style.background = 'transparent';
                outerWrapper.style.backdropFilter = 'none';
            }

            // Filter maps by currently selected BO tab
            const mapsToRender = raceState.maps
                .map((map, globalIndex) => ({ map, globalIndex }))
                .filter(({ globalIndex }) => matchState.mapBOs[globalIndex] === scoreboardBOTab);

            const racer1Name = raceState.racers[0]?.name || 'Tay Đua 1';
            const racer2Name = raceState.racers[1]?.name || 'Tay Đua 2';

            if (mapsToRender.length === 0) {
                container1vs1.innerHTML = `<div class="text-center py-12 text-slate-500 w-full font-medium">Chưa có bản đồ nào được ghi nhận cho BO này.</div>`;
            } else {
                let headerCols = '';
                let cardCols = '';

                mapsToRender.forEach(({ map, globalIndex: mapIndex }, colIdx) => {
                    const roundLabel = `ROUND ${colIdx + 1}`;
                    const isMapActive = map.name && map.name.trim() !== '' && map.name.trim().toLowerCase() !== 'chưa đặt tên';

                    // Header cell
                    headerCols += `
                        <th style="min-width:215px;width:215px;padding:8px 0;text-align:center;border:none;border-bottom:1px solid rgba(71,85,105,0.5);background:rgba(10,14,30,0.95);">
                            <div style="font-family:'Orbitron',sans-serif;font-size:0.7rem;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:#67e8f9;">
                                ${roundLabel}
                            </div>
                        </th>
                    `;

                    if (!isMapActive) {
                        cardCols += `
                            <td style="min-width:215px;width:215px;padding:0;vertical-align:top;border:1px solid rgba(71,85,105,0.5);">
                                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:480px;background:rgba(8,12,30,0.8);">
                                    <i class="fas fa-lock" style="color:#475569;font-size:1.1rem;margin-bottom:8px;"></i>
                                    <span style="font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#475569;">Đang Chờ</span>
                                </div>
                            </td>
                        `;
                        return;
                    }

                    const mapInfo = ALL_MAPS.find(m => (m.name || "").trim() === (map.name || "").trim());
                    const mapImageUrl = mapInfo?.imageUrl || '';

                    const pointValue = mapPointsMatrix[mapIndex];
                    const racer1Won = pointValue[0] === 1;
                    const racer2Won = pointValue[1] === 1;
                    const hasFinished = racer1Won || racer2Won;

                    const r1WinLose = hasFinished
                        ? (racer1Won
                            ? `<div style="font-family:'Orbitron',sans-serif;font-size:1.45rem;font-weight:900;color:#fbbf24;letter-spacing:0.1em;text-shadow:0 0 14px rgba(251,191,36,0.7),0 2px 4px rgba(0,0,0,0.9);line-height:1;">WIN</div>`
                            : `<div style="font-family:'Orbitron',sans-serif;font-size:1.1rem;font-weight:700;color:rgba(148,163,184,0.5);letter-spacing:0.08em;line-height:1;">LOSE</div>`)
                        : `<div style="font-size:0.68rem;font-weight:700;color:#64748b;letter-spacing:0.1em;text-transform:uppercase;">Đang đua</div>`;

                    const r2WinLose = hasFinished
                        ? (racer2Won
                            ? `<div style="font-family:'Orbitron',sans-serif;font-size:1.45rem;font-weight:900;color:#fbbf24;letter-spacing:0.1em;text-shadow:0 0 14px rgba(251,191,36,0.7),0 2px 4px rgba(0,0,0,0.9);line-height:1;">WIN</div>`
                            : `<div style="font-family:'Orbitron',sans-serif;font-size:1.1rem;font-weight:700;color:rgba(148,163,184,0.5);letter-spacing:0.08em;line-height:1;">LOSE</div>`)
                        : `<div style="font-size:0.68rem;font-weight:700;color:#64748b;letter-spacing:0.1em;text-transform:uppercase;">Đang đua</div>`;

                    const car1Name = (map.cars && map.cars[0]) || '';
                    const car2Name = (map.cars && map.cars[1]) || '';
                    const car1Info = car1Name ? ALL_CARS.find(c => (c.name || "").trim() === car1Name.trim()) : null;
                    const car2Info = car2Name ? ALL_CARS.find(c => (c.name || "").trim() === car2Name.trim()) : null;
                    const car1ImageUrl = car1Info?.imageUrl || '';
                    const car2ImageUrl = car2Info?.imageUrl || '';

                    const car1Img = car1ImageUrl
                        ? `<img src="${car1ImageUrl}" style="height:60px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.8));" alt="${car1Name}">`
                        : `<i class="fas fa-car" style="font-size:1.8rem;color:#334155;opacity:0.4;"></i>`;
                    const car2Img = car2ImageUrl
                        ? `<img src="${car2ImageUrl}" style="height:60px;object-fit:contain;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.8));" alt="${car2Name}">`
                        : `<i class="fas fa-car" style="font-size:1.8rem;color:#334155;opacity:0.4;"></i>`;

                    const r1NameColor = racer1Won ? '#fbbf24' : '#cbd5e1';
                    const r2NameColor = racer2Won ? '#fbbf24' : '#cbd5e1';
                    const r1CarColor  = racer1Won ? '#fbbf24' : 'rgba(245,158,11,0.75)';
                    const r2CarColor  = racer2Won ? '#fbbf24' : 'rgba(245,158,11,0.75)';

                    const isBtcMap  = mapIndex === 0 && map.name.trim() === raceState.firstMapBtc.trim();
                    const isKingMap = raceState.racers.some(r => r.kingMap.trim() === map.name.trim());
                    let badgeHtml = '';
                    if (isBtcMap)       badgeHtml = `<span style="position:absolute;top:6px;right:6px;z-index:5;font-size:0.52rem;background:rgba(239,68,68,0.9);color:#fff;font-weight:900;padding:2px 5px;border-radius:3px;letter-spacing:0.06em;">BTC</span>`;
                    else if (isKingMap) badgeHtml = `<span style="position:absolute;top:6px;right:6px;z-index:5;font-size:0.52rem;background:rgba(245,158,11,0.9);color:#fff;font-weight:900;padding:2px 5px;border-radius:3px;letter-spacing:0.06em;">KING</span>`;

                    const bgTop    = racer1Won
                        ? 'linear-gradient(to bottom, rgba(35,22,0,0.90) 0%, rgba(20,12,0,0.45) 100%)'
                        : 'linear-gradient(to bottom, rgba(6,10,28,0.90) 0%, rgba(6,10,28,0.45) 100%)';
                    const bgBottom = racer2Won
                        ? 'linear-gradient(to top, rgba(35,22,0,0.90) 0%, rgba(20,12,0,0.45) 100%)'
                        : 'linear-gradient(to top, rgba(6,10,28,0.90) 0%, rgba(6,10,28,0.45) 100%)';
                    const footerBg = racer2Won
                        ? 'rgba(28,16,0,0.92)'
                        : 'rgba(5,8,22,0.92)';

                    const mapBgStyle = mapImageUrl
                        ? `background-image:url('${mapImageUrl}');background-size:cover;background-position:center;`
                        : `background:rgba(8,12,30,0.95);`;

                    cardCols += `
                        <td style="min-width:215px;width:215px;padding:0;vertical-align:top;border:1px solid rgba(71,85,105,0.5);">
                            <div style="position:relative;overflow:hidden;height:480px;display:flex;flex-direction:column;">
                                ${badgeHtml}
                                <div style="position:absolute;inset:0;${mapBgStyle}z-index:0;"></div>
                                <div style="position:absolute;inset:0;background:rgba(4,6,18,0.42);z-index:0;"></div>

                                <!-- Racer 1 Top -->
                                <div style="position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 12px 8px;background:${bgTop};">
                                    <div style="font-size:1.05rem;font-weight:800;color:${r1NameColor};text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0.03em;margin-bottom:3px;text-shadow:0 1px 4px rgba(0,0,0,0.95);">${racer1Name}</div>
                                    <div style="margin-bottom:7px;">${r1WinLose}</div>
                                    <div style="display:flex;align-items:center;justify-content:center;height:68px;width:100%;margin-bottom:5px;">${car1Img}</div>
                                    <div style="font-size:0.9rem;font-weight:700;color:${r1CarColor};text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Orbitron',sans-serif;">${car1Name || '---'}</div>
                                </div>

                                <!-- Racer 2 Bottom -->
                                <div style="position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 12px 6px;background:${bgBottom};">
                                    <div style="font-size:1.05rem;font-weight:800;color:${r2NameColor};text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:0.03em;margin-bottom:3px;text-shadow:0 1px 4px rgba(0,0,0,0.95);">${racer2Name}</div>
                                    <div style="margin-bottom:7px;">${r2WinLose}</div>
                                    <div style="display:flex;align-items:center;justify-content:center;height:68px;width:100%;margin-bottom:5px;">${car2Img}</div>
                                    <div style="font-size:0.9rem;font-weight:700;color:${r2CarColor};text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:'Orbitron',sans-serif;">${car2Name || '---'}</div>
                                </div>

                                <!-- Map Name Footer -->
                                <div style="position:relative;z-index:2;flex-shrink:0;padding:9px 10px 10px;text-align:center;background:${footerBg};">
                                    <div style="font-size:0.88rem;font-weight:600;color:#e2e8f0;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${map.name}</div>
                                </div>
                            </div>
                        </td>
                    `;
                });

                container1vs1.innerHTML = `
                    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;padding:16px 0 20px;">
                        <table style="border-collapse:collapse;table-layout:fixed;">
                            <thead>
                                <tr>${headerCols}</tr>
                            </thead>
                            <tbody>
                                <tr>${cardCols}</tr>
                            </tbody>
                        </table>
                    </div>
                `;
            }
        }
    } else {
        // Show standard table, hide 1vs1 container
        if (table) table.classList.remove('hidden');
        if (container1vs1) container1vs1.classList.add('hidden');

        // Áp dụng class speed-table và style layout
        table.className = 'speed-table min-w-full';
        table.style.tableLayout = 'fixed';
        table.style.width = 'max-content';
        table.style.minWidth = '100%';

        // Tạo colgroup
        let colgroupHtml = '<colgroup>';

        raceState.maps.forEach((map) => {
            const isMapActive = map.name && map.name.trim() !== '' && map.name.trim().toLowerCase() !== 'chưa đặt tên';
            const mapInfo = isMapActive ? ALL_MAPS.find(m => (m.name || "").trim() === (map.name || "").trim()) : null;
            const mapImageUrl = mapInfo?.imageUrl || '';
            const backgroundStyle = mapImageUrl ?
                `background-image: url('${mapImageUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat;` :
                'background: rgba(15, 23, 42, 0.4);';
            colgroupHtml += `<col class="map-column-bg" style="${backgroundStyle} width: 210px; min-width: 210px; max-width: 210px;">`;
        });
        colgroupHtml += '</colgroup>';

        // Xóa colgroup cũ
        const oldColgroup = table.querySelector('colgroup');
        if (oldColgroup) oldColgroup.remove();
        table.insertAdjacentHTML('afterbegin', colgroupHtml);

        // Tạo header
        let headerRow = `<tr>`;

        raceState.maps.forEach((map, mapIndex) => {
            const isMapActive = map.name && map.name.trim() !== '' && map.name.trim().toLowerCase() !== 'chưa đặt tên';
            
            let headerContent = '';
            let backgroundStyle = '';

            if (isMapActive) {
                const isBtcMap = mapIndex === 0 && map.name.trim() === raceState.firstMapBtc.trim();
                const isKingMap = raceState.racers.some(r => r.kingMap.trim() === map.name.trim());
                let mapTypeIcon = '';

                if (isBtcMap) {
                    mapTypeIcon = '<i class="fas fa-flag text-red-400 ml-1"></i>';
                } else if (isKingMap) {
                    mapTypeIcon = '<i class="fas fa-crown text-amber-400 ml-1"></i>';
                }

                // Thêm nhãn BO cho mode 1vs1
                let boLabel = '';
                if (raceState.is1vs1Mode && matchState) {
                    const boNum = matchState.mapBOs[mapIndex] || 1;
                    boLabel = `<span class="text-[9px] bg-cyan-500/30 text-cyan-300 px-1 rounded ml-1 font-numeric">BO${boNum}</span>`;
                }

                const mapInfo = ALL_MAPS.find(m => (m.name || "").trim() === (map.name || "").trim());
                const mapImageUrl = mapInfo?.imageUrl || '';
                backgroundStyle = mapImageUrl ? `background-image: linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.55)), url('${mapImageUrl}'); background-size: cover; background-position: center;` : '';

                headerContent = `
                    <span class="text-slate-100 text-sm flex items-center justify-center drop-shadow-md font-bold text-center leading-tight break-words px-2">
                        ${map.name.trim() || 'Chưa đặt tên'} ${mapTypeIcon} ${boLabel}
                    </span>
                `;
            } else {
                backgroundStyle = 'background: linear-gradient(180deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.8)); border: 1px dashed rgba(124, 58, 237, 0.2);';
                headerContent = `
                    <span class="text-slate-500 text-xs flex flex-col items-center justify-center font-extrabold text-center tracking-widest leading-tight uppercase px-2">
                        <i class="fas fa-hourglass-start mb-1 text-slate-600 animate-pulse"></i>
                        Bản đồ ${mapIndex + 1}
                    </span>
                `;
            }

            headerRow += `<th scope="col" class="map-column-header px-4 py-4 text-center text-xs font-extrabold text-cyan-400 uppercase tracking-wider" style="${backgroundStyle} width: 210px; min-width: 210px; max-width: 210px;">
                    <div class="map-column-header-content flex flex-col items-center justify-center min-h-[60px]">
                        ${headerContent}
                    </div>
                </th>`;
        });

        headerRow += `</tr>`;
        thead.innerHTML = headerRow;

        // Tạo body
        tbody.innerHTML = '';
        rankingData.forEach((racer, racerRankIndex) => {
            const racerIndex = racer.originalIndex;
            let racerName = racer.name;
            let teamStyleClass = '';
            
            if (raceState.isTeamMode) {
                const isTeam1 = (racerIndex === 0 || racerIndex === 2);
                teamStyleClass = isTeam1 ? 'text-red-400 font-bold' : 'text-blue-400 font-bold';
                const teamBadge = isTeam1 ? '<span class="text-[10px] bg-red-500/20 px-1 rounded mr-1">T1</span>' : '<span class="text-[10px] bg-blue-500/20 px-1 rounded mr-1">T2</span>';
                racerName = `${teamBadge}${racer.name}`;
            }

            let rowHtml = `<tr class="hover:bg-slate-700/50 transition-colors ${racer.rank <= 3 ? 'font-bold' : ''}">`;

            raceState.maps.forEach((map, mapIndex) => {
                const isMapActive = map.name && map.name.trim() !== '' && map.name.trim().toLowerCase() !== 'chưa đặt tên';
                
                if (isMapActive) {
                    const pointValue = mapPointsMatrix[mapIndex][racerIndex];
                    
                    if (raceState.is1vs1Mode) {
                        const isWinner = pointValue === 1;
                        const scoreStyle = isWinner ? 'style="color: #fbbf24 !important; text-shadow: 0 0 15px rgba(251, 191, 36, 0.6), 0 2px 4px rgba(0, 0, 0, 0.8);"' : '';
                        rowHtml += `<td class="map-score-cell-td px-3 py-3 text-center">
                                <div class="map-racer-label">${racer.name}</div>
                                <div class="map-score-cell" ${scoreStyle}>${isWinner ? 'WIN' : '-'}</div>
                            </td>`;
                    } else {
                        const isWinner = pointValue >= 11;
                        const scoreStyle = isWinner ? 'style="color: #fbbf24 !important; text-shadow: 0 0 15px rgba(251, 191, 36, 0.6), 0 2px 4px rgba(0, 0, 0, 0.8);"' : '';
                        rowHtml += `<td class="map-score-cell-td px-3 py-3 text-center">
                                <div class="map-racer-label">${racer.name}</div>
                                <div class="map-score-cell" ${scoreStyle}>+${pointValue}</div>
                            </td>`;
                    }
                } else {
                    if (racerRankIndex === 0) {
                        rowHtml += `<td rowspan="${getNumRacers()}" class="map-score-cell-td px-3 py-3 text-center" style="background: rgba(15, 23, 42, 0.4) !important; vertical-align: middle;">
                            <div class="flex flex-col items-center justify-center py-6 animate__animated animate__pulse animate__infinite" style="animation-duration: 3s;">
                                <div class="relative w-14 h-14 flex items-center justify-center">
                                    <svg class="absolute text-cyan-500/10 w-14 h-14" fill="currentColor" viewBox="0 0 24 24" style="transform: scaleX(-1);"><path d="M2 7.5h6v1H2zm-1 2h8v1H1zm2 2h5v1H3zm-2 2h7v1H1z" opacity="0.3"/></svg>
                                    <svg class="w-10 h-10 text-cyan-500/35 animate-spin" style="animation-duration: 5s;" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-9c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm0-6c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1s1-.45 1-1V6c0-.55-.45-1-1-1zm0 10c-.55 0-1 .45-1 1v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1zm-5-3c0-.55.45-1 1-1h2c.55 0 1 .45 1 1s-.45 1-1 1H8c-.55 0-1-.45-1-1zm10 0c0-.55.45-1 1-1h2c.55 0 1 .45 1 1s-.45 1-1 1h-2c-.55 0-1-.45-1-1z"/></svg>
                                </div>
                                <span class="text-[9px] text-slate-500 font-extrabold uppercase mt-2 tracking-widest">ĐANG CHỜ</span>
                            </div>
                        </td>`;
                    }
                }
            });

            rowHtml += `</tr>`;
            tbody.insertAdjacentHTML('beforeend', rowHtml);
        });
    }

    const teamSummaryContainer = document.getElementById('team-summary-container');
    if (raceState.isTeamMode && teamSummaryContainer) {
        teamSummaryContainer.classList.remove('hidden');
        let team1Total = 0;
        let team2Total = 0;
        
        rankingData.forEach(r => {
            const rIdx = r.originalIndex;
            const isTeam1 = (rIdx === 0 || rIdx === 2);
            if (isTeam1) team1Total += r.totalScore;
            else team2Total += r.totalScore;
        });
        
        const team1Names = (raceState.racers[0]?.name || '---') + ' & ' + (raceState.racers[2]?.name || '---');
        const team2Names = (raceState.racers[1]?.name || '---') + ' & ' + (raceState.racers[3]?.name || '---');

        teamSummaryContainer.innerHTML = `
            <div class="neon-card p-6 border-l-4 border-l-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)] bg-gradient-to-br from-red-900/20 to-transparent flex items-center justify-between">
                <div>
                    <div class="text-xs text-red-400/80 font-bold tracking-widest uppercase mb-1">TỔNG KẾT ĐIỂM</div>
                    <div class="text-3xl font-black text-red-400 uppercase tracking-wider">${raceState.teamNames?.[0] || 'Đội 1'}</div>
                    <div class="text-sm text-red-300/70 mt-1 italic"><i class="fas fa-users text-xs mr-1"></i> ${team1Names}</div>
                </div>
                <div class="text-5xl font-black text-white font-numeric tracking-tighter drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                    ${team1Total}
                </div>
            </div>
            <div class="neon-card p-6 border-r-4 border-r-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.2)] bg-gradient-to-bl from-blue-900/20 to-transparent flex items-center justify-between">
                <div class="text-5xl font-black text-white font-numeric tracking-tighter drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                    ${team2Total}
                </div>
                <div class="text-right">
                    <div class="text-xs text-blue-400/80 font-bold tracking-widest uppercase mb-1">TỔNG KẾT ĐIỂM</div>
                    <div class="text-3xl font-black text-blue-400 uppercase tracking-wider">${raceState.teamNames?.[1] || 'Đội 2'}</div>
                    <div class="text-sm text-blue-300/70 mt-1 italic">${team2Names} <i class="fas fa-users text-xs ml-1"></i></div>
                </div>
            </div>
        `;
    } else if (teamSummaryContainer) {
        teamSummaryContainer.classList.add('hidden');
    }

    // Render Widescreen Scoreboard Summary Bar (S-League style)
    const summaryBarContainer = document.getElementById('scoreboard-summary-bar-container');
    if (summaryBarContainer) {
        summaryBarContainer.classList.remove('hidden');
        
        if (raceState.is1vs1Mode && matchState) {
            const _rankingData = rankingData || calculateRanking();
            const p1 = _rankingData.find(r => r.originalIndex === 0) || { name: 'Tay đua 1', totalScore: 0 };
            const p2 = _rankingData.find(r => r.originalIndex === 1) || { name: 'Tay đua 2', totalScore: 0 };
            
            const currentBO = typeof scoreboardBOTab !== 'undefined' ? scoreboardBOTab : matchState.currentBO;
            let currentBOWins = [0, 0];
            if (currentBO === 1) currentBOWins = matchState.bo1.wins;
            else if (currentBO === 2) currentBOWins = matchState.bo2.wins;
            else if (currentBO === 3) currentBOWins = matchState.bo3.wins;

            // Find player avatars
            const u1Info = (typeof ALL_USERS !== 'undefined') ? ALL_USERS.find(u =>
                (u.nickname && u.nickname.trim() === p1.name.trim()) ||
                (u.displayName && u.displayName.trim() === p1.name.trim())
            ) : null;
            const u1Avatar = (u1Info && u1Info.photoBase64) ? u1Info.photoBase64 :
                (u1Info && u1Info.photoURL && u1Info.photoURL !== 'logoWS.png') ? u1Info.photoURL : null;

            const u2Info = (typeof ALL_USERS !== 'undefined') ? ALL_USERS.find(u =>
                (u.nickname && u.nickname.trim() === p2.name.trim()) ||
                (u.displayName && u.displayName.trim() === p2.name.trim())
            ) : null;
            const u2Avatar = (u2Info && u2Info.photoBase64) ? u2Info.photoBase64 :
                (u2Info && u2Info.photoURL && u2Info.photoURL !== 'logoWS.png') ? u2Info.photoURL : null;

            summaryBarContainer.innerHTML = `
                <div class="animate__animated animate__fadeInUp flex items-center w-full font-bold px-6 py-4 rounded-2xl mt-6" style="background: linear-gradient(135deg, rgba(8,8,30,0.97) 0%, rgba(15,15,45,0.97) 50%, rgba(8,8,30,0.97) 100%); border: 1px solid rgba(99,179,237,0.25); box-shadow: 0 0 40px rgba(6,182,212,0.15), inset 0 1px 0 rgba(255,255,255,0.05);">

                    <!-- Far Left: Tổng điểm (anchored to edge) -->
                    <div class="flex-1 flex justify-start items-center">
                        <span class="text-5xl font-black font-numeric text-center drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]" style="color:#f59e0b; min-width:48px; font-family:'Orbitron',sans-serif;">${matchState.overallScore[0]}</span>
                    </div>

                    <!-- Left inner: Avatar+Tên | BO Wins (sát logo) -->
                    <div class="flex items-center gap-4">
                        <div class="h-10 w-px" style="background:rgba(99,179,237,0.2);"></div>
                        <div class="flex items-center gap-3">
                            ${u1Avatar ? `
                                <img src="${u1Avatar}" class="w-10 h-10 rounded-full object-cover border border-white/10 shadow-lg" style="box-shadow: 0 0 12px rgba(99,102,241,0.5);">
                            ` : `
                                <div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black shadow-lg" style="background: linear-gradient(135deg, #3b82f6, #6366f1); box-shadow: 0 0 12px rgba(99,102,241,0.5);">
                                    ${p1.name.charAt(0).toUpperCase()}
                                </div>
                            `}
                            <span class="text-xl font-black tracking-wider" style="color:#e2e8f0; text-shadow: 0 0 20px rgba(148,163,184,0.4);">${p1.name}</span>
                        </div>
                        <div class="h-10 w-px" style="background:rgba(99,179,237,0.2);"></div>
                        <span class="text-4xl font-black font-numeric text-center" style="color:#67e8f9; min-width:40px; font-family:'Orbitron',sans-serif; text-shadow: 0 0 15px rgba(103,232,249,0.6);">${currentBOWins[0]}</span>
                    </div>

                    <!-- Center: Logo -->
                    <div class="flex flex-col items-center justify-center px-6 gap-1">
                        <img src="assets/images/logows.png" alt="Westar Tournament" class="object-contain" style="height:56px; width:auto; filter: drop-shadow(0 0 12px rgba(103,232,249,0.5)) brightness(1.2);" onerror="this.src='https://raw.githubusercontent.com/run-to-future/westar-scoreboard/main/public/assets/images/logows.png'">
                        <span class="text-[9px] font-extrabold tracking-[0.2em] uppercase text-center whitespace-nowrap" style="color:rgba(103,232,249,0.6);">westar tournament</span>
                    </div>

                    <!-- Right inner: BO Wins | Tên+Avatar (sát logo) -->
                    <div class="flex items-center gap-4">
                        <span class="text-4xl font-black font-numeric text-center" style="color:#67e8f9; min-width:40px; font-family:'Orbitron',sans-serif; text-shadow: 0 0 15px rgba(103,232,249,0.6);">${currentBOWins[1]}</span>
                        <div class="h-10 w-px" style="background:rgba(99,179,237,0.2);"></div>
                        <div class="flex items-center gap-3">
                            <span class="text-xl font-black tracking-wider" style="color:#e2e8f0; text-shadow: 0 0 20px rgba(148,163,184,0.4);">${p2.name}</span>
                            ${u2Avatar ? `
                                <img src="${u2Avatar}" class="w-10 h-10 rounded-full object-cover border border-white/10 shadow-lg" style="box-shadow: 0 0 12px rgba(244,63,94,0.5);">
                            ` : `
                                <div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black shadow-lg" style="background: linear-gradient(135deg, #ec4899, #f43f5e); box-shadow: 0 0 12px rgba(244,63,94,0.5);">
                                    ${p2.name.charAt(0).toUpperCase()}
                                </div>
                            `}
                        </div>
                        <div class="h-10 w-px" style="background:rgba(99,179,237,0.2);"></div>
                    </div>

                    <!-- Far Right: Tổng điểm (anchored to edge) -->
                    <div class="flex-1 flex justify-end items-center">
                        <span class="text-5xl font-black font-numeric text-center drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]" style="color:#f59e0b; min-width:48px; font-family:'Orbitron',sans-serif;">${matchState.overallScore[1]}</span>
                    </div>
                </div>
            `;
            return;
        }

        const getRacerData = (index) => {
            const name = raceState.racers[index]?.name || `Player ${index + 1}`;
            const found = rankingData.find(r => r.originalIndex === index);
            return {
                name: name,
                score: found ? found.totalScore : 0
            };
        };

        const r1 = getRacerData(0);
        const r2 = getRacerData(1);
        const r3 = getRacerData(2);
        const r4 = getRacerData(3);

        let left1, left2, right1, right2;
        let scoreClass1, scoreClass2, scoreClass3, scoreClass4;
        let centerLabel = "CHUNG CUỘC";

        if (raceState.isTeamMode) {
            left1 = r1; 
            left2 = r3; 
            right1 = r2; 
            right2 = r4; 
            centerLabel = "TEAM STANDINGS";
            
            scoreClass1 = 'team-red text-red-500';
            scoreClass2 = 'team-red text-red-500';
            scoreClass3 = 'team-blue text-blue-500';
            scoreClass4 = 'team-blue text-blue-500';
        } else {
            left1 = r1;
            left2 = r2;
            right1 = r3;
            right2 = r4;
            centerLabel = "INDIVIDUAL SPRINT";
            
            scoreClass1 = 'text-cyan-400';
            scoreClass2 = 'text-cyan-400';
            scoreClass3 = 'text-cyan-400';
            scoreClass4 = 'text-cyan-400';
        }

        const roundNum = raceState.maps.filter(map =>
            map.times && map.times.some(t => t && t.trim() !== '' && t.trim() !== "--'--'--")
        ).length;

        summaryBarContainer.innerHTML = `
            <div class="summary-bar-container animate__animated animate__fadeInUp">
                <!-- Player Left 1 -->
                <div class="summary-bar-player">
                    <span class="summary-bar-player-name" title="${left1.name}">${left1.name}</span>
                    <span class="summary-bar-player-score ${scoreClass1}">${left1.score}</span>
                </div>
                
                <div class="summary-bar-divider"></div>
                
                <!-- Player Left 2 -->
                <div class="summary-bar-player">
                    <span class="summary-bar-player-name" title="${left2.name}">${left2.name}</span>
                    <span class="summary-bar-player-score ${scoreClass2}">${left2.score}</span>
                </div>
                
                <!-- Center Round Badge -->
                <div class="summary-bar-center">
                    <div class="summary-bar-center-inner">
                        <span class="summary-bar-round">ROUND ${roundNum}</span>
                        <br>
                        <span class="summary-bar-mode">${centerLabel}</span>
                    </div>
                </div>
                
                <!-- Player Right 1 -->
                <div class="summary-bar-player">
                    <span class="summary-bar-player-name" title="${right1.name}">${right1.name}</span>
                    <span class="summary-bar-player-score ${scoreClass3}">${right1.score}</span>
                </div>
                
                <div class="summary-bar-divider"></div>
                
                <!-- Player Right 2 -->
                <div class="summary-bar-player">
                    <span class="summary-bar-player-name" title="${right2.name}">${right2.name}</span>
                    <span class="summary-bar-player-score ${scoreClass4}">${right2.score}</span>
                </div>
            </div>
        `;
    }
};


const renderRankingTable = (rankingData) => {
    const tbody = document.getElementById('ranking-table-body');
    tbody.innerHTML = '';

    // Team mode display
    const teamRankingContainer = document.getElementById('team-ranking-container');
    if (teamRankingContainer) {
        if (raceState.isTeamMode) {
            teamRankingContainer.classList.remove('hidden');
            
            // Calculate team scores
            let team1Score = 0;
            let team2Score = 0;
            
            const r1 = rankingData.find(r => r.originalIndex === 0);
            const r3 = rankingData.find(r => r.originalIndex === 2);
            const r2 = rankingData.find(r => r.originalIndex === 1);
            const r4 = rankingData.find(r => r.originalIndex === 3);
            
            if(r1) team1Score += r1.totalScore;
            if(r3) team1Score += r3.totalScore;
            if(r2) team2Score += r2.totalScore;
            if(r4) team2Score += r4.totalScore;
            
            document.getElementById('team1-total-score').textContent = team1Score;
            document.getElementById('team2-total-score').textContent = team2Score;
            
            const teamNames = raceState.teamNames || ['Đội 1', 'Đội 2'];
            document.getElementById('team1-name-display').textContent = teamNames[0] || 'Đội 1';
            document.getElementById('team2-name-display').textContent = teamNames[1] || 'Đội 2';
            
            const name1 = r1 ? r1.name : 'TĐ 1';
            const name3 = r3 ? r3.name : 'TĐ 3';
            const name2 = r2 ? r2.name : 'TĐ 2';
            const name4 = r4 ? r4.name : 'TĐ 4';
            
            document.getElementById('team1-members').textContent = `${name1} & ${name3}`;
            document.getElementById('team2-members').textContent = `${name2} & ${name4}`;
            
            // Highlight winner
            const card1 = document.getElementById('team1-score-card');
            const card2 = document.getElementById('team2-score-card');
            
            if (team1Score > team2Score) {
                card1.classList.add('shadow-[0_0_25px_rgba(239,68,68,0.4)]');
                card1.classList.remove('opacity-70');
                card2.classList.add('opacity-70');
                card2.classList.remove('shadow-[0_0_25px_rgba(59,130,246,0.4)]');
            } else if (team2Score > team1Score) {
                card2.classList.add('shadow-[0_0_25px_rgba(59,130,246,0.4)]');
                card2.classList.remove('opacity-70');
                card1.classList.add('opacity-70');
                card1.classList.remove('shadow-[0_0_25px_rgba(239,68,68,0.4)]');
            } else {
                card1.classList.remove('opacity-70');
                card2.classList.remove('opacity-70');
            }
        } else {
            teamRankingContainer.classList.add('hidden');
        }
    }

    const topRacers = rankingData.slice(0, Math.min(rankingData.length, 4));

    topRacers.forEach((racer, index) => {
        let rankContent = racer.rank;
        let scoreClass = 'text-white';
        let trendIcon = '';

        if (racer.rank === 1) {
            rankContent = '<div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-amber-500/30 shadow-[0_0_15px_rgba(251,191,36,0.1)]"><span class="text-xl">🥇</span></div>';
            scoreClass = 'text-white';
        } else if (racer.rank === 2) {
            rankContent = '<div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-slate-400/30"><span class="text-xl">🥈</span></div>';
            scoreClass = 'text-slate-300';
        } else if (racer.rank === 3) {
            rankContent = '<div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-orange-500/30"><span class="text-xl">🥉</span></div>';
            scoreClass = 'text-slate-400';
        } else {
            rankContent = `<div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 text-slate-500 text-xs font-black">#${racer.rank}</div>`;
        }

        const trendValue = (racer.originalIndex + 1) - racer.rank;
        if (trendValue > 0) {
            trendIcon = `<span class="flex items-center text-green-400 text-[10px] font-black uppercase"><i class="fas fa-caret-up mr-1 text-sm"></i> +${trendValue}</span>`;
        } else if (trendValue < 0) {
            trendIcon = `<span class="flex items-center text-red-400 text-[10px] font-black uppercase"><i class="fas fa-caret-down mr-1 text-sm"></i> ${trendValue}</span>`;
        } else {
            trendIcon = `<span class="flex items-center text-slate-600 text-[10px] font-black uppercase"><i class="fas fa-minus mr-1"></i> 0</span>`;
        }

        const rowHtml = `
            <tr class="group hover:bg-white/5 transition-all duration-200">
                <td class="px-6 py-5 flex justify-center items-center">
                    ${rankContent}
                </td>
                <td class="px-6 py-5">
                    <div class="flex items-center space-x-3">
                        ${(() => {
                            const userInfo = ALL_USERS.find(u =>
                                (u.nickname && u.nickname.trim() === racer.name.trim()) ||
                                (u.displayName && u.displayName.trim() === racer.name.trim())
                            );
                            const avatarSrc = (userInfo && userInfo.photoBase64) ? userInfo.photoBase64 :
                                (userInfo && userInfo.photoURL && userInfo.photoURL !== 'logoWS.png') ? userInfo.photoURL : null;

                            const isRank1 = (racer.rank === 1);
                            const frameClass = isRank1 ? 'avatar-frame-vip w-9 h-9 flex items-center justify-center' : '';
                            const imgClass = isRank1 ? 'w-8 h-8 rounded-full object-cover relative z-10 border border-white/10' : 'w-8 h-8 rounded-lg object-cover border border-white/10 shadow-lg';
                            const placeholderClass = isRank1 ? 'w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/5 opacity-80 relative z-10' : 'w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center border border-white/5 opacity-50';

                            let avatarHtml = '';
                            if (avatarSrc) {
                                avatarHtml = `<img src="${avatarSrc}" class="${imgClass}" alt="avatar">`;
                            } else {
                                avatarHtml = `<div class="${placeholderClass}">
                                                <i class="fas fa-user-ninja text-[10px] text-slate-600"></i>
                                              </div>`;
                            }

                            if (isRank1) {
                                return `<div class="${frameClass}">${avatarHtml}</div>`;
                            } else {
                                return avatarHtml;
                            }
                        })()}
                        <div class="flex flex-col">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="text-sm font-black text-white uppercase tracking-tight text-left">${racer.name}</span>
                                ${(() => {
                                    const titles = (window.RACER_VIP_TITLES && window.RACER_VIP_TITLES[racer.name.trim()]) || [];
                                    return titles.map(t => `
                                        <span class="vip-badge-base ${t.className}" title="${t.desc}">
                                            <i class="fas ${t.icon} mr-1 text-[8px]"></i>${t.name}
                                        </span>
                                    `).join('');
                                })()}
                            </div>
                            <span class="text-[9px] text-slate-600 uppercase font-black tracking-widest mt-1 text-left">Player ${racer.originalIndex + 1}</span>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-5">
                    <div class="text-center font-black ${scoreClass} text-2xl tracking-tighter">${racer.totalScore}</div>
                </td>
                <td class="px-6 py-5">
                    <div class="flex justify-center">${trendIcon}</div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', rowHtml);
    });
};

const updateUI = () => {
    const rankingData = calculateRanking();
    calculateRacerTitles();
    renderRacerInputsWithDropdown();
    renderMapTables();
    renderDetailedScoreboard(rankingData);
    renderRankingTable(rankingData);
    updateStatistics();
    initBtcWheel();

    // Cập nhật mô tả quy tắc tính điểm
    const pointRuleTextEl = document.getElementById('point-rule-text');
    if (pointRuleTextEl) {
        if (raceState.is1vs1Mode) {
            pointRuleTextEl.innerHTML = `Chế độ 1vs1: Mỗi map đấu thắng được tính 1 điểm. Tuyển thủ đạt 5 điểm trước sẽ thắng BO đấu hiện tại.`;
        } else {
            pointRuleTextEl.innerHTML = `Tay đua nhanh nhất được 11 điểm (hoặc 12 điểm nếu là King Map Owner). Các tay đua sau bị trừ 1 điểm cho mỗi giây trễ so với người nhanh nhất.`;
        }
    }

    // THÊM: Attach event listeners cho input
    attachInputListeners();

    renderHallOfFame();

    // TẮT auto-scroll khi đang edit
    if (!isEditing && mapIdToScroll) {
        requestAnimationFrame(() => {
            const newMapRow = document.getElementById(`map-row-${mapIdToScroll}`);
            if (newMapRow) {
                newMapRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                gsap.to(newMapRow, {
                    backgroundColor: 'rgba(0, 243, 255, 0.1)',
                    duration: 0.5,
                    yoyo: true,
                    repeat: 1
                });
            }
            mapIdToScroll = null;
        });
    }

    const lastUpdateEl = document.getElementById('last-update');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = 'Vừa xong';
    }
};

// --- Global Event Handlers ---
window.handleNameChange = (newName, index) => {
    const newState = { ...raceState, racers: [...raceState.racers] };
    const updatedRacer = { ...newState.racers[index], name: newName.trim() };
    newState.racers[index] = updatedRacer;
    raceState = ensureInitialMaps(newState);
    saveRaceState(raceState);
    displayMessage("Đã cập nhật tên tay đua!");
};

window.handleKingMapChange = (newValue, index) => {
    const inputElement = document.getElementById(`king-map-${index}`);
    const trimmedKingMap = newValue.trim();
    const currentBtcMap = raceState.firstMapBtc.trim();
    const oldKingMap = raceState.racers[index].kingMap || '';

    // 1. Trường hợp để trống (Xoá King Map)
    if (!trimmedKingMap) {
        const newState = { ...raceState, racers: [...raceState.racers] };
        newState.racers[index] = { ...newState.racers[index], kingMap: '' };

        // Kiểm tra xem map cũ có còn cần thiết không
        const requiredAfter = getRequiredMapNames(newState);
        if (oldKingMap && !requiredAfter.includes(oldKingMap)) {
            newState.maps = newState.maps.filter(m => m.name.trim() !== oldKingMap);
        }

        raceState = ensureInitialMaps(newState);
        saveRaceState(raceState);
        displayMessage("Đã xoá King Map!");
        return;
    }

    // 2. Kiểm tra bản đồ có tồn tại trong danh sách (Dữ liệu Firestore) hay không
    const mapInfo = ALL_MAPS.find(m => m.name.trim().toLowerCase() === trimmedKingMap.toLowerCase());
    if (!mapInfo) {
        inputElement.value = oldKingMap; // Khôi phục giá trị cũ
        displayMessage(`⚠️ Bản đồ "${trimmedKingMap}" không tồn tại trong danh sách dữ liệu hệ thống!`, true);
        return;
    }

    const officialMapName = mapInfo.name.trim();

    // 3. Kiểm tra trùng BTC
    if (officialMapName === currentBtcMap) {
        inputElement.value = oldKingMap;
        displayMessage(`⚠️ King Map "${officialMapName}" không được trùng với Map BTC ("${currentBtcMap}")!`, true);
        return;
    }

    // 4. Kiểm tra trùng với tay đua khác
    const activeRacersCount = raceState.is1vs1Mode ? 2 : raceState.racers.length;
    const otherKingMaps = raceState.racers.slice(0, activeRacersCount).filter((_, i) => i !== index).map(r => r.kingMap.trim());
    if (otherKingMaps.includes(officialMapName)) {
        inputElement.value = oldKingMap;
        displayMessage(`⚠️ King Map "${officialMapName}" đã bị trùng với tay đua khác!`, true);
        return;
    }

    // 5. Cập nhật và Xoá Map cũ nếu cần
    const newState = { ...raceState, racers: [...raceState.racers] };
    newState.racers[index] = { ...newState.racers[index], kingMap: officialMapName };

    // Logic xoá map cũ nếu nó không còn là King Map của ai khác và không phải BTC
    const requiredAfter = getRequiredMapNames(newState);
    if (oldKingMap && oldKingMap !== officialMapName && !requiredAfter.includes(oldKingMap)) {
        newState.maps = newState.maps.filter(m => m.name.trim() !== oldKingMap);
    }

    raceState = ensureInitialMaps(newState);
    saveRaceState(raceState);
    displayMessage("Đã cập nhật King Map!");
};

window.handleBanMapChange = (newValue, index, banIndex) => {
    const inputElement = document.getElementById(`ban-map-${index}-${banIndex}`);
    const trimmedBanMap = newValue.trim();
    const currentBtcMap = (raceState.firstMapBtc || '').trim();
    
    const racerBans = raceState.racers[index].banMaps || ['', ''];
    const oldBanMap = racerBans[banIndex] || '';

    // 1. Trường hợp để trống (Xoá cấm map)
    if (!trimmedBanMap) {
        const newState = { ...raceState, racers: [...raceState.racers] };
        if (!newState.racers[index].banMaps) {
            newState.racers[index].banMaps = ['', ''];
        }
        newState.racers[index].banMaps[banIndex] = '';
        raceState = newState;
        saveRaceState(raceState);
        displayMessage("Đã xoá map cấm!");
        return;
    }

    // 2. Kiểm tra bản đồ có tồn tại trong danh sách dữ liệu hệ thống hay không
    const mapInfo = ALL_MAPS.find(m => m.name.trim().toLowerCase() === trimmedBanMap.toLowerCase());
    if (!mapInfo) {
        inputElement.value = oldBanMap; // Khôi phục giá trị cũ
        displayMessage(`⚠️ Bản đồ "${trimmedBanMap}" không tồn tại trong hệ thống!`, true);
        return;
    }

    const officialMapName = mapInfo.name.trim();

    // 3. Kiểm tra trùng BTC
    if (officialMapName === currentBtcMap) {
        inputElement.value = oldBanMap;
        displayMessage(`⚠️ Map cấm "${officialMapName}" không được trùng với Map BTC ("${currentBtcMap}")!`, true);
        return;
    }

    // 4. Kiểm tra trùng với map cấm khác của chính mình hoặc tay đua còn lại
    const otherBans = [];
    for (let i = 0; i < 2; i++) {
        const rBans = raceState.racers[i].banMaps || ['', ''];
        for (let j = 0; j < 2; j++) {
            if (!(i === index && j === banIndex)) {
                if (rBans[j] && rBans[j].trim()) {
                    otherBans.push(rBans[j].trim());
                }
            }
        }
    }

    if (otherBans.includes(officialMapName)) {
        inputElement.value = oldBanMap;
        displayMessage(`⚠️ Bản đồ "${officialMapName}" đã bị cấm bởi tay đua khác hoặc ở ô cấm khác!`, true);
        return;
    }

    // 5. Cập nhật map cấm
    const newState = { ...raceState, racers: [...raceState.racers] };
    if (!newState.racers[index].banMaps) {
        newState.racers[index].banMaps = ['', ''];
    }
    newState.racers[index].banMaps[banIndex] = officialMapName;
    raceState = newState;
    saveRaceState(raceState);
    displayMessage("Đã cập nhật map cấm!");
};

window.handleBtcMapChange = (newName) => {
    const inputElement = document.getElementById('btc-map-name');
    const trimmedBtcMap = newName.trim();
    const oldBtcMap = raceState.firstMapBtc || '';

    // 1. Trường hợp để trống
    if (!trimmedBtcMap) {
        const newState = { ...raceState, firstMapBtc: '' };

        // Xoá map cũ nếu không còn cần thiết
        const requiredAfter = getRequiredMapNames(newState);
        if (oldBtcMap && !requiredAfter.includes(oldBtcMap)) {
            newState.maps = newState.maps.filter(m => m.name.trim() !== oldBtcMap);
        }

        raceState = ensureInitialMaps(newState);
        saveRaceState(raceState);
        displayMessage("Đã xoá Map BTC!");
        return;
    }

    // 2. Kiểm tra tồn tại
    const mapInfo = ALL_MAPS.find(m => m.name.trim().toLowerCase() === trimmedBtcMap.toLowerCase());
    if (!mapInfo) {
        inputElement.value = oldBtcMap;
        displayMessage(`⚠️ Bản đồ "${trimmedBtcMap}" không tồn tại trong danh sách dữ liệu hệ thống!`, true);
        return;
    }

    const officialMapName = mapInfo.name.trim();

    // 3. Kiểm tra trùng với bất kỳ King Map nào
    const kingMaps = raceState.racers.map(r => r.kingMap.trim());
    if (kingMaps.includes(officialMapName)) {
        inputElement.value = oldBtcMap;
        displayMessage(`⚠️ Map BTC "${officialMapName}" không được trùng với King Map của các tay đua!`, true);
        return;
    }

    // Kiểm tra trùng với bất kỳ Map cấm nào
    if (raceState.is1vs1Mode) {
        const bannedMaps = [];
        for (let i = 0; i < 2; i++) {
            const racer = raceState.racers[i];
            if (racer && racer.banMaps) {
                racer.banMaps.forEach(ban => {
                    if (ban && ban.trim()) bannedMaps.push(ban.trim().toLowerCase());
                });
            }
        }
        if (bannedMaps.includes(officialMapName.toLowerCase())) {
            inputElement.value = oldBtcMap;
            displayMessage(`⚠️ Map BTC "${officialMapName}" đã bị cấm, không thể chọn làm Map BTC!.`, true);
            return;
        }
    }

    // 4. Cập nhật và xoá map cũ
    const newState = { ...raceState, firstMapBtc: officialMapName };
    const requiredAfter = getRequiredMapNames(newState);
    if (oldBtcMap && oldBtcMap !== officialMapName && !requiredAfter.includes(oldBtcMap)) {
        newState.maps = newState.maps.filter(m => m.name.trim() !== oldBtcMap);
    }

    raceState = ensureInitialMaps(newState);
    saveRaceState(raceState);
    displayMessage("Đã cập nhật Map BTC!");
};

window.handleTimeInputAndSave = (input) => {
    const mapIndex = parseInt(input.getAttribute('data-map-index'));
    const racerIndex = parseInt(input.getAttribute('data-racer-index'));
    const timeString = input.value.trim();
    const seconds = timeToSeconds(timeString);
    const newState = { ...raceState, maps: [...raceState.maps] };

    if (seconds === null || seconds === 0) {
        newState.maps[mapIndex].times[racerIndex] = null;
        input.value = '';
        if (timeString) {
            displayMessage("⚠️ Thời gian nhập không đúng format! (MM'SS'MS hoặc 10423). Đã reset ô này.", true);
        }
    } else {
        const formattedTime = secondsToTimeString(seconds);
        newState.maps[mapIndex].times[racerIndex] = formattedTime;
        input.value = formattedTime;

        // Lưu thành tích vào Firestore
        const mapName = raceState.maps[mapIndex].name;
        const car = raceState.maps[mapIndex].cars[racerIndex];
        const pet = raceState.maps[mapIndex].pets[racerIndex];

        saveRaceRecord(mapName, racerIndex, seconds, car, pet);
    }

    raceState = newState;
    saveRaceState(raceState);

    // Kiểm tra xem map đã hoàn thành chưa sau khi nhập thời gian
    setTimeout(() => {
        checkIfMapCompleted(mapIndex);
    }, 500);
};

// Hàm kiểm tra xem map đã hoàn thành chưa
const checkIfMapCompleted = async (mapIndex) => {
    try {
        const map = raceState.maps[mapIndex];
        if (!map || !map.times || !map.cars || !map.pets) return;

        // Đếm số tay đua đã có thông tin đầy đủ (thời gian, xe, pet)
        const completedRacers = map.times.filter((time, index) => {
            const hasValidTime = time && time.trim() && time.trim() !== "--'--'--" && timeToSeconds(time) > 0;
            const hasValidCar = map.cars[index] && map.cars[index].trim() !== '';
            const hasValidPet = map.pets[index] && map.pets[index].trim() !== '';

            return hasValidTime && hasValidCar && hasValidPet;
        }).length;

        console.log(`Map ${map.name}: ${completedRacers}/${getNumRacers()} tay đua đã hoàn thành đầy đủ`);

        // Nếu tất cả tay đua đã có thông tin đầy đủ
        if (completedRacers === getNumRacers()) {


            // Kiểm tra và cập nhật record
            await checkAndUpdateRecordForMap(mapIndex);

            // Hiển thị thông báo thành công
            displayMessage(`✅ Map "${map.name}" đã hoàn thành!`, false);
        } else {
            // Hiển thị thông báo nếu còn thiếu thông tin
            const incompleteCount = getNumRacers() - completedRacers;
            if (incompleteCount > 0) {
                console.log(`⚠️ Còn thiếu thông tin của ${incompleteCount} tay đua cho map ${map.name}`);

                // Tìm ra những tay đua nào còn thiếu thông tin
                const missingInfo = [];
                for (let i = 0; i < getNumRacers(); i++) {
                    const racerName = raceState.racers[i]?.name || `Tay Đua ${i + 1}`;
                    const missingFields = [];

                    if (!map.times[i] || map.times[i].trim() === "--'--'--") {
                        missingFields.push('thời gian');
                    }
                    if (!map.cars[i] || map.cars[i].trim() === '') {
                        missingFields.push('xe');
                    }
                    if (!map.pets[i] || map.pets[i].trim() === '') {
                        missingFields.push('pet');
                    }

                    if (missingFields.length > 0) {
                        missingInfo.push(`${racerName} (thiếu ${missingFields.join(', ')})`);
                    }
                }

                if (missingInfo.length > 0) {
                    console.log(`Thiếu thông tin:`, missingInfo);
                }
            }
        }
    } catch (error) {
        console.error("Lỗi khi kiểm tra hoàn thành map:", error);
    }
};

// Hàm kiểm tra xem map đã có đầy đủ thông tin chưa
const isMapFullyCompleted = (map) => {
    if (!map || !map.times || !map.cars || !map.pets) return false;

    for (let i = 0; i < getNumRacers(); i++) {
        const hasValidTime = map.times[i] && map.times[i].trim() && map.times[i].trim() !== "--'--'--" && timeToSeconds(map.times[i]) > 0;
        const hasValidCar = map.cars[i] && map.cars[i].trim() !== '';
        const hasValidPet = map.pets[i] && map.pets[i].trim() !== '';

        if (!hasValidTime || !hasValidCar || !hasValidPet) {
            return false;
        }
    }

    return true;
};

// Hàm kiểm tra record cho map cụ thể
const checkAndUpdateRecordForMap = async (mapIndex) => {
    try {


        const map = raceState.maps[mapIndex];
        if (!map) {
            console.log(`❌ Không tìm thấy map tại index ${mapIndex}`);
            return;
        }

        // KIỂM TRA TẤT CẢ THÔNG TIN ĐẦY ĐỦ (Chỉ check các racer active)
        const activeTimes = map.times.slice(0, getNumRacers());
        const activeCars = map.cars.slice(0, getNumRacers());
        const activePets = map.pets.slice(0, getNumRacers());

        const isFullyCompleted = activeTimes.every(time =>
            time && time.trim() && time.trim() !== "--'--'--" && timeToSeconds(time) > 0
        ) && activeCars.every(car => car && car.trim() !== '')
            && activePets.every(pet => pet && pet.trim() !== '');

        if (!isFullyCompleted) {
            console.log(`⏸️ Map ${map.name} chưa hoàn thành đầy đủ`);
            return;
        }

        const timesInSeconds = activeTimes.map(timeToSeconds);
        const validTimes = timesInSeconds.filter(t => t > 0);

        // Kiểm tra có đủ số tay đua không
        if (validTimes.length === getNumRacers()) {
            const bestTimeInMap = Math.min(...validTimes);
            const bestRacerIndexInMap = timesInSeconds.indexOf(bestTimeInMap);

            // Lấy thông tin xe và pet
            const bestCar = map.cars && map.cars[bestRacerIndexInMap];
            const bestPet = map.pets && map.pets[bestRacerIndexInMap];
            const bestRacerName = raceState.racers[bestRacerIndexInMap]?.name || `Tay Đua ${bestRacerIndexInMap + 1}`;

            // KIỂM TRA XE VÀ PET
            const hasValidCar = bestCar && bestCar.trim() !== '';
            const hasValidPet = bestPet && bestPet.trim() !== '';

            if (!hasValidCar || !hasValidPet) {
                console.log(`⚠️ Không thể cập nhật: Thiếu xe hoặc pet`);
                return;
            }

            console.log(`📋 Thông tin tốt nhất trong map:`);
            console.log(`- Tay đua: ${bestRacerName}`);
            console.log(`- Thời gian: ${secondsToTimeString(bestTimeInMap)}`);
            console.log(`- Xe: ${bestCar}`);
            console.log(`- Pet: ${bestPet}`);

            // Kiểm tra xem đã cập nhật record cho map này chưa
            const mapKey = `record_checked_${map.name}`;
            const lastChecked = localStorage.getItem(mapKey);
            const now = Date.now();

            // Chỉ cập nhật nếu chưa kiểm tra trong 30 giây
            if (!lastChecked || (now - parseInt(lastChecked) > 30000)) {
                console.log(`🔄 Kiểm tra và cập nhật record...`);

                const isUpdated = await updateMapRecord(map.name, {
                    timeInSeconds: bestTimeInMap,
                    timeString: secondsToTimeString(bestTimeInMap),
                    racerName: bestRacerName,
                    racerIndex: bestRacerIndexInMap,
                    car: bestCar,
                    pet: bestPet,
                    timestamp: new Date().toISOString()
                });

                if (isUpdated) {
                    // Hiển thị thông báo thành công (chỉ 1 lần)
                    showStatusMessage(`🎉 Đã cập nhật kỷ lục mới cho ${map.name}!`, false);

                    // Cập nhật lại dữ liệu từ Firestore
                    await fetchGameDataFromFirestore();
                    // Cập nhật UI
                    updateStatistics();

                    // Thêm hiệu ứng
                    const mapRow = document.getElementById(`map-row-${map.id}`);
                    if (mapRow) {
                        mapRow.classList.add('record-updated');
                        setTimeout(() => {
                            mapRow.classList.remove('record-updated');
                        }, 2000);
                    }
                } else {
                    console.log(`📭 Không có record mới để cập nhật`);
                }

                // Lưu thời điểm kiểm tra
                localStorage.setItem(mapKey, now.toString());
            } else {
                console.log(`⏰ Đã kiểm tra record gần đây, bỏ qua`);
            }
        }
    } catch (error) {
        console.error(`❌ Lỗi khi kiểm tra record cho map ${mapIndex}:`, error);
    }
};

window.handleMapNameChange = (newName, mapIndex) => {
    const trimmedNewName = newName.trim();
    const newState = { ...raceState, maps: [...raceState.maps] };

    if (trimmedNewName) {
        if (raceState.is1vs1Mode) {
            const bannedMaps = [];
            for (let i = 0; i < 2; i++) {
                const racer = raceState.racers[i];
                if (racer && racer.banMaps) {
                    racer.banMaps.forEach(ban => {
                        if (ban && ban.trim()) bannedMaps.push(ban.trim().toLowerCase());
                    });
                }
            }
            if (bannedMaps.includes(trimmedNewName.toLowerCase())) {
                newState.maps[mapIndex].name = '';
                raceState = newState;
                saveRaceState(raceState);
                displayMessage(`⚠️ Bản đồ "${trimmedNewName}" đã bị cấm, không thể chọn làm Map Tự Do!.`, true);
                return;
            }
        }

        const isDuplicated = newState.maps.some((map, index) => {
            return index !== mapIndex && map.name.trim() === trimmedNewName;
        });

        if (isDuplicated) {
            newState.maps[mapIndex].name = '';
            displayMessage(`⚠️ Bản đồ "${trimmedNewName}" đã được sử dụng, hãy chọn bản đồ khác!.`, true);
        } else {
            newState.maps[mapIndex].name = trimmedNewName;
        }
    } else {
        newState.maps[mapIndex].name = trimmedNewName;
    }

    raceState = newState;
    saveRaceState(raceState);
};

const isCarUsedByRacerInOtherMap = (state, carName, racerIndex, currentMapIndex) => {
    if (!carName) return null;
    const trimmedCarName = carName.trim().toLowerCase();

    if (state.is1vs1Mode) {
        const matchState = get1vs1MatchState(state.maps);
        const currentBO = matchState.mapBOs[currentMapIndex] || matchState.currentBO;

        for (let mapIndex = 0; mapIndex < state.maps.length; mapIndex++) {
            if (mapIndex === currentMapIndex) continue;

            const otherBO = matchState.mapBOs[mapIndex] || 1;
            const isSamePool = (currentBO === 3 && otherBO === 3) || 
                               ((currentBO === 1 || currentBO === 2) && (otherBO === 1 || otherBO === 2));

            if (isSamePool) {
                const usedCar = state.maps[mapIndex].cars[racerIndex];
                if (usedCar && usedCar.trim().toLowerCase() === trimmedCarName) {
                    return state.maps[mapIndex].name || `Trận ${mapIndex + 1}`;
                }
            }
        }
        return null;
    }

    for (let mapIndex = 0; mapIndex < state.maps.length; mapIndex++) {
        if (mapIndex === currentMapIndex) continue;

        const usedCar = state.maps[mapIndex].cars[racerIndex];
        if (usedCar && usedCar.trim().toLowerCase() === trimmedCarName) {
            return state.maps[mapIndex].name;
        }
    }
    return null;
};

const isPetUsedByRacerInOtherMap = (state, petName, racerIndex, currentMapIndex) => {
    // Không kiểm tra trùng pet nữa
    return null;
};

window.handleCarChange = (input) => {
    const mapIndex = parseInt(input.getAttribute('data-map-index'));
    const racerIndex = parseInt(input.getAttribute('data-racer-index'));
    const newCar = input.value.trim();
    const newState = { ...raceState, maps: [...raceState.maps] };
    const racerName = raceState.racers[racerIndex].name || `Tay Đua ${racerIndex + 1}`;

    if (newCar) {
        const mapUsedElsewhere = isCarUsedByRacerInOtherMap(raceState, newCar, racerIndex, mapIndex);

        if (mapUsedElsewhere) {
            const errorMessage = `⚠️ Xe "${newCar}" đã được sử dụng bởi ${racerName} ở Map "${mapUsedElsewhere}". Vui lòng chọn xe khác.`;
            displayMessage(errorMessage, true);

            input.value = '';
            newState.maps[mapIndex].cars[racerIndex] = null;
            raceState = newState;
            saveRaceState(raceState);
            return;
        }
    }

    newState.maps[mapIndex].cars[racerIndex] = newCar;
    raceState = newState;
    saveRaceState(raceState);

    // Kiểm tra xem map đã hoàn thành chưa sau khi cập nhật xe
    setTimeout(() => {
        checkIfMapCompleted(mapIndex);
    }, 500);
};

window.handlePetChange = (input) => {
    const mapIndex = parseInt(input.getAttribute('data-map-index'));
    const racerIndex = parseInt(input.getAttribute('data-racer-index'));
    const newPet = input.value.trim();
    const newState = { ...raceState, maps: [...raceState.maps] };
    const racerName = raceState.racers[racerIndex].name || `Tay Đua ${racerIndex + 1}`;

    if (newPet) {
        const mapUsedElsewhere = isPetUsedByRacerInOtherMap(raceState, newPet, racerIndex, mapIndex);

        if (mapUsedElsewhere) {
            const errorMessage = `⚠️ Pet "${newPet}" đã được sử dụng bởi ${racerName} ở Map "${mapUsedElsewhere}". Vui lòng chọn pet khác.`;
            displayMessage(errorMessage, true);

            input.value = '';
            newState.maps[mapIndex].pets[racerIndex] = null;
            raceState = newState;
            saveRaceState(raceState);
            return;
        }
    }

    newState.maps[mapIndex].pets[racerIndex] = newPet;
    raceState = newState;
    saveRaceState(raceState);

    // Kiểm tra xem map đã hoàn thành chưa sau khi cập nhật pet
    setTimeout(() => {
        checkIfMapCompleted(mapIndex);
    }, 500);
};

// Hàm hiển thị tất cả thông báo (dành cho cả người xem)
window.showAllNotifications = () => {
    // Đóng dropdown
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
    }

    // Tạo modal hiển thị tất cả thông báo
    const modalHtml = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" onclick="closeAllNotificationsModal()"></div>
            <div class="relative bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
                <div class="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800">
                    <div class="flex items-center justify-between">
                        <h3 class="text-xl font-bold text-white">
                            <i class="fas fa-bell mr-2"></i>
                            Tất cả thông báo (${notifications.length})
                        </h3>
                        <button onclick="closeAllNotificationsModal()" class="text-slate-400 hover:text-white p-2">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div class="p-6 overflow-y-auto max-h-[60vh]">
                    ${notifications.length === 0 ?
            '<div class="text-center text-slate-500 py-8"><i class="fas fa-bell-slash text-3xl mb-4"></i><p>Không có thông báo nào</p></div>' :
            notifications.map(notification => `
                            <div class="notification-item ${notification.read ? 'read' : 'unread'} mb-4 p-4 bg-slate-800/50 rounded-lg border ${notification.important ? 'border-red-500/30' : 'border-slate-700'}">
                                <div class="flex items-start">
                                    <div class="mr-3">
                                        <i class="${getNotificationIcon(notification.type)} ${getNotificationIconColor(notification.type)} text-lg"></i>
                                    </div>
                                    <div class="flex-1">
                                        <div class="font-bold text-white mb-1">${notification.title}</div>
                                        <div class="text-slate-300 mb-2">${notification.content || notification.message || ''}</div>
                                        <div class="text-xs text-slate-500 flex justify-between">
                                            <span>${notification.sender || 'Hệ thống'}</span>
                                            <span>${getTimeAgo(notification.timestamp)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')
        }
                </div>
                <div class="p-4 border-t border-slate-800 text-center bg-slate-900/50">
                    <button onclick="closeAllNotificationsModal()" class="speed-button px-6 py-2">
                        <i class="fas fa-times mr-2"></i> Đóng
                    </button>
                </div>
            </div>
        </div>
    `;

    const modalContainer = document.createElement('div');
    modalContainer.id = 'all-notifications-modal';
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    document.body.style.overflow = 'hidden';
};

// Hàm đóng modal tất cả thông báo
window.closeAllNotificationsModal = () => {
    const modal = document.getElementById('all-notifications-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
};

window.addMap = () => {
    const configErrors = validateMapConfiguration(raceState);
    if (configErrors.length > 0) {
        const errorHtml = configErrors.map(e => `<li>${e}</li>`).join('');
        document.getElementById('error-message').innerHTML = `
                <p class="font-bold mb-2">Vui lòng hoàn thiện cấu hình trước:</p>
                <ul class="list-disc list-inside space-y-1">${errorHtml}</ul>
            `;
        document.getElementById('error-message').classList.remove('hidden');
        document.getElementById('config').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    } else {
        document.getElementById('error-message').classList.add('hidden');
    }

    const newMap = defaultMapData();
    const newState = { ...raceState, maps: [...raceState.maps, newMap] };
    mapIdToScroll = newMap.id;
    raceState = newState;
    saveRaceState(raceState);
    displayMessage("Đã thêm Map tự do thành công!");
};

document.getElementById('add-map-btn').onclick = window.addMap;

window.deleteMap = (mapIndex) => {
    const mapName = raceState.maps[mapIndex].name || `Map ${mapIndex + 1}`;
    if (!confirm(`Bạn có chắc chắn muốn xóa bản đồ "${mapName}" không?`)) return;
    const newState = { ...raceState, maps: raceState.maps.filter((_, index) => index !== mapIndex) };
    raceState = newState;
    saveRaceState(raceState);
    displayMessage("Đã xóa bản đồ thành công.", false);
};

window.handleDataRefresh = () => {
    if (!confirm("⚠️ CẢNH BÁO: Thao tác này sẽ XÓA TẤT CẢ cấu hình tay đua và map. Bạn có chắc chắn muốn tiếp tục không?")) return;
    const resetState = {
        racers: defaultState.racers.map(r => ({ name: '', kingMap: '', banMaps: ['', ''] })),
        firstMapBtc: '',
        maps: [],
        version: defaultState.version,
    };
    raceState = resetState;
    saveRaceState(raceState);
    displayMessage("Đã làm mới dữ liệu thành công (xoá cấu hình tay đua và tất cả map).", false);
};

window.exportToExcel = () => {
    if (raceState.maps.length === 0) {
        displayMessage("Không có dữ liệu Map (bản đồ) để xuất. Vui lòng thêm Map vào bảng tính điểm.", true);
        return;
    }
    const numRacers = getNumRacers();
    const racerNames = raceState.racers.slice(0, numRacers).map((r, i) => r.name.trim() || `Tay Đua ${i + 1}`);
    const csvRows = [];
    const rankingData = calculateRanking();

    const addRankingSection = (data) => {
        csvRows.push('');
        csvRows.push(['BẢNG XẾP HẠNG CHUNG CUỘC'].join(','));
        csvRows.push(['Hạng', 'Tay Đua', 'Tổng Điểm'].join(','));
        data.forEach(racer => {
            const safeName = `"${racer.name.replace(/"/g, '""')}"`;
            csvRows.push([racer.rank, safeName, racer.totalScore].join(','));
        });
    };

    const addDetailedScoreboard = () => {
        csvRows.push('');
        let headerRow1 = ['#', 'Tay Đua'];
        raceState.maps.forEach((map, index) => {
            headerRow1.push(`${map.name.trim() || 'Chưa đặt tên'}`);
        });
        headerRow1.push('Tổng Điểm');
        csvRows.push(headerRow1.map(item => `"${item.replace(/"/g, '""')}"`).join(','));

        rankingData.forEach((racer) => {
            const row = [racer.rank, racer.name];
            raceState.maps.forEach(map => {
                const mapPoints = calculateMapPoints(map.times, map.name);
                row.push(mapPoints[racer.originalIndex]);
            });
            row.push(racer.totalScore);
            const safeRow = row.map(item => {
                const strItem = String(item);
                if (strItem.includes(',') || strItem.includes('"') || strItem.includes('\n')) {
                    return `"${strItem.replace(/"/g, '""')}"`;
                }
                return strItem;
            });
            csvRows.push(safeRow.join(','));
        });
    };

    const addPivotedSection = (title, mapDataKey) => {
        csvRows.push('');
        csvRows.push([`BẢNG ${title}`].join(','));
        let header = ['#', 'Tên Map'];
        racerNames.forEach(name => header.push(name));
        csvRows.push(header.map(item => `"${item.replace(/"/g, '""')}"`).join(','));

        raceState.maps.forEach((map, index) => {
            const row = [index + 1, map.name];
            for (let i = 0; i < numRacers; i++) {
                const data = (map[mapDataKey] && map[mapDataKey][i]) || '';
                row.push(data);
            }
            const safeRow = row.map(item => {
                const strItem = String(item);
                if (strItem.includes(',') || strItem.includes('"') || strItem.includes('\n')) {
                    return `"${strItem.replace(/"/g, '""')}"`;
                }
                return strItem;
            });
            csvRows.push(safeRow.join(','));
        });
    };

    addRankingSection(rankingData);
    addDetailedScoreboard();
    addPivotedSection('THỜI GIAN CHI TIẾT THEO MAP', 'times');
    addPivotedSection('XE SỬ DỤNG', 'cars');
    addPivotedSection('PET SỬ DỤNG', 'pets');

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bao_Cao_Diem_Thanh_Tich_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    displayMessage("Đã xuất file CSV thành công!", false);
};

window.handleLogout = async () => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
        try {
            await signOut(auth);
            displayMessage("Đã đăng xuất thành công. Đang chuyển hướng...", false);
            setTimeout(() => { window.location.href = "login.html"; }, 500);
        } catch (error) {
            console.error("Lỗi khi đăng xuất:", error);
            displayMessage("Lỗi khi đăng xuất. Vui lòng thử lại.", true);
        }
    }
};

// ================ USER PROFILE MANAGEMENT ================

// Hàm mở modal profile
window.openUserProfileModal = () => {
    const modal = document.getElementById('user-profile-modal');
    if (!modal) {
        createUserProfileModal();
    }

    const displayNameInput = document.getElementById('profile-displayName');
    const nicknameInput = document.getElementById('profile-nickname');
    const previewAvatar = document.getElementById('profile-preview-avatar');

    if (auth.currentUser) {
        displayNameInput.value = auth.currentUser.displayName || '';

        // Load nickname from Firestore
        getDoc(doc(db, "users", auth.currentUser.uid)).then(docSnap => {
            if (docSnap.exists()) {
                const userData = docSnap.data();
                nicknameInput.value = userData.nickname || '';

                // Ưu tiên Base64 nếu có, nếu không thì dùng photoURL hoặc logo mặc định
                if (userData.photoBase64) {
                    previewAvatar.src = userData.photoBase64;
                } else if (userData.photoURL && !userData.photoURL.includes('custom_avatar_')) {
                    // Nếu photoURL không phải marker string, thì dùng nó
                    previewAvatar.src = userData.photoURL;
                } else {
                    // Dùng logo mặc định
                    previewAvatar.src = 'logoWS.png';
                }
            }
        });
    }

    // ĐẢM BẢO tất cả input trong modal profile hoạt động cho cả admin và user thường
    setTimeout(() => {
        const profileModal = document.getElementById('user-profile-modal');
        if (profileModal) {
            // Enable tất cả input, button, textarea trong modal
            const profileElements = profileModal.querySelectorAll('input, button, textarea, label');
            profileElements.forEach(el => {
                el.disabled = false;
                el.readOnly = false;
                el.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-800', 'pointer-events-none');
                el.style.pointerEvents = 'auto';
                el.style.cursor = 'pointer';
            });

            // Đặc biệt cho file input và preview avatar
            const fileInput = profileModal.querySelector('input[type="file"]');
            if (fileInput) {
                fileInput.disabled = false;
                fileInput.style.pointerEvents = 'auto';
            }

            const avatarPreview = profileModal.querySelector('#profile-preview-avatar');
            if (avatarPreview && avatarPreview.parentElement) {
                avatarPreview.parentElement.style.pointerEvents = 'auto';
                avatarPreview.parentElement.style.cursor = 'pointer';
                avatarPreview.parentElement.classList.remove('pointer-events-none');
            }
        }
    }, 100);

    document.getElementById('user-profile-modal').classList.remove('hidden');
    document.getElementById('user-profile-modal').classList.add('flex');
    document.body.style.overflow = 'hidden';
};

// Hàm đóng modal profile
window.closeUserProfileModal = () => {
    document.getElementById('user-profile-modal').classList.add('hidden');
    document.getElementById('user-profile-modal').classList.remove('flex');
    document.body.style.overflow = '';
};

// Global variable for cropper instance
let cropperInstance = null;

// Hàm xử lý thay đổi ảnh avatar
window.handleProfileImageChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        displayMessage('Kích thước file không được vượt quá 2MB', true);
        return;
    }

    if (!file.type.startsWith('image/')) {
        displayMessage('Vui lòng chọn file ảnh', true);
        return;
    }

    try {
        // Tạo Data URL từ file
        const reader = new FileReader();
        reader.onload = (e) => {
            // Lưu file gốc để crop
            window.originalImageData = e.target.result;

            // Hiển thị modal crop
            const cropModal = document.getElementById('crop-image-modal');
            const cropImage = document.getElementById('crop-image');

            cropImage.src = e.target.result;
            cropModal.classList.remove('hidden');
            cropModal.classList.add('flex');
            document.body.style.overflow = 'hidden';

            // ĐẢM BẢO tất cả elements trong crop modal hoạt động
            setTimeout(() => {
                const cropModalElements = cropModal.querySelectorAll('button, input, *');
                cropModalElements.forEach(el => {
                    el.disabled = false;
                    el.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none');
                    el.style.pointerEvents = 'auto';
                    if (el.tagName === 'BUTTON') {
                        el.style.cursor = 'pointer';
                    }
                });
            }, 50);

            // Khởi tạo cropper sau khi ảnh load xong
            cropImage.onload = () => {
                if (cropperInstance) {
                    cropperInstance.destroy();
                }
                cropperInstance = new Cropper(cropImage, {
                    aspectRatio: 1, // Vuông mặc định
                    autoCropArea: 1,
                    responsive: true,
                    restore: true,
                    guides: true,
                    center: true,
                    highlight: true,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: true,
                    background: false
                });
            };
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Lỗi khi xử lý ảnh:', error);
        displayMessage('Lỗi khi xử lý ảnh. Vui lòng thử lại.', true);
    }
};

// Hàm đóng modal crop
window.closeCropModal = () => {
    const cropModal = document.getElementById('crop-image-modal');
    cropModal.classList.add('hidden');
    cropModal.classList.remove('flex');
    document.body.style.overflow = '';

    if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
    }
};

// Hàm quay ảnh
window.rotateCropImage = () => {
    if (cropperInstance) {
        cropperInstance.rotate(45);
    }
};

// Hàm lật ảnh ngang
window.flipCropImageH = () => {
    if (cropperInstance) {
        const data = cropperInstance.getData();
        cropperInstance.setData({
            ...data,
            scaleX: (data.scaleX || 1) * -1
        });
    }
};

// Hàm lật ảnh dọc
window.flipCropImageV = () => {
    if (cropperInstance) {
        const data = cropperInstance.getData();
        cropperInstance.setData({
            ...data,
            scaleY: (data.scaleY || 1) * -1
        });
    }
};

// Hàm thiết lập tỷ lệ khung hình
window.setCropAspectRatio = (ratio) => {
    if (cropperInstance) {
        cropperInstance.setAspectRatio(ratio);
    }
};

// Hàm áp dụng crop
window.applyCrop = async () => {
    if (!cropperInstance) return;

    try {
        const canvas = cropperInstance.getCroppedCanvas({
            maxWidth: 300,
            maxHeight: 300,
            fillColor: '#0a0a0f',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });

        // Chuyển canvas sang Base64 với chất lượng tối ưu
        let quality = 0.8;
        let base64 = canvas.toDataURL('image/jpeg', quality);

        // Nếu vẫn quá lớn, giảm chất lượng tiếp
        while (base64.length > 1000000 && quality > 0.1) {
            quality -= 0.1;
            base64 = canvas.toDataURL('image/jpeg', quality);
        }

        console.log('✅ Đã crop ảnh thành công, kích thước:', base64.length, 'bytes');

        // Cập nhật preview
        document.getElementById('profile-preview-avatar').src = base64;

        // Lưu Base64 để save sau
        window.selectedProfileImageBase64 = base64;
        delete window.originalImageData;

        // Đóng modal crop
        closeCropModal();

        displayMessage('Cắt ảnh thành công! Nhấn "Lưu" để cập nhật avatar.', false);
    } catch (error) {
        console.error('Lỗi khi crop ảnh:', error);
        displayMessage('Lỗi khi cắt ảnh. Vui lòng thử lại.', true);
    }
};

// HÀm lưu profile
window.saveUserProfile = async () => {
    const displayName = document.getElementById('profile-displayName').value.trim();
    const nickname = document.getElementById('profile-nickname').value.trim();

    if (!displayName) {
        displayMessage('Vui lòng nhập tên hiển thị', true);
        return;
    }

    // KIỂM TRA: Đảm bảo user đã đăng nhập
    if (!auth.currentUser) {
        displayMessage('Bạn cần đăng nhập để cập nhật thông tin', true);
        return;
    }

    const saveBtn = document.getElementById('save-profile-btn');
    const originalContent = saveBtn.innerHTML;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Đang lưu...';

    try {
        let photoBase64 = null; // Lưu Base64 riêng
        let photoURLForAuth = auth.currentUser.photoURL || 'logoWS.png'; // Cho Auth (URL ngắn)

        // CẬP NHẬT ẢNH BẰNG BASE64 nếu có ảnh mới
        if (window.selectedProfileImageBase64) {
            try {
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Đang xử lý ảnh...';

                // Sử dụng Base64 đã nén
                photoBase64 = window.selectedProfileImageBase64;

                console.log('✅ Sử dụng ảnh đã nén, kích thước:', photoBase64.length, 'bytes');

                // Kiểm tra kích thước Base64 (Firestore giới hạn ~1MB per field)
                if (photoBase64.length > 1000000) {
                    displayMessage('Ảnh vẫn quá lớn sau nén. Vui lòng chọn ảnh khác.', true);
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalContent;
                    return;
                }

                // Đặt URL đơn giản cho Auth (chỉ là marker)
                photoURLForAuth = `custom_avatar_${auth.currentUser.uid}`;

                // Xóa biến tạm
                delete window.selectedProfileImageBase64;
            } catch (uploadError) {
                console.error('Lỗi khi xử lý ảnh:', uploadError);
                displayMessage('Lỗi khi xử lý ảnh. Vui lòng thử lại.', true);
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalContent;
                return;
            }
        }

        // Update Firebase Auth profile (với URL ngắn, không phải Base64)
        await updateProfile(auth.currentUser, {
            displayName: displayName,
            photoURL: photoURLForAuth
        });

        // Chuẩn bị dữ liệu lưu vào Firestore
        const userDataToSave = {
            displayName: displayName,
            nickname: nickname,
            photoURL: photoURLForAuth,
            updatedAt: new Date().toISOString()
        };

        // Nếu có ảnh Base64 mới, lưu riêng vào trường photoBase64
        if (photoBase64) {
            userDataToSave.photoBase64 = photoBase64;
        }

        // Update Firestore user document
        await setDoc(doc(db, "users", auth.currentUser.uid), userDataToSave, { merge: true });

        // Update UI
        document.getElementById('user-display-name').textContent = displayName;

        // Cập nhật hiển thị với nickname (nếu có)
        if (nickname) {
            const roleBadge = isAdminUser ?
                '<span class="user-badge-pill user-badge-admin">Admin</span>' :
                '<span class="user-badge-pill user-badge-user">User</span>';

            document.getElementById('user-display-name').innerHTML =
                `${displayName} <span class="user-badge-pill user-badge-nickname">@${nickname}</span> ${roleBadge}`;
        } else {
            // Chỉ hiển thị role badge
            const roleBadge = isAdminUser ?
                '<span class="user-badge-pill user-badge-admin">Admin</span>' :
                '<span class="user-badge-pill user-badge-user">User</span>';

            document.getElementById('user-display-name').innerHTML = `${displayName} ${roleBadge}`;
        }

        // Cập nhật avatar ở header và sidebar
        // Ưu tiên dùng Base64 nếu có, nếu không thì dùng photoURL
        const avatarSrc = photoBase64 || photoURLForAuth;
        const avatarElements = document.querySelectorAll('#user-avatar, #profile-preview-avatar');
        avatarElements.forEach(el => {
            el.src = avatarSrc;
        });

        closeUserProfileModal();
        displayMessage('Cập nhật thông tin thành công!', false);

    } catch (error) {
        console.error('Error updating profile:', error);
        displayMessage('Có lỗi xảy ra khi cập nhật thông tin: ' + error.message, true);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalContent;
    }
};

// ================ RACER SELECTION FROM FIRESTORE ================

// Hàm load danh sách racers từ Firestore
const loadAvailableRacers = async () => {
    try {
        const availableRacers = [];
        if (racersCacheLoaded && ALL_USERS.length > 0) return ALL_USERS;

        const usersSnapshot = await getDocs(collection(db, "users"));
        usersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.role === 'racer') {
                availableRacers.push({
                    id: doc.id,
                    displayName: data.displayName || 'Unnamed',
                    nickname: data.nickname || '',
                    photoURL: data.photoURL || 'logoWS.png',
                    photoBase64: data.photoBase64 || null
                });
            }
        });

        ALL_USERS = availableRacers;
        window.ALL_USERS = availableRacers;
        racersCacheLoaded = true;
        return availableRacers;
    } catch (error) {
        console.error('Error loading racers:', error);
        return [];
    }
};

// Hàm render racer inputs với dropdown
const renderRacerInputsWithDropdown = async () => {
    const container = document.getElementById('racer-names');

    // THÊM KIỂM TRA NÀY
    if (!container) {
        console.error("❌ Không tìm thấy container #racer-names");
        return;
    }

    // Hiển thị loading
    container.innerHTML = `
        <div class="col-span-2 text-center py-12 text-slate-500">
            <div class="flex flex-col items-center justify-center space-y-4">
                <div class="speed-loader h-12 w-12"></div>
                <span>Đang tải cấu hình tay đua...</span>
            </div>
        </div>
    `;

    const availableRacers = await loadAvailableRacers();
    ALL_USERS = availableRacers;
    window.ALL_USERS = availableRacers;

    container.innerHTML = '';

    // THÊM KIỂM TRA CHO BTC MAP INPUT
    const btcMapInput = document.getElementById('btc-map-name');
    if (btcMapInput) {
        btcMapInput.value = raceState.firstMapBtc;

        if (!isAdminUser) {
            btcMapInput.disabled = true;
            btcMapInput.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-800');
        }
    } else {
        console.warn("⚠️ Không tìm thấy element #btc-map-name");
    }

    for (let index = 0; index < getNumRacers(); index++) {
        const racer = raceState.racers[index];
        let racerTitle = `Tay đua ${index + 1}`;
        let teamStyleClass = '';
        
        if (raceState.isTeamMode) {
            const isTeam1 = (index === 0 || index === 2);
            racerTitle = isTeam1 ? `TĐ ${index + 1} (Đội 1)` : `TĐ ${index + 1} (Đội 2)`;
            teamStyleClass = isTeam1 ? 'border-l-4 border-l-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 'border-l-4 border-l-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)]';
        }

        const disabledAttr = !isAdminUser ? 'disabled' : '';
        const disabledClass = !isAdminUser ? 'opacity-50 cursor-not-allowed bg-slate-800' : '';

        // Tìm racer đã được chọn (theo tên hoặc nickname)
        let selectedRacerId = '';
        if (racer.name) {
            const selectedRacer = availableRacers.find(r =>
                r.displayName === racer.name || r.nickname === racer.name
            );
            if (selectedRacer) {
                selectedRacerId = selectedRacer.id;
            }
        }

        let inputHtml = `
            <div class="neon-card p-5 hover:border-cyan-500/30 transition-all duration-300 ${teamStyleClass}">
                <div class="flex items-center mb-4 pb-3 border-b border-slate-800">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mr-3">
                        <span class="text-white font-bold">${index + 1}</span>
                    </div>
                    <label class="text-lg font-bold text-cyan-300">${racerTitle}</label>
                </div>
                <div class="mb-4">
                    <label for="racer-input-${index}" class="block text-sm font-medium text-slate-400 mb-2">
                        <i class="fas fa-search mr-1"></i> Tìm Tay Đua
                    </label>
                    <input type="text" id="racer-input-${index}" ${disabledAttr}
                        class="speed-input w-full text-center ${disabledClass}" 
                        placeholder="Nhập tên tay đua để tìm..."
                        list="racer-datalist-${index}"
                        value="${racer.name || ''}"
                        onchange="${isAdminUser ? `handleRacerInput(${index}, this.value)` : ''}" />
                    <datalist id="racer-datalist-${index}">
                        ${availableRacers.map(r => {
                            const isUsedByOther = raceState.racers.some((rc, i) =>
                                i !== index && (rc.name === r.displayName || rc.name === r.nickname)
                            );
                            if (isUsedByOther) return ''; // Don't suggest already selected racers
                            const searchName = r.nickname || r.displayName || 'Unnamed';
                            return `<option value="${searchName}">`;
                        }).join('')}
                    </datalist>
                </div>
                ${!raceState.is1vs1Mode && !raceState.isTeamMode ? `
                    <div class="pt-4 border-t border-slate-800/50">
                        <label for="king-map-${index}" class="block text-sm font-medium text-slate-400 mb-2">
                            <i class="fas fa-crown mr-1"></i> King Map
                        </label>
                        <input type="text" id="king-map-${index}" value="${racer.kingMap}" 
                            ${disabledAttr}
                            list="map-suggestions" class="speed-input w-full text-center ${disabledClass}" 
                            placeholder="${!isAdminUser ? 'Chỉ xem' : 'Nhập King Map'}" 
                            onchange="${isAdminUser ? `handleKingMapChange(this.value, ${index})` : ''}" />
                        <p class="text-xs text-slate-500 mt-2 italic text-center">
                            <i class="fas fa-star text-amber-400 mr-1"></i> King Map Owner được 
                            <span class="text-amber-400 font-bold">+1 điểm</span> nếu về nhất map đó.
                        </p>
                    </div>
                ` : (raceState.is1vs1Mode ? `
                <div class="grid grid-cols-2 gap-3 mt-2">
                    <div>
                        <label for="ban-map-${index}-0" class="block text-xs font-semibold text-slate-400 mb-1 text-center">
                            <i class="fas fa-ban text-red-500 mr-0.5"></i> Cấm Map 1
                        </label>
                        <input type="text" id="ban-map-${index}-0" value="${racer.banMaps ? (racer.banMaps[0] || '') : ''}" 
                            ${disabledAttr}
                            list="map-suggestions" class="speed-input w-full text-xs text-center p-2 rounded-lg bg-red-950/20 border border-red-500/20 text-red-200 focus:border-red-500/50 ${disabledClass}" 
                            placeholder="${!isAdminUser ? 'Chỉ xem' : 'Cấm Map 1'}" 
                            onchange="${isAdminUser ? `handleBanMapChange(this.value, ${index}, 0)` : ''}" />
                    </div>
                    <div>
                        <label for="ban-map-${index}-1" class="block text-xs font-semibold text-slate-400 mb-1 text-center">
                            <i class="fas fa-ban text-red-500 mr-0.5"></i> Cấm Map 2
                        </label>
                        <input type="text" id="ban-map-${index}-1" value="${racer.banMaps ? (racer.banMaps[1] || '') : ''}" 
                            ${disabledAttr}
                            list="map-suggestions" class="speed-input w-full text-xs text-center p-2 rounded-lg bg-red-950/20 border border-red-500/20 text-red-200 focus:border-red-500/50 ${disabledClass}" 
                            placeholder="${!isAdminUser ? 'Chỉ xem' : 'Cấm Map 2'}" 
                            onchange="${isAdminUser ? `handleBanMapChange(this.value, ${index}, 1)` : ''}" />
                    </div>
                </div>
                ` : '')}
            </div>
        `;
        container.insertAdjacentHTML('beforeend', inputHtml);
    }

    // Sau khi render 4 tay đua, thêm riêng 2 ô King Map Đội ở bên dưới nếu đang ở chế độ 2vs2
    if (raceState.isTeamMode) {
        const disabledAttr = !isAdminUser ? 'disabled' : '';
        const disabledClass = !isAdminUser ? 'opacity-50 cursor-not-allowed bg-slate-800' : '';
        
        const teamKingMapsHtml = `
            <div class="neon-card p-5 border-l-4 border-l-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)] col-span-1">
                <label for="king-map-0" class="block text-sm font-medium text-slate-400 mb-2 text-center">
                    <i class="fas fa-crown mr-1"></i> King Map (Đội 1)
                </label>
                <input type="text" id="king-map-0" value="${raceState.racers[0]?.kingMap || ''}" 
                    ${disabledAttr}
                    list="map-suggestions" class="speed-input w-full text-center ${disabledClass}" 
                    placeholder="${!isAdminUser ? 'Chỉ xem' : 'Nhập King Map'}" 
                    onchange="${isAdminUser ? `handleKingMapChange(this.value, 0)` : ''}" />
                <p class="text-xs text-slate-500 mt-2 italic text-center">
                    <i class="fas fa-star text-amber-400 mr-1"></i> Đội 1 về nhất map này sẽ được 
                    <span class="text-amber-400 font-bold">+12 điểm</span>.
                </p>
            </div>
            
            <div class="neon-card p-5 border-l-4 border-l-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] col-span-1">
                <label for="king-map-1" class="block text-sm font-medium text-slate-400 mb-2 text-center">
                    <i class="fas fa-crown mr-1"></i> King Map (Đội 2)
                </label>
                <input type="text" id="king-map-1" value="${raceState.racers[1]?.kingMap || ''}" 
                    ${disabledAttr}
                    list="map-suggestions" class="speed-input w-full text-center ${disabledClass}" 
                    placeholder="${!isAdminUser ? 'Chỉ xem' : 'Nhập King Map'}" 
                    onchange="${isAdminUser ? `handleKingMapChange(this.value, 1)` : ''}" />
                <p class="text-xs text-slate-500 mt-2 italic text-center">
                    <i class="fas fa-star text-amber-400 mr-1"></i> Đội 2 về nhất map này sẽ được 
                    <span class="text-amber-400 font-bold">+12 điểm</span>.
                </p>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', teamKingMapsHtml);
    }

    // Cập nhật giao diện Team Mode Toggle
    const teamToggle = document.getElementById('team-mode-toggle');
    const teamNamesConfig = document.getElementById('team-names-config');
    const team1Input = document.getElementById('team1-name-input');
    const team2Input = document.getElementById('team2-name-input');
    
    if (teamToggle && teamNamesConfig) {
        teamToggle.checked = raceState.isTeamMode || false;
        teamToggle.disabled = !isAdminUser;
        
        if (raceState.isTeamMode) {
            teamNamesConfig.classList.remove('hidden');
        } else {
            teamNamesConfig.classList.add('hidden');
        }
        
        if (team1Input) {
            team1Input.value = (raceState.teamNames && raceState.teamNames[0]) || 'Team 1';
            team1Input.disabled = !isAdminUser;
        }
        if (team2Input) {
            team2Input.value = (raceState.teamNames && raceState.teamNames[1]) || 'Team 2';
            team2Input.disabled = !isAdminUser;
        }
    }

    // Cập nhật giao diện 1vs1 Mode Toggle
    const toggle1vs1 = document.getElementById('1vs1-mode-toggle');
    if (toggle1vs1) {
        toggle1vs1.checked = raceState.is1vs1Mode || false;
        toggle1vs1.disabled = !isAdminUser;
        
        // Cập nhật BO format selector
        const formatSelector = document.getElementById('bo-format-selector');
        if (formatSelector) {
            if (raceState.is1vs1Mode) {
                formatSelector.classList.remove('hidden');
                const format = raceState.bo1vs1Format || 'BO9';
                const btn9 = document.getElementById('bo9-btn');
                const btn7 = document.getElementById('bo7-btn');
                if (btn9) btn9.classList.toggle('active', format === 'BO9');
                if (btn7) btn7.classList.toggle('active', format === 'BO7');
                const desc = document.getElementById('1vs1-format-desc');
                if (desc) {
                    desc.textContent = format === 'BO7'
                        ? 'Đua 1vs1 giữa 2 tay đua (BO3 lớn: BO1 & BO2 chạm 4, BO3 chạm 4 cách biệt 2)'
                        : 'Đua 1vs1 giữa 2 tay đua (BO3 lớn: BO1 & BO2 chạm 5, BO3 chạm 5 cách biệt 2)';
                }
            } else {
                formatSelector.classList.add('hidden');
            }
        }
    }

    console.log("✅ Đã render xong racer inputs");
};

// --- Xử lý Team Mode & 1vs1 Mode ---
window.toggleTeamMode = (isChecked) => {
    raceState.isTeamMode = isChecked;
    if (isChecked) {
        raceState.is1vs1Mode = false;
        const toggle1vs1 = document.getElementById('1vs1-mode-toggle');
        if (toggle1vs1) toggle1vs1.checked = false;
        
        // Reset King Maps for secondary team members
        if (raceState.racers[2]) raceState.racers[2].kingMap = '';
        if (raceState.racers[3]) raceState.racers[3].kingMap = '';

        displayMessage("Đã BẬT chế độ Đội 2vs2!");
    } else {
        displayMessage("Đã TẮT chế độ Đội 2vs2!");
    }
    saveRaceState(raceState);
    renderRacerInputsWithDropdown();
};

window.toggle1vs1Mode = (isChecked) => {
    raceState.is1vs1Mode = isChecked;
    // Reset BO tab state khi bật/tắt chế độ 1vs1
    currentBOTab = 1;
    window._boTabUserOverride = false;
    
    const formatSelector = document.getElementById('bo-format-selector');
    if (isChecked) {
        raceState.isTeamMode = false;
        const teamToggle = document.getElementById('team-mode-toggle');
        if (teamToggle) teamToggle.checked = false;
        if (formatSelector) formatSelector.classList.remove('hidden');
        displayMessage("Đã BẬT chế độ 1vs1!");
        // Gọi lại hàm để cập nhật UI nút
        if (!raceState.bo1vs1Format) raceState.bo1vs1Format = 'BO9';
        window.toggle1vs1BOFormat(raceState.bo1vs1Format);
    } else {
        if (formatSelector) formatSelector.classList.add('hidden');
        displayMessage("Đã TẮT chế độ 1vs1!");
    }
    saveRaceState(raceState);
    renderRacerInputsWithDropdown();
};

window.handleTeamNameChange = (teamIndex, newName) => {
    if (!raceState.teamNames) raceState.teamNames = ['Team 1', 'Team 2'];
    raceState.teamNames[teamIndex] = newName.trim() || `Team ${teamIndex + 1}`;
    saveRaceState(raceState);
};

// Hàm xử lý tìm kiếm tay đua từ input text
window.handleRacerInput = async (index, value) => {
    if (!value || value.trim() === '') {
        // Xóa thông tin tay đua nếu input rỗng
        handleRacerSelection(index, '');
        return;
    }
    
    // Tìm kiếm trong danh sách ALL_USERS (biến toàn cục được gán từ availableRacers)
    const availableRacers = ALL_USERS || [];
    const matchedRacer = availableRacers.find(r => 
        (r.nickname && r.nickname.trim().toLowerCase() === value.trim().toLowerCase()) || 
        (r.displayName && r.displayName.trim().toLowerCase() === value.trim().toLowerCase())
    );

    if (!matchedRacer) {
        displayMessage(`Lỗi: Không tìm thấy tay đua "${value}" trong hệ thống!`, true);
        // Trả lại giá trị cũ
        document.getElementById(`racer-input-${index}`).value = raceState.racers[index].name || '';
        return;
    }

    // Kiểm tra xem tay đua này đã được chọn ở vị trí khác chưa
    const isUsedByOther = raceState.racers.some((rc, i) =>
        i !== index && (rc.name === matchedRacer.displayName || rc.name === matchedRacer.nickname)
    );

    if (isUsedByOther) {
        displayMessage(`Lỗi: Tay đua "${value}" đã được chọn ở vị trí khác!`, true);
        document.getElementById(`racer-input-${index}`).value = raceState.racers[index].name || '';
        return;
    }

    // Gọi hàm xử lý cũ với ID của user tìm được
    handleRacerSelection(index, matchedRacer.id);
};

// Hàm xử lý chọn racer
window.handleRacerSelection = async (index, userId) => {
    if (!userId) {
        const newState = { ...raceState, racers: [...raceState.racers] };
        newState.racers[index].name = '';
        raceState = ensureInitialMaps(newState);
        saveRaceState(raceState);
        renderRacerInputsWithDropdown();
        return;
    }

    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const newState = { ...raceState, racers: [...raceState.racers] };

            // Ưu tiên lưu biệt danh, không có thì lưu tên
            const displayName = userData.nickname || userData.displayName || 'Unnamed';
            newState.racers[index].name = displayName;
            newState.racers[index].userId = userId;
            newState.racers[index].nickname = userData.nickname || '';
            newState.racers[index].fullName = userData.displayName || '';

            raceState = ensureInitialMaps(newState);
            saveRaceState(raceState);
            renderRacerInputsWithDropdown();
            displayMessage(`Đã chọn ${displayName} làm Tay đua ${index + 1}!`);
        }
    } catch (error) {
        console.error('Error loading racer:', error);
        displayMessage('Lỗi khi tải thông tin tay đua', true);
    }
};

// ================ VÒNG QUAY MAP BTC ================

let wheelCanvas;
let wheelCtx;
let wheelRotation = 0;
let isSpinning = false;
let mapImages = {}; // Cache cho hình ảnh map
let imagesLoaded = false;

// Tải trước hình ảnh map
const preloadMapImages = async () => {
    if (imagesLoaded) return;

    const maps = ALL_MAPS.filter(m => m.name && m.name.trim() && m.imageUrl);
    if (maps.length === 0) {
        imagesLoaded = true;
        return;
    }

    const loadPromises = maps.map(map => {
        // Tránh tải lại nếu đã có trong cache
        if (mapImages[map.name]) return Promise.resolve();

        return new Promise((resolve) => {
            const img = new Image();
            img.src = map.imageUrl;
            img.onload = () => {
                mapImages[map.name] = img;
                resolve();
            };
            img.onerror = () => {
                console.warn(`Không thể tải ảnh cho map: ${map.name}`);
                resolve(); // Tiếp tục dù lỗi
            };
        });
    });

    await Promise.all(loadPromises);
    imagesLoaded = true;
    drawWheel(); // Vẽ lại khi đã có ảnh
};

// Khởi tạo vòng quay
const initBtcWheel = async () => {
    wheelCanvas = document.getElementById('btc-wheel-canvas');
    if (!wheelCanvas) return;

    wheelCtx = wheelCanvas.getContext('2d');

    // Bắt đầu tải ảnh ngay lập tức
    preloadMapImages();

    drawWheel();

    // Kiểm tra nếu đã có Map BTC được chọn
    if (raceState.firstMapBtc && raceState.firstMapBtc.trim()) {
        showSelectedBtcMap(raceState.firstMapBtc);
    }
};

// Vẽ vòng quay
const drawWheel = () => {
    if (!wheelCtx || !wheelCanvas) return;

    const maps = ALL_MAPS.filter(m => m.name && m.name.trim());
    if (maps.length === 0) {
        // Vẽ placeholder nếu chưa có map
        wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
        wheelCtx.fillStyle = 'rgba(14, 14, 20, 0.8)';
        wheelCtx.beginPath();
        wheelCtx.arc(200, 200, 180, 0, Math.PI * 2);
        wheelCtx.fill();

        wheelCtx.fillStyle = '#94a3b8';
        wheelCtx.font = 'bold 16px Inter';
        wheelCtx.textAlign = 'center';
        wheelCtx.fillText('Chưa có map nào', 200, 200);
        return;
    }

    const centerX = 200;
    const centerY = 200;
    const radius = 180;
    const sliceAngle = (Math.PI * 2) / maps.length;

    wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

    // 1. Vẽ viền ngoài kim loại (Rim)
    wheelCtx.beginPath();
    wheelCtx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
    const rimGradient = wheelCtx.createRadialGradient(centerX, centerY, radius, centerX, centerY, radius + 10);
    rimGradient.addColorStop(0, '#1a1a24');
    rimGradient.addColorStop(0.5, '#2a2a35');
    rimGradient.addColorStop(1, '#0e0e14');
    wheelCtx.fillStyle = rimGradient;
    wheelCtx.fill();

    // 2. Vẽ các phần của vòng quay (Slices)
    maps.forEach((map, index) => {
        const startAngle = wheelRotation + (sliceAngle * index);
        const endAngle = startAngle + sliceAngle;

        wheelCtx.save();

        // Vẽ lát cắt và Clip
        wheelCtx.beginPath();
        wheelCtx.moveTo(centerX, centerY);
        wheelCtx.arc(centerX, centerY, radius, startAngle, endAngle);
        wheelCtx.closePath();
        wheelCtx.clip();

        // Kiểm tra xem có ảnh không
        const img = mapImages[map.name];
        if (img) {
            // Vẽ ảnh map làm nền
            // Scale and center the image in the slice
            const imgScale = Math.max(radius * 2 / img.width, radius * 2 / img.height);
            const imgW = img.width * imgScale;
            const imgH = img.height * imgScale;

            wheelCtx.globalAlpha = 0.8; // Độ trong suốt nhẹ để thấy màu nền
            wheelCtx.drawImage(img, centerX - imgW / 2, centerY - imgH / 2, imgW, imgH);
            wheelCtx.globalAlpha = 1.0;

            // Thêm lớp phủ (Overlay) để text dễ đọc
            const overlayGradient = wheelCtx.createRadialGradient(centerX, centerY, radius * 0.4, centerX, centerY, radius);
            overlayGradient.addColorStop(0, 'rgba(14, 14, 20, 0.4)');
            overlayGradient.addColorStop(1, 'rgba(14, 14, 20, 0.7)');
            wheelCtx.fillStyle = overlayGradient;
            wheelCtx.fill();
        } else {
            // Fallback nếu không có ảnh
            let baseColor = (index % 2 === 0) ? '#161621' : '#0e0e14';
            const sliceGradient = wheelCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
            sliceGradient.addColorStop(0.7, baseColor);
            sliceGradient.addColorStop(1, '#2a2a35');
            wheelCtx.fillStyle = sliceGradient;
            wheelCtx.fill();
        }

        // Viền lát cắt
        wheelCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        wheelCtx.lineWidth = 1;
        wheelCtx.stroke();

        wheelCtx.restore();
    });

    // 4. Các điểm nhấn phát sáng (Dots) trên viền
    maps.forEach((_, index) => {
        const angle = wheelRotation + (sliceAngle * index);
        wheelCtx.beginPath();
        wheelCtx.arc(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, 2, 0, Math.PI * 2);
        wheelCtx.fillStyle = 'rgba(0, 243, 255, 0.3)';
        wheelCtx.fill();
    });

    // 5. Vẽ vòng tròn giữa (Hub)
    const centerGradient = wheelCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 45);
    centerGradient.addColorStop(0, '#0e0e14');
    centerGradient.addColorStop(0.6, '#161621');
    centerGradient.addColorStop(1, '#2a2a35');

    wheelCtx.beginPath();
    wheelCtx.arc(centerX, centerY, 45, 0, Math.PI * 2);
    wheelCtx.fillStyle = centerGradient;
    wheelCtx.fill();

    // Viền kim loại cho Hub
    wheelCtx.strokeStyle = '#2a2a35';
    wheelCtx.lineWidth = 4;
    wheelCtx.stroke();

    // Viền phát sáng cho hub
    wheelCtx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
    wheelCtx.lineWidth = 1;
    wheelCtx.stroke();

    // 6. Text "BTC" phong cách Tech
    wheelCtx.fillStyle = '#00f3ff';
    wheelCtx.font = '900 14px Inter';
    wheelCtx.textAlign = 'center';
    wheelCtx.letterSpacing = '2px';
    wheelCtx.fillText('BTC', centerX, centerY + 5);

    // Icon tia chớp hoặc radar nhỏ dưới chữ BTC (tùy chọn)
};

// Quay vòng
window.spinWheel = async () => {
    if (isSpinning) return;
    if (!isAdminUser) {
        displayMessage("Chỉ Admin mới có quyền quay chọn Map BTC", true);
        return;
    }

    const maps = ALL_MAPS.filter(m => m.name && m.name.trim());
    if (maps.length === 0) {
        displayMessage("Chưa có map nào để quay. Vui lòng thêm map vào hệ thống.", true);
        return;
    }

    isSpinning = true;
    const spinBtn = document.getElementById('spin-wheel-btn');
    spinBtn.disabled = true;
    spinBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> ĐANG QUAY...';

    wheelCanvas.classList.add('spinning');

    // Random số vòng quay và góc dừng
    const minSpins = 5;
    const maxSpins = 8;
    const spins = minSpins + Math.random() * (maxSpins - minSpins);
    const randomAngle = Math.random() * Math.PI * 2;
    const totalRotation = (Math.PI * 2 * spins) + randomAngle;

    // Animation
    const startTime = Date.now();
    const duration = 4000; // 4 giây

    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);

        wheelRotation = totalRotation * eased;
        drawWheel();

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            wheelCanvas.classList.remove('spinning');
            finishSpin(maps);
        }
    };

    animate();
};

// Kết thúc quay và chọn map
const finishSpin = async (maps) => {
    // Tính góc cuối cùng
    const normalizedRotation = wheelRotation % (Math.PI * 2);
    const sliceAngle = (Math.PI * 2) / maps.length;

    // Mũi tên ở phía trên (góc 270 độ hoặc 3π/2)
    const pointerAngle = Math.PI * 1.5;

    // Tính index của map được chọn
    let selectedIndex = Math.floor(((pointerAngle - normalizedRotation) % (Math.PI * 2)) / sliceAngle);
    if (selectedIndex < 0) selectedIndex += maps.length;
    selectedIndex = maps.length - 1 - selectedIndex;

    const selectedMap = maps[selectedIndex];

    // Hiệu ứng kết quả
    await new Promise(resolve => setTimeout(resolve, 500));

    // Lưu Map BTC
    const newState = { ...raceState, firstMapBtc: selectedMap.name.trim() };
    raceState = ensureInitialMaps(newState);
    await saveRaceState(raceState);

    // Hiển thị kết quả
    showSelectedBtcMap(selectedMap.name);

    // Hiển thị thông báo
    displayMessage(`🎉 Map BTC đã được chọn: ${selectedMap.name}!`, false);

    // Gửi notification
    if (isAdminUser) {
        await sendNotificationToAllUsers({
            title: "🎲 Map BTC đã được chọn!",
            content: `Ban Tổ Chức đã quay và chọn Map BTC: "${selectedMap.name}"`,
            type: "info",
            important: true
        });
    }

    // Reset button
    const spinBtn = document.getElementById('spin-wheel-btn');
    spinBtn.disabled = false;
    spinBtn.innerHTML = '<i class="fas fa-sync-alt mr-3"></i> QUAY NGẪU NHIÊN';

    isSpinning = false;
};

// Hiển thị map đã chọn
const showSelectedBtcMap = (mapName) => {
    const wheelContainer = document.getElementById('btc-wheel-container');
    const selectedContainer = document.getElementById('selected-btc-map');
    const displayElement = document.getElementById('btc-map-display');
    // Tìm element icon để thay thế bằng ảnh
    const iconContainer = selectedContainer ? selectedContainer.querySelector('.w-12.h-12') : null;

    if (wheelContainer && selectedContainer && displayElement) {
        wheelContainer.classList.add('hidden');
        selectedContainer.classList.remove('hidden');
        selectedContainer.classList.add('wheel-result-announce');
        displayElement.textContent = mapName;

        // **MỚI: Hiển thị hình ảnh map**
        if (iconContainer) {
            const mapInfo = ALL_MAPS.find(m => m.name === mapName);
            if (mapInfo && mapInfo.imageUrl) {
                iconContainer.innerHTML = `<img src="${mapInfo.imageUrl}" class="w-full h-full object-cover rounded-xl" alt="${mapName}">`;
                iconContainer.classList.remove('bg-accent-blue/10', 'border-accent-blue/20');
                iconContainer.classList.add('p-0', 'overflow-hidden', 'bg-transparent', 'border-0');
            } else {
                // Reset về icon nếu không có ảnh
                iconContainer.innerHTML = `<i class="fas fa-flag-checkered text-accent-blue text-xl"></i>`;
                iconContainer.classList.add('bg-accent-blue/10', 'border-accent-blue/20');
                iconContainer.classList.remove('p-0', 'overflow-hidden', 'bg-transparent', 'border-0');
            }
        }
    }
};

// Reset để quay lại
window.resetBtcMap = async () => {
    if (!isAdminUser) {
        displayMessage("Chỉ Admin mới có quyền reset Map BTC", true);
        return;
    }

    if (!confirm("Bạn có chắc chắn muốn reset Map BTC và quay lại không?")) {
        return;
    }

    const wheelContainer = document.getElementById('btc-wheel-container');
    const selectedContainer = document.getElementById('selected-btc-map');

    if (wheelContainer && selectedContainer) {
        wheelContainer.classList.remove('hidden');
        selectedContainer.classList.add('hidden');

        // Reset icon container về trạng thái ban đầu
        const iconContainer = selectedContainer.querySelector('.w-12.h-12');
        if (iconContainer) {
            iconContainer.innerHTML = `<i class="fas fa-flag-checkered text-accent-blue text-xl"></i>`;
            iconContainer.classList.add('bg-accent-blue/10', 'border-accent-blue/20', 'w-12', 'h-12', 'rounded-xl', 'flex', 'items-center', 'justify-center', 'mr-4', 'border');
            iconContainer.classList.remove('p-0', 'overflow-hidden', 'bg-transparent', 'border-0');
        }
    }

    // Reset state
    const newState = { ...raceState, firstMapBtc: '' };
    raceState = ensureInitialMaps(newState);
    await saveRaceState(raceState);

    // Reset rotation
    wheelRotation = 0;
    drawWheel();

    displayMessage("Đã reset Map BTC. Có thể quay lại.", false);
};

window.saveMapData = async (mapIndex) => {
    if (!isAdminUser) {
        displayMessage("Chỉ Admin mới có quyền chỉnh sửa dữ liệu", true);
        return;
    }

    const saveBtn = document.getElementById(`save-map-${mapIndex}`);
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang kiểm tra...';
        saveBtn.disabled = true;
    }

    try {
        isEditing = true;
        const newState = { ...raceState, maps: [...raceState.maps] };
        const errors = [];

        // ============================================
        // BƯỚC 1: KIỂM TRA XE VÀ PET TRƯỚC
        // ============================================
        console.log("🔍 BƯỚC 1: Kiểm tra Xe và Pet...");

        let missingCarsPets = [];
        for (let racerIndex = 0; racerIndex < getNumRacers(); racerIndex++) {
            const carInput = document.getElementById(`car-${mapIndex}-${racerIndex}`);
            const petInput = document.getElementById(`pet-${mapIndex}-${racerIndex}`);

            const carValue = carInput ? carInput.value.trim() : '';
            const petValue = petInput ? petInput.value.trim() : '';

            const racerName = raceState.racers[racerIndex]?.name || `Tay đua ${racerIndex + 1}`;

            if (!carValue || !petValue) {
                missingCarsPets.push({
                    racer: racerName,
                    missingCar: !carValue,
                    missingPet: !petValue
                });
            }
        }

        // Nếu thiếu Xe hoặc Pet -> DỪNG NGAY, KHÔNG CHO LƯU
        if (missingCarsPets.length > 0) {
            let errorMsg = `⚠️ BẮT BUỘC: Phải nhập đầy đủ Xe và Pet trước khi lưu thời gian!\n\n`;
            errorMsg += "Thiếu thông tin:\n";

            missingCarsPets.forEach(item => {
                let missing = [];
                if (item.missingCar) missing.push("Xe");
                if (item.missingPet) missing.push("Pet");
                errorMsg += `• ${item.racer}: thiếu ${missing.join(' và ')}\n`;
            });

            errorMsg += "\n👉 Vui lòng vào bảng 'Xe và Pet sử dụng' bên dưới để nhập đầy đủ!";

            displayMessage(errorMsg, true);

            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Lưu';
                saveBtn.disabled = false;
            }

            isEditing = false;

            // Cuộn đến bảng Xe & Pet
            const carPetTable = document.getElementById('map-car-pet-body');
            if (carPetTable) {
                carPetTable.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            return;
        }

        console.log("✅ BƯỚC 1 PASSED: Đã có đầy đủ Xe và Pet");

        // ============================================
        // BƯỚC 2: KIỂM TRA THỜI GIAN
        // ============================================
        console.log("🔍 BƯỚC 2: Kiểm tra Thời gian...");

        let missingTimes = [];
        let invalidTimes = [];
        const recordsToSave = [];

        for (let racerIndex = 0; racerIndex < getNumRacers(); racerIndex++) {
            const timeInput = document.getElementById(`time-${mapIndex}-${racerIndex}`);
            const timeValue = timeInput ? timeInput.value.trim() : '';

            const racerName = raceState.racers[racerIndex]?.name || `Tay đua ${racerIndex + 1}`;

            // Kiểm tra thiếu thời gian
            if (!timeValue || timeValue === "--'--'--") {
                missingTimes.push(racerName);
                continue;
            }

            // Kiểm tra format thời gian
            const seconds = timeToSeconds(timeValue);
            if (seconds === null || seconds === 0) {
                invalidTimes.push({
                    racer: racerName,
                    value: timeValue
                });
                continue;
            }

            // Nếu hợp lệ, chuẩn bị lưu
            const formattedTime = secondsToTimeString(seconds);
            newState.maps[mapIndex].times[racerIndex] = formattedTime;

            if (timeInput) {
                timeInput.value = formattedTime;
            }

            // Lưu thông tin để save record
            recordsToSave.push({
                racerIndex,
                timeInSeconds: seconds,
                racerName
            });
        }

        // Nếu có lỗi về thời gian -> DỪNG
        if (missingTimes.length > 0 || invalidTimes.length > 0) {
            let errorMsg = `⚠️ BẮT BUỘC: Phải nhập đầy đủ thời gian cho ${getNumRacers()} tay đua!\n\n`;

            if (missingTimes.length > 0) {
                errorMsg += `Thiếu thời gian:\n• ${missingTimes.join('\n• ')}\n\n`;
            }

            if (invalidTimes.length > 0) {
                errorMsg += "Thời gian không đúng format:\n";
                invalidTimes.forEach(item => {
                    errorMsg += `• ${item.racer}: "${item.value}" (phải là MM'SS'MS, ví dụ: 01'23'45)\n`;
                });
                errorMsg += "\n";
            }

            errorMsg += `👉 Vui lòng nhập đủ ${getNumRacers()} thời gian hợp lệ trước khi lưu!`;

            displayMessage(errorMsg, true);

            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Lưu';
                saveBtn.disabled = false;
            }

            isEditing = false;
            return;
        }

        console.log(`✅ BƯỚC 2 PASSED: Đã có đầy đủ ${getNumRacers()} thời gian hợp lệ`);

        // ============================================
        // BƯỚC 3: LƯU DỮ LIỆU XE VÀ PET
        // ============================================
        console.log("💾 BƯỚC 3: Lưu Xe và Pet...");

        for (let racerIndex = 0; racerIndex < getNumRacers(); racerIndex++) {
            const carInput = document.getElementById(`car-${mapIndex}-${racerIndex}`);
            const petInput = document.getElementById(`pet-${mapIndex}-${racerIndex}`);

            const carValue = carInput ? carInput.value.trim() : '';
            const petValue = petInput ? petInput.value.trim() : '';

            // Kiểm tra trùng xe
            if (carValue) {
                const mapUsedElsewhere = isCarUsedByRacerInOtherMap(newState, carValue, racerIndex, mapIndex);
                if (mapUsedElsewhere) {
                    const racerName = raceState.racers[racerIndex]?.name || `Tay đua ${racerIndex + 1}`;
                    errors.push(`❌ Xe "${carValue}" đã được sử dụng bởi ${racerName} ở Map "${mapUsedElsewhere}"`);

                    if (carInput) {
                        carInput.value = '';
                    }
                }
            }

            newState.maps[mapIndex].cars[racerIndex] = carValue;
            newState.maps[mapIndex].pets[racerIndex] = petValue;
        }

        // Nếu có lỗi trùng xe -> DỪNG
        if (errors.length > 0) {
            displayMessage(errors.join('\n'), true);

            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Lưu';
                saveBtn.disabled = false;
            }

            isEditing = false;
            return;
        }

        console.log("✅ BƯỚC 3 PASSED: Đã lưu Xe và Pet");

        // ============================================
        // BƯỚC 4: LƯU DỮ LIỆU LÊN FIRESTORE
        // ============================================
        console.log("💾 BƯỚC 4: Lưu lên Firestore...");

        raceState = newState;
        await saveRaceState(raceState);

        console.log("✅ BƯỚC 4 PASSED: Đã lưu lên Firestore");

        // ============================================
        // BƯỚC 5: LƯU RACE RECORDS
        // ============================================
        console.log("💾 BƯỚC 5: Lưu Race Records...");

        if (recordsToSave.length === getNumRacers()) {
            const mapName = newState.maps[mapIndex].name;

            for (const recordData of recordsToSave) {
                const car = newState.maps[mapIndex].cars[recordData.racerIndex];
                const pet = newState.maps[mapIndex].pets[recordData.racerIndex];

                await saveRaceRecord(
                    mapName,
                    recordData.racerIndex,
                    recordData.timeInSeconds,
                    car,
                    pet
                );

                console.log(`✅ Đã lưu record cho ${recordData.racerName}`);
            }

            console.log("✅ BƯỚC 5 PASSED: Đã lưu tất cả Race Records");
        }

        // ============================================
        // BƯỚC 6: KIỂM TRA VÀ CẬP NHẬT RECORD
        // ============================================
        console.log("🏆 BƯỚC 6: Kiểm tra và cập nhật record...");

        setTimeout(() => {
            checkIfMapCompleted(mapIndex);
        }, 500);

        // ============================================
        // HOÀN THÀNH
        // ============================================
        displayMessage("✅ Đã lưu đầy đủ: Xe, Pet, Thời gian và Race Records!", false);

        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-check mr-1"></i> Đã lưu';
            setTimeout(() => {
                saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Lưu';
                saveBtn.disabled = false;
            }, 2000);
        }

    } catch (error) {
        console.error("❌ Lỗi khi lưu dữ liệu map:", error);
        displayMessage("❌ Lỗi khi lưu dữ liệu. Vui lòng thử lại!", true);

        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Lưu';
            saveBtn.disabled = false;
        }
    } finally {
        isEditing = false;
    }
};

// Thêm event listener cho các input khi render xong
const attachInputListeners = () => {
    // Chỉ attach cho admin
    if (!isAdminUser) return;

    document.querySelectorAll('.temp-edit-input').forEach(input => {
        // Highlight khi focus
        input.addEventListener('focus', function () {
            this.style.borderColor = 'rgba(0, 243, 255, 0.5)';
            this.style.boxShadow = '0 0 0 2px rgba(0, 243, 255, 0.1)';
        });

        // Reset khi blur
        input.addEventListener('blur', function () {
            this.style.borderColor = '';
            this.style.boxShadow = '';
        });

        // Hiển thị nút lưu khi có thay đổi
        input.addEventListener('input', function () {
            const mapIndex = parseInt(this.getAttribute('data-map-index'));
            const saveBtn = document.getElementById(`save-map-${mapIndex}`);
            if (saveBtn && !this.classList.contains('save-btn-highlighted')) {
                saveBtn.classList.add('save-btn-pulse');
                input.classList.add('save-btn-highlighted');
            }
        });
    });
};


// ================ HÀM LƯU TOÀN BỘ XE & PET ================
window.saveAllCarsPets = async () => {
    if (!isAdminUser) {
        displayMessage("Chỉ Admin mới có quyền lưu dữ liệu", true);
        return;
    }

    const saveBtn = document.getElementById('save-all-cars-pets-btn');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Đang lưu...';
        saveBtn.disabled = true;
    }

    try {
        isEditing = true;
        const newState = { ...raceState, maps: [...raceState.maps] };
        let hasChanges = false;
        let hasErrors = false;
        const errors = [];

        for (let mapIndex = 0; mapIndex < raceState.maps.length; mapIndex++) {
            for (let racerIndex = 0; racerIndex < getNumRacers(); racerIndex++) {
                // Lấy xe
                const carInput = document.getElementById(`car-${mapIndex}-${racerIndex}`);
                if (carInput) {
                    const carValue = carInput.value.trim();

                    // MỚI: Kiểm tra tính hợp lệ của xe (Bắt buộc trong thư viện)
                    if (carValue && !ALL_CARS.some(c => c.name === carValue)) {
                        errors.push(`Xe "${carValue}" (Map ${mapIndex + 1}, Tay đua ${racerIndex + 1}) không tồn tại trong thư viện!`);
                        hasErrors = true;
                    }

                    // Kiểm tra trùng xe
                    if (carValue) {
                        const mapUsedElsewhere = isCarUsedByRacerInOtherMap(newState, carValue, racerIndex, mapIndex);
                        if (mapUsedElsewhere) {
                            errors.push(`Xe "${carValue}" đã được sử dụng bởi ${raceState.racers[racerIndex]?.name || `Tay đua ${racerIndex + 1}`} ở Map "${mapUsedElsewhere}"`);
                            hasErrors = true;
                        }
                    }

                    if (newState.maps[mapIndex].cars[racerIndex] !== carValue) {
                        newState.maps[mapIndex].cars[racerIndex] = carValue;
                        hasChanges = true;
                    }
                }

                // Lấy pet
                const petInput = document.getElementById(`pet-${mapIndex}-${racerIndex}`);
                if (petInput) {
                    const petValue = petInput.value.trim();

                    // MỚI: Kiểm tra tính hợp lệ của pet (Bắt buộc trong thư viện)
                    if (petValue && !ALL_PETS.some(p => p.name === petValue)) {
                        errors.push(`Pet "${petValue}" (Map ${mapIndex + 1}, Tay đua ${racerIndex + 1}) không tồn tại trong thư viện!`);
                        hasErrors = true;
                    }

                    if (newState.maps[mapIndex].pets[racerIndex] !== petValue) {
                        newState.maps[mapIndex].pets[racerIndex] = petValue;
                        hasChanges = true;
                    }
                }
            }
        }

        if (hasErrors) {
            displayMessage(errors.join('\n'), true);
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Lưu toàn bộ Xe & Pet';
                saveBtn.disabled = false;
            }
            isEditing = false;
            return;
        }

        if (!hasChanges) {
            displayMessage("Không có thay đổi nào để lưu", false);
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Lưu toàn bộ Xe & Pet';
                saveBtn.disabled = false;
            }
            isEditing = false;
            return;
        }

        // Lưu vào Firestore
        raceState = newState;
        await saveRaceState(raceState);

        displayMessage("✅ Đã lưu toàn bộ Xe & Pet thành công!", false);

        // // Gửi thông báo
        // await sendNotificationToAllUsers({
        //     title: "🚗 Xe & Pet đã được cập nhật",
        //     content: "Thông tin xe và pet của tất cả các map đã được cập nhật.",
        //     type: "success",
        //     important: false
        // });

        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-check mr-2"></i> Đã lưu';
            setTimeout(() => {
                saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Lưu toàn bộ Xe & Pet';
                saveBtn.disabled = false;
            }, 2000);
        }
    } catch (error) {
        console.error("Lỗi khi lưu Xe & Pet:", error);
        displayMessage("❌ Lỗi khi lưu dữ liệu", true);

        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Lưu toàn bộ Xe & Pet';
            saveBtn.disabled = false;
        }
    } finally {
        isEditing = false;
    }
};

// ================ HÀM LƯU XE & PET THEO TỪNG MAP ================
window.saveMapCarsPets = async (mapIndex) => {
    if (!isAdminUser) {
        displayMessage("Chỉ Admin mới có quyền lưu dữ liệu", true);
        return;
    }

    const saveBtn = document.getElementById(`save-car-pet-${mapIndex}`);
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>';
        saveBtn.disabled = true;
    }

    try {
        isEditing = true;
        const newState = { ...raceState, maps: [...raceState.maps] };
        let hasChanges = false;
        let hasErrors = false;
        const errors = [];
        const numRacers = getNumRacers();

        for (let racerIndex = 0; racerIndex < numRacers; racerIndex++) {
            // Lấy xe
            const carInput = document.getElementById(`car-${mapIndex}-${racerIndex}`);
            if (carInput) {
                const carValue = carInput.value.trim();
                if (carValue && !ALL_CARS.some(c => c.name === carValue)) {
                    errors.push(`Xe "${carValue}" không tồn tại!`);
                    hasErrors = true;
                }
                if (carValue) {
                    const mapUsedElsewhere = isCarUsedByRacerInOtherMap(newState, carValue, racerIndex, mapIndex);
                    if (mapUsedElsewhere) {
                        errors.push(`Xe "${carValue}" đã được dùng ở Map "${mapUsedElsewhere}"`);
                        hasErrors = true;
                    }
                }
                if (newState.maps[mapIndex].cars[racerIndex] !== carValue) {
                    newState.maps[mapIndex].cars[racerIndex] = carValue;
                    hasChanges = true;
                }
            }

            // Lấy pet
            const petInput = document.getElementById(`pet-${mapIndex}-${racerIndex}`);
            if (petInput) {
                const petValue = petInput.value.trim();
                if (petValue && !ALL_PETS.some(p => p.name === petValue)) {
                    errors.push(`Pet "${petValue}" không tồn tại!`);
                    hasErrors = true;
                }
                if (petValue) {
                    const mapUsedElsewhere = isPetUsedByRacerInOtherMap(newState, petValue, racerIndex, mapIndex);
                    if (mapUsedElsewhere) {
                        errors.push(`Pet "${petValue}" đã được dùng ở Map "${mapUsedElsewhere}"`);
                        hasErrors = true;
                    }
                }
                if (newState.maps[mapIndex].pets[racerIndex] !== petValue) {
                    newState.maps[mapIndex].pets[racerIndex] = petValue;
                    hasChanges = true;
                }
            }
        }

        if (hasErrors) {
            displayMessage(errors.join('\n'), true);
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Lưu';
                saveBtn.disabled = false;
            }
            isEditing = false;
            return;
        }

        if (!hasChanges) {
            displayMessage("Không có thay đổi nào để lưu", false);
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Lưu';
                saveBtn.disabled = false;
            }
            isEditing = false;
            return;
        }

        raceState = newState;
        await saveRaceState(raceState);
        displayMessage(`✅ Đã lưu Xe & Pet cho map "${raceState.maps[mapIndex].name}"`, false);

        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-check mr-1"></i> Đã lưu';
            setTimeout(() => {
                saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Lưu';
                saveBtn.disabled = false;
            }, 2000);
        }
    } catch (error) {
        console.error("Lỗi khi lưu Xe & Pet:", error);
        displayMessage("Lỗi khi lưu dữ liệu: " + error.message, true);
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Lưu';
            saveBtn.disabled = false;
        }
    } finally {
        isEditing = false;
    }
};

// ================ RECORD HOLDER MODAL FUNCTIONS ================

// Hàm mở modal chi tiết record holder
window.openRecordHolderModal = async (racerName) => {
    const modal = document.getElementById('record-holder-detail-modal');
    const nameElement = document.getElementById('record-holder-name');
    const countElement = document.getElementById('record-holder-count');
    const mapsList = document.getElementById('record-holder-maps-list');

    if (!modal) return;

    // Hiển thị modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    // Hiển thị tên tay đua
    nameElement.textContent = racerName;

    // Hiển thị loading
    mapsList.innerHTML = `
        <div class="flex items-center justify-center py-8">
            <div class="speed-loader h-12 w-12"></div>
        </div>
    `;

    try {
        // Lấy danh sách maps mà tay đua này giữ record
        const mapsSnapshot = await getDocs(collection(db, "gameMaps"));
        const recordMaps = [];

        mapsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.recordRacer === racerName &&
                data.recordTime &&
                data.recordTime !== "00'00'00" &&
                data.recordTime !== "--'--'--") {

                recordMaps.push({
                    id: doc.id,
                    name: data.name || "Chưa có tên",
                    recordTime: data.recordTime,
                    recordCar: data.recordCar || "Chưa có",
                    recordPet: data.recordPet || "Chưa có",
                    imageUrl: data.imageUrl || null,
                    difficulty: data.difficulty || "Medium"
                });
            }
        });

        // Cập nhật số lượng record
        countElement.textContent = recordMaps.length;

        // Hiển thị danh sách maps
        if (recordMaps.length === 0) {
            mapsList.innerHTML = `
                <div class="text-center text-slate-500 py-8">
                    <i class="fas fa-inbox text-4xl mb-4 opacity-50"></i>
                    <p>Không tìm thấy record nào</p>
                </div>
            `;
            return;
        }

        // Render danh sách maps
        mapsList.innerHTML = recordMaps.map((map, index) => {
            const difficultyColors = {
                'easy': 'bg-green-500/20 text-green-400 border-green-500/30',
                'dễ': 'bg-green-500/20 text-green-400 border-green-500/30',
                '3 sao': 'bg-green-500/20 text-green-400 border-green-500/30',
                
                'medium': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                'trung bình': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                '4 sao': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                
                'hard': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                'khó': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                '5 sao': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
                
                'expert': 'bg-red-500/20 text-red-400 border-red-500/30',
                'rất khó': 'bg-red-500/20 text-red-400 border-red-500/30',
                '6 sao': 'bg-red-500/20 text-red-400 border-red-500/30',
                
                'extreme': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                'cực khó': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
                '7 sao': 'bg-purple-500/20 text-purple-400 border-purple-500/30'
            };

            const difficultyClass = difficultyColors[map.difficulty.toLowerCase()] || difficultyColors['medium'];

            return `
                <div class="record-map-card relative p-4 rounded-xl bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-slate-700/50">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center space-x-3 flex-1 min-w-0">
                            ${map.imageUrl ? `
                                <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 border-amber-500/30">
                                    <img src="${map.imageUrl}" alt="${map.name}" 
                                         class="w-full h-full object-cover hover:scale-110 transition-transform duration-300">
                                </div>
                            ` : `
                                <div class="w-16 h-16 rounded-lg flex-shrink-0 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border-2 border-amber-500/30">
                                    <i class="fas fa-map text-2xl text-amber-400"></i>
                                </div>
                            `}
                            <div class="flex-1 min-w-0">
                                <h5 class="text-lg font-bold text-white mb-1 truncate">${map.name}</h5>
                                <div class="flex items-center space-x-2">
                                    <span class="record-info-badge ${difficultyClass} text-[10px] border flex items-center gap-0.5 px-1.5 py-0.5 rounded">
                                        ${(() => {
                                            let starCount = 3;
                                            const lowerDiff = (map.difficulty || '').toLowerCase();
                                            if (lowerDiff.includes('3 sao') || lowerDiff.includes('dễ') || lowerDiff.includes('easy')) starCount = 3;
                                            else if (lowerDiff.includes('4 sao') || lowerDiff.includes('trung bình') || lowerDiff.includes('medium')) starCount = 4;
                                            else if (lowerDiff.includes('5 sao') || lowerDiff.includes('khó') || lowerDiff.includes('hard')) starCount = 5;
                                            else if (lowerDiff.includes('6 sao') || lowerDiff.includes('rất khó') || lowerDiff.includes('expert')) starCount = 6;
                                            else if (lowerDiff.includes('7 sao') || lowerDiff.includes('cực khó') || lowerDiff.includes('extreme')) starCount = 7;
                                            else starCount = 0;
                                            
                                            if (starCount > 0) {
                                                let starsHTML = '';
                                                for(let i=0; i<starCount; i++) {
                                                    starsHTML += `<i class="fas fa-star text-yellow-400 text-[8px] mr-0.5"></i>`;
                                                }
                                                return starsHTML;
                                            }
                                            return `<i class="fas fa-signal mr-1"></i>${map.difficulty}`;
                                        })()}
                                    </span>
                                    <span class="text-xs text-slate-400">#${index + 1}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 gap-3 pl-19">
                        <!-- Thời gian -->
                        <div class="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-green-500/20">
                            <div class="flex items-center">
                                <i class="fas fa-stopwatch text-green-400 text-lg mr-3"></i>
                                <span class="text-sm text-slate-400">Thời gian Record:</span>
                            </div>
                            <span class="record-time-display text-green-400">${map.recordTime}</span>
                        </div>

                        <!-- Xe và Pet -->
                        <div class="grid grid-cols-2 gap-2">
                            <div class="flex items-center p-2 bg-slate-900/50 rounded-lg border border-cyan-500/20">
                                ${(() => {
                    const carInfo = ALL_CARS.find(c => c.name === map.recordCar);
                    return carInfo && carInfo.imageUrl ?
                        `<img src="${carInfo.imageUrl}" class="w-8 h-8 object-contain mr-2" alt="car">` :
                        `<i class="fas fa-car text-cyan-400 mr-2 text-lg"></i>`;
                })()}
                                <div class="flex-1 min-w-0">
                                    <div class="text-[10px] text-slate-500 uppercase font-bold">Xe:</div>
                                    <div class="text-sm text-white font-semibold truncate">${map.recordCar}</div>
                                </div>
                            </div>
                            <div class="flex items-center p-2 bg-slate-900/50 rounded-lg border border-pink-500/20">
                                ${(() => {
                    const petInfo = ALL_PETS.find(p => p.name === map.recordPet);
                    return petInfo && petInfo.imageUrl ?
                        `<img src="${petInfo.imageUrl}" class="w-8 h-8 object-contain mr-2" alt="pet">` :
                        `<i class="fas fa-paw text-pink-400 mr-2 text-lg"></i>`;
                })()}
                                <div class="flex-1 min-w-0">
                                    <div class="text-[10px] text-slate-500 uppercase font-bold">Pet:</div>
                                    <div class="text-sm text-white font-semibold truncate">${map.recordPet}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("❌ Lỗi khi load chi tiết record holder:", error);
        mapsList.innerHTML = `
            <div class="text-center text-red-400 py-8">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <p>Có lỗi xảy ra khi tải dữ liệu</p>
            </div>
        `;
    }
};

// Hàm đóng modal
window.closeRecordHolderModal = () => {
    const modal = document.getElementById('record-holder-detail-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
    }
};

// Hàm mở modal BXH nổi
window.openBxhModal = () => {
    const modal = document.getElementById('bxh-floating-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
        
        // Kích hoạt lại animation GSAP
        if (typeof gsap !== 'undefined') {
            gsap.from("#top-racers-list > div", {
                opacity: 0,
                x: -30,
                duration: 0.5,
                stagger: 0.05,
                ease: "power2.out"
            });
            gsap.from("#top-record-holders-list > div", {
                opacity: 0,
                x: 30,
                duration: 0.5,
                stagger: 0.05,
                ease: "power2.out"
            });
            gsap.from("#top-combos-list > div", {
                opacity: 0,
                y: 30,
                duration: 0.5,
                stagger: 0.1,
                ease: "power2.out"
            });
        }
    }
};

// Hàm đóng modal BXH nổi
window.closeBxhModal = () => {
    const modal = document.getElementById('bxh-floating-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
    }
};

// Hàm mở modal chi tiết trận đấu của tay đua
window.openRacerMatchesModal = (racerName) => {
    const modal = document.getElementById('racer-matches-detail-modal');
    const titleNameEl = document.getElementById('racer-matches-title-name');
    const playedCountEl = document.getElementById('racer-matches-played-count');
    const totalScoreEl = document.getElementById('racer-matches-total-score');
    const statsSummaryEl = document.getElementById('racer-matches-stats-summary');
    
    const avgRankEl = document.getElementById('racer-avg-rank');
    const winCountEl = document.getElementById('racer-win-count');
    const top1RateEl = document.getElementById('racer-top1-rate');
    const avgScoreEl = document.getElementById('racer-avg-score');
    const listBodyEl = document.getElementById('racer-matches-list-body');

    if (!modal) return;

    // Hiển thị modal và trạng thái đang tải
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';

    if (titleNameEl) titleNameEl.textContent = racerName;
    if (listBodyEl) {
        listBodyEl.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-slate-500">
                    <div class="flex flex-col items-center justify-center space-y-3">
                        <div class="speed-loader h-8 w-8 mx-auto"></div>
                        <span>Đang phân tích kết quả thi đấu...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    // Lấy tất cả records từ bộ nhớ cache
    const allRecords = window.ALL_RACE_RECORDS || [];
    
    // Nhóm các records trong lịch sử thành các phiên đấu (trận đấu) theo mapName và thời gian gần nhau
    const sessions = [];
    const sortedRecords = [...allRecords].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    sortedRecords.forEach(record => {
        if (!record.timestamp || !record.mapName) return;
        const recordTime = new Date(record.timestamp).getTime();
        
        // Tìm phiên đấu có cùng bản đồ và lệch nhau không quá 10 giây
        const session = sessions.find(s => 
            s.mapName === record.mapName && 
            Math.abs(s.time - recordTime) < 10000
        );

        if (session) {
            session.records.push(record);
        } else {
            sessions.push({
                mapName: record.mapName,
                time: recordTime,
                records: [record]
            });
        }
    });

    // Lọc các phiên đấu mà tay đua được chọn có tham gia
    let matchesPlayed = 0;
    let totalScore = 0;
    let rankSum = 0;
    let winCount = 0;
    const matches = [];

    const racerNameLC = racerName.trim().toLowerCase();
    
    sessions.forEach((session, sessionIndex) => {
        const racerRecord = session.records.find(r => {
            if (!r.racerName) return false;
            const recNameLC = r.racerName.trim().toLowerCase();
            if (recNameLC === racerNameLC) return true;
            
            const user1 = ALL_USERS.find(u =>
                (u.nickname && u.nickname.trim().toLowerCase() === recNameLC) ||
                (u.displayName && u.displayName.trim().toLowerCase() === recNameLC)
            );
            const user2 = ALL_USERS.find(u =>
                (u.nickname && u.nickname.trim().toLowerCase() === racerNameLC) ||
                (u.displayName && u.displayName.trim().toLowerCase() === racerNameLC)
            );
            return user1 && user2 && user1.id === user2.id;
        });
        
        if (racerRecord) {
            const racerTimeSec = timeToSeconds(racerRecord.timeString);
            
            if (racerTimeSec && racerTimeSec > 0) {
                // Xác định thứ hạng của tay đua trong phiên đấu này bằng cách sắp xếp thời gian
                const sessionTimes = session.records
                    .map(r => timeToSeconds(r.timeString))
                    .filter(t => t !== null && t > 0)
                    .sort((a, b) => a - b);
                
                const mapRank = sessionTimes.indexOf(racerTimeSec) + 1;
                
                // Tính điểm (rank 1 = 11 điểm, hoặc 12 điểm nếu là King Map của họ; các hạng sau lấy 10 - penalty)
                const bestTime = sessionTimes[0] || racerTimeSec;
                let score = 0;
                if (racerTimeSec === bestTime) {
                    const activeRacerConfig = raceState?.racers?.find(r => {
                        if (!r.name) return false;
                        const activeNameLC = r.name.trim().toLowerCase();
                        if (activeNameLC === racerNameLC) return true;
                        const user1 = ALL_USERS.find(u =>
                            (u.nickname && u.nickname.trim().toLowerCase() === activeNameLC) ||
                            (u.displayName && u.displayName.trim().toLowerCase() === activeNameLC)
                        );
                        const user2 = ALL_USERS.find(u =>
                            (u.nickname && u.nickname.trim().toLowerCase() === racerNameLC) ||
                            (u.displayName && u.displayName.trim().toLowerCase() === racerNameLC)
                        );
                        return user1 && user2 && user1.id === user2.id;
                    });
                    let isKingMap = false;
                    if (activeRacerConfig) {
                        const racerIndex = raceState.racers.indexOf(activeRacerConfig);
                        let kingMapName = '';
                        if (raceState.isTeamMode && racerIndex !== -1) {
                            const teamLeadIndex = (racerIndex === 0 || racerIndex === 2) ? 0 : 1;
                            kingMapName = (raceState.racers[teamLeadIndex]?.kingMap || '').trim();
                        } else {
                            kingMapName = (activeRacerConfig.kingMap || '').trim();
                        }
                        isKingMap = kingMapName && kingMapName === session.mapName.trim();
                    }
                    score = isKingMap ? 12 : 11;
                } else {
                    const diff = racerTimeSec - bestTime;
                    score = Math.max(0, 10 - Math.floor(diff));
                }

                matchesPlayed++;
                totalScore += score;
                rankSum += mapRank;
                if (mapRank === 1) winCount++;

                matches.push({
                    mapIndex: sessionIndex + 1,
                    mapName: session.mapName,
                    timeStr: racerRecord.timeString,
                    rank: mapRank,
                    score: score,
                    car: racerRecord.car || "-",
                    pet: racerRecord.pet || "-",
                    date: racerRecord.timestamp ? new Date(racerRecord.timestamp).toLocaleDateString('vi-VN') : 'N/A'
                });
            }
        }
    });

    const avgRank = matchesPlayed > 0 ? (rankSum / matchesPlayed).toFixed(1) : "0.0";
    const winRate = matchesPlayed > 0 ? Math.round((winCount / matchesPlayed) * 100) : 0;
    const avgScore = matchesPlayed > 0 ? (totalScore / matchesPlayed).toFixed(1) : "0.0";

    // Cập nhật giao diện KPIs
    if (playedCountEl) playedCountEl.textContent = matchesPlayed;
    if (totalScoreEl) totalScoreEl.textContent = totalScore;
    if (statsSummaryEl) statsSummaryEl.textContent = `Tỷ lệ: ${winRate}% Top 1`;
    
    if (avgRankEl) avgRankEl.textContent = `#${avgRank}`;
    if (winCountEl) winCountEl.textContent = `${winCount} trận`;
    if (top1RateEl) top1RateEl.textContent = `${winRate}%`;
    if (avgScoreEl) avgScoreEl.textContent = avgScore;
    // Lưu các trận đấu vào state phân trang và hiển thị trang đầu tiên
    window.racerMatchesState = {
        matches: [...matches].reverse(), // Sắp xếp trận mới nhất lên đầu
        currentPage: 1,
        pageSize: 5
    };
    window.renderRacerMatchesPage();
};

// Hàm render dữ liệu trang hiện tại của danh sách trận đấu
window.renderRacerMatchesPage = () => {
    const state = window.racerMatchesState;
    const bodyEl = document.getElementById('racer-matches-list-body');
    const prevBtn = document.getElementById('racer-matches-prev-page');
    const nextBtn = document.getElementById('racer-matches-next-page');
    const pageNumEl = document.getElementById('racer-matches-page-number');
    const showStartEl = document.getElementById('racer-matches-show-start');
    const showEndEl = document.getElementById('racer-matches-show-end');
    const showTotalEl = document.getElementById('racer-matches-show-total');

    if (!bodyEl || !state) return;

    const totalMatches = state.matches.length;
    const totalPages = Math.ceil(totalMatches / state.pageSize) || 1;

    // Boundary check
    if (state.currentPage < 1) state.currentPage = 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = Math.min(startIndex + state.pageSize, totalMatches);
    const pageMatches = state.matches.slice(startIndex, endIndex);

    // Cập nhật thông số hiển thị
    if (showStartEl) showStartEl.textContent = totalMatches > 0 ? startIndex + 1 : 0;
    if (showEndEl) showEndEl.textContent = endIndex;
    if (showTotalEl) showTotalEl.textContent = totalMatches;
    if (pageNumEl) pageNumEl.textContent = `Trang ${state.currentPage}/${totalPages}`;

    // Bật/tắt nút điều hướng
    if (prevBtn) prevBtn.disabled = state.currentPage === 1;
    if (nextBtn) nextBtn.disabled = state.currentPage === totalPages;

    // Render danh sách các trận đấu trong trang
    if (totalMatches === 0) {
        bodyEl.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">Chưa tham gia trận đấu nào.</td></tr>`;
    } else {
        bodyEl.innerHTML = pageMatches.map(match => {
            let rankBadge = `#${match.rank}`;
            let rankColor = 'text-slate-300';
            if (match.rank === 1) {
                rankBadge = '🥇 #1';
                rankColor = 'text-amber-400 font-extrabold';
            } else if (match.rank === 2) {
                rankBadge = '🥈 #2';
                rankColor = 'text-slate-200 font-bold';
            } else if (match.rank === 3) {
                rankBadge = '🥉 #3';
                rankColor = 'text-amber-600';
            }
            
            return `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="px-4 py-3 text-left text-xs text-slate-500">${match.date}</td>
                    <td class="px-4 py-3 text-left font-bold text-white">${match.mapName}</td>
                    <td class="px-4 py-3 font-mono text-cyan-400">${match.timeStr}</td>
                    <td class="px-4 py-3 ${rankColor}">${rankBadge}</td>
                    <td class="px-4 py-3 font-bold text-emerald-400">+${match.score}</td>
                    <td class="px-4 py-3 text-slate-400 text-xs">${match.car}</td>
                    <td class="px-4 py-3 text-slate-400 text-xs">${match.pet}</td>
                </tr>
            `;
        }).join('');
    }
};

// Hàm chuyển trang
window.changeRacerMatchesPage = (delta) => {
    if (window.racerMatchesState) {
        window.racerMatchesState.currentPage += delta;
        window.renderRacerMatchesPage();
    }
};
// Hàm đóng modal chi tiết trận đấu
window.closeRacerMatchesModal = () => {
    const modal = document.getElementById('racer-matches-detail-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
    }
};

// Đóng modal khi nhấn ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeRecordHolderModal();
        closeBxhModal();
        closeRacerMatchesModal();
    }
});

// --- Firebase Initialization ---
const initFirebase = async () => {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        // Gán vào window để các module khác truy cập
        window.db = db;
        window.auth = auth;
        window.firestoreGetDocs = getDocs;
        window.firestoreCollection = collection;

        setPersistence(auth, browserLocalPersistence).catch(error => {
            console.warn("Không thể thiết lập persistence. Tiếp tục khởi tạo.", error);
        });

        // Dispatch event for other modules
        window.dispatchEvent(new CustomEvent('firebaseInitialized', {
            detail: { db, auth, app }
        }));

        // Mock user bypass for testing/preview if query parameter ?mockUser=... is present
        const urlParams = new URLSearchParams(window.location.search);
        const mockUserParam = urlParams.get('mockUser');
        
        let customAuthStateChange = onAuthStateChanged;
        if (mockUserParam) {
            console.log("⚠️ Dev Mode: Mocking authentication as", mockUserParam);
            const mockUser = {
                uid: mockUserParam === 'admin' ? 'mock-admin-uid' : 'mock-viewer-uid',
                email: `${mockUserParam}@example.com`,
                displayName: mockUserParam === 'admin' ? 'Mock Admin' : 'Mock Viewer',
                photoURL: 'assets/images/logows.png',
                providerData: [{ providerId: 'google.com' }]
            };
            customAuthStateChange = (auth, callback) => {
                setTimeout(() => {
                    callback(mockUser);
                }, 100);
                return () => {};
            };
        }

        customAuthStateChange(auth, async (user) => {
            if (user) {
                try {
                    let isAdmin = false;
                    let userData = {};
                    let userDocExists = false;

                    if (user.uid.startsWith('mock-')) {
                        isAdmin = mockUserParam === 'admin';
                        userData = {
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName,
                            photoURL: user.photoURL,
                            role: isAdmin ? 'admin' : 'viewer',
                            status: 'active',
                            isAdmin: isAdmin,
                            nickname: mockUserParam === 'admin' ? 'admin' : 'viewer'
                        };
                        userDocExists = true;
                    } else {
                        const userRef = doc(db, "users", user.uid);
                        const userDoc = await getDoc(userRef);
                        if (userDoc.exists()) {
                            userData = userDoc.data();
                            isAdmin = userData.isAdmin || false;
                            userDocExists = true;
                        }
                    }

                    // Hiển thị nút quản lý dữ liệu cho admin
                    if (isAdmin) {
                        const configdataLink = document.getElementById('configdata-link');
                        if (configdataLink) configdataLink.style.display = 'flex';
                        isAdminUser = true; // Cập nhật biến toàn cục
                    } else {
                        const configdataLink = document.getElementById('configdata-link');
                        if (configdataLink) configdataLink.style.display = 'none';
                    }

                    isAdminUser = isAdmin; // Lưu biến toàn cục
                    userId = user.uid;
                    isAuthReady = true;

                    // Tải danh sách racers sớm để chuẩn bị Avatar
                    loadAvailableRacers();

                    // Dispatch user loaded event for user-profile module
                    window.dispatchEvent(new CustomEvent('userLoaded', {
                        detail: {
                            ...user,
                            isAdmin,
                            userData: userData
                        }
                    }));

                    // Lấy dữ liệu từ Firestore
                    await fetchGameDataFromFirestore();

                    document.getElementById('loading-screen').classList.add('hidden');
                    document.getElementById('app').classList.remove('hidden');

                    const displayName = user.displayName || (isAdmin ? 'Admin' : 'User');
                    const nickname = userData.nickname || '';
                    const roleLabel = isAdmin ? 'Quản trị viên' : 'Tay đua';
                    const roleBadgeClass = isAdmin ? 'user-badge-admin' : 'user-badge-user';

                    document.getElementById('user-role-label').textContent = roleLabel;

                    let nameHtml = displayName;
                    if (nickname) {
                        nameHtml = `<span class="user-badge-pill user-badge-nickname">@${nickname}</span> ${displayName}`;
                    }
                    nameHtml += ` <span class="user-badge-pill ${roleBadgeClass}">${isAdmin ? 'Admin' : 'User'}</span>`;

                    document.getElementById('user-display-name').innerHTML = nameHtml;

                    // Hiển thị avatar - ưu tiên Base64 nếu có
                    if (userData.photoBase64) {
                        // Nếu có Base64, dùng Base64 (ảnh mới cập nhật)
                        document.getElementById('user-avatar').src = userData.photoBase64;
                    } else if (userData.photoURL) {
                        // Nếu không có Base64, dùng photoURL
                        document.getElementById('user-avatar').src = userData.photoURL;
                    } else if (user.photoURL) {
                        // Cuối cùng, dùng từ Firebase Auth
                        document.getElementById('user-avatar').src = user.photoURL;
                    }

                    if (!isAdmin) {
                        disableEditFunctions();
                        displayMessage("⚡ Chào mừng bạn! Bạn đang ở chế độ xem.", false);
                    }

                    setupFirestoreListener();

                } catch (error) {
                    console.error("Lỗi khi kiểm tra quyền:", error);
                    displayMessage("Lỗi khi kiểm tra quyền truy cập.", true);
                    // setTimeout(() => { window.location.href = "login.html"; }, 2000);
                }
            } else {
                if (!isAuthReady) {
                    window.location.href = "login.html";
                }
            }

            setupNotificationListener();
            initNotificationSystem();
        });
    } catch (error) {
        console.error("Lỗi khi khởi tạo Firebase:", error);
        document.getElementById('loading-screen').innerHTML = `<p class="text-red-400 text-xl">Lỗi hệ thống: Không thể kết nối Firebase.</p>`;
    }

    // Trì hoãn việc kiểm tra kỷ lục để không làm lag UI khi khởi động
    setTimeout(() => {
        checkAllCompletedMapsRecords();
    }, 5000);
};

// Hàm kiểm tra record cho tất cả maps đã hoàn thành
const checkAllCompletedMapsRecords = async () => {
    try {

        for (let i = 0; i < raceState.maps.length; i++) {
            const map = raceState.maps[i];
            const isCompleted = map.times && map.times.every(time => {
                return time && time.trim() && time.trim() !== "--'--'--" && timeToSeconds(time) > 0;
            });

            if (isCompleted) {
                console.log(`Kiểm tra record cho map đã hoàn thành: ${map.name}`);
                await checkAndUpdateRecordForMap(i);
            }
        }
    } catch (error) {
        console.error("Lỗi khi kiểm tra tất cả maps:", error);
    }
};

// Gọi hàm này khi khởi tạo xong
// Thêm vào trong initFirebase hoặc setupFirestoreListener sau khi raceState được load

const setupFirestoreListener = () => {
    // Setup banners listener
    setupBannersListener();

    onSnapshot(getRaceDocRef(), (doc) => {
        if (doc.exists()) {
            let serverState = doc.data();

            if (!serverState.version || serverState.version < defaultState.version) {
                console.log("Nâng cấp cấu trúc dữ liệu...");
                serverState = ensureInitialMaps(serverState);
                serverState.version = defaultState.version;
                saveRaceState(serverState);
            }

            serverState = ensureInitialMaps(serverState);
            raceState = serverState;
        } else {
            console.log("Tạo trạng thái ban đầu trên Firestore.");
            raceState = ensureInitialMaps(defaultState);
            saveRaceState(raceState);
        }

        updateUI();
    }, (error) => {
        console.error("Lỗi khi lắng nghe Firestore:", error);
        displayMessage("Lỗi kết nối CSDL theo thời gian thực. Vui lòng tải lại trang.", true);
    });
};

// Sửa hàm disableEditFunctions trong file index.html:
const disableEditFunctions = () => {


    // Vô hiệu hóa tất cả input trong phần config
    const configInputs = document.querySelectorAll('#config input, #config select, #config textarea');
    configInputs.forEach(input => {
        input.disabled = true;
        input.readOnly = true;
        input.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-800');
    });

    // Vô hiệu hóa ô Map BTC
    const btcMapInput = document.getElementById('btc-map-name');
    if (btcMapInput) {
        btcMapInput.disabled = true;
        btcMapInput.readOnly = true;
        btcMapInput.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-800');
        if (!btcMapInput.value.trim()) btcMapInput.placeholder = "Chỉ xem";
    }

    // Nút Vòng quay chỉ Admin mới được quay
    const spinBtn = document.getElementById('spin-wheel-btn');
    if (spinBtn) {
        spinBtn.disabled = true;
        spinBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    const exportBtn = document.getElementById('export-excel-btn');
    if (exportBtn) {
        // exportBtn.disabled = true; // Vẫn cho phép User xuất Excel
    }

    // Vô hiệu hóa các ô tên tay đua
    for (let i = 0; i < getNumRacers(); i++) {
        const nameInput = document.getElementById(`racer-name-${i}`);
        const kingMapInput = document.getElementById(`king-map-${i}`);
        const banMap0Input = document.getElementById(`ban-map-${i}-0`);
        const banMap1Input = document.getElementById(`ban-map-${i}-1`);

        if (nameInput) {
            nameInput.disabled = true;
            nameInput.readOnly = true;
            nameInput.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-800');
            if (!nameInput.value.trim()) nameInput.placeholder = "Chỉ xem";
        }

        if (kingMapInput) {
            kingMapInput.disabled = true;
            kingMapInput.readOnly = true;
            kingMapInput.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-800');
            if (!kingMapInput.value.trim()) kingMapInput.placeholder = "Chỉ xem";
        }

        [banMap0Input, banMap1Input].forEach(inp => {
            if (inp) {
                inp.disabled = true;
                inp.readOnly = true;
                inp.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-800');
                if (!inp.value.trim()) inp.placeholder = "Chỉ xem";
            }
        });
    }

    // Vô hiệu hóa tất cả input trong Bảng Thời Gian và Điểm Số
    const timeTableInputs = document.querySelectorAll('#map-time-points-body input, #data-entry input:not([type="hidden"])');
    timeTableInputs.forEach(input => {
        input.disabled = true;
        input.readOnly = true;
        input.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-800');
        if (!input.value.trim()) {
            if (input.placeholder.includes("'--'--") || input.placeholder.includes("MM'SS'MS")) {
                input.placeholder = "Chỉ xem";
            }
        }
    });

    // Vô hiệu hóa tất cả input trong Bảng Xe và Pet
    const carPetInputs = document.querySelectorAll('#map-car-pet-body input, #racer-sub-header-car-pet + tbody input');
    carPetInputs.forEach(input => {
        input.disabled = true;
        input.readOnly = true;
        input.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-800');
        if (!input.value.trim()) input.placeholder = "Chỉ xem";
    });

    // Vô hiệu hóa tất cả input trong Bảng điểm chi tiết (nếu có)
    const scoreboardInputs = document.querySelectorAll('#detailed-scoreboard-body input, #detailed-scoreboard-header input');
    scoreboardInputs.forEach(input => {
        input.disabled = true;
        input.readOnly = true;
        input.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-800');
    });

    // VÔ hiệu hóa tất cả các button TRỪ button menu mobile, button profile, button record holder, và các button được phép (vòng quay, export)
    const allowedButtonSelectors = [
        '#logout-btn',
        '#notification-bell',
        '.notification-item button',
        '#sidebar-toggle',
        '#sidebar-toggle-in',
        '.lg\\:hidden',
        '[onclick*="openUserProfileModal"]',
        '[onclick*="openRecordHolderModal"]',
        '[onclick*="userProfileManager"]',
        '#delete-all-notifications',
        '#close-banner',
        '#mark-all-read',
        '[onclick*="openBxhModal"]',
        '[onclick*="close"]',
        '[onclick*="toggle"]',
        '[onclick*="changeRacerMatchesPage"]',
        '#mobile-search-toggle',
        '#mobile-search-clear',
        '#header-search-clear',
        '#carousel-prev',
        '#carousel-next',
        '.carousel-indicator',
        '#mobile-search-close'
    ].join(',');

    const allButtons = document.querySelectorAll(`button:not(${allowedButtonSelectors})`);
    allButtons.forEach(button => {
        button.disabled = true;
        button.classList.add('opacity-50', 'cursor-not-allowed');
        if (button.id === 'add-map-btn' || button.id === 'refresh-data-btn' || button.id === 'export-excel-btn') {
            button.classList.add('hidden');
        }
    });

    // Đảm bảo button profile (avatar) hoạt động cho cả admin và user
    const profileButtons = document.querySelectorAll('[onclick*="openUserProfileModal"]');
    profileButtons.forEach(button => {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
        button.style.pointerEvents = 'auto';
        button.style.cursor = 'pointer';
    });

    // Đảm bảo button "Hồ Sơ Cá Nhân" từ userProfileManager hoạt động
    const userProfileButtons = document.querySelectorAll('[onclick*="userProfileManager"]');
    userProfileButtons.forEach(button => {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
        button.style.pointerEvents = 'auto';
        button.style.cursor = 'pointer';
    });

    // Đảm bảo button record holder hoạt động cho cả admin và user
    const recordHolderButtons = document.querySelectorAll('[onclick*="openRecordHolderModal"]');
    recordHolderButtons.forEach(button => {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
        button.style.pointerEvents = 'auto';
        button.style.cursor = 'pointer';
    });

    // Đảm bảo button menu mobile hoạt động cho cả admin và user
    const mobileMenuButton = document.querySelector('button.lg\\:hidden');
    if (mobileMenuButton) {
        mobileMenuButton.disabled = false;
        mobileMenuButton.classList.remove('opacity-50', 'cursor-not-allowed');
        mobileMenuButton.style.pointerEvents = 'auto';
        mobileMenuButton.style.cursor = 'pointer';
    }

    // ĐẶC BIỆT: KHÔNG vô hiệu hóa các nút đóng modal thông báo và record holder
    const closeButtons = document.querySelectorAll('button[onclick*="closeNotificationModal"], button[onclick*="closeAllNotificationsModal"], button[onclick*="closeRecordHolderModal"]');
    closeButtons.forEach(button => {
        button.disabled = false;
        button.classList.remove('opacity-50', 'cursor-not-allowed');
        button.style.pointerEvents = 'auto';
        button.style.cursor = 'pointer';
    });

    // Loại bỏ sự kiện onchange từ tất cả các phần tử NGOẠI TRỪ file input trong modal profile
    document.querySelectorAll('[onchange]').forEach(element => {
        // KHÔNG xóa onchange cho file input trong modal profile
        if (!(element.type === 'file' && element.closest('#user-profile-modal'))) {
            element.removeAttribute('onchange');
            element.setAttribute('title', 'Chế độ xem - Không thể chỉnh sửa');
        }
    });

    // Loại bỏ sự kiện onclick từ các nút xóa map
    document.querySelectorAll('[onclick*="deleteMap"]').forEach(element => {
        element.removeAttribute('onclick');
        element.setAttribute('title', 'Chế độ xem - Không thể xóa');
    });

    // Sửa đổi placeholder cho tất cả các input
    document.querySelectorAll('input[type="text"], input[type="number"]').forEach(input => {
        if (!input.disabled && input.placeholder) {
            const currentPlaceholder = input.placeholder;
            if (!currentPlaceholder.includes("Chỉ xem")) {
                if (currentPlaceholder.includes("'--'--") || currentPlaceholder.includes("MM'SS'MS")) {
                    input.placeholder = "Chỉ xem";
                } else if (currentPlaceholder.includes("Xe") || currentPlaceholder.includes("Pet")) {
                    input.placeholder = "Chỉ xem - " + currentPlaceholder;
                } else if (currentPlaceholder.includes("Tên Map")) {
                    input.placeholder = "Chỉ xem - Tên Map";
                }
            }
        }
    });

    // Thêm thông báo chế độ xem vào các section
    const sectionsToDisable = ['#config', '#data-entry', '#scoreboard'];
    sectionsToDisable.forEach(selector => {
        const section = document.querySelector(selector);
        if (section) {
            const existingNotice = section.querySelector('.view-mode-notice');
            if (!existingNotice) {
                const notice = document.createElement('div');
                notice.className = 'view-mode-notice bg-gradient-to-r from-blue-900/50 to-blue-800/30 border-l-4 border-blue-500 p-4 mb-6 rounded-r-xl';
                notice.innerHTML = `
                        <div class="flex items-center justify-center">
                            <i class="fas fa-eye text-blue-400 mr-2"></i>
                            <span class="font-bold text-blue-300">CHẾ ĐỘ CHỈ XEM</span>
                        </div>
                        <p class="text-sm text-blue-200 mt-1 text-center">Bạn đang ở chế độ xem. Chỉ có quyền xem dữ liệu, không thể chỉnh sửa.</p>
                    `;
                section.insertBefore(notice, section.firstChild);
            }
        }
    });

    // Removed redundant view-mode-badge as requested

    // Vô hiệu hóa hover effect trên các bảng (nhưng không trên modal)
    document.querySelectorAll('.neon-card:not(#crop-image-modal *):not(#user-profile-modal *):not(#record-holder-detail-modal *), .speed-table tbody tr').forEach(element => {
        if (!element.closest('#crop-image-modal') && !element.closest('#user-profile-modal') && !element.closest('#record-holder-detail-modal')) {
            element.classList.add('pointer-events-none');
        }
    });

    // Vô hiệu hóa tất cả các input trong các section khác
    const allSectionInputs = document.querySelectorAll('main input:not([type="hidden"])');
    allSectionInputs.forEach(input => {
        // KIỂM TRA: Không vô hiệu hóa các phần tử trong hệ thống thông báo và modal
        if (!input.closest('#notification-dropdown') && !input.closest('#notification-modal') && !input.closest('#crop-image-modal') && !input.closest('#user-profile-modal')) {
            if (!input.disabled) {
                input.disabled = true;
                input.readOnly = true;
                input.classList.add('opacity-50', 'cursor-not-allowed', 'bg-slate-800');
            }
        }
    });

    // Cho phép click vào avatar để mở modal
    const avatarButtons = document.querySelectorAll('[onclick*="openUserProfileModal"]');
    avatarButtons.forEach(btn => {
        btn.style.pointerEvents = 'auto';
        btn.style.cursor = 'pointer';
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    });

    // Cho phép các input trong modal profile hoạt động
    const profileModal = document.getElementById('user-profile-modal');
    if (profileModal) {
        const profileInputs = profileModal.querySelectorAll('input, button, textarea');
        profileInputs.forEach(input => {
            input.disabled = false;
            input.readOnly = false;
            input.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-slate-800');
            // Đảm bảo file input có thể click
            if (input.type === 'file') {
                input.disabled = false;
                input.classList.remove('opacity-50', 'cursor-not-allowed');
                input.style.pointerEvents = 'auto';
            }
        });
        // Cho phép file input
        const fileInputs = profileModal.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            input.disabled = false;
            input.classList.remove('opacity-50', 'cursor-not-allowed');
            input.style.pointerEvents = 'auto';
        });
        // Cho phép label chứa file input (upload avatar)
        const fileLabels = profileModal.querySelectorAll('label');
        fileLabels.forEach(label => {
            label.classList.remove('opacity-50', 'cursor-not-allowed');
            label.style.pointerEvents = 'auto';
            label.style.cursor = 'pointer';
        });
    }

    // Cho phép các button trong modal crop ảnh
    const cropModal = document.getElementById('crop-image-modal');
    if (cropModal) {
        const cropButtons = cropModal.querySelectorAll('button');
        cropButtons.forEach(button => {
            button.disabled = false;
            button.classList.remove('opacity-50', 'cursor-not-allowed');
        });
        // Đảm bảo tất cả element trong crop modal hoạt động
        const cropElements = cropModal.querySelectorAll('*');
        cropElements.forEach(el => {
            el.classList.remove('pointer-events-none');
            el.style.pointerEvents = 'auto';
            el.disabled = false;
        });
    }


    // Thêm CSS để làm mờ các bảng dữ liệu
    const style = document.createElement('style');
    style.textContent = `
            .view-mode .speed-input {
                background-color: rgba(30, 41, 59, 0.5) !important;
                border-color: rgba(100, 116, 139, 0.3) !important;
                color: #94a3b8 !important;
            }
            
            .view-mode .neon-card {
                border-color: rgba(100, 116, 139, 0.2) !important;
            }
            
            .view-mode table {
                opacity: 0.9;
            }
        `;
    document.head.appendChild(style);

    // Vô hiệu hóa các nút lưu mới
    const saveBtcMapBtn = document.getElementById('save-btc-map-btn');
    if (saveBtcMapBtn) {
        saveBtcMapBtn.disabled = true;
        saveBtcMapBtn.classList.add('hidden');
    }

    const saveKingMapsBtn = document.getElementById('save-king-maps-btn');
    if (saveKingMapsBtn) {
        saveKingMapsBtn.disabled = true;
        saveKingMapsBtn.classList.add('hidden');
    }

    const saveAllCarsPetsBtn = document.getElementById('save-all-cars-pets-btn');
    if (saveAllCarsPetsBtn) {
        saveAllCarsPetsBtn.disabled = true;
        saveAllCarsPetsBtn.classList.add('hidden');
    }
    document.body.classList.add('view-mode');
};

const saveRaceRecord = async (mapName, racerIndex, timeInSeconds, car, pet) => {
    try {
        if (!mapName || !timeInSeconds || !car || !pet) return;

        const racerName = raceState.racers[racerIndex]?.name || `Tay Đua ${racerIndex + 1}`;
        const recordId = `${mapName.replace(/\s+/g, '_')}_${racerName}_${Date.now()}`;
        const mapInfo = ALL_MAPS.find(m => (m.name || "").trim() === (mapName || "").trim());

        const recordData = {
            mapName: mapName,
            mapImage: mapInfo?.image || '',
            racerName: racerName,
            racerIndex: racerIndex,
            timeInSeconds: timeInSeconds,
            timeString: secondsToTimeString(timeInSeconds),
            car: car || '',
            pet: pet || '',
            timestamp: new Date().toISOString(),
            isRecord: false
        };

        await setDoc(doc(db, "raceRecords", recordId), recordData);
        await updateMapRecord(mapName, {
            timeInSeconds: timeInSeconds,
            timeString: secondsToTimeString(timeInSeconds),
            racerName: racerName,
            racerIndex: racerIndex,
            car: car || '',
            pet: pet || '',
            timestamp: new Date().toISOString()
        });

        setTimeout(() => renderHallOfFame(), 1000);

        console.log("Đã lưu thành tích:", recordData);
    } catch (error) {
        console.error("Lỗi khi lưu thành tích:", error);
    }
};

// Thêm biến global để tracking
const notificationLocks = new Map();
const SENT_NOTIFICATIONS = new Set(); // Set để tracking notifications đã gửi

// Hàm gửi thông báo với lock
const sendRecordNotificationWithLock = async (mapName, recordData) => {
    // Tạo key duy nhất cho thông báo này
    const notificationKey = `${mapName}_${recordData.timeString}_${recordData.racerName}`;

    // Kiểm tra xem đã gửi chưa
    if (SENT_NOTIFICATIONS.has(notificationKey)) {
        console.log(`🔒 Bỏ qua - Thông báo đã được gửi: ${notificationKey}`);
        return true;
    }

    // Kiểm tra lock
    if (notificationLocks.has(mapName)) {
        console.log(`🔒 Bỏ qua - Map ${mapName} đang bị lock`);
        return false;
    }

    // Set lock
    notificationLocks.set(mapName, true);

    try {
        // KIỂM TRA LẠI XE VÀ PET
        if (!recordData.car || !recordData.pet ||
            recordData.car.trim() === '' || recordData.pet.trim() === '') {
            console.error(`❌ Không thể gửi thông báo: Thiếu thông tin xe hoặc pet`);
            return false;
        }

        console.log(`📤 Gửi thông báo record mới cho ${mapName}`);

        // Lấy hình ảnh tay đua - tìm theo cả displayName lẫn nickname
        let racerAvatar = null;
        try {
            const usersSnap = await getDocs(collection(db, "users"));
            const matchedUser = usersSnap.docs.find(d => {
                const uData = d.data();
                const nameToMatch = recordData.racerName.trim().toLowerCase();
                return (
                    (uData.nickname || '').trim().toLowerCase() === nameToMatch ||
                    (uData.displayName || '').trim().toLowerCase() === nameToMatch
                );
            });
            if (matchedUser) {
                const uData = matchedUser.data();
                racerAvatar = uData.photoBase64 || uData.photoURL || null;
            }
        } catch (e) {
            // fallback nếu lỗi, dùng null
        }

        // Lấy hình ảnh bản đồ từ ALL_MAPS
        const mapInfo = ALL_MAPS.find(m => (m.name || '').trim() === (mapName || '').trim());
        const mapImageUrl = mapInfo?.imageUrl || null;

        // Lấy hình ảnh xe từ ALL_CARS
        const carInfo = ALL_CARS.find(c => c.name === recordData.car);
        const carImageUrl = carInfo?.imageUrl || null;

        // Lấy hình ảnh pet từ ALL_PETS
        const petInfo = ALL_PETS.find(p => p.name === recordData.pet);
        const petImageUrl = petInfo?.imageUrl || null;

        const notificationData = {
            title: "🎉 Kỷ lục mới được thiết lập!",
            message: `${recordData.racerName} vừa lập kỷ lục mới trên map "${mapName}" với thời gian ${recordData.timeString}!`,
            type: "record",
            target: "all",
            important: true,
            extraData: {
                mapName: mapName,
                time: recordData.timeString,
                racer: recordData.racerName,
                car: recordData.car,
                pet: recordData.pet,
                racerAvatar: racerAvatar,
                mapImageUrl: mapImageUrl,
                carImageUrl: carImageUrl,
                petImageUrl: petImageUrl,
                timestamp: new Date().toISOString()
            }
        };

        // Gửi thông báo
        const result = await sendNotificationToAllUsers(notificationData);

        if (result) {
            // Đánh dấu đã gửi
            SENT_NOTIFICATIONS.add(notificationKey);
            console.log(`✅ Đã gửi thông báo record: ${notificationKey}`);

            // Tự động xóa sau 30 giây để có thể gửi lại nếu cần
            setTimeout(() => {
                SENT_NOTIFICATIONS.delete(notificationKey);
            }, 30000);
        }

        return result;
    } catch (error) {
        console.error("❌ Lỗi khi gửi thông báo:", error);
        return false;
    } finally {
        // Luôn unlock sau 2 giây (tránh race condition)
        setTimeout(() => {
            notificationLocks.delete(mapName);
        }, 2000);
    }
};

// Thay thế tất cả các lời gọi sendRecordNotification bằng hàm mới

const updateMapRecord = async (mapName, recordData) => {
    try {
        console.log(`🔄 Bắt đầu cập nhật record cho ${mapName}...`);

        const map = ALL_MAPS.find(m => (m.name || "").trim() === (mapName || "").trim());
        if (!map) {
            console.log(`❌ Không tìm thấy map ${mapName} trong ALL_MAPS`);
            return false;
        }

        // KIỂM TRA XE VÀ PET CÓ ĐẦY ĐỦ KHÔNG
        const hasValidCar = recordData.car && recordData.car.trim() !== '';
        const hasValidPet = recordData.pet && recordData.pet.trim() !== '';

        if (!hasValidCar || !hasValidPet) {
            console.log(`❌ Không thể cập nhật record: Thiếu thông tin xe hoặc pet`);
            return false;
        }

        const currentRecordTime = map.recordTime || "00'00'00";
        const timeStringFormatted = secondsToTimeString(recordData.timeInSeconds);

        console.log(`📊 Thông tin record:`);
        console.log(`- Map: ${mapName}`);
        console.log(`- Tay đua: ${recordData.racerName}`);
        console.log(`- Thời gian mới: ${timeStringFormatted}`);
        console.log(`- Record hiện tại: ${currentRecordTime}`);
        console.log(`- Xe: ${recordData.car}`);
        console.log(`- Pet: ${recordData.pet}`);

        // Xử lý trường hợp chưa có record
        const isNoRecord = currentRecordTime === "00'00'00" ||
            currentRecordTime === "--'--'--" ||
            !currentRecordTime;

        if (isNoRecord) {
            console.log(`📝 Chưa có record, cập nhật record mới...`);

            await setDoc(doc(db, "gameMaps", map.id), {
                recordTime: timeStringFormatted,
                recordRacer: recordData.racerName,
                recordRacerIndex: recordData.racerIndex,
                recordCar: recordData.car,
                recordPet: recordData.pet,
                lastUpdated: new Date().toISOString()
            }, { merge: true });

            console.log(`✅ Đã cập nhật record đầu tiên`);

            // Gửi thông báo với LOCK - CHỈ GỬI 1 LẦN
            await sendRecordNotificationWithLock(mapName, recordData);
            return true;
        }

        // Nếu đã có record, so sánh
        const parseTimeToMs = (timeString) => {
            if (!timeString || timeString === "--'--'--") return Infinity;
            const parts = timeString.split("'");
            if (parts.length !== 3) return Infinity;

            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseInt(parts[1]) || 0;
            const milliseconds = parseInt(parts[2]) || 0;

            return (minutes * 60 * 100) + (seconds * 100) + milliseconds;
        };

        const currentTimeMs = parseTimeToMs(currentRecordTime);
        const newTimeMs = parseTimeToMs(timeStringFormatted);

        console.log(`⚖️ So sánh: ${currentTimeMs}ms (cũ) vs ${newTimeMs}ms (mới)`);

        // CHỈ cập nhật khi tốt hơn
        if (newTimeMs < currentTimeMs) {
            console.log(`🎉 Thành tích mới tốt hơn! Cập nhật...`);

            await setDoc(doc(db, "gameMaps", map.id), {
                recordTime: timeStringFormatted,
                recordRacer: recordData.racerName,
                recordRacerIndex: recordData.racerIndex,
                recordCar: recordData.car,
                recordPet: recordData.pet,
                lastUpdated: new Date().toISOString()
            }, { merge: true });

            console.log(`✅ Đã cập nhật record mới`);

            // Gửi thông báo với LOCK - CHỈ GỬI 1 LẦN
            await sendRecordNotificationWithLock(mapName, recordData);
            return true;
        } else {
            console.log(`❌ Thành tích không tốt hơn record hiện tại`);
            return false;
        }
    } catch (error) {
        console.error("❌ Lỗi khi cập nhật record:", error);
        return false;
    }
};

// Mobile sidebar toggle
document.addEventListener('DOMContentLoaded', function () {
    const menuButton = document.querySelector('button.lg\\:hidden');
    const sidebar = document.querySelector('.sidebar-modern');
    const app = document.getElementById('app');

    if (menuButton && sidebar) {
        menuButton.addEventListener('click', function () {
            if (sidebar.classList.contains('hidden')) {
                // Mở sidebar
                sidebar.classList.remove('hidden');
                sidebar.style.transform = 'translateX(0)';

                // Thêm overlay
                const overlay = document.createElement('div');
                overlay.id = 'mobile-sidebar-overlay';
                overlay.className = 'fixed inset-0 bg-black/70 z-10 lg:hidden';
                overlay.addEventListener('click', closeSidebar);
                document.body.appendChild(overlay);

                // Ngăn scroll body
                document.body.style.overflow = 'hidden';
            } else {
                closeSidebar();
            }
        });

        function closeSidebar() {
            sidebar.classList.add('hidden');
            const overlay = document.getElementById('mobile-sidebar-overlay');
            if (overlay) {
                overlay.remove();
            }
            document.body.style.overflow = '';
        }

        document.querySelectorAll('.sidebar-admin .sidebar-link').forEach(link => {
            link.addEventListener('click', function () {
                if (window.innerWidth < 1024) {
                    const overlay = document.getElementById('sidebar-overlay');
                    document.body.classList.remove('sidebar-active');
                    if (overlay) overlay.classList.remove('active');
                }
            });
        });

        // Đóng sidebar khi click vào nút logout
        document.getElementById('logout-btn')?.addEventListener('click', function () {
            if (window.innerWidth < 1024) {
                closeSidebar();
            }
        });
    }

    if (isAdminUser) {
        document.getElementById('configdata-link').style.display = 'flex';
    }

    // Điều chỉnh sidebar cho mobile
    function adjustSidebarForMobile() {
        if (window.innerWidth < 1024 && sidebar) {
            // Thêm styles cho sidebar mobile
            sidebar.style.position = 'fixed';
            sidebar.style.top = '0';
            sidebar.style.left = '0';
            sidebar.style.height = '100vh';
            sidebar.style.width = '280px';
            sidebar.style.zIndex = '50'; // Phải cao hơn overlay (35) để menu click được
            sidebar.style.transform = 'translateX(-100%)';
            sidebar.style.transition = 'transform 0.3s ease-in-out';
        } else {
            // Reset cho desktop
            if (sidebar) {
                sidebar.style.position = '';
                sidebar.style.transform = '';
                sidebar.style.transition = '';
                sidebar.style.width = '';
                sidebar.style.zIndex = '';
            }
            const overlay = document.getElementById('mobile-sidebar-overlay');
            if (overlay) {
                overlay.remove();
            }
            document.body.style.overflow = '';
        }
    }

    // Gọi lần đầu
    adjustSidebarForMobile();

    // Theo dõi thay đổi kích thước màn hình
    window.addEventListener('resize', adjustSidebarForMobile);
});

// ================ HÀM QUẢN LÝ THÔNG BÁO ================

// Biến lưu trữ thông báo
let notifications = [];
let unreadCount = 0;

// Khởi tạo hệ thống thông báo
let _notificationSystemInited = false;
const initNotificationSystem = () => {
    const bellButton = document.getElementById('notification-bell');
    const dropdown = document.getElementById('notification-dropdown');
    const markAllReadButton = document.getElementById('mark-all-read');

    if (!bellButton || !dropdown) return;

    // Tránh gắn event listener nhiều lần
    if (_notificationSystemInited) return;
    _notificationSystemInited = true;

    // Toggle dropdown
    bellButton.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    // Đóng dropdown khi click ra ngoài
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !bellButton.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
    });

    // Xoá tất cả thông báo
    const deleteAllButton = document.getElementById('delete-all-notifications');
    if (deleteAllButton) {
        deleteAllButton.addEventListener('click', () => {
            if (confirm("Bạn có chắc chắn muốn xoá tất cả thông báo?")) {
                deleteAllNotifications();
            }
        });
    }

    // Đánh dấu tất cả thông báo đã đọc
    if (markAllReadButton) {
        markAllReadButton.addEventListener('click', () => {
            markAllNotificationsAsRead();
        });
    }

    // Lấy thông báo từ Firestore
    setupNotificationListener();
};

// Cập nhật hàm setupNotificationListener
const setupNotificationListener = () => {
    if (!db) {
        console.error("Firestore chưa được khởi tạo");
        return;
    }

    // Kiểm tra nếu đã có listener
    if (window.notificationListener) {
        console.log("⚠️ Notification listener đã được thiết lập, bỏ qua");
        return;
    }

    try {
        if (!userId) {
            console.log("⚠️ Chờ userId để thiết lập lắng nghe thông báo...");
            return;
        }

        const notificationsRef = collection(db, "users", userId, "notifications");

        console.log(`🎯 Bắt đầu lắng nghe thông báo cá nhân cho user ${userId}...`);

        // Thêm debounce để tránh nhiều lần update
        let updateTimeout;

        window.notificationListener = onSnapshot(notificationsRef, (snapshot) => {
            console.log(`📨 Nhận ${snapshot.docs.length} thông báo từ Firestore`);

            // Phát hiện và bung popup ngay cho Kỷ Lục Mới
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (data.type === 'record' && data.extraData) {
                        const notifTime = new Date(data.timestamp || data.createdAt).getTime();
                        if (Date.now() - notifTime < 60000) { // Chỉ tính những kỷ lục lập trong vòng 1 phút
                            const popupKey = `popup_shown_${change.doc.id}`;
                            if (!sessionStorage.getItem(popupKey)) {
                                sessionStorage.setItem(popupKey, "true");
                                if (typeof window.showRecordHonorPopup === 'function') {
                                    window.showRecordHonorPopup(
                                        data.extraData.racer,
                                        data.extraData.time,
                                        data.extraData.mapName,
                                        data.extraData.car,
                                        data.extraData.pet,
                                        data.extraData.racerAvatar,
                                        data.extraData.mapImageUrl,
                                        data.extraData.carImageUrl,
                                        data.extraData.petImageUrl
                                    );
                                }
                            }
                        }
                    }
                }
            });

            // Clear timeout cũ
            if (updateTimeout) {
                clearTimeout(updateTimeout);
            }

            // Debounce: chờ 300ms trước khi update
            updateTimeout = setTimeout(() => {
                const newNotifications = [];

                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    newNotifications.push({
                        id: doc.id,
                        title: data.title || "Thông báo",
                        content: data.content || data.message || "",
                        type: data.type || "info",
                        target: data.target || "all",
                        important: data.important || false,
                        sender: data.sender || "Hệ thống",
                        senderId: data.senderId || "system",
                        read: data.read || false,
                        timestamp: data.timestamp || data.createdAt || new Date().toISOString(),
                        createdAt: data.createdAt || data.timestamp || new Date().toISOString(),
                        extraData: data.extraData || null
                    });
                });

                // Sắp xếp theo thời gian mới nhất
                newNotifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                // Cập nhật notifications array
                notifications = newNotifications;

                // Cập nhật UI
                updateNotificationUI();

                console.log("✅ Đã cập nhật UI với thông báo mới");
            }, 300); // Debounce 300ms
        }, (error) => {
            console.error("❌ Lỗi khi lắng nghe thông báo:", error);
        });

        console.log("✅ Đã thiết lập notification listener thành công");
    } catch (error) {
        console.error("❌ Lỗi khi thiết lập listener thông báo:", error);
    }
};

// ĐẶC BIỆT: Cho phép người xem click vào thông báo
const notificationItems = document.querySelectorAll('.notification-item');
notificationItems.forEach(item => {
    item.style.pointerEvents = 'auto';
    item.style.cursor = 'pointer';
});

// Cập nhật UI thông báo
const updateNotificationUI = () => {
    const notificationList = document.getElementById('notification-list');
    const notificationCount = document.getElementById('notification-count');
    const notificationBell = document.getElementById('notification-bell');

    if (!notificationList) return;

    // Đếm số thông báo chưa đọc trước khi cập nhật các thành phần UI khác
    unreadCount = notifications.filter(n => !n.read).length;

    if (notificationBell) {
        if (unreadCount > 0) {
            notificationBell.classList.add('has-unread');

            // Nếu có thông báo quan trọng, thêm class đặc biệt
            const hasImportant = notifications.some(n => !n.read && n.important);
            if (hasImportant) {
                notificationBell.classList.add('important-alert');
            } else {
                notificationBell.classList.remove('important-alert');
            }

            // Highlight icon chuông
            const bellIcon = notificationBell.querySelector('i');
            if (bellIcon) bellIcon.classList.add('text-yellow-400');
        } else {
            notificationBell.classList.remove('has-unread', 'important-alert');
            const bellIcon = notificationBell.querySelector('i');
            if (bellIcon) bellIcon.classList.remove('text-yellow-400');
        }
    }

    // Cập nhật badge số lượng nếu tồn tại
    if (notificationCount) {
        if (unreadCount > 0) {
            notificationCount.textContent = unreadCount > 9 ? '9+' : unreadCount;
            notificationCount.classList.remove('hidden');
            notificationCount.classList.add('notification-badge-pulse');
        } else {
            notificationCount.classList.add('hidden');
            notificationCount.classList.remove('notification-badge-pulse');
        }
    }

    // Hiển thị danh sách thông báo
    if (notifications.length === 0) {
        notificationList.innerHTML = `
            <div class="p-4 text-center text-slate-500">
                <i class="fas fa-bell-slash text-2xl mb-2"></i>
                <p>Không có thông báo nào</p>
            </div>
        `;
        return;
    }

    let notificationsHTML = '';

    // Cập nhật phần render trong updateNotificationUI
    notifications.forEach(notification => {
        const timeAgo = getTimeAgo(notification.timestamp);
        const icon = getNotificationIcon(notification.type);
        const iconColor = getNotificationIconColor(notification.type);

        // Thêm biểu tượng quan trọng nếu có
        const importantBadge = notification.important ?
            '<span class="ml-2 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded">!</span>' : '';

        // Thêm biểu tượng target nếu không phải "all"
        const targetBadge = notification.target && notification.target !== "all" ?
            `<span class="ml-2 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">${notification.target.substring(0, 1).toUpperCase()}</span>` : '';

        notificationsHTML += `
<div class="notification-item ${notification.read ? 'read' : 'unread'} group" 
     data-id="${notification.id}">
    <div class="flex items-start">
        <div class="mr-3 mt-1 flex-shrink-0" onclick="handleNotificationClick('${notification.id}', event)">
            <i class="${icon} ${iconColor} text-lg"></i>
        </div>
        <div class="flex-1 min-w-0" onclick="handleNotificationClick('${notification.id}', event)">
            <div class="notification-title flex items-center justify-between">
                <span class="truncate">${notification.title}</span>
                <div class="flex items-center space-x-1 flex-shrink-0">
                    ${importantBadge}
                    ${targetBadge}
                </div>
            </div>
            <div class="notification-message text-xs text-slate-400 mt-0.5 line-clamp-2">${notification.content || notification.message || ''}</div>
            <div class="notification-time flex items-center justify-between mt-1 text-[10px]">
                <span class="text-cyan-500/70">${notification.sender || 'Hệ thống'}</span>
                <span class="text-slate-500">${timeAgo}</span>
            </div>
        </div>
        <div class="flex flex-col items-center justify-between self-stretch ml-2 flex-shrink-0">
            ${!notification.read ? `
            <div class="w-2 h-2 bg-cyan-400 rounded-full mb-2"></div>
            ` : '<div class="w-2 h-2"></div>'}
            <button onclick="deleteNotification('${notification.id}', event)" 
                    class="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-1"
                    title="Xóa thông báo">
                <i class="fas fa-trash-alt text-xs"></i>
            </button>
        </div>
    </div>
</div>
`;
    });

    notificationList.innerHTML = notificationsHTML;
};

// Hàm đánh dấu thông báo đã đọc
window.markNotificationAsRead = async (notificationId) => {
    try {
        if (!userId) return;
        await setDoc(doc(db, "users", userId, "notifications", notificationId), {
            read: true
        }, { merge: true });
    } catch (error) {
        console.error("Lỗi khi đánh dấu thông báo đã đọc:", error);
    }
};

// Hàm xóa thông báo (dành riêng cho mỗi user)
window.deleteNotification = async (notificationId, event) => {
    if (event) event.stopPropagation();

    if (!confirm("Bạn có chắc chắn muốn xóa thông báo này không?")) return;

    try {
        if (!userId) return;

        // Tạo hiệu ứng fade out cho item trong UI trước khi xóa khỏi DB
        const item = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
        if (item) {
            item.style.opacity = '0';
            item.style.transform = 'translateX(20px)';
            item.style.transition = 'all 0.3s ease';
        }

        // Sử dụng deleteDoc hoặc setDoc tùy theo setup Firebase của bạn, ở đây dùng setDoc xóa là ko đúng, phải xóa hẳn document
        // Nhưng vì DB của bạn đang dùng setDoc nhiều, tôi sẽ dùng hàm xóa document chuẩn của Firestore
        // Cần import deleteDoc nếu chưa có, nhưng các hàm Firestore đang dùng via import ở đầu file.
        // Tôi sẽ kiểm tra xem deleteDoc đã được import chưa.
        // GIẢ ĐỊNH: deleteDoc đã có sẵn trong scope import (nếu chưa tôi sẽ bổ sung ở bước sau)

        const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
        await deleteDoc(doc(db, "users", userId, "notifications", notificationId));

        showStatusMessage("Đã xóa thông báo", false);
    } catch (error) {
        console.error("Lỗi khi xóa thông báo:", error);
        showStatusMessage("Lỗi khi xóa thông báo", true);
    }
};

// Đánh dấu tất cả thông báo đã đọc
const deleteAllNotifications = async () => {
    try {
        if (!userId) return;

        if (notifications.length === 0) {
            displayMessage("Không có thông báo nào để xoá", false);
            return;
        }

        const batch = [];

        notifications.forEach(notification => {
            const ref = doc(db, "users", userId, "notifications", notification.id);
            batch.push(deleteDoc(ref));
        });

        if (batch.length > 0) {
            await Promise.all(batch);
            displayMessage("Đã xoá tất cả thông báo", false);
        }
    } catch (error) {
        console.error("Lỗi khi xoá thông báo:", error);
        displayMessage("Lỗi khi xoá thông báo", true);
    }
};

const markAllNotificationsAsRead = async () => {
    try {
        console.log("Đánh dấu TẤT CẢ thông báo đã đọc");
        // Cho phép mọi người dùng đã đăng nhập đánh dấu thông báo của riêng họ
        if (!userId) {
            return;
        }

        const unreadNotifications = notifications.filter(n => !n.read);
        if (unreadNotifications.length === 0) {
            console.log("Không có thông báo nào chưa đọc");
            return;
        }

        // 1. Cập nhật tất cả trên Firestore
        const batch = [];
        unreadNotifications.forEach(notification => {
            const ref = doc(db, "users", userId, "notifications", notification.id);
            batch.push(setDoc(ref, { read: true }, { merge: true }));
        });

        if (batch.length > 0) {
            await Promise.all(batch);
        }

        // 2. CẬP NHẬT NGAY LẬP TỨC LOCAL STATE
        notifications.forEach(notification => {
            notification.read = true;
        });

        // 3. CẬP NHẬT UI NGAY LẬP TỨC
        updateNotificationBadge();

        // 4. Cập nhật tất cả item trong UI
        document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
            item.classList.add('read');
            item.style.opacity = '0.7';

            const unreadIndicator = item.querySelector('.w-2.h-2.bg-cyan-400');
            if (unreadIndicator) {
                unreadIndicator.remove();
            }
        });

        // 5. Hiệu ứng feedback
        showStatusMessage(`Đã đánh dấu ${unreadNotifications.length} thông báo là đã đọc`, false);

        console.log(`Đã đánh dấu ${unreadNotifications.length} thông báo đã đọc`);
    } catch (error) {
        console.error("Lỗi khi đánh dấu tất cả thông báo đã đọc:", error);
        showStatusMessage("Lỗi khi đánh dấu thông báo đã đọc", true);
    }
};

// Cập nhật hàm getTimeAgo để xử lý timestamp
const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Vừa xong';

    const now = new Date();
    const past = new Date(timestamp);

    // Kiểm tra xem timestamp có hợp lệ không
    if (isNaN(past.getTime())) {
        return 'Vừa xong';
    }

    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return 'Vừa xong';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} ngày trước`;
    return `${Math.floor(diffInSeconds / 2592000)} tháng trước`;
};

// Hàm helper: lấy icon theo loại thông báo
// Thêm debug cho hàm getNotificationIcon
const getNotificationIcon = (type) => {
    console.log(`getNotificationIcon called with type: ${type}`);

    switch (type) {
        case 'success':
            console.log("Returning: fas fa-check-circle");
            return 'fas fa-check-circle';
        case 'warning':
            console.log("Returning: fas fa-exclamation-triangle");
            return 'fas fa-exclamation-triangle';
        case 'error':
            console.log("Returning: fas fa-times-circle");
            return 'fas fa-times-circle';
        case 'info':
            console.log("Returning: fas fa-info-circle");
            return 'fas fa-info-circle';
        case 'record':
            console.log("Returning: fas fa-trophy");
            return 'fas fa-trophy';
        case 'update':
            console.log("Returning: fas fa-sync-alt");
            return 'fas fa-sync-alt';
        default:
            console.log("Returning default: fas fa-bell");
            return 'fas fa-bell';
    }
};

// Hàm helper: lấy màu icon
const getNotificationIconColor = (type) => {
    switch (type) {
        case 'success': return 'text-green-400';
        case 'warning': return 'text-yellow-400';
        case 'error': return 'text-red-400';
        case 'record': return 'text-amber-400';
        case 'update': return 'text-cyan-400';
        default: return 'text-blue-400';
    }
};

// Thêm hiệu ứng cho icon chuông khi có thông báo mới
const animateNotificationBell = () => {
    const bell = document.getElementById('notification-bell');
    if (!bell) return;

    bell.classList.add('animate__animated', 'animate__shakeX');
    setTimeout(() => {
        bell.classList.remove('animate__animated', 'animate__shakeX');
    }, 1000);
};

// ================ HÀM XỬ LÝ MODAL THÔNG BÁO ================

// Biến lưu thông báo đang được xem
let currentNotification = null;

// Mở modal thông báo
const openNotificationModal = (notification) => {
    currentNotification = notification;

    const modal = document.getElementById('notification-modal');
    const modalIcon = document.getElementById('modal-notification-icon');
    const modalIconClass = document.getElementById('modal-icon');
    const modalTitle = document.getElementById('modal-notification-title');
    const modalMessage = document.getElementById('modal-notification-message');
    const modalTime = document.getElementById('modal-notification-time');
    const modalSender = document.getElementById('modal-sender');
    const modalExtra = document.getElementById('modal-notification-extra');
    const modalExtraContent = document.getElementById('modal-extra-content');
    const markReadBtn = document.getElementById('modal-mark-read-btn');

    if (!modal) return;

    // Xóa tất cả class modal type cũ
    modal.classList.remove('modal-success', 'modal-warning', 'modal-error', 'modal-record', 'modal-info');
    modalIcon.classList.remove('modal-icon-success', 'modal-icon-warning', 'modal-icon-error', 'modal-icon-record', 'modal-icon-info');

    // Đặt icon và màu sắc theo loại thông báo
    const icon = getNotificationIcon(notification.type);
    const iconClass = getNotificationIconColor(notification.type);

    modalIconClass.className = icon;

    // Thêm class màu sắc cho modal và icon
    switch (notification.type) {
        case 'success':
            modal.classList.add('modal-success');
            modalIcon.classList.add('modal-icon-success');
            break;
        case 'warning':
            modal.classList.add('modal-warning');
            modalIcon.classList.add('modal-icon-warning');
            break;
        case 'error':
            modal.classList.add('modal-error');
            modalIcon.classList.add('modal-icon-error');
            break;
        case 'record':
            modal.classList.add('modal-record');
            modalIcon.classList.add('modal-icon-record');
            break;
        default:
            modal.classList.add('modal-info');
            modalIcon.classList.add('modal-icon-info');
    }

    // Cập nhật nội dung
    modalTitle.textContent = notification.title;
    modalMessage.innerHTML = formatNotificationMessage(notification.message);
    modalTime.textContent = getTimeAgo(notification.createdAt);
    modalSender.textContent = notification.sentBy === 'system' ? 'Hệ thống' : notification.sentBy || 'Hệ thống';

    // Hiển thị nút "Đánh dấu đã đọc" nếu thông báo chưa đọc
    if (markReadBtn) {
        if (!notification.read) {
            markReadBtn.classList.remove('hidden');
            markReadBtn.disabled = false;
        } else {
            markReadBtn.classList.add('hidden');
            markReadBtn.disabled = true;
        }
    }

    // Xử lý thông tin bổ sung (nếu có)
    if (notification.extraData) {
        modalExtra.classList.remove('hidden');

        let extraHtml = '';
        if (notification.extraData.mapName) {
            extraHtml += `<div><i class="fas fa-map mr-2"></i> Map: ${notification.extraData.mapName}</div>`;
        }
        if (notification.extraData.time) {
            extraHtml += `<div><i class="fas fa-stopwatch mr-2"></i> Thời gian: ${notification.extraData.time}</div>`;
        }
        if (notification.extraData.racer) {
            extraHtml += `<div><i class="fas fa-user mr-2"></i> Tay đua: ${notification.extraData.racer}</div>`;
        }
        if (notification.extraData.car) {
            extraHtml += `<div><i class="fas fa-car mr-2"></i> Xe: ${notification.extraData.car}</div>`;
        }
        if (notification.extraData.pet) {
            extraHtml += `<div><i class="fas fa-paw mr-2"></i> Pet: ${notification.extraData.pet}</div>`;
        }

        modalExtraContent.innerHTML = extraHtml;
    } else {
        modalExtra.classList.add('hidden');
    }

    // Hiển thị modal
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Ngăn scroll body

    // Thêm hiệu ứng animation
    modal.classList.add('animate__animated', 'animate__fadeIn');

    // Tự động đánh dấu đã đọc sau 3 giây nếu chưa đọc
    if (!notification.read) {
        setTimeout(() => {
            markCurrentNotificationAsRead();
        }, 3000);
    }
};

// Đóng modal thông báo
window.closeNotificationModal = () => {
    const modal = document.getElementById('notification-modal');
    if (modal) {
        // Thêm hiệu ứng fade out
        modal.classList.add('animate__fadeOut');

        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('animate__fadeIn', 'animate__fadeOut');
            document.body.style.overflow = '';

            // QUAN TRỌNG: KHÔNG đánh dấu đã đọc khi người xem đóng modal
            // KHÔNG gọi markNotificationAsRead ở đây
            currentNotification = null;
        }, 300); // Thời gian cho hiệu ứng fade out
    }
};

// Sự kiện click overlay để đóng modal
document.addEventListener('click', function (e) {
    const modal = document.getElementById('notification-modal');
    if (modal && !modal.classList.contains('hidden')) {
        // Kiểm tra nếu click vào overlay (background mờ)
        if (e.target.classList.contains('bg-black/70')) {
            closeNotificationModal();
        }
    }
});

// Sự kiện phím ESC để đóng modal
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('notification-modal');
        if (modal && !modal.classList.contains('hidden')) {
            closeNotificationModal();
        }
    }
});

// Đánh dấu thông báo hiện tại đã đọc
window.markCurrentNotificationAsRead = async () => {
    // KIỂM TRA: Chỉ admin mới có quyền
    if (!isAdminUser) {
        showStatusMessage("Chỉ Admin mới có quyền đánh dấu thông báo đã đọc", true);
        return;
    }

    if (!currentNotification || currentNotification.read) return;

    try {
        await markNotificationAsRead(currentNotification.id);

        // Cập nhật UI
        const markReadBtn = document.getElementById('modal-mark-read-btn');
        if (markReadBtn) {
            markReadBtn.innerHTML = '<i class="fas fa-check mr-2"></i> Đã đọc';
            markReadBtn.disabled = true;
            markReadBtn.classList.add('bg-gradient-to-r', 'from-slate-600', 'to-slate-700');
        }

        // Cập nhật trong danh sách
        currentNotification.read = true;
        updateNotificationUI();

        // Hiệu ứng xác nhận
        showStatusMessage("Đã đánh dấu thông báo là đã đọc", false);
    } catch (error) {
        console.error("Lỗi khi đánh dấu thông báo đã đọc:", error);
    }
};

// Format nội dung thông báo (hỗ trợ xuống dòng và HTML đơn giản)
const formatNotificationMessage = (message) => {
    if (!message) return '';

    // Thay thế xuống dòng thành <br>
    let formatted = message.replace(/\n/g, '<br>');

    // Highlight các từ khóa quan trọng
    const highlightWords = ['kỷ lục', 'record', 'mới', 'tốt nhất', 'chiến thắng', 'quan trọng', 'cảnh báo'];

    highlightWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        formatted = formatted.replace(regex, `<span class="text-cyan-300 font-bold">$&</span>`);
    });

    // Highlight thời gian (định dạng mm'ss'ms)
    const timeRegex = /(\d{2}'\d{2}'\d{2})/g;
    formatted = formatted.replace(timeRegex, `<span class="text-green-400 font-mono font-bold">$1</span>`);

    // Highlight tên map
    if (ALL_MAPS) {
        ALL_MAPS.forEach(map => {
            if (map.name && formatted.includes(map.name)) {
                formatted = formatted.replace(
                    new RegExp(map.name, 'g'),
                    `<span class="text-amber-300 font-semibold">${map.name}</span>`
                );
            }
        });
    }

    return formatted;
};


// Hàm xử lý khi click vào thông báo trong danh sách
window.handleNotificationClick = async (notificationId, event) => {
    try {
        console.log("=== Xử lý click thông báo ===");

        if (event) {
            event.stopPropagation();
            event.preventDefault();
        }

        // Tìm thông báo
        const notification = notifications.find(n => n.id === notificationId);
        if (!notification) {
            console.error("Không tìm thấy notification với ID:", notificationId);
            return;
        }

        // Đánh dấu đã đọc khi click (áp dụng cho tất cả user đã đăng nhập)
        if (!notification.read) {
            console.log("📝 Đánh dấu thông báo đã đọc...");
            await window.markNotificationAsRead(notificationId);
        }

        // Đóng dropdown thông báo
        const dropdown = document.getElementById('notification-dropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
            console.log("✅ Đã đóng dropdown");
        }

        // Hiển thị modal chi tiết - NGƯỜI XEM VẪN CÓ THỂ XEM
        showNotificationDetailModal(notification);

    } catch (error) {
        console.error("❌ Lỗi trong handleNotificationClick:", error);
    }
};


// Hàm hiển thị modal chi tiết thông báo
const showNotificationDetailModal = (notification) => {
    console.log("=== Hiển thị modal chi tiết thông báo ===");
    console.log("Notification object:", notification);

    const modal = document.getElementById('notification-modal');
    console.log("Modal element exists:", !!modal);

    if (!modal) {
        console.error("❌ ERROR: Không tìm thấy modal!");
        return;
    }

    // Đảm bảo modal được hiển thị
    modal.classList.remove('hidden');

    // Lấy các phần tử
    const titleElement = document.getElementById('modal-notification-title');
    const messageElement = document.getElementById('modal-notification-message');
    const timeElement = document.getElementById('modal-notification-time');
    const senderElement = document.getElementById('modal-sender');
    const iconElement = document.getElementById('modal-icon');
    const extraContentElement = document.getElementById('modal-extra-content');
    const modalExtra = document.getElementById('modal-notification-extra');
    const modalFooter = modal.querySelector('.border-t.border-slate-800');

    // Cập nhật nội dung chính
    if (titleElement) {
        titleElement.textContent = notification.title || "Thông báo không có tiêu đề";
    }

    if (messageElement) {
        // Sử dụng content hoặc message
        let messageHtml = notification.content || notification.message || "Không có nội dung";
        // Thay thế xuống dòng bằng <br>
        messageHtml = messageHtml.replace(/\n/g, '<br>');
        messageElement.innerHTML = messageHtml;
    }

    if (timeElement) {
        timeElement.textContent = getTimeAgo(notification.timestamp) || "Vừa xong";
    }

    if (senderElement) {
        senderElement.textContent = notification.sender || "Hệ thống";
    }

    if (iconElement) {
        const iconClass = getNotificationIcon(notification.type);
        iconElement.className = iconClass;
    }

    // Cập nhật icon container màu sắc
    const iconContainer = document.getElementById('modal-notification-icon');
    if (iconContainer) {
        // Reset classes
        iconContainer.className = 'w-10 h-10 rounded-full flex items-center justify-center mr-4';

        // Thêm màu theo loại thông báo
        switch (notification.type) {
            case 'success':
                iconContainer.classList.add('bg-gradient-to-br', 'from-green-500', 'to-emerald-600');
                break;
            case 'warning':
                iconContainer.classList.add('bg-gradient-to-br', 'from-yellow-500', 'to-amber-600');
                break;
            case 'error':
                iconContainer.classList.add('bg-gradient-to-br', 'from-red-500', 'to-rose-600');
                break;
            case 'record':
                iconContainer.classList.add('bg-gradient-to-br', 'from-amber-500', 'to-orange-600');
                break;
            default:
                iconContainer.classList.add('bg-gradient-to-br', 'from-cyan-500', 'to-blue-600');
        }
    }

    // HIỂN THỊ THÔNG TIN CHI TIẾT (EXTRA DATA)
    if (extraContentElement && modalExtra) {
        let extraHtml = '';

        // Thêm các trường thông tin chi tiết
        if (notification.target && notification.target !== "all") {
            extraHtml += `
                <div class="flex items-start mb-2">
                    <i class="fas fa-bullseye text-cyan-400 mr-2 mt-0.5 w-4"></i>
                    <div>
                        <span class="text-slate-300 font-medium">Đối tượng:</span>
                        <span class="text-slate-400 ml-2">${notification.target}</span>
                    </div>
                </div>
            `;
        }

        if (notification.type) {
            extraHtml += `
                <div class="flex items-start mb-2">
                    <i class="fas ${getNotificationIcon(notification.type)} ${getNotificationIconColor(notification.type)} mr-2 mt-0.5 w-4"></i>
                    <div>
                        <span class="text-slate-300 font-medium">Loại thông báo:</span>
                        <span class="text-slate-400 ml-2">${getNotificationTypeText(notification.type)}</span>
                    </div>
                </div>
            `;
        }

        if (notification.important) {
            extraHtml += `
                <div class="flex items-start mb-2">
                    <i class="fas fa-exclamation-circle text-red-400 mr-2 mt-0.5 w-4"></i>
                    <div>
                        <span class="text-red-300 font-medium">Quan trọng:</span>
                        <span class="text-red-400 ml-2">Có</span>
                    </div>
                </div>
            `;
        }

        // Thêm trạng thái đã đọc/chưa đọc
        extraHtml += `
            <div class="flex items-start mb-2">
                <i class="fas ${notification.read ? 'fa-eye' : 'fa-eye-slash'} ${notification.read ? 'text-green-400' : 'text-yellow-400'} mr-2 mt-0.5 w-4"></i>
                <div>
                    <span class="text-slate-300 font-medium">Trạng thái:</span>
                    <span class="${notification.read ? 'text-green-400' : 'text-yellow-400'} ml-2 font-medium">
                        ${notification.read ? 'Đã đọc' : 'Chưa đọc'}
                    </span>
                </div>
            </div>
        `;

        // Thêm thời gian chi tiết
        if (notification.timestamp) {
            const date = new Date(notification.timestamp);
            const formattedDate = date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });

            extraHtml += `
                <div class="flex items-start">
                    <i class="fas fa-clock text-slate-400 mr-2 mt-0.5 w-4"></i>
                    <div>
                        <span class="text-slate-300 font-medium">Thời gian gửi:</span>
                        <span class="text-slate-400 ml-2 text-xs">${formattedDate}</span>
                    </div>
                </div>
            `;
        }

        if (extraHtml) {
            extraContentElement.innerHTML = extraHtml;
            modalExtra.classList.remove('hidden');
        } else {
            modalExtra.classList.add('hidden');
        }
    }

    // Bỏ qua việc thêm viewer-note cho người xem vì User giờ có quyền đánh dấu đã đọc thông báo của chính mình


    // HIỂN THỊ NÚT "ĐÁNH DẤU ĐÃ ĐỌC" (áp dụng cho tất cả user nếu thông báo chưa đọc)
    const markReadBtn = modal.querySelector('button[onclick*="markCurrentNotificationAsRead"]');
    if (markReadBtn) {
        if (!isAdminUser && false) { // Đã gỡ bỏ điều kiện này
            // Ẩn nút cho người xem
            markReadBtn.style.display = 'none';
        } else {
            // Hiển thị nút cho admin
            markReadBtn.style.display = 'flex';

            // Cập nhật trạng thái nút
            if (notification.read) {
                markReadBtn.innerHTML = '<i class="fas fa-check mr-2"></i> Đã đọc';
                markReadBtn.disabled = true;
                markReadBtn.classList.add('bg-gradient-to-r', 'from-slate-600', 'to-slate-700');
            } else {
                markReadBtn.innerHTML = '<i class="fas fa-check-double mr-2"></i> Đánh dấu đã đọc';
                markReadBtn.disabled = false;
                markReadBtn.classList.remove('bg-gradient-to-r', 'from-slate-600', 'to-slate-700');
            }
        }
    }

    // Thêm animation
    modal.classList.add('animate__animated', 'animate__fadeIn');

    // Ngăn scroll body
    document.body.style.overflow = 'hidden';

    console.log("✅ Modal đã được hiển thị thành công!");
};

// Hàm helper: chuyển đổi type thông báo sang text
const getNotificationTypeText = (type) => {
    switch (type) {
        case 'success':
            return "Thành công";
        case 'warning':
            return "Cảnh báo";
        case 'error':
            return "Lỗi";
        case 'record':
            return "Kỷ lục";
        case 'info':
            return "Thông tin";
        case 'update':
            return "Cập nhật";
        default:
            return "Thông báo";
    }
};

window.markNotificationAsRead = async (notificationId) => {
    try {
        console.log("🔄 Đánh dấu thông báo đã đọc:", notificationId);

        // 1. Cập nhật trên Firestore
        await setDoc(doc(db, "notifications", notificationId), {
            read: true,
            readAt: new Date().toISOString()  // Thêm timestamp đọc
        }, { merge: true });

        // 2. TÌM VÀ CẬP NHẬT TRONG LOCAL STATE
        let found = false;
        notifications = notifications.map(n => {
            if (n.id === notificationId) {
                found = true;
                return { ...n, read: true };
            }
            return n;
        });

        if (!found) {
            console.warn("⚠️ Không tìm thấy notification trong local state:", notificationId);
        } else {
            console.log("✅ Đã cập nhật local state");
        }

        // 3. CẬP NHẬT BADGE NGAY LẬP TỨC
        updateNotificationBadge();

        // 4. CẬP NHẬT UI CỦA ITEM ĐÓ
        updateNotificationItemUI(notificationId);

        // 5. Debug
        console.log("📊 Trạng thái sau khi đánh dấu đã đọc:");
        console.log("- Tổng thông báo:", notifications.length);
        console.log("- Chưa đọc:", notifications.filter(n => !n.read).length);

        return true;
    } catch (error) {
        console.error("❌ Lỗi khi đánh dấu thông báo đã đọc:", error);
        return false;
    }
};

// Hàm cập nhật badge - ĐẢM BẢO ĐÃ CÓ
const updateNotificationBadge = () => {
    const notificationCount = document.getElementById('notification-count');
    const notificationBell = document.getElementById('notification-bell');

    if (!notificationCount && !notificationBell) {
        return;
    }

    // Tính số thông báo chưa đọc
    const unreadCountForBadge = notifications.filter(n => !n.read).length;

    console.log(`🔄 Cập nhật badge: ${unreadCountForBadge} thông báo chưa đọc`);

    // CHỈ HIỂN THỊ BADGE CHO ADMIN
    if (typeof isAdminUser !== 'undefined' && isAdminUser && unreadCountForBadge > 0) {
        if (notificationCount) {
            notificationCount.textContent = unreadCountForBadge > 9 ? '9+' : unreadCountForBadge;
            notificationCount.classList.remove('hidden');
        }
        if (notificationBell) {
            notificationBell.classList.add('has-unread');

            // Kiểm tra có thông báo quan trọng không
            const hasImportantUnread = notifications.some(n => !n.read && n.important);
            if (hasImportantUnread) {
                notificationBell.classList.add('important-alert');
            } else {
                notificationBell.classList.remove('important-alert');
            }
        }
    } else {
        // NGƯỜI XEM: không hiển thị badge số lượng
        if (notificationCount) notificationCount.classList.add('hidden');
        if (notificationBell) {
            notificationBell.classList.remove('has-unread', 'important-alert');

            // Nhưng vẫn có thể thấy chuông có thông báo mới (không đếm số)
            const hasUnread = notifications.some(n => !n.read);
            if (hasUnread) {
                notificationBell.classList.add('has-unread');
            } else {
                notificationBell.classList.remove('has-unread');
            }
        }
    }
};

// Hàm cập nhật UI của item
const updateNotificationItemUI = (notificationId) => {
    const notificationItem = document.querySelector(`.notification-item[data-id="${notificationId}"]`);
    if (notificationItem) {
        // Xóa class unread, thêm class read
        notificationItem.classList.remove('unread');
        notificationItem.classList.add('read');

        // Xóa indicator chưa đọc
        const unreadIndicator = notificationItem.querySelector('.w-2.h-2.bg-cyan-400');
        if (unreadIndicator) {
            unreadIndicator.remove();
        }

        // Thêm hiệu ứng visual
        notificationItem.style.opacity = '0.7';
        notificationItem.style.transition = 'opacity 0.3s';

        console.log(`✅ Đã cập nhật UI cho notification: ${notificationId}`);
    } else {
        console.warn(`⚠️ Không tìm thấy notification item với ID: ${notificationId}`);
    }
};

// Cập nhật hàm gửi thông báo với Extra Data
const sendNotificationWithExtraData = async (notificationData) => {
    try {
        const notificationId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const notificationToSave = {
            title: notificationData.title || "Thông báo",
            content: notificationData.message || notificationData.content || "",
            type: notificationData.type || "info",
            target: notificationData.target || "all",
            important: notificationData.important || false,
            sender: userId ? "Admin" : "Hệ thống",
            senderId: userId || "system",
            read: false,
            timestamp: new Date().toISOString(),
            createdAt: new Date().toISOString()
        };

        // Thêm dữ liệu bổ sung nếu có
        if (notificationData.extraData) {
            // Lưu extraData vào content hoặc một trường riêng
            notificationToSave.content += `\n\n--- THÔNG TIN CHI TIẾT ---\n`;
            Object.keys(notificationData.extraData).forEach(key => {
                notificationToSave.content += `${key}: ${notificationData.extraData[key]}\n`;
            });
        }

        await setDoc(doc(db, "notifications", notificationId), notificationToSave);

        console.log("Đã gửi thông báo:", notificationToSave);
        return true;
    } catch (error) {
        console.error("Lỗi khi gửi thông báo:", error);
        return false;
    }
};

// Cập nhật hàm gửi thông báo khi có record mới
const sendRecordNotification = async (mapName, recordData) => {
    // KIỂM TRA LẠI XE VÀ PET TRƯỚC KHI GỬI THÔNG BÁO
    if (!recordData.car || !recordData.pet || recordData.car.trim() === '' || recordData.pet.trim() === '') {
        console.error(`❌ Không thể gửi thông báo: Thiếu thông tin xe hoặc pet`);
        return false;
    }

    const notificationData = {
        title: "🎉 Kỷ lục mới được thiết lập!",
        message: `${recordData.racerName} vừa lập kỷ lục mới trên map "${mapName}" với thời gian ${recordData.timeString}!`,
        type: "record",
        extraData: {
            mapName: mapName,
            time: recordData.timeString,
            racer: recordData.racerName,
            car: recordData.car,
            pet: recordData.pet
        }
    };

    return await sendNotificationWithExtraData(notificationData);
};

// ================ COMBO SUGGESTION MODAL ================
window.showComboModal = (mapIndex, racerIndex, mapName) => {
    const combos = (window.MAP_COMBOS || {})[mapName.trim()] || [];
    const racerName = raceState.racers[racerIndex]?.name || `Tay đua ${racerIndex + 1}`;

    let combosHtml = '';
    if (combos.length === 0) {
        combosHtml = `
            <div class="text-center py-12 px-6">
                <div class="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-magic-slash text-2xl text-slate-600"></i>
                </div>
                <h4 class="text-white font-bold mb-2">Chưa có dữ liệu gợi ý</h4>
                <p class="text-slate-500 text-sm">Hệ thống chưa ghi nhận các combo phổ biến cho bản đồ "${mapName}" này.</p>
            </div>
        `;
    } else {
        combosHtml = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${combos.map((combo, idx) => {
            const carInfo = (window.ALL_CARS || []).find(c => c.name === combo.car);
            const petInfo = (window.ALL_PETS || []).find(p => p.name === combo.pet);

            const carHtml = carInfo && carInfo.imageUrl ?
                `<div class="w-10 h-8 rounded-lg overflow-hidden border border-white/10 bg-slate-900 flex-shrink-0 mr-3">
                            <img src="${carInfo.imageUrl}" class="w-full h-full object-contain" onerror="this.parentElement.innerHTML='<i class=\'fas fa-car text-cyan-400 text-[10px]\'></i>'">
                        </div>` :
                `<div class="w-10 h-8 rounded-lg border border-white/10 bg-slate-900 flex items-center justify-center flex-shrink-0 mr-3">
                            <i class="fas fa-car text-cyan-400 text-xs"></i>
                        </div>`;

            const petHtml = petInfo && petInfo.imageUrl ?
                `<div class="w-10 h-8 rounded-lg overflow-hidden border border-white/10 bg-slate-900 flex-shrink-0 mr-3">
                            <img src="${petInfo.imageUrl}" class="w-full h-full object-contain" onerror="this.parentElement.innerHTML='<i class=\'fas fa-paw text-pink-400 text-[10px]\'></i>'">
                        </div>` :
                `<div class="w-10 h-8 rounded-lg border border-white/10 bg-slate-900 flex items-center justify-center flex-shrink-0 mr-3">
                            <i class="fas fa-paw text-pink-400 text-xs"></i>
                        </div>`;

            return `
                    <button onclick="applyCombo(${mapIndex}, ${racerIndex}, '${combo.car.replace(/'/g, "\\'")}', '${combo.pet.replace(/'/g, "\\'")}')"
                        class="group p-4 bg-slate-800/40 hover:bg-cyan-500/10 border border-slate-700 hover:border-cyan-500/50 rounded-2xl transition-all duration-300 text-left animate__animated animate__fadeInUp"
                        style="animation-delay: ${idx * 0.1}s">
                        <div class="flex items-center justify-between mb-4">
                            <span class="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Combo Phổ Biến #${idx + 1}</span>
                            <div class="w-7 h-7 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white group-hover:border-cyan-400 transition-all">
                                <i class="fas fa-bolt text-[10px]"></i>
                            </div>
                        </div>
                        <div class="space-y-3">
                            <div class="flex items-center">
                                ${carHtml}
                                <span class="text-white font-bold text-sm tracking-tight truncate">${combo.car}</span>
                            </div>
                            <div class="flex items-center">
                                ${petHtml}
                                <span class="text-slate-300 text-[13px] tracking-tight truncate">${combo.pet}</span>
                            </div>
                        </div>
                    </button>
                `}).join('')}
            </div>
        `;
    }

    const modalHtml = `
        <div id="combo-suggestion-modal" class="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate__animated animate__fadeIn"></div>
            <div class="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate__animated animate__zoomIn animate__faster">
                <!-- Header -->
                <div class="p-6 border-b border-white/5 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center justify-between">
                    <div class="flex items-center">
                        <div class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mr-4 shadow-inner">
                            <i class="fas fa-magic text-xl"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-white uppercase tracking-tight">Gợi ý Combo</h3>
                            <p class="text-xs text-slate-400 mt-0.5">Dành cho <span class="text-cyan-400 font-bold">${racerName}</span> tại <span class="text-white font-bold">${mapName}</span></p>
                        </div>
                    </div>
                    <button onclick="closeComboModal()" class="w-10 h-10 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors flex items-center justify-center">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <!-- Body -->
                <div class="p-8">
                    ${combosHtml}
                </div>
                
                <!-- Footer -->
                <div class="p-6 bg-slate-950/30 border-t border-white/5 flex justify-center">
                    <p class="text-[10px] text-slate-500 italic flex items-center gap-2">
                        <i class="fas fa-info-circle"></i>
                        Dữ liệu được tổng hợp từ lịch sử các trận đấu record gần đây.
                    </p>
                </div>
            </div>
        </div>
    `;

    const modalContainer = document.createElement('div');
    modalContainer.id = 'combo-modal-wrapper';
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    document.body.style.overflow = 'hidden';
};

window.closeComboModal = () => {
    const modal = document.getElementById('combo-modal-wrapper');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
};

window.applyCombo = (mapIndex, racerIndex, car, pet) => {
    const carInput = document.getElementById(`car-${mapIndex}-${racerIndex}`);
    const petInput = document.getElementById(`pet-${mapIndex}-${racerIndex}`);
    if (carInput) {
        carInput.value = car;
        carInput.dispatchEvent(new Event('change'));
    }
    if (petInput) {
        petInput.value = pet;
        petInput.dispatchEvent(new Event('change'));
    }

    closeComboModal();
    displayMessage(`Đã áp dụng combo cho Tay đua ${racerIndex + 1}`, false);
};

// Đóng menu khi click ra ngoài
document.addEventListener('click', (e) => {
    if (!e.target.closest('[id^="combo-menu-"]') && !e.target.closest('button[onclick^="toggleComboMenu"]')) {
        document.querySelectorAll('[id^="combo-menu-"]').forEach(m => m.classList.add('hidden'));
    }
});

// ================ HEADER SEARCH LOGIC ================
const initHeaderSearch = () => {
    // Lấy danh sách tay đua duy nhất
    const getRacersList = () => {
        const namesSet = new Set();
        
        // Tạo map hỗ trợ chuyển đổi từ displayName sang nickname (nếu có nickname)
        const nameToNickname = new Map();
        if (Array.isArray(ALL_USERS)) {
            ALL_USERS.forEach(u => {
                if (u.nickname && u.nickname.trim() && u.displayName && u.displayName.trim()) {
                    nameToNickname.set(u.displayName.trim().toLowerCase(), u.nickname.trim());
                }
            });
        }

        const resolveRacerName = (name) => {
            if (!name) return '';
            const trimmed = name.trim();
            const lower = trimmed.toLowerCase();
            return nameToNickname.get(lower) || trimmed;
        };

        // 1. Từ danh sách người dùng đã nạp (Ưu tiên nickname, nếu không có mới dùng displayName)
        if (Array.isArray(ALL_USERS)) {
            ALL_USERS.forEach(u => {
                const nickname = u.nickname && u.nickname.trim();
                const displayName = u.displayName && u.displayName.trim();
                if (nickname) {
                    namesSet.add(nickname);
                } else if (displayName) {
                    namesSet.add(displayName);
                }
            });
        }

        // 2. Từ các tay đua hiện tại trong raceState
        if (raceState && Array.isArray(raceState.racers)) {
            raceState.racers.forEach(r => {
                if (r.name && r.name.trim()) {
                    namesSet.add(resolveRacerName(r.name));
                }
            });
        }

        // 3. Từ lịch sử đấu
        const allRecords = window.ALL_RACE_RECORDS || [];
        allRecords.forEach(rec => {
            if (rec.racerName && rec.racerName.trim()) {
                namesSet.add(resolveRacerName(rec.racerName));
            }
        });

        return Array.from(namesSet).sort((a, b) => a.localeCompare(b));
    };

    const setupSearchBox = (searchInput, searchSuggestions, searchClear, searchContainer) => {
        if (!searchInput || !searchSuggestions) return;

        let activeIndex = -1;
        let filteredRacers = [];

        // Render danh sách gợi ý
        const renderSuggestions = (query) => {
            const racers = getRacersList();
            const cleanQuery = query.trim().toLowerCase();

            if (!cleanQuery) {
                searchSuggestions.innerHTML = '';
                searchSuggestions.classList.add('hidden');
                if (searchClear) searchClear.classList.add('hidden');
                activeIndex = -1;
                return;
            }

            if (searchClear) searchClear.classList.remove('hidden');

            filteredRacers = racers.filter(name => name.toLowerCase().includes(cleanQuery));

            // --- Map search ---
            const allMaps = window.ALL_MAPS || [];
            const filteredMaps = allMaps.filter(m => m.name && m.name.toLowerCase().includes(cleanQuery));

            const totalResults = filteredRacers.length + filteredMaps.length;

            if (totalResults === 0) {
                searchSuggestions.innerHTML = `
                    <div class="p-4 text-center text-xs text-slate-500">
                        <i class="fas fa-search mr-2"></i>Không tìm thấy kết quả nào
                    </div>
                `;
                searchSuggestions.classList.remove('hidden');
                activeIndex = -1;
                return;
            }

            let html = '';

            // --- RACER GROUP ---
            if (filteredRacers.length > 0) {
                html += `<div class="px-3 pt-2.5 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><i class="fas fa-user text-cyan-500/70"></i> Tay đua</div>`;
                html += filteredRacers.slice(0, 5).map((racerName, index) => {
                    const userInfo = ALL_USERS.find(u =>
                        (u.nickname && u.nickname.trim().toLowerCase() === racerName.toLowerCase()) ||
                        (u.displayName && u.displayName.trim().toLowerCase() === racerName.toLowerCase())
                    );
                    const avatarSrc = (userInfo && userInfo.photoBase64) ? userInfo.photoBase64 :
                        (userInfo && userInfo.photoURL && userInfo.photoURL !== 'logoWS.png') ? userInfo.photoURL : 'assets/images/logows.png';
                    return `
                        <div class="search-suggestion-item search-racer-item flex items-center gap-3 p-2.5 hover:bg-cyan-500/10 cursor-pointer transition-all duration-200"
                             data-index="racer-${index}" data-name="${racerName.replace(/"/g, '&quot;')}" data-type="racer">
                            <img src="${avatarSrc}" class="w-7 h-7 rounded-lg object-cover border border-slate-800 flex-shrink-0" alt="avatar" 
                                 onerror="this.src='assets/images/logows.png'">
                            <div class="min-w-0 flex-1">
                                <div class="text-xs font-black text-white truncate uppercase tracking-wide">${racerName}</div>
                            </div>
                            <i class="fas fa-chevron-right text-[10px] text-slate-600"></i>
                        </div>
                    `;
                }).join('');
            }

            // --- MAP GROUP ---
            if (filteredMaps.length > 0) {
                const difficultyColors = {
                    'Dễ': 'text-green-400 border-green-500/40 bg-green-500/10',
                    '3 sao': 'text-green-400 border-green-500/40 bg-green-500/10',
                    'Trung bình': 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
                    '4 sao': 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
                    'Khó': 'text-orange-400 border-orange-500/40 bg-orange-500/10',
                    '5 sao': 'text-orange-400 border-orange-500/40 bg-orange-500/10',
                    'Rất khó': 'text-red-400 border-red-500/40 bg-red-500/10',
                    '6 sao': 'text-red-400 border-red-500/40 bg-red-500/10',
                    'Cực khó': 'text-purple-400 border-purple-500/40 bg-purple-500/10',
                    '7 sao': 'text-purple-400 border-purple-500/40 bg-purple-500/10'
                };
                html += `<div class="px-3 pt-2.5 pb-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 ${filteredRacers.length > 0 ? 'border-t border-slate-800 mt-1' : ''}"><i class="fas fa-map text-emerald-500/70"></i> Bản đồ</div>`;
                html += filteredMaps.slice(0, 5).map((map, index) => {
                    const diffClass = difficultyColors[map.difficulty] || 'text-slate-400 border-slate-600 bg-slate-700/30';
                    const mapThumb = map.imageUrl || '';
                    return `
                        <div class="search-suggestion-item search-map-item flex items-center gap-3 p-2.5 hover:bg-emerald-500/10 cursor-pointer transition-all duration-200"
                             data-index="map-${index}" data-mapname="${map.name.replace(/"/g, '&quot;')}" data-type="map">
                            <div class="w-12 h-7 rounded-md overflow-hidden border border-slate-700 flex-shrink-0 bg-slate-800">
                                ${mapThumb ? `<img src="${mapThumb}" class="w-full h-full object-cover" onerror="this.style.display='none'">` : `<div class="w-full h-full flex items-center justify-center"><i class="fas fa-map text-slate-600 text-xs"></i></div>`}
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="text-xs font-bold text-white truncate">${map.name}</div>
                                 ${(() => {
                                    if (!map.difficulty) return '';
                                    let starsHTML = '';
                                    let starCount = 3;
                                    const diff = map.difficulty.toLowerCase();
                                    if (diff.includes('3 sao') || diff.includes('dễ') || diff.includes('easy')) starCount = 3;
                                    else if (diff.includes('4 sao') || diff.includes('trung bình') || diff.includes('medium')) starCount = 4;
                                    else if (diff.includes('5 sao') || diff.includes('khó') || diff.includes('hard')) starCount = 5;
                                    else if (diff.includes('6 sao') || diff.includes('rất khó') || diff.includes('expert')) starCount = 6;
                                    else if (diff.includes('7 sao') || diff.includes('cực khó') || diff.includes('extreme')) starCount = 7;
                                    else starCount = 0;
                                    
                                    if (starCount > 0) {
                                        for (let i = 0; i < starCount; i++) {
                                            starsHTML += `<i class="fas fa-star text-yellow-400 text-[8px] mr-0.5"></i>`;
                                        }
                                        return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded border ${diffClass} inline-flex items-center gap-0.5">${starsHTML}</span>`;
                                    }
                                    return `<span class="text-[10px] font-semibold px-1.5 py-0 rounded border ${diffClass}">${map.difficulty}</span>`;
                                })()}
                            </div>
                            <i class="fas fa-chevron-right text-[10px] text-slate-600"></i>
                        </div>
                    `;
                }).join('');
            }

            searchSuggestions.innerHTML = html;
            searchSuggestions.classList.remove('hidden');
            activeIndex = -1;

            // Click events
            searchSuggestions.querySelectorAll('.search-racer-item').forEach(item => {
                item.addEventListener('click', () => {
                    const name = item.getAttribute('data-name');
                    selectRacer(name);
                });
            });
            searchSuggestions.querySelectorAll('.search-map-item').forEach(item => {
                item.addEventListener('click', () => {
                    const mapName = item.getAttribute('data-mapname');
                    searchInput.value = '';
                    searchSuggestions.innerHTML = '';
                    searchSuggestions.classList.add('hidden');
                    if (searchClear) searchClear.classList.add('hidden');
                    window.openMapDetailModal(mapName);
                });
            });
        };

        // Chọn tay đua và mở modal
        const selectRacer = (name) => {
            if (typeof window.openRacerMatchesModal === 'function') {
                window.openRacerMatchesModal(name);
            } else {
                console.error("❌ Không tìm thấy hàm openRacerMatchesModal");
            }
            searchInput.value = '';
            searchSuggestions.innerHTML = '';
            searchSuggestions.classList.add('hidden');
            if (searchClear) searchClear.classList.add('hidden');
            activeIndex = -1;
            searchInput.blur();

            // Nếu là ô tìm kiếm mobile, ẩn container khi đã chọn xong
            const mobileSearchContainer = document.getElementById('mobile-search-container');
            if (mobileSearchContainer && searchInput.id === 'mobile-search-input') {
                mobileSearchContainer.classList.add('hidden');
            }
        };

        // Xử lý sự kiện nhập từ khóa
        searchInput.addEventListener('input', (e) => {
            renderSuggestions(e.target.value);
        });

        // Nhấn phím để điều hướng hoặc xác nhận
        searchInput.addEventListener('keydown', (e) => {
            const items = searchSuggestions.querySelectorAll('.search-suggestion-item');
            if (items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (activeIndex < items.length - 1) {
                    if (activeIndex >= 0) items[activeIndex].classList.remove('active');
                    activeIndex++;
                    items[activeIndex].classList.add('active');
                    items[activeIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (activeIndex > 0) {
                    items[activeIndex].classList.remove('active');
                    activeIndex--;
                    items[activeIndex].classList.add('active');
                    items[activeIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (activeIndex >= 0 && activeIndex < items.length) {
                    const name = items[activeIndex].getAttribute('data-name');
                    selectRacer(name);
                } else if (filteredRacers.length > 0) {
                    selectRacer(filteredRacers[0]);
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                searchSuggestions.classList.add('hidden');
                activeIndex = -1;
                searchInput.blur();
                
                // Nếu là ô tìm kiếm mobile, ẩn container khi nhấn Escape
                const mobileSearchContainer = document.getElementById('mobile-search-container');
                if (mobileSearchContainer && searchInput.id === 'mobile-search-input') {
                    mobileSearchContainer.classList.add('hidden');
                }
            }
        });

        // Nút clear input
        if (searchClear) {
            searchClear.addEventListener('click', () => {
                searchInput.value = '';
                renderSuggestions('');
                searchInput.focus();
            });
        }

        // Đóng dropdown khi click ra ngoài container
        document.addEventListener('click', (e) => {
            if (searchContainer && !searchContainer.contains(e.target)) {
                searchSuggestions.classList.add('hidden');
                activeIndex = -1;
            }
        });

        // Hiển thị lại suggestions khi focus vào input nếu đã có text
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim()) {
                renderSuggestions(searchInput.value);
            }
        });
    };

    // Khởi tạo cho Desktop Search
    const searchInput = document.getElementById('header-search-input');
    const searchSuggestions = document.getElementById('header-search-suggestions');
    const searchClear = document.getElementById('header-search-clear');
    const searchContainer = document.getElementById('header-search-container');
    setupSearchBox(searchInput, searchSuggestions, searchClear, searchContainer);

    // Khởi tạo cho Mobile Search
    const mobileSearchInput = document.getElementById('mobile-search-input');
    const mobileSearchSuggestions = document.getElementById('mobile-search-suggestions');
    const mobileSearchClear = document.getElementById('mobile-search-clear');
    const mobileSearchContainer = document.getElementById('mobile-search-container');
    setupSearchBox(mobileSearchInput, mobileSearchSuggestions, mobileSearchClear, mobileSearchContainer);

    // Tải nút mở/đóng search trên mobile
    const mobileSearchToggle = document.getElementById('mobile-search-toggle');
    const mobileSearchClose = document.getElementById('mobile-search-close');

    if (mobileSearchToggle && mobileSearchContainer && mobileSearchInput) {
        mobileSearchToggle.addEventListener('click', () => {
            mobileSearchContainer.classList.remove('hidden');
            mobileSearchInput.value = '';
            if (mobileSearchSuggestions) {
                mobileSearchSuggestions.innerHTML = '';
                mobileSearchSuggestions.classList.add('hidden');
            }
            if (mobileSearchClear) mobileSearchClear.classList.add('hidden');
            setTimeout(() => mobileSearchInput.focus(), 150);
        });
    }

    if (mobileSearchClose && mobileSearchContainer) {
        mobileSearchClose.addEventListener('click', () => {
            mobileSearchContainer.classList.add('hidden');
        });
    }
};

// Khởi chạy khi tài liệu HTML sẵn sàng
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderSearch);
} else {
    initHeaderSearch();
}

// ==================== MAP DETAIL MODAL ====================
window.openMapDetailModal = (mapName) => {
    const modal = document.getElementById('map-detail-modal');
    const box = document.getElementById('map-detail-box');
    if (!modal || !box) return;

    // Find map info
    const allMaps = window.ALL_MAPS || [];
    const mapInfo = allMaps.find(m => (m.name || '').trim().toLowerCase() === mapName.trim().toLowerCase());

    // Video URL setup
    const videoUrl = (mapInfo?.videoUrl || mapInfo?.bestRecordVideo || '').trim();
    window.currentMapVideoUrl = videoUrl;
    window.currentMapName = mapName;
    const videoBtn = document.getElementById('map-detail-video-btn');
    if (videoBtn) {
        if (videoUrl) {
            videoBtn.classList.remove('hidden');
            videoBtn.classList.add('flex');
        } else {
            videoBtn.classList.add('hidden');
            videoBtn.classList.remove('flex');
        }
    }

    // Header
    const nameEl = document.getElementById('map-detail-name');
    const imgEl = document.getElementById('map-detail-img');
    const diffEl = document.getElementById('map-detail-difficulty');

    if (nameEl) nameEl.textContent = mapName;
    if (imgEl) {
        imgEl.src = mapInfo?.imageUrl || '';
        imgEl.style.display = mapInfo?.imageUrl ? 'block' : 'none';
    }

    const difficultyStyles = {
        'Dễ': { text: '3 sao', cls: 'text-green-400 border-green-500/50 bg-green-500/10' },
        '3 sao': { text: '3 sao', cls: 'text-green-400 border-green-500/50 bg-green-500/10' },
        'Dễ (3 sao)': { text: 'Dễ (3 sao)', cls: 'text-green-400 border-green-500/50 bg-green-500/10' },
        'Trung bình': { text: '4 sao', cls: 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10' },
        '4 sao': { text: '4 sao', cls: 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10' },
        'Trung bình (4 sao)': { text: 'Trung bình (4 sao)', cls: 'text-yellow-400 border-yellow-500/50 bg-yellow-500/10' },
        'Khó': { text: '5 sao', cls: 'text-orange-400 border-orange-500/50 bg-orange-500/10' },
        '5 sao': { text: '5 sao', cls: 'text-orange-400 border-orange-500/50 bg-orange-500/10' },
        'Khó (5 sao)': { text: 'Khó (5 sao)', cls: 'text-orange-400 border-orange-500/50 bg-orange-500/10' },
        'Rất khó': { text: '6 sao', cls: 'text-red-400 border-red-500/50 bg-red-500/10' },
        '6 sao': { text: '6 sao', cls: 'text-red-400 border-red-500/50 bg-red-500/10' },
        'Rất khó (6 sao)': { text: 'Rất khó (6 sao)', cls: 'text-red-400 border-red-500/50 bg-red-500/10' },
        'Cực khó': { text: '7 sao', cls: 'text-purple-400 border-purple-500/50 bg-purple-500/10' },
        '7 sao': { text: '7 sao', cls: 'text-purple-400 border-purple-500/50 bg-purple-500/10' },
        'Cực khó (7 sao)': { text: 'Cực khó (7 sao)', cls: 'text-purple-400 border-purple-500/50 bg-purple-500/10' }
    };
    if (diffEl) {
        const diff = mapInfo?.difficulty;
        const style = difficultyStyles[diff];
        
        let starCount = 3;
        const lowerDiff = (diff || '').toLowerCase();
        if (lowerDiff.includes('3 sao') || lowerDiff.includes('dễ') || lowerDiff.includes('easy')) starCount = 3;
        else if (lowerDiff.includes('4 sao') || lowerDiff.includes('trung bình') || lowerDiff.includes('medium')) starCount = 4;
        else if (lowerDiff.includes('5 sao') || lowerDiff.includes('khó') || lowerDiff.includes('hard')) starCount = 5;
        else if (lowerDiff.includes('6 sao') || lowerDiff.includes('rất khó') || lowerDiff.includes('expert')) starCount = 6;
        else if (lowerDiff.includes('7 sao') || lowerDiff.includes('cực khó') || lowerDiff.includes('extreme')) starCount = 7;
        else starCount = 0;
        
        let starsHTML = '';
        if (starCount > 0) {
            for (let i = 0; i < starCount; i++) {
                starsHTML += `<i class="fas fa-star text-yellow-400 text-[9px] mr-0.5"></i>`;
            }
        } else {
            starsHTML = style?.text || diff || '';
        }
        
        diffEl.innerHTML = starsHTML;
        diffEl.className = `text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border mb-2 inline-flex items-center gap-0.5 ${ style?.cls || 'text-slate-400 border-slate-600 bg-slate-700/20' }`;
        diffEl.style.display = diff ? 'inline-flex' : 'none';
    }

    // Records
    const allRecords = window.ALL_RACE_RECORDS || [];
    const maxRecords = window.innerWidth < 768 ? 5 : 10;
    const mapRecords = allRecords
        .filter(r => (r.mapName || '').trim().toLowerCase() === mapName.trim().toLowerCase())
        .sort((a, b) => (parseFloat(a.timeInSeconds) || 9999) - (parseFloat(b.timeInSeconds) || 9999))
        .slice(0, maxRecords);

    const allCars = window.ALL_CARS || [];
    const allPets = window.ALL_PETS || [];
    const allUsers = window.ALL_USERS || [];

    const rankColors = ['text-yellow-400', 'text-slate-300', 'text-amber-600'];
    const rankIcons = ['🥇', '🥈', '🥉'];

    const recordsEl = document.getElementById('map-detail-records');
    if (recordsEl) {
        if (mapRecords.length === 0) {
            recordsEl.innerHTML = `
                <div class="text-center py-8 text-slate-500">
                    <i class="fas fa-clock text-3xl mb-3 block opacity-40"></i>
                    <p class="text-sm">Chưa có kỷ lục nào cho bản đồ này</p>
                </div>`;
        } else {
            recordsEl.innerHTML = mapRecords.map((rec, i) => {
                const isTop1 = i === 0;
                const rankLabel = rankIcons[i] || `<span class="text-slate-400 font-bold text-sm">#${i + 1}</span>`;

                // Car image
                const carInfo = allCars.find(c => (c.name || '').trim().toLowerCase() === (rec.car || '').trim().toLowerCase());
                const carImg = carInfo?.imageUrl || '';

                // Pet image
                const petInfo = allPets.find(p => (p.name || '').trim().toLowerCase() === (rec.pet || '').trim().toLowerCase());
                const petImg = petInfo?.imageUrl || '';

                // Top 1 - find racer avatar
                let racerAvatarHtml = '';
                if (isTop1) {
                    const lookupUsers = (typeof ALL_USERS !== 'undefined' ? ALL_USERS : []) || allUsers;
                    const racerUser = lookupUsers.find(u => {
                        const nick = (u.nickname || '').trim().toLowerCase();
                        const disp = (u.displayName || '').trim().toLowerCase();
                        const rName = (rec.racerName || '').trim().toLowerCase();
                        return nick === rName || disp === rName;
                    });
                    let avatarSrc = 'assets/images/logows.png';
                    if (racerUser) {
                        if (racerUser.photoBase64 && racerUser.photoBase64.trim() !== '') {
                            avatarSrc = racerUser.photoBase64;
                        } else if (racerUser.photoURL && racerUser.photoURL.trim() !== '' && racerUser.photoURL !== 'logoWS.png' && !racerUser.photoURL.startsWith('custom_avatar_')) {
                            avatarSrc = racerUser.photoURL;
                        }
                    }
                    racerAvatarHtml = `<img src="${avatarSrc}" class="w-10 h-10 rounded-full object-cover border-2 border-yellow-400/70 flex-shrink-0 shadow-[0_0_8px_rgba(250,204,21,0.4)]" onerror="this.src='assets/images/logows.png'">`;
                }

                if (isTop1) {
                    return `
                    <div class="flex flex-col gap-3 p-4 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-900/10 border border-yellow-500/30 relative overflow-hidden mb-2 shadow-[0_4px_15px_rgba(234,179,8,0.15)]">
                        <div class="absolute -right-4 -top-4 text-yellow-500/10 text-7xl"><i class="fas fa-crown"></i></div>
                        <div class="flex items-center gap-3 relative z-10">
                            <div class="w-8 text-center text-3xl drop-shadow-md flex-shrink-0">🥇</div>
                            ${racerAvatarHtml}
                            <div class="flex-1 min-w-0 pl-1">
                                <div class="text-xs text-yellow-500/80 font-black uppercase tracking-wider mb-0.5">Kỷ Lục Gia</div>
                                <div class="text-base font-black text-white truncate drop-shadow-sm">${rec.racerName || 'N/A'}</div>
                            </div>
                            <div class="text-base font-mono font-black text-yellow-400 drop-shadow-md tracking-wide">${rec.timeString || 'N/A'}</div>
                        </div>
                        <div class="flex items-center gap-3 mt-1 bg-black/30 rounded-lg p-2 border border-yellow-500/10 relative z-10">
                            <div class="flex items-center gap-2 flex-1 min-w-0 pl-1">
                                <div class="w-12 h-6 flex-shrink-0 flex items-center justify-center">
                                    ${carImg ? `<img src="${carImg}" class="max-w-full max-h-full object-contain drop-shadow-md" title="${rec.car || 'N/A'}">` : `<i class="fas fa-car text-slate-500" title="${rec.car || 'N/A'}"></i>`}
                                </div>
                                <div class="text-xs font-bold text-slate-300 truncate flex-1" title="${rec.car || 'N/A'}">${rec.car || 'N/A'}</div>
                            </div>
                            <div class="w-px h-6 bg-yellow-500/20"></div>
                            <div class="flex items-center gap-2 flex-1 min-w-0">
                                <div class="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                    ${petImg ? `<img src="${petImg}" class="max-w-full max-h-full object-contain drop-shadow-md" title="${rec.pet || 'Không có'}">` : `<i class="fas fa-paw text-slate-500" title="${rec.pet || 'Không có'}"></i>`}
                                </div>
                                <div class="text-xs font-bold text-slate-300 truncate flex-1" title="${rec.pet || 'Không có'}">${rec.pet || 'Không có'}</div>
                            </div>
                        </div>
                    </div>
                    `;
                }

                const rowBg = i % 2 === 0 ? 'bg-slate-800/50 border border-slate-700/40' : 'bg-slate-800/25 border border-slate-700/20';

                return `
                <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl ${rowBg}">
                    <!-- Rank -->
                    <div class="w-8 text-center text-lg flex-shrink-0">${rankLabel}</div>

                    <!-- Racer name -->
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold truncate text-white">${rec.racerName || 'N/A'}</div>
                    </div>

                    <!-- Time -->
                    <div class="text-sm font-mono font-black text-cyan-400 flex-shrink-0 tracking-wide">${rec.timeString || 'N/A'}</div>

                    <!-- Car image -->
                    <div class="w-14 h-8 flex-shrink-0 flex items-center justify-center" title="${rec.car || 'N/A'}">
                        ${carImg ? `<img src="${carImg}" class="max-w-full max-h-full object-contain">` : `<i class="fas fa-car text-slate-500 text-xs"></i>`}
                    </div>

                    <!-- Pet image -->
                    <div class="w-8 h-8 flex-shrink-0 flex items-center justify-center" title="${rec.pet || 'Không có'}">
                        ${petImg ? `<img src="${petImg}" class="max-w-full max-h-full object-contain">` : `<i class="fas fa-paw text-slate-500" style="font-size:9px"></i>`}
                    </div>
                </div>
                `;
            }).join('');
        }
    }

    // Show modal with animation
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
        box.classList.add('animate__zoomIn', 'animate__faster');
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) window.closeMapDetailModal();
    }, { once: true });
};

window.closeMapDetailModal = () => {
    const modal = document.getElementById('map-detail-modal');
    const box = document.getElementById('map-detail-box');
    if (!modal) return;
    box.classList.remove('animate__zoomIn');
    box.classList.add('animate__zoomOut', 'animate__faster');
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        box.classList.remove('animate__zoomOut', 'animate__faster');
    }, 300);
};

// ==================== MAP VIDEO MODAL ====================
window.openCurrentMapVideoExternal = () => {
    if (window.currentMapVideoUrl) {
        window.open(window.currentMapVideoUrl, '_blank', 'noopener,noreferrer');
    }
};

window.toggleMapVideoFullscreen = () => {
    const container = document.getElementById('map-video-container') || document.getElementById('map-video-content');
    if (!container) return;

    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen();
        } else {
            const videoEl = container.querySelector('video');
            if (videoEl && videoEl.requestFullscreen) videoEl.requestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
};

window.hideMapVideoLoading = () => {
    const loader = document.getElementById('map-video-loading');
    if (loader) loader.classList.add('hidden');
};

window.playMapVideo = () => {
    const videoUrl = window.currentMapVideoUrl;
    if (!videoUrl) return;

    const modal = document.getElementById('map-video-modal');
    const box = document.getElementById('map-video-box');
    const container = document.getElementById('map-video-container');
    const contentEl = document.getElementById('map-video-content') || container;
    const titleEl = document.getElementById('map-video-title');
    const loader = document.getElementById('map-video-loading');

    if (!modal || !container) return;

    if (titleEl) titleEl.textContent = `Video Best Record - ${window.currentMapName || 'Bản đồ'}`;

    // Show loading spinner
    if (loader) loader.classList.remove('hidden');

    // Safety timeout to hide spinner if iframe load event is suppressed
    if (window._videoLoadTimeout) clearTimeout(window._videoLoadTimeout);
    window._videoLoadTimeout = setTimeout(() => {
        window.hideMapVideoLoading();
    }, 6000);

    // Helper to extract YouTube ID
    const getYouTubeEmbedUrl = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
            return `https://www.youtube.com/embed/${match[2]}?autoplay=1&mute=0&rel=0&enablejsapi=1`;
        }
        return null;
    };

    // Helper to extract Bilibili embed
    const getBilibiliEmbedUrl = (url) => {
        const match = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i);
        if (match && match[1]) {
            return `//player.bilibili.com/player.html?bvid=${match[1]}&page=1&high_quality=1&danmaku=0&autoplay=1`;
        }
        return null;
    };

    // Helper to extract Google Drive file ID
    const getGoogleDriveInfo = (url) => {
        const matchFileD = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
        if (matchFileD && matchFileD[1]) return matchFileD[1];

        const matchQueryId = url.match(/drive\.google\.com\/(?:open|uc)\?.*id=([a-zA-Z0-9_-]+)/i);
        if (matchQueryId && matchQueryId[1]) return matchQueryId[1];

        return null;
    };

    const ytEmbed = getYouTubeEmbedUrl(videoUrl);
    const biliEmbed = getBilibiliEmbedUrl(videoUrl);
    const driveId = getGoogleDriveInfo(videoUrl);

    if (ytEmbed) {
        contentEl.innerHTML = `<iframe src="${ytEmbed}" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen onload="window.hideMapVideoLoading()"></iframe>`;
    } else if (biliEmbed) {
        contentEl.innerHTML = `<iframe src="${biliEmbed}" class="w-full h-full border-0" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" onload="window.hideMapVideoLoading()"></iframe>`;
    } else if (driveId) {
        const gdrivePreview = `https://drive.google.com/file/d/${driveId}/preview?autoplay=1`;
        contentEl.innerHTML = `<iframe src="${gdrivePreview}" class="w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen onload="window.hideMapVideoLoading()"></iframe>`;
    } else if (/\.(mp4|webm|ogg)$/i.test(videoUrl)) {
        contentEl.innerHTML = `<video src="${videoUrl}" controls autoplay playsinline class="w-full h-full object-contain" oncanplay="window.hideMapVideoLoading(); this.play();" onloadeddata="window.hideMapVideoLoading()"></video>`;
    } else {
        contentEl.innerHTML = `<iframe src="${videoUrl}" class="w-full h-full border-0" allow="autoplay; fullscreen" onload="window.hideMapVideoLoading()"></iframe>`;
    }

    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
        if (box) box.classList.add('animate__zoomIn', 'animate__faster');
    });

    const backdropClose = (e) => {
        if (e.target === modal) window.closeMapVideoModal();
    };
    modal.addEventListener('click', backdropClose, { once: true });
};

window.closeMapVideoModal = () => {
    const modal = document.getElementById('map-video-modal');
    const box = document.getElementById('map-video-box');
    const contentEl = document.getElementById('map-video-content');

    if (!modal) return;
    if (window._videoLoadTimeout) clearTimeout(window._videoLoadTimeout);
    if (box) {
        box.classList.remove('animate__zoomIn');
        box.classList.add('animate__zoomOut', 'animate__faster');
    }
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        if (box) box.classList.remove('animate__zoomOut', 'animate__faster');
        if (contentEl) contentEl.innerHTML = ''; // Stop video playback
    }, 300);
};

// Ensure dark mode (clear any legacy light-mode theme)
(function () {
    try {
        localStorage.removeItem('westar-theme');
        document.documentElement.classList.remove('light-mode');
    } catch (e) {}
})();

// ─── 1vs1 BO Format Toggle ────────────────────────────────────────────────────
window.toggle1vs1BOFormat = (format) => {
    if (!raceState) return;
    raceState.bo1vs1Format = format; // 'BO9' hoặc 'BO7'
    saveRaceState(raceState);
    // Cập nhật UI nút
    const btn9 = document.getElementById('bo9-btn');
    const btn7 = document.getElementById('bo7-btn');
    if (btn9) btn9.classList.toggle('active', format === 'BO9');
    if (btn7) btn7.classList.toggle('active', format === 'BO7');
    // Cập nhật mô tả
    const desc = document.getElementById('1vs1-format-desc');
    if (desc) {
        desc.textContent = format === 'BO7'
            ? 'Đua 1vs1 giữa 2 tay đua (BO3 lớn: BO1 & BO2 chạm 4, BO3 chạm 4 cách biệt 2)'
            : 'Đua 1vs1 giữa 2 tay đua (BO3 lớn: BO1 & BO2 chạm 5, BO3 chạm 5 cách biệt 2)';
    }
    renderMapTables();
    displayMessage(`Đã chuyển sang định dạng ${format}!`);
};

// ==================== BANNER CAROUSEL LOGIC ====================
let carouselInterval = null;
let currentSlideIndex = 0;

const setupBannersListener = () => {
    try {
        const bannersRef = collection(db, "banners");
        onSnapshot(bannersRef, (snapshot) => {
            const banners = [];
            snapshot.forEach(doc => {
                const banner = doc.data();
                if (banner.active !== false) {
                    banners.push({ id: doc.id, ...banner });
                }
            });
            banners.sort((a, b) => (parseInt(a.order) || 0) - (parseInt(b.order) || 0));
            renderBannersCarousel(banners);
        }, (error) => {
            console.error("Lỗi khi lắng nghe banners:", error);
        });
    } catch (e) {
        console.error("Error setting up banners listener:", e);
    }
};

const renderBannersCarousel = (banners) => {
    const container = document.getElementById('banner-carousel-container');
    const slidesContainer = document.getElementById('banner-slides');
    const indicatorsContainer = document.getElementById('carousel-indicators');
    
    if (!container || !slidesContainer) return;
    
    if (banners.length === 0) {
        container.classList.add('hidden');
        if (carouselInterval) clearInterval(carouselInterval);
        return;
    }
    
    container.classList.remove('hidden');
    slidesContainer.innerHTML = '';
    if (indicatorsContainer) indicatorsContainer.innerHTML = '';
    
    banners.forEach((banner, index) => {
        // Slide
        const slide = document.createElement('div');
        slide.className = `banner-slide absolute inset-0 opacity-0 transition-opacity duration-700 ease-in-out ${index === 0 ? 'active opacity-100' : ''}`;
        slide.setAttribute('data-index', index);
        slide.innerHTML = `
            <img src="${banner.imageUrl}" class="w-full h-full" style="object-fit: ${banner.objectFit || 'cover'}; object-position: ${banner.objectPosition || 'center'};">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
            ${banner.title ? `
                <div class="absolute bottom-8 left-8 right-8 z-20">
                    <h3 class="text-xl sm:text-2xl font-bold text-white mb-2 drop-shadow-md">${banner.title}</h3>
                </div>
            ` : ''}
        `;
        slidesContainer.appendChild(slide);
        
        // Indicator
        if (indicatorsContainer) {
            const indicator = document.createElement('button');
            indicator.className = `carousel-indicator w-2 h-2 rounded-full transition-all duration-300 ${index === 0 ? 'bg-cyan-400 w-6' : 'bg-white/40 hover:bg-white/70'}`;
            indicator.setAttribute('data-slide-to', index);
            indicator.addEventListener('click', () => {
                goToSlide(index, banners.length);
            });
            indicatorsContainer.appendChild(indicator);
        }
    });
    
    // Wire Prev/Next buttons
    const prevBtn = document.getElementById('carousel-prev');
    const nextBtn = document.getElementById('carousel-next');
    if (prevBtn) {
        prevBtn.onclick = () => prevSlide(banners.length);
    }
    if (nextBtn) {
        nextBtn.onclick = () => nextSlide(banners.length);
    }

    currentSlideIndex = 0;
    startCarouselAutoPlay(banners.length);
};

const startCarouselAutoPlay = (totalSlides) => {
    if (carouselInterval) clearInterval(carouselInterval);
    if (totalSlides <= 1) return;
    
    carouselInterval = setInterval(() => {
        nextSlide(totalSlides);
    }, 5000); // Auto slide every 5 seconds
};

const goToSlide = (index, totalSlides) => {
    if (totalSlides <= 1) return;
    
    const slides = document.querySelectorAll('.banner-slide');
    const indicators = document.querySelectorAll('#carousel-indicators button');
    
    slides.forEach((slide) => {
        slide.classList.remove('active', 'opacity-100');
        slide.classList.add('opacity-0');
    });
    
    indicators.forEach((indicator) => {
        indicator.classList.remove('bg-cyan-400', 'w-6');
        indicator.classList.add('bg-white/40');
    });
    
    currentSlideIndex = index;
    
    if (slides[index]) {
        slides[index].classList.add('active', 'opacity-100');
        slides[index].classList.remove('opacity-0');
    }
    
    if (indicators[index]) {
        indicators[index].classList.add('bg-cyan-400', 'w-6');
        indicators[index].classList.remove('bg-white/40');
    }
    
    // Reset timer on manual navigation
    startCarouselAutoPlay(totalSlides);
};

const nextSlide = (totalSlides) => {
    let nextIndex = currentSlideIndex + 1;
    if (nextIndex >= totalSlides) nextIndex = 0;
    goToSlide(nextIndex, totalSlides);
};

const prevSlide = (totalSlides) => {
    let prevIndex = currentSlideIndex - 1;
    if (prevIndex < 0) prevIndex = totalSlides - 1;
    goToSlide(prevIndex, totalSlides);
};

initFirebase();