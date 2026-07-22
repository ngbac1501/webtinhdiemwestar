import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, doc, getDoc, collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { performanceOptimizer } from "./js/modules/performance-optimizer.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDtFpBAuZ_3JHmMXq1uVShq4sm0zK9xqEI",
    authDomain: "tinhdiemtheog.firebaseapp.com",
    projectId: "tinhdiemtheog",
    storageBucket: "tinhdiemtheog.firebasestorage.app",
    messagingSenderId: "52564586448",
    appId: "1:52564586448:web:983bdc321423b81f5a53d5",
    measurementId: "G-PFTMHMTF6J"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global variables
let ALL_MAPS = [];
let ALL_RECORDS = [];
let ALL_CARS = [];
let ALL_PETS = [];
let ALL_USERS = [];
let raceState = null;
let GLOBAL_CACHE_LOADED = false;
let scoreboardBOTab = 1;
window._scoreboardBOTabUserOverride = false;

// Utility Functions
const getNumRacers = () => {
    return (raceState && raceState.is1vs1Mode) ? 2 : 4;
};

const timeToSeconds = (timeString) => {
    if (!timeString || typeof timeString !== 'string') return null;
    timeString = timeString.trim();
    const match = timeString.match(/(\d+)'(\d+)'(\d+)/);
    if (match) {
        const minutes = parseInt(match[1]) || 0;
        const seconds = parseInt(match[2]) || 0;
        const milliseconds = parseInt(match[3]) || 0;
        return minutes * 60 + seconds + (milliseconds / 100);
    }
    return null;
};

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

// Calculate map points
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
        points[i] = Math.max(0, baseScore - penalty);
    }
    return points;
};

// Calculate ranking
const calculateRanking = () => {
    const numRacers = getNumRacers();
    
    if (raceState.is1vs1Mode) {
        const matchState = get1vs1MatchState(raceState.maps);
        const rankingData = [0, 1].map(index => {
            const racer = raceState.racers[index];
            return {
                originalIndex: index,
                name: racer && racer.name ? racer.name.trim() : `Tay đua ${index + 1}`,
                totalScore: matchState.overallScore[index],
                mapWins: matchState.bo1.wins[index] + matchState.bo2.wins[index] + matchState.bo3.wins[index],
                rank: index + 1
            };
        });

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
        name: racer.name.trim() || `Tay đua ${index + 1}`,
        totalScore: 0,
        rank: 0,
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

// Refresh Cache with SWR
const refreshGlobalCache = async (types = ['maps', 'records', 'cars', 'pets', 'users']) => {
    const fetchMapData = async () => {
        const snap = await getDocs(collection(db, "gameMaps"));
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    const fetchRecordData = async () => {
        const snap = await getDocs(collection(db, "raceRecords"));
        return snap.docs.map(doc => doc.data());
    };

    const fetchCarData = async () => {
        const snap = await getDocs(collection(db, "gameCars"));
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(car => car.name);
    };

    const fetchPetData = async () => {
        const snap = await getDocs(collection(db, "gamePets"));
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(pet => pet.name);
    };

    const fetchUserData = async () => {
        const snap = await getDocs(collection(db, "users"));
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(u => u.role === 'racer');
    };

    const tasks = [];
    if (types.includes('maps')) tasks.push(performanceOptimizer.fetchWithCache('gameMaps', fetchMapData).then(data => ALL_MAPS = data));
    if (types.includes('records')) tasks.push(performanceOptimizer.fetchWithCache('raceRecords', fetchRecordData).then(data => ALL_RECORDS = data));
    if (types.includes('cars')) tasks.push(performanceOptimizer.fetchWithCache('gameCars', fetchCarData).then(data => ALL_CARS = data));
    if (types.includes('pets')) tasks.push(performanceOptimizer.fetchWithCache('gamePets', fetchPetData).then(data => ALL_PETS = data));
    if (types.includes('users')) tasks.push(performanceOptimizer.fetchWithCache('users', fetchUserData).then(data => ALL_USERS = data));

    await Promise.all(tasks);
    GLOBAL_CACHE_LOADED = true;
};

// === SCOREBOARD BO TABS ===
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
        if (scoreboardBOTab !== 1) {
            scoreboardBOTab = 1;
        }
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
    renderDetailedScoreboard();
};

// Render Scoreboard
const renderDetailedScoreboard = () => {
    const thead = document.getElementById('detailed-scoreboard-header');
    const tbody = document.getElementById('detailed-scoreboard-body');
    const table = thead.closest('table');
    const container1vs1 = document.getElementById('detailed-scoreboard-1vs1-container');

    if (!raceState || raceState.maps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="100%" class="text-center py-20 text-slate-500">Chưa có dữ liệu.</td></tr>`;
        return;
    }

    const rankingData = calculateRanking();
    const mapPointsMatrix = raceState.maps.map(map => calculateMapPoints(map.times, map.name));
    const matchState = raceState.is1vs1Mode ? get1vs1MatchState(raceState.maps) : null;

    // Render BO tabs
    renderScoreboardBOTabBar(matchState);

    if (raceState.is1vs1Mode && matchState) {
        // Hide standard table, show 1vs1 cards container
        if (table) table.classList.add('hidden');
        // Remove wrapper clipping so grid has no rounded corners
        const outerWrapper = container1vs1?.closest('.table-responsive-wrapper');
        if (outerWrapper) {
            outerWrapper.style.borderRadius = '0';
            outerWrapper.style.overflow = 'visible';
            outerWrapper.style.border = 'none';
            outerWrapper.style.boxShadow = 'none';
            outerWrapper.style.background = 'transparent';
            outerWrapper.style.backdropFilter = 'none';
        }
        if (container1vs1) {
            container1vs1.classList.remove('hidden');

            // Lọc map theo BO tab
            let mapsToRender = raceState.maps
                .map((map, globalIndex) => ({ map, globalIndex }))
                .filter(({ globalIndex }) => matchState.mapBOs[globalIndex] === scoreboardBOTab);

            const racer1Name = raceState.racers[0]?.name || 'Tay Đua 1';
            const racer2Name = raceState.racers[1]?.name || 'Tay Đua 2';

            if (mapsToRender.length === 0) {
                container1vs1.innerHTML = `<div class="text-center py-12 text-slate-500 w-full font-medium">Chưa có bản đồ nào được ghi nhận cho BO này.</div>`;
            } else {
                // ── Build table-like layout sát nhau, không bo góc ──
                let headerCols = '';
                let cardCols = '';

                mapsToRender.forEach(({ map, globalIndex: mapIndex }, colIdx) => {
                    const roundLabel = `ROUND ${colIdx + 1}`;
                    const isMapActive = map.name && map.name.trim() !== '' && map.name.trim().toLowerCase() !== 'chưa đặt tên';

                    // ── Header cell ──
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

                    // WIN/LOSE text
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

                    // Car info
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

                    // Colors
                    const r1NameColor = racer1Won ? '#fbbf24' : '#cbd5e1';
                    const r2NameColor = racer2Won ? '#fbbf24' : '#cbd5e1';
                    const r1CarColor  = racer1Won ? '#fbbf24' : 'rgba(245,158,11,0.75)';
                    const r2CarColor  = racer2Won ? '#fbbf24' : 'rgba(245,158,11,0.75)';

                    // Badge
                    const isBtcMap  = mapIndex === 0 && map.name.trim() === raceState.firstMapBtc.trim();
                    const isKingMap = raceState.racers.some(r => r.kingMap.trim() === map.name.trim());
                    let badgeHtml = '';
                    if (isBtcMap)   badgeHtml = `<span style="position:absolute;top:6px;right:6px;z-index:5;font-size:0.52rem;background:rgba(239,68,68,0.9);color:#fff;font-weight:900;padding:2px 5px;border-radius:3px;letter-spacing:0.06em;">BTC</span>`;
                    else if (isKingMap) badgeHtml = `<span style="position:absolute;top:6px;right:6px;z-index:5;font-size:0.52rem;background:rgba(245,158,11,0.9);color:#fff;font-weight:900;padding:2px 5px;border-radius:3px;letter-spacing:0.06em;">KING</span>`;

                    // Section backgrounds (tinted by winner)
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
                                <!-- Map background layer -->
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

                // ── Scrollable grid wrapper ──
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
        if (table) table.classList.remove('hidden');
        if (container1vs1) container1vs1.classList.add('hidden');
        // Restore wrapper original styles for non-1vs1 mode
        const outerWrapper2 = container1vs1?.closest('.table-responsive-wrapper');
        if (outerWrapper2) {
            outerWrapper2.style.borderRadius = '';
            outerWrapper2.style.overflow = '';
            outerWrapper2.style.border = '';
            outerWrapper2.style.boxShadow = '';
            outerWrapper2.style.background = '';
            outerWrapper2.style.backdropFilter = '';
        }

        // Handle colgroup
        let colgroupHtml = '<colgroup>';
        raceState.maps.forEach((map) => {
            const isMapActive = map.name && map.name.trim() !== '' && map.name.trim().toLowerCase() !== 'chưa đặt tên';
            const mapInfo = isMapActive ? ALL_MAPS.find(m => m.name === map.name) : null;
            const mapImageUrl = mapInfo?.imageUrl || '';
            const backgroundStyle = mapImageUrl ?
                `background-image: url('${mapImageUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat;` :
                'background: rgba(15, 23, 42, 0.4);';
            colgroupHtml += `<col class="map-column-bg" style="${backgroundStyle} width: 210px; min-width: 210px; max-width: 210px;">`;
        });
        colgroupHtml += '</colgroup>';

        const oldColgroup = table.querySelector('colgroup');
        if (oldColgroup) oldColgroup.remove();
        table.insertAdjacentHTML('afterbegin', colgroupHtml);

        // Header
        let headerRow = `<tr>`;
        raceState.maps.forEach((map, mapIndex) => {
            const isMapActive = map.name && map.name.trim() !== '' && map.name.trim().toLowerCase() !== 'chưa đặt tên';
            let headerContent = '';
            let backgroundStyle = '';

            if (isMapActive) {
                const isBtcMap = mapIndex === 0 && map.name.trim() === raceState.firstMapBtc.trim();
                const isKingMap = raceState.racers.some(r => r.kingMap.trim() === map.name.trim());
                let mapTypeIcon = '';
                if (isBtcMap) mapTypeIcon = '<i class="fas fa-flag text-red-400 ml-1"></i>';
                else if (isKingMap) mapTypeIcon = '<i class="fas fa-crown text-amber-400 ml-1"></i>';
                const mapInfo = ALL_MAPS.find(m => m.name === map.name);
                const mapImageUrl = mapInfo?.imageUrl || '';
                backgroundStyle = mapImageUrl ? `background-image: linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0.55)), url('${mapImageUrl}'); background-size: cover; background-position: center;` : '';
                headerContent = `<span class="text-slate-100 text-sm flex items-center justify-center drop-shadow-md font-bold text-center leading-tight break-words px-2">${map.name.trim() || 'Chưa đặt tên'} ${mapTypeIcon}</span>`;
            } else {
                backgroundStyle = 'background: linear-gradient(180deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.8)); border: 1px dashed rgba(124, 58, 237, 0.2);';
                headerContent = `<span class="text-slate-500 text-xs flex flex-col items-center justify-center font-extrabold text-center tracking-widest leading-tight uppercase px-2"><i class="fas fa-hourglass-start mb-1 text-slate-600 animate-pulse"></i> Bản đồ ${mapIndex + 1}</span>`;
            }

            headerRow += `<th scope="col" class="map-column-header px-4 py-4 text-center text-xs font-extrabold text-cyan-400 uppercase tracking-wider" style="${backgroundStyle} width: 210px; min-width: 210px; max-width: 210px;">
                <div class="map-column-header-content flex flex-col items-center justify-center min-h-[60px]">${headerContent}</div>
            </th>`;
        });
        headerRow += `</tr>`;
        thead.innerHTML = headerRow;

        // Body
        tbody.innerHTML = '';
        rankingData.forEach((racer, racerRankIndex) => {
            const racerIndex = racer.originalIndex;
            let rowHtml = `<tr class="hover:bg-slate-700/50 transition-colors ${racer.rank <= 3 ? 'font-bold' : ''}">`;
            raceState.maps.forEach((map, mapIndex) => {
                const isMapActive = map.name && map.name.trim() !== '' && map.name.trim().toLowerCase() !== 'chưa đặt tên';
                if (isMapActive) {
                    const pointValue = mapPointsMatrix[mapIndex][racerIndex];
                    const isWinner = pointValue >= 11;
                    const scoreStyle = isWinner ? 'style="color: #fbbf24 !important; text-shadow: 0 0 15px rgba(251, 191, 36, 0.6), 0 2px 4px rgba(0, 0, 0, 0.8);"' : '';
                    rowHtml += `<td class="map-score-cell-td px-3 py-3 text-center">
                            <div class="map-racer-label">${racer.name}</div>
                            <div class="map-score-cell" ${scoreStyle}>+${pointValue}</div>
                        </td>`;
                } else if (racerRankIndex === 0) {
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

    const summaryBarContainer = document.getElementById('scoreboard-summary-bar-container');
    if (summaryBarContainer) {
        summaryBarContainer.classList.remove('hidden');

        if (raceState.is1vs1Mode && matchState) {
            const p1 = rankingData.find(r => r.originalIndex === 0) || { name: 'Tay đua 1', totalScore: 0 };
            const p2 = rankingData.find(r => r.originalIndex === 1) || { name: 'Tay đua 2', totalScore: 0 };
            
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
                <div class="animate__animated animate__fadeInUp flex items-center justify-between w-full font-bold px-6 py-4 rounded-2xl mt-6" style="background: linear-gradient(135deg, rgba(8,8,30,0.97) 0%, rgba(15,15,45,0.97) 50%, rgba(8,8,30,0.97) 100%); border: 1px solid rgba(99,179,237,0.25); box-shadow: 0 0 40px rgba(6,182,212,0.15), inset 0 1px 0 rgba(255,255,255,0.05);">
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

            scoreClass1 = 'team-red';
            scoreClass2 = 'team-red';
            scoreClass3 = 'team-blue';
            scoreClass4 = 'team-blue';
        } else {
            left1 = r1;
            left2 = r2;
            right1 = r3;
            right2 = r4;
            centerLabel = "INDIVIDUAL SPRINT";

            scoreClass1 = '';
            scoreClass2 = '';
            scoreClass3 = '';
            scoreClass4 = '';
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

// Setup Listener
const setupRealtimeListener = () => {
    onSnapshot(doc(db, "raceState", "current"), async (snap) => {
        if (snap.exists()) {
            raceState = snap.data();
            await refreshGlobalCache(['records']);
            renderDetailedScoreboard();
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
        }
    });
};

// Init
const init = async () => {
    try {
        await refreshGlobalCache();
        setupRealtimeListener();
    } catch (err) {
        console.error("Init error:", err);
    }
};

init();
