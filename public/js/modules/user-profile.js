/**
 * User Profile & Achievement System
 * Quản lý profil người dùng, achievements, thành tích
 */

class UserProfileManager {
    constructor() {
        this.currentUser = null;
        this.userStats = {};
        this.achievements = [];
        this.db = null;
        this.auth = null;
        this.init();
    }

    /**
     * Khởi tạo hệ thống
     */
    init() {
        this.setupProfileListener();
        // Lắng nghe Firebase được khởi tạo
        document.addEventListener('firebaseInitialized', (e) => {
            this.db = e.detail.db;
            this.auth = e.detail.auth;
        });
    }

    /**
     * Setup profile listener
     */
    setupProfileListener() {
        document.addEventListener('userLoaded', (e) => {
            this.currentUser = e.detail;
            this.loadUserStats();
        });
    }

    /**
     * Tạo trang profile
     */
    async createProfilePage(targetUid = null) {
        // 1. Create and show container immediately
        let container = document.getElementById('user-profile-page');
        if (!container) {
            container = document.createElement('div');
            container.id = 'user-profile-page';
            document.body.appendChild(container);
        }

        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(10, 10, 15, 0.98);
            backdrop-filter: blur(15px);
            z-index: 5000;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;

        // Loading state
        container.innerHTML = `
            <div id="profile-loader" style="text-align: center; color: var(--neon-cyan); font-family: 'Orbitron', sans-serif;">
                <div class="fas fa-circle-notch fa-spin" style="font-size: 4rem; margin-bottom: 25px; filter: drop-shadow(0 0 10px var(--neon-cyan));"></div>
                <div style="letter-spacing: 4px; text-transform: uppercase; font-weight: 700; animate: pulse 1.5s infinite;">Đang đồng bộ dữ liệu...</div>
                <button onclick="document.getElementById('user-profile-page').remove()" style="margin-top: 30px; background: none; border: 1px solid rgba(255,255,255,0.2); color: #666; padding: 8px 20px; border-radius: 20px; cursor: pointer;">Hủy</button>
            </div>
        `;

        // Reveal with animation
        requestAnimationFrame(() => {
            container.style.opacity = '1';
        });

        // 2. Load fresh data in background
        try {
            // If we have some data already, we could show it, but for now let's just wait and optimize the load
            await this.loadUserStats(targetUid);
            const profile = await this.buildProfileHTML(targetUid);

            // 3. Update UI
            container.style.display = 'block';
            container.style.alignItems = 'initial';
            container.style.justifyContent = 'initial';
            container.innerHTML = profile;

            this.setupProfileInteractions(container);
        } catch (error) {
            console.error("Lỗi khi hiển thị profile:", error);
            container.innerHTML = `
                <div style="color: white; text-align: center; font-family: 'Orbitron', sans-serif;">
                    <i class="fas fa-exclamation-triangle text-amber-500 mb-4" style="font-size: 3rem;"></i>
                    <h2>HỆ THỐNG GẶP LỖI</h2>
                    <p style="color: #64748b;">Không thể tải dữ liệu hồ sơ. Vui lòng thử lại sau.</p>
                    <button onclick="document.getElementById('user-profile-page').remove()" style="margin-top: 20px; background: var(--neon-cyan); color: black; padding: 10px 30px; border-radius: 10px; font-weight: bold; cursor: pointer;">ĐÓNG</button>
                </div>
            `;
        }

        return container;
    }

    /**
     * Tạo trang edit profile
     */
    async createEditProfilePage() {
        const container = document.createElement('div');
        container.id = 'edit-profile-page';
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(10, 10, 15, 0.95);
            backdrop-filter: blur(10px);
            z-index: 5001;
            overflow-y: auto;
            padding: 20px;
            animation: fadeIn 0.3s ease-in-out;
        `;

        const editForm = await this.buildEditProfileHTML();
        container.innerHTML = editForm;

        document.body.appendChild(container);
        this.setupEditProfileInteractions(container);

        return container;
    }

    /**
     * Build profile HTML
     */
    async buildProfileHTML(targetUid = null) {
        const stats = this.userStats;
        let user = this.currentUser || window.auth?.currentUser;
        
        let displayUser = {
            displayName: user?.displayName || 'Tay đua ẩn danh',
            email: user?.email || 'Chưa cập nhật'
        };

        // Get avatar from Firestore users collection
        let avatarUrl = '';
        const targetId = targetUid || (user ? user.uid : null);
        
        if (targetId) {
            try {
                const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
                const db = getFirestore();
                const userDoc = await getDoc(doc(db, "users", targetId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    avatarUrl = userData.photoBase64 || userData.photoURL || (user?.uid === targetId ? user.photoURL : '') || '';
                    if (targetUid) {
                        displayUser.displayName = userData.displayName || userData.nickname || 'Tay đua ẩn danh';
                        displayUser.email = userData.email || 'Ẩn';
                    }
                }
            } catch (error) {
                console.log('Không thể lấy avatar:', error);
                avatarUrl = (user?.uid === targetId) ? user.photoURL : '';
            }
        }

        return `
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                .profile-stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                    margin-bottom: 30px;
                }

                .profile-main-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 25px;
                    margin-bottom: 30px;
                }

                .achievements-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                }

                @media (max-width: 1024px) {
                    .profile-main-grid {
                        grid-template-columns: 1fr !important;
                    }
                }

                @media (max-width: 768px) {
                    #user-profile-page { padding: 15px !important; }
                    .profile-stats-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 12px !important;
                    }
                    .profile-header-flex {
                        flex-direction: column !important;
                        text-align: center !important;
                        gap: 20px !important;
                    }
                    .profile-header-flex > div:last-child {
                        width: 100% !important;
                        justify-content: center !important;
                    }
                    .achievements-grid {
                        grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important;
                        gap: 10px !important;
                    }
                }

                @media (max-width: 480px) {
                    .profile-stats-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .achievements-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            </style>
            <div style="max-width: 1200px; margin: 0 auto;">
                <!-- Close button -->
                <button onclick="document.getElementById('user-profile-page').remove()" style="
                    position: fixed;
                    top: 20px;
                    right: 30px;
                    background: rgba(0, 243, 255, 0.1);
                    border: 1px solid rgba(0, 243, 255, 0.3);
                    color: var(--neon-cyan);
                    font-size: 1.5rem;
                    cursor: pointer;
                    z-index: 5001;
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                " onmouseover="this.style.background='rgba(0, 243, 255, 0.2)'" onmouseout="this.style.background='rgba(0, 243, 255, 0.1)'">
                    <i class="fas fa-times"></i>
                </button>

                <!-- Profile Header v2.0 -->
                <div style="
                    position: relative;
                    background: linear-gradient(180deg, rgba(0, 243, 255, 0.15) 0%, rgba(10, 10, 15, 0.95) 100%);
                    border: 1px solid rgba(0, 243, 255, 0.3);
                    border-radius: 24px;
                    padding: 40px;
                    margin-bottom: 30px;
                    overflow: hidden;
                ">
                    <!-- Background Decoration -->
                    <div style="position: absolute; top: -50px; right: -50px; width: 200px; height: 200px; background: var(--neon-cyan); filter: blur(100px); opacity: 0.1; z-index: 0;"></div>
                    <div style="position: absolute; bottom: -50px; left: -50px; width: 200px; height: 200px; background: var(--neon-blue); filter: blur(100px); opacity: 0.1; z-index: 0;"></div>

                    <div style="position: relative; z-index: 1; display: flex; align-items: center; gap: 30px; flex-wrap: wrap;" class="profile-header-flex">
                        <div style="position: relative;">
                            <div style="
                                width: 120px;
                                height: 120px;
                                border-radius: 50%;
                                background: linear-gradient(135deg, var(--neon-cyan), var(--neon-blue));
                                padding: 4px;
                                box-shadow: 0 0 20px rgba(0, 243, 255, 0.3);
                            ">
                                <div style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #1a1a2e; display: flex; align-items: center; justify-content: center; font-size: 3rem; color: white;">
                                    ${avatarUrl && !avatarUrl.startsWith('custom_avatar_') ?
                `<img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                        <i class="fas fa-user" style="display: none;"></i>` :
                `<i class="fas fa-user"></i>`
            }
                                </div>
                            </div>
                            <div style="position: absolute; bottom: 5px; right: 5px; background: var(--neon-green); width: 20px; height: 20px; border-radius: 50%; border: 3px solid #0a0a0f;"></div>
                        </div>

                        <div style="flex: 1; min-width: 250px;">
                            <h2 style="margin: 0 0 5px 0; font-size: 2.2rem; font-weight: 900; color: white; text-shadow: 0 0 10px rgba(0, 243, 255, 0.5); letter-spacing: -0.02em;">
                                ${displayUser.displayName}
                            </h2>
                            <div style="display: flex; gap: 15px; align-items: center; margin-bottom: 15px;">
                                <span style="color: #94a3b8; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
                                    <i class="fas fa-envelope" style="color: var(--neon-cyan);"></i> ${displayUser.email}
                                </span>
                                <span style="color: var(--neon-green); font-size: 0.9rem; font-weight: 700; background: rgba(16, 185, 129, 0.1); padding: 2px 10px; border-radius: 20px;">
                                    Tay đua vinh quang
                                </span>
                            </div>
                            <div style="color: #64748b; font-size: 0.85rem; font-style: italic; border-left: 2px solid var(--neon-cyan); padding-left: 10px;">
                                "Tốc độ là đam mê, vinh quang là tất cả."
                            </div>
                        </div>

                        ${!targetUid || (user && targetUid === user.uid) ? `
                        <div style="display: flex; gap: 10px;">
                            <button onclick="userProfileManager.createEditProfilePage()" style="
                                background: rgba(0, 243, 255, 0.1);
                                border: 1px solid var(--neon-cyan);
                                color: var(--neon-cyan);
                                padding: 12px 25px;
                                border-radius: 14px;
                                font-weight: 800;
                                text-transform: uppercase;
                                letter-spacing: 0.05em;
                                cursor: pointer;
                                transition: all 0.3s ease;
                                display: flex;
                                align-items: center;
                                gap: 10px;
                            " onmouseover="this.style.background='var(--neon-cyan)'; this.style.color='black'" onmouseout="this.style.background='rgba(0, 243, 255, 0.1)'; this.style.color='var(--neon-cyan)'">
                                <i class="fas fa-edit"></i> Chỉnh sửa
                            </button>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Main Stats v2.0 -->
                <div class="profile-stats-grid">
                    ${this.buildStatCard('Tổng số trận', stats.totalRaces, 'fa-flag-checkered', 'var(--neon-cyan)')}
                    ${this.buildStatCard('Tỷ lệ thắng', stats.winRate ? stats.winRate + '%' : '0%', 'fa-trophy', 'var(--neon-green)')}
                    ${this.buildStatCard('Tổng điểm', stats.totalPoints || 0, 'fa-star', 'var(--neon-pink)')}
                </div>

                <!-- Two Column Layout -->
                <div class="profile-main-grid">
                    <!-- Left Column: Favorite Items -->
                    <div style="display: flex; flex-direction: column; gap: 25px;">
                        <div class="glass-card" style="padding: 25px; background: rgba(10, 10, 15, 0.7); border: 1px solid rgba(255, 255, 255, 0.05);">
                            <h3 style="color: var(--neon-cyan); margin: 0 0 20px 0; font-size: 1.2rem; display: flex; align-items: center; gap: 12px; font-weight: 800;">
                                <i class="fas fa-car-side"></i> BỘ SƯU TẬP XE
                            </h3>
                            <div style="display: grid; gap: 15px;">
                                ${(stats.favoriteCars || []).slice(0, 3).map(car => {
                const carInfo = (window.ALL_CARS || []).find(c => (c.name || '').trim() === (car.name || '').trim());
                return `
                                    <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 12px; display: flex; align-items: center; gap: 15px; border: 1px solid rgba(255,255,255,0.05);">
                                        <div style="width: 50px; height: 50px; background: #000; border-radius: 10px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                            ${carInfo?.imageUrl ? `<img src="${carInfo.imageUrl}" style="width: 90%; height: 90%; object-fit: contain;">` : `<i class="fas fa-car text-cyan-400"></i>`}
                                        </div>
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="color: white; font-weight: 700; font-size: 0.95rem;" class="truncate">${car.name}</div>
                                            <div style="color: var(--neon-cyan); font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">${car.uses} Trận thi đấu</div>
                                        </div>
                                    </div>`;
            }).join('') || '<div style="color: #4a5568; font-style: italic;">Chưa có dữ liệu xe</div>'}
                            </div>
                        </div>

                        <div class="glass-card" style="padding: 25px; background: rgba(10, 10, 15, 0.7); border: 1px solid rgba(255, 255, 255, 0.05);">
                            <h3 style="color: var(--neon-pink); margin: 0 0 20px 0; font-size: 1.2rem; display: flex; align-items: center; gap: 12px; font-weight: 800;">
                                <i class="fas fa-paw"></i> THÚ CƯNG ĐỒNG HÀNH
                            </h3>
                            <div style="display: grid; gap: 15px;">
                                ${(stats.favoritePets || []).slice(0, 3).map(pet => {
                const petInfo = (window.ALL_PETS || []).find(p => (p.name || '').trim() === (pet.name || '').trim());
                return `
                                    <div style="background: rgba(255,255,255,0.03); border-radius: 16px; padding: 12px; display: flex; align-items: center; gap: 15px; border: 1px solid rgba(255,255,255,0.05);">
                                        <div style="width: 50px; height: 50px; background: #000; border-radius: 10px; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                            ${petInfo?.imageUrl ? `<img src="${petInfo.imageUrl}" style="width: 90%; height: 90%; object-fit: contain;">` : `<i class="fas fa-paw text-pink-400"></i>`}
                                        </div>
                                        <div style="flex: 1; min-width: 0;">
                                            <div style="color: white; font-weight: 700; font-size: 0.95rem;" class="truncate">${pet.name}</div>
                                            <div style="color: var(--neon-pink); font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">${pet.uses} Trận phối hợp</div>
                                        </div>
                                    </div>`;
            }).join('') || '<div style="color: #4a5568; font-style: italic;">Chưa có dữ liệu thú cưng</div>'}
                            </div>
                        </div>
                    </div>

                     <!-- Right Column: Achievements & VIP Titles -->
                     <div style="display: flex; flex-direction: column; gap: 25px;">
                         <!-- VIP Titles Section -->
                         <div class="glass-card" style="padding: 25px; background: rgba(10, 10, 15, 0.7); border: 1px solid rgba(255, 255, 255, 0.05);">
                             <h3 style="color: var(--neon-cyan); margin: 0 0 20px 0; font-size: 1.2rem; display: flex; align-items: center; gap: 12px; font-weight: 800;">
                                 <i class="fas fa-crown"></i> DANH HIỆU ĐỘI ĐUA VIP
                             </h3>
                             <div style="display: flex; flex-direction: column; gap: 12px;" id="vip-profile-titles">
                                 ${(() => {
                                     const rName = displayUser.displayName ? displayUser.displayName.trim() : '';
                                     const titles = (window.RACER_VIP_TITLES && window.RACER_VIP_TITLES[rName]) || [];
                                     if (titles.length === 0) {
                                         return `<div style="color: #4a5568; font-style: italic; font-size: 0.9rem;">Chưa đạt danh hiệu VIP nào. Hãy đua tích cực và giữ kỷ lục để mở khóa!</div>`;
                                     }
                                     return titles.map(t => `
                                         <div style="background: rgba(255,255,255,0.02); border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 15px; border: 1px solid rgba(255,255,255,0.05);">
                                             <span class="vip-badge-base ${t.className} scale-[1.1] origin-left" style="padding: 4px 10px; pointer-events: none;" title="${t.desc}">
                                                 <i class="fas ${t.icon} mr-1.5 text-[10px]"></i>${t.name}
                                             </span>
                                             <div style="color: #94a3b8; font-size: 0.8rem; font-weight: 500;">
                                                 ${t.desc}
                                             </div>
                                         </div>
                                     `).join('');
                                 })()}
                             </div>
                         </div>

                         <!-- Achievements Section -->
                         <div class="glass-card" style="padding: 25px; background: rgba(10, 10, 15, 0.7); border: 1px solid rgba(255, 255, 255, 0.05);">
                             <h3 style="color: var(--neon-green); margin: 0 0 20px 0; font-size: 1.2rem; display: flex; align-items: center; gap: 12px; font-weight: 800;">
                                 <i class="fas fa-medal"></i> THÀNH TỰU TAY ĐUA
                             </h3>
                             <div class="achievements-grid">
                                 ${this.buildAchievements(stats)}
                             </div>
                         </div>
                     </div>
                 </div>

                <!-- Record Maps Section -->
                ${stats.recordMaps && stats.recordMaps.length > 0 ? `
                <div style="margin-top: 20px;">
                    <h3 style="
                        margin: 0 0 20px 0;
                        color: #FFD700;
                        font-size: 1.4rem;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        font-weight: 900;
                        text-transform: uppercase;
                    ">
                        <i class="fas fa-crown"></i> Kỷ lục bản đồ cá nhân
                    </h3>
                    <div style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                        gap: 20px;
                    ">
                        ${stats.recordMaps.map(map => {
                const carInfo = (window.ALL_CARS || []).find(c => (c.name || '').trim() === (map.recordCar || '').trim());
                const petInfo = (window.ALL_PETS || []).find(p => (p.name || '').trim() === (map.recordPet || '').trim());

                return `
                            <div style="
                                position: relative;
                                border: 1px solid rgba(255, 215, 0, 0.3);
                                border-radius: 16px;
                                padding: 20px;
                                overflow: hidden;
                                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                                min-height: 180px;
                                cursor: pointer;
                                display: flex;
                                flex-direction: column;
                                justify-content: space-between;
                            " class="record-map-card" onclick="userProfileManager.showRecordDetail('${map.id}')" onmouseover="this.style.transform='translateY(-6px) scale(1.02)'; this.style.boxShadow='0 15px 35px rgba(255, 215, 0, 0.3)'" onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='none'">
                                <!-- Map Background -->
                                <div style="
                                    position: absolute;
                                    inset: 0;
                                    z-index: 0;
                                    background: url('${map.imageUrl || 'assets/images/default-map.jpg'}') center center / cover no-repeat;
                                    filter: brightness(0.5);
                                    transition: transform 0.6s ease;
                                " class="map-bg"></div>
                                
                                <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 60%); z-index: 1;"></div>
                                
                                <!-- Content Wrapper -->
                                <div style="position: relative; z-index: 2; height: 100%; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;">
                                    <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                                        <div style="min-width: 0; flex: 1;">
                                            <div style="color: #FFD700; font-size: 0.65rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">🏆 Record</div>
                                            <div style="color: white; font-size: 1.1rem; font-weight: 900; line-height: 1.1; text-shadow: 0 2px 4px rgba(0,0,0,0.8);" class="truncate uppercase">${map.name}</div>
                                        </div>
                                        <div style="background: rgba(255, 215, 0, 0.9); padding: 4px 10px; border-radius: 6px; color: #000; font-family: monospace; font-size: 1.1rem; font-weight: 900; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">
                                            ${map.recordTime}
                                        </div>
                                    </div>

                                    <div style="display: flex; gap: 8px; width: 100%; overflow: hidden;">
                                        <!-- Car Info -->
                                        <div style="flex: 1; flex-basis: 0; min-width: 0; background: rgba(0, 0, 0, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 6px; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(4px);" title="${map.recordCar}">
                                            <div style="width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); border-radius: 4px;">
                                                ${carInfo?.imageUrl ? `<img src="${carInfo.imageUrl}" style="width: 100%; height: 100%; object-fit: contain;">` : `<i class="fas fa-car text-cyan-400" style="font-size: 0.7rem;"></i>`}
                                            </div>
                                            <div style="flex: 1; min-width: 0;">
                                                <div style="color: white; font-size: 0.7rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${map.recordCar}</div>
                                            </div>
                                        </div>
                                        
                                        <!-- Pet Info -->
                                        <div style="flex: 1; flex-basis: 0; min-width: 0; background: rgba(0, 0, 0, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 6px; display: flex; align-items: center; gap: 8px; backdrop-filter: blur(4px);" title="${map.recordPet}">
                                            <div style="width: 28px; height: 28px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); border-radius: 4px;">
                                                ${petInfo?.imageUrl ? `<img src="${petInfo.imageUrl}" style="width: 100%; height: 100%; object-fit: contain;">` : `<i class="fas fa-paw text-pink-400" style="font-size: 0.7rem;"></i>`}
                                            </div>
                                            <div style="flex: 1; min-width: 0;">
                                                <div style="color: white; font-size: 0.7rem; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${map.recordPet}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style="text-align: center; color: rgba(255,255,255,0.4); font-size: 0.55rem; text-transform: uppercase; letter-spacing: 0.1em; margin-top: -5px;">Nhấn để xem chi tiết</div>
                                </div>
                            </div>
                        `;
            }).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Build edit profile HTML
     */
    async buildEditProfileHTML() {
        const user = this.currentUser || window.auth?.currentUser;

        // Get avatar from Firestore users collection
        let avatarUrl = '';
        if (user) {
            try {
                const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
                const db = getFirestore();
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    avatarUrl = userData.photoBase64 || userData.photoURL || user.photoURL || '';
                }
            } catch (error) {
                console.log('Không thể lấy avatar:', error);
                avatarUrl = user.photoURL || '';
            }
        }

        return `
            <style>
                .edit-profile-input {
                    width: 100%;
                    padding: 12px 16px;
                    background: rgba(18, 18, 26, 0.7);
                    border: 1px solid rgba(0, 243, 255, 0.2);
                    border-radius: 10px;
                    color: #e2e8f0;
                    font-size: 1rem;
                    transition: all 0.3s ease;
                }
                .edit-profile-input:focus {
                    outline: none;
                    border-color: var(--neon-cyan);
                    box-shadow: 0 0 0 3px rgba(0, 243, 255, 0.1);
                }
                .edit-profile-label {
                    display: block;
                    color: var(--neon-cyan);
                    font-weight: 600;
                    margin-bottom: 8px;
                    font-size: 0.95rem;
                }
                @media (max-width: 768px) {
                    #edit-profile-page { padding: 10px !important; }
                }
            </style>
            <div style="max-width: 800px; margin: 0 auto;">
                <!-- Header -->
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 30px;
                ">
                    <h2 style="
                        margin: 0;
                        font-size: 2rem;
                        color: var(--neon-cyan);
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    ">
                        <i class="fas fa-user-edit"></i> Chỉnh sửa hồ sơ
                    </h2>
                    <button onclick="document.getElementById('edit-profile-page').remove()" style="
                        background: rgba(255, 0, 0, 0.1);
                        border: 1px solid rgba(255, 0, 0, 0.3);
                        color: #ff4444;
                        font-size: 1.5rem;
                        cursor: pointer;
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.background='rgba(255, 0, 0, 0.2)'" onmouseout="this.style.background='rgba(255, 0, 0, 0.1)'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Edit Form -->
                <form id="edit-profile-form" style="
                    background: linear-gradient(135deg, rgba(0, 243, 255, 0.05), rgba(0, 102, 255, 0.02));
                    border: 1px solid rgba(0, 243, 255, 0.2);
                    border-radius: 20px;
                    padding: 30px;
                ">
                    <!-- Avatar Section -->
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="
                            width: 120px;
                            height: 120px;
                            border-radius: 50%;
                            background: linear-gradient(135deg, var(--neon-cyan), var(--neon-blue));
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 3rem;
                            overflow: hidden;
                            margin: 0 auto 15px;
                            position: relative;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        " id="avatar-preview" onclick="document.getElementById('avatar-input').click()" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                            ${avatarUrl && !avatarUrl.startsWith('custom_avatar_') ?
                `<img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" id="avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                <i class="fas fa-user" style="display: none;" id="avatar-icon"></i>` :
                `<i class="fas fa-user" id="avatar-icon"></i>`
            }
                            <div style="
                                position: absolute;
                                bottom: 0;
                                right: 0;
                                background: var(--neon-cyan);
                                width: 35px;
                                height: 35px;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                border: 3px solid #0a0a0f;
                            ">
                                <i class="fas fa-camera" style="color: #0a0a0f;"></i>
                            </div>
                        </div>
                        <input type="file" id="avatar-input" accept="image/*" style="display: none;">
                        <p style="color: #cbd5e0; font-size: 0.9rem;">Nhấp vào ảnh đại diện để thay đổi</p>
                    </div>

                    <!-- Display Name -->
                    <div style="margin-bottom: 20px;">
                        <label class="edit-profile-label">
                            <i class="fas fa-signature mr-2"></i>Tên hiển thị
                        </label>
                        <input type="text" id="edit-display-name" class="edit-profile-input" 
                            value="${user?.displayName || ''}" placeholder="Nhập tên hiển thị">
                    </div>

                    <!-- Email (readonly) -->
                    <div style="margin-bottom: 20px;">
                        <label class="edit-profile-label">
                            <i class="fas fa-envelope mr-2"></i>Email
                        </label>
                        <input type="email" class="edit-profile-input" 
                            value="${user?.email || ''}" readonly style="opacity: 0.6; cursor: not-allowed;">
                        <p style="color: #718096; font-size: 0.85rem; margin-top: 5px;">
                            <i class="fas fa-info-circle mr-1"></i>Email không thể thay đổi
                        </p>
                    </div>

                    <!-- Bio -->
                    <div style="margin-bottom: 20px;">
                        <label class="edit-profile-label">
                            <i class="fas fa-pen mr-2"></i>Giới thiệu bản thân
                        </label>
                        <textarea id="edit-bio" class="edit-profile-input" rows="4" 
                            placeholder="Viết vài dòng về bạn...">${this.userStats.bio || ''}</textarea>
                    </div>

                    <!-- Social Links -->
                    <div style="margin-bottom: 20px;">
                        <label class="edit-profile-label">
                            <i class="fab fa-facebook mr-2"></i>Facebook
                        </label>
                        <input type="url" id="edit-facebook" class="edit-profile-input" 
                            value="${this.userStats.socialLinks?.facebook || ''}" 
                            placeholder="https://facebook.com/yourprofile">
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label class="edit-profile-label">
                            <i class="fab fa-youtube mr-2"></i>YouTube
                        </label>
                        <input type="url" id="edit-youtube" class="edit-profile-input" 
                            value="${this.userStats.socialLinks?.youtube || ''}" 
                            placeholder="https://youtube.com/@yourchannel">
                    </div>

                    <!-- Buttons -->
                    <div style="
                        display: flex;
                        gap: 15px;
                        margin-top: 30px;
                        justify-content: flex-end;
                    ">
                        <button type="button" onclick="document.getElementById('edit-profile-page').remove()" style="
                            background: rgba(100, 100, 120, 0.2);
                            border: 1px solid rgba(100, 100, 120, 0.3);
                            color: #cbd5e0;
                            padding: 12px 30px;
                            border-radius: 10px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        " onmouseover="this.style.background='rgba(100, 100, 120, 0.3)'" onmouseout="this.style.background='rgba(100, 100, 120, 0.2)'">
                            <i class="fas fa-times mr-2"></i>Hủy
                        </button>
                        <button type="submit" style="
                            background: linear-gradient(135deg, var(--neon-cyan), var(--neon-blue));
                            border: none;
                            color: white;
                            padding: 12px 30px;
                            border-radius: 10px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 20px rgba(0, 243, 255, 0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                            <i class="fas fa-save mr-2"></i>Lưu thay đổi
                        </button>
                    </div>
                </form>
            </div>
        `;
    }

    /**
     * Setup edit profile interactions
     */
    setupEditProfileInteractions(container) {
        const form = container.querySelector('#edit-profile-form');
        const avatarInput = container.querySelector('#avatar-input');
        const avatarPreview = container.querySelector('#avatar-preview');

        // Handle avatar upload with cropping
        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.size > 2 * 1024 * 1024) {
                alert('Kích thước file không được vượt quá 2MB');
                return;
            }

            if (!file.type.startsWith('image/')) {
                alert('Vui lòng chọn file ảnh');
                return;
            }

            try {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.showCropModal(e.target.result, avatarPreview);
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('Lỗi khi xử lý ảnh:', error);
                alert('Lỗi khi xử lý ảnh. Vui lòng thử lại.');
            }
        });

        // Handle form submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveProfileChanges(container);
        });
    }

    /**
     * Show crop modal
     */
    showCropModal(imageData, previewElement) {
        // Create crop modal
        const modal = document.createElement('div');
        modal.id = 'profile-crop-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;

        modal.innerHTML = `
            <div style="
                background: var(--card-bg);
                border: 1px solid rgba(0, 243, 255, 0.3);
                border-radius: 20px;
                padding: 30px;
                max-width: 800px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
            ">
                <h3 style="color: var(--neon-cyan); font-size: 1.5rem; margin-bottom: 20px; text-align: center;">
                    <i class="fas fa-crop-alt mr-2"></i>Cắt ảnh đại diện
                </h3>
                
                <div style="margin-bottom: 20px; max-height: 400px; overflow: hidden;">
                    <img id="profile-crop-image" src="${imageData}" style="max-width: 100%; display: block;">
                </div>

                <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; justify-content: center;">
                    <button onclick="userProfileManager.rotateCropImage()" style="
                        background: rgba(0, 243, 255, 0.1);
                        border: 1px solid var(--neon-cyan);
                        color: var(--neon-cyan);
                        padding: 8px 16px;
                        border-radius: 8px;
                        cursor: pointer;
                    ">
                        <i class="fas fa-redo mr-2"></i>Quay
                    </button>
                    <button onclick="userProfileManager.flipCropImageH()" style="
                        background: rgba(0, 243, 255, 0.1);
                        border: 1px solid var(--neon-cyan);
                        color: var(--neon-cyan);
                        padding: 8px 16px;
                        border-radius: 8px;
                        cursor: pointer;
                    ">
                        <i class="fas fa-arrows-alt-h mr-2"></i>Lật ngang
                    </button>
                    <button onclick="userProfileManager.flipCropImageV()" style="
                        background: rgba(0, 243, 255, 0.1);
                        border: 1px solid var(--neon-cyan);
                        color: var(--neon-cyan);
                        padding: 8px 16px;
                        border-radius: 8px;
                        cursor: pointer;
                    ">
                        <i class="fas fa-arrows-alt-v mr-2"></i>Lật dọc
                    </button>
                </div>

                <div style="display: flex; gap: 15px; justify-content: center;">
                    <button onclick="userProfileManager.closeCropModal()" style="
                        background: rgba(100, 100, 120, 0.2);
                        border: 1px solid rgba(100, 100, 120, 0.3);
                        color: #cbd5e0;
                        padding: 12px 30px;
                        border-radius: 10px;
                        cursor: pointer;
                        font-weight: 600;
                    ">
                        <i class="fas fa-times mr-2"></i>Hủy
                    </button>
                    <button onclick="userProfileManager.applyCrop()" style="
                        background: linear-gradient(135deg, var(--neon-cyan), var(--neon-blue));
                        border: none;
                        color: white;
                        padding: 12px 30px;
                        border-radius: 10px;
                        cursor: pointer;
                        font-weight: 600;
                    ">
                        <i class="fas fa-check mr-2"></i>Áp dụng
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        // Initialize Cropper
        const cropImage = document.getElementById('profile-crop-image');
        cropImage.onload = () => {
            if (this.cropperInstance) {
                this.cropperInstance.destroy();
            }
            this.cropperInstance = new Cropper(cropImage, {
                aspectRatio: 1,
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

        // Store preview element reference
        this.avatarPreviewElement = previewElement;
    }

    /**
     * Close crop modal
     */
    closeCropModal() {
        const modal = document.getElementById('profile-crop-modal');
        if (modal) {
            modal.remove();
        }
        document.body.style.overflow = '';

        if (this.cropperInstance) {
            this.cropperInstance.destroy();
            this.cropperInstance = null;
        }
    }

    /**
     * Rotate crop image
     */
    rotateCropImage() {
        if (this.cropperInstance) {
            this.cropperInstance.rotate(45);
        }
    }

    /**
     * Flip crop image horizontally
     */
    flipCropImageH() {
        if (this.cropperInstance) {
            const data = this.cropperInstance.getData();
            this.cropperInstance.setData({
                ...data,
                scaleX: (data.scaleX || 1) * -1
            });
        }
    }

    /**
     * Flip crop image vertically
     */
    flipCropImageV() {
        if (this.cropperInstance) {
            const data = this.cropperInstance.getData();
            this.cropperInstance.setData({
                ...data,
                scaleY: (data.scaleY || 1) * -1
            });
        }
    }

    /**
     * Apply crop
     */
    async applyCrop() {
        if (!this.cropperInstance) return;

        try {
            const canvas = this.cropperInstance.getCroppedCanvas({
                maxWidth: 300,
                maxHeight: 300,
                fillColor: '#0a0a0f',
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });

            // Convert to Base64 with optimal quality
            let quality = 0.8;
            let base64 = canvas.toDataURL('image/jpeg', quality);

            // Reduce quality if still too large
            while (base64.length > 1000000 && quality > 0.1) {
                quality -= 0.1;
                base64 = canvas.toDataURL('image/jpeg', quality);
            }

            console.log('✅ Đã crop ảnh thành công, kích thước:', base64.length, 'bytes');

            // Update preview
            if (this.avatarPreviewElement) {
                const img = this.avatarPreviewElement.querySelector('#avatar-img');
                const icon = this.avatarPreviewElement.querySelector('#avatar-icon');

                if (img) {
                    img.src = base64;
                    img.style.display = 'block';
                    if (icon) icon.style.display = 'none';
                } else {
                    this.avatarPreviewElement.innerHTML = `
                        <img src="${base64}" style="width: 100%; height: 100%; object-fit: cover;" id="avatar-img">
                        <div style="
                            position: absolute;
                            bottom: 0;
                            right: 0;
                            background: var(--neon-cyan);
                            width: 35px;
                            height: 35px;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border: 3px solid #0a0a0f;
                        ">
                            <i class="fas fa-camera" style="color: #0a0a0f;"></i>
                        </div>
                    `;
                }
            }

            // Store Base64 for saving
            this.selectedAvatarBase64 = base64;

            // Close modal
            this.closeCropModal();

            if (window.notificationSystem) {
                window.notificationSystem.addNotification({
                    type: 'success',
                    title: 'Thành công',
                    message: 'Cắt ảnh thành công! Nhấn "Lưu thay đổi" để cập nhật.'
                });
            }

        } catch (error) {
            console.error('Lỗi khi crop ảnh:', error);
            alert('Lỗi khi cắt ảnh. Vui lòng thử lại.');
        }
    }

    /**
     * Save profile changes
     */
    async saveProfileChanges(container) {
        try {
            const displayName = container.querySelector('#edit-display-name').value.trim();
            const bio = container.querySelector('#edit-bio').value.trim();
            const facebook = container.querySelector('#edit-facebook').value.trim();
            const youtube = container.querySelector('#edit-youtube').value.trim();

            if (!displayName) {
                alert('Vui lòng nhập tên hiển thị!');
                return;
            }

            // Show loading
            const submitBtn = container.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Đang lưu...';
            submitBtn.disabled = true;

            // Import Firebase modules
            const { getFirestore, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
            const { getAuth, updateProfile } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");

            const auth = getAuth();
            const db = getFirestore();
            const user = auth.currentUser;

            if (!user) {
                alert('Không tìm thấy người dùng!');
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
                return;
            }

            let photoBase64 = null;
            let photoURLForAuth = user.photoURL || 'logoWS.png';

            // Handle avatar upload if changed
            if (this.selectedAvatarBase64) {
                try {
                    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Đang xử lý ảnh...';

                    photoBase64 = this.selectedAvatarBase64;

                    console.log('✅ Sử dụng ảnh đã nén, kích thước:', photoBase64.length, 'bytes');

                    // Check Base64 size (Firestore limit ~1MB per field)
                    if (photoBase64.length > 1000000) {
                        alert('Ảnh vẫn quá lớn sau nén. Vui lòng chọn ảnh khác.');
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalBtnText;
                        return;
                    }

                    // Set simple URL for Auth (just a marker)
                    photoURLForAuth = `custom_avatar_${user.uid}`;

                    // Clear temp variable
                    delete this.selectedAvatarBase64;
                } catch (uploadError) {
                    console.error('Lỗi khi xử lý ảnh:', uploadError);
                    alert('Lỗi khi xử lý ảnh. Vui lòng thử lại.');
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                    return;
                }
            }

            // Update Firebase Auth profile
            await updateProfile(user, {
                displayName: displayName,
                photoURL: photoURLForAuth
            });

            // Prepare data for Firestore
            const userDataToSave = {
                displayName: displayName,
                photoURL: photoURLForAuth,
                bio: bio,
                socialLinks: {
                    facebook: facebook,
                    youtube: youtube
                },
                updatedAt: new Date().toISOString()
            };

            // If have new Base64 image, save separately
            if (photoBase64) {
                userDataToSave.photoBase64 = photoBase64;
            }

            // Update Firestore
            await setDoc(doc(db, "users", user.uid), userDataToSave, { merge: true });

            // Update local state
            this.currentUser = {
                ...this.currentUser,
                displayName: displayName,
                photoURL: photoURLForAuth
            };
            this.userStats.bio = bio;
            this.userStats.socialLinks = { facebook, youtube };

            // Show success message
            if (window.notificationSystem) {
                window.notificationSystem.addNotification({
                    type: 'success',
                    title: 'Thành công',
                    message: 'Cập nhật hồ sơ thành công!'
                });
            } else {
                alert('Cập nhật hồ sơ thành công!');
            }

            // Close edit page and refresh profile
            container.remove();

            // Refresh profile page if it's open
            const profilePage = document.getElementById('user-profile-page');
            if (profilePage) {
                profilePage.remove();
                await this.createProfilePage();
            }

            // Update header avatar and display name
            const avatarSrc = photoBase64 || photoURLForAuth;
            const avatarElements = document.querySelectorAll('#user-avatar');
            avatarElements.forEach(el => {
                if (avatarSrc && !avatarSrc.startsWith('custom_avatar_')) {
                    el.src = avatarSrc;
                }
            });

            // Update display name in header
            const displayNameEl = document.getElementById('user-display-name');
            if (displayNameEl) {
                displayNameEl.textContent = displayName;
            }

        } catch (error) {
            console.error('Lỗi khi lưu hồ sơ:', error);
            alert('Có lỗi xảy ra: ' + error.message);

            // Restore button
            const submitBtn = container.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i>Lưu thay đổi';
                submitBtn.disabled = false;
            }
        }
    }
    buildStatCard(label, value, iconClass, color) {
        return `
            <div style="
                background: rgba(10, 10, 15, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.05);
                border-radius: 20px;
                padding: 25px;
                text-align: center;
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                position: relative;
                overflow: hidden;
            " onmouseover="this.style.borderColor='${color}'; this.style.transform='translateY(-6px)'; this.style.boxShadow='0 10px 30px rgba(0,0,0,0.5), 0 0 15px ${color}33'" onmouseout="this.style.borderColor='rgba(255, 255, 255, 0.05)'; this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                <div style="
                    width: 50px;
                    height: 50px;
                    background: ${color}15;
                    color: ${color};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 15px auto;
                    font-size: 1.5rem;
                ">
                    <i class="fas ${iconClass}"></i>
                </div>
                <div style="color: #94a3b8; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px;">${label}</div>
                <div style="font-size: 1.8rem; font-weight: 900; color: white;">${value}</div>
            </div>
        `;
    }

    /**
     * Build achievements
     */
    buildAchievements(stats) {
        const allAchievements = [
            { id: 'first-race', name: 'Lần đầu tiên', icon: '🚀', color: '#00f3ff', unlocked: (stats.totalRaces || 0) >= 1 },
            { id: 'top-3', name: 'Tay đua hạng A', icon: '🏆', color: '#ffd700', unlocked: stats.winRate > 0 },
            { id: 'pro-racer', name: 'Cựu binh', icon: '🎖️', color: '#10b981', unlocked: (stats.totalRaces || 0) >= 50 },
            { id: 'speed-demon', name: 'Tốc độ', icon: '⚡', color: '#f59e0b', unlocked: stats.recordMaps?.length > 0 },
            { id: 'collector', name: 'Nhà sưu tầm', icon: '📦', color: '#ec4899', unlocked: (stats.favoriteCars?.length || 0) >= 2 },
            { id: 'legend', name: 'Huyền thoại', icon: '👑', color: '#8b5cf6', unlocked: (stats.totalPoints || 0) >= 1000 }
        ];

        return allAchievements.map(ach => `
            <div style="
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: ${ach.unlocked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)'};
                border: 1px solid ${ach.unlocked ? ach.color + '44' : 'rgba(255,255,255,0.05)'};
                border-radius: 16px;
                transition: all 0.3s ease;
                filter: ${ach.unlocked ? 'grayscale(0)' : 'grayscale(1)'};
                opacity: ${ach.unlocked ? 1 : 0.6};
            " title="${ach.unlocked ? 'Đã đạt được' : 'Chưa mở khóa'}">
                <div style="
                    width: 40px;
                    height: 40px;
                    background: ${ach.unlocked ? ach.color + '22' : 'rgba(0,0,0,0.2)'};
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    box-shadow: ${ach.unlocked ? '0 0 10px ' + ach.color + '33' : 'none'};
                ">
                    ${ach.icon}
                </div>
                <div style="min-width: 0;">
                    <div style="color: ${ach.unlocked ? 'white' : '#64748b'}; font-size: 0.8rem; font-weight: 800; line-height: 1.2;">${ach.name}</div>
                    <div style="color: ${ach.unlocked ? ach.color : '#475569'}; font-size: 0.65rem; font-weight: 700; text-transform: uppercase;">
                        ${ach.unlocked ? '✓ Unlocked' : 'Locked'}
                    </div>
                </div>
            </div>
        `).join('');
    }

    async showRecordDetail(mapId) {
        try {
            const map = this.userStats.recordMaps.find(m => m.id === mapId);
            if (!map) return;

            const carInfo = (window.ALL_CARS || []).find(c => (c.name || '').trim() === (map.recordCar || '').trim());
            const petInfo = (window.ALL_PETS || []).find(p => (p.name || '').trim() === (map.recordPet || '').trim());

            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.9);
                backdrop-filter: blur(10px);
                z-index: 6000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                animation: fadeIn 0.3s ease;
            `;

            modal.innerHTML = `
                <div style="
                    background: #0a0a0f;
                    border: 1px solid rgba(255, 215, 0, 0.3);
                    border-radius: 24px;
                    width: 100%;
                    max-width: 500px;
                    overflow: hidden;
                    box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 30px rgba(255, 215, 0, 0.1);
                ">
                    <div style="position: relative; height: 200px; background: url('${map.imageUrl || 'assets/images/default-map.jpg'}') center center / cover no-repeat;">
                        <div style="position: absolute; inset: 0; background: linear-gradient(0deg, #0a0a0f 0%, transparent 100%);"></div>
                        <button onclick="this.closest('div').parentElement.parentElement.remove()" style="
                            position: absolute;
                            top: 20px;
                            right: 20px;
                            background: rgba(0,0,0,0.5);
                            border: 1px solid rgba(255,255,255,0.2);
                            color: white;
                            width: 35px;
                            height: 35px;
                            border-radius: 50%;
                            cursor: pointer;
                        "><i class="fas fa-times"></i></button>
                    </div>

                    <div style="padding: 30px; text-align: center;">
                        <div style="color: #FFD700; font-size: 0.8rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 8px;">Kỷ Lục Bản Đồ</div>
                        <h2 style="color: white; font-size: 2rem; font-weight: 900; margin: 0 0 20px 0; text-transform: uppercase;">${map.name}</h2>
                        
                        <div style="background: rgba(255, 215, 0, 0.1); border: 1px solid rgba(255, 215, 0, 0.3); border-radius: 16px; padding: 20px; margin-bottom: 30px;">
                            <div style="color: #FFD700; font-size: 0.9rem; margin-bottom: 5px;">Thời gian tốt nhất</div>
                            <div style="color: white; font-size: 2.5rem; font-weight: 900; font-family: monospace;">${map.recordTime}</div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px;">
                                <div style="width: 80px; height: 80px; margin: 0 auto 15px auto; display: flex; align-items: center; justify-content: center;">
                                    ${carInfo?.imageUrl ? `<img src="${carInfo.imageUrl}" style="width: 100%; height: 100%; object-fit: contain;">` : `<i class="fas fa-car text-cyan-400 text-3xl"></i>`}
                                </div>
                                <div style="color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 5px;">Xe sử dụng</div>
                                <div style="color: white; font-weight: bold;">${map.recordCar}</div>
                            </div>

                            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 20px;">
                                <div style="width: 80px; height: 80px; margin: 0 auto 15px auto; display: flex; align-items: center; justify-content: center;">
                                    ${petInfo?.imageUrl ? `<img src="${petInfo.imageUrl}" style="width: 100%; height: 100%; object-fit: contain;">` : `<i class="fas fa-paw text-pink-400 text-3xl"></i>`}
                                </div>
                                <div style="color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; margin-bottom: 5px;">Thú cưng</div>
                                <div style="color: white; font-weight: bold;">${map.recordPet}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
        } catch (error) {
            console.error('Lỗi khi hiển thị chi tiết kỷ lục:', error);
        }
    }

    /**
     * Setup profile interactions
     */
    setupProfileInteractions(container) {
        // Add event listeners here
    }

    /**
     * Load record maps for user
     */
    async loadRecordMaps(userNickname) {
        try {
            const { getFirestore, collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
            const db = getFirestore();

            console.log('🏆 Đang tìm bản đồ kỷ lục cho:', userNickname);

            const q = query(collection(db, "gameMaps"), where("recordRacer", "==", userNickname));
            const mapsSnapshot = await getDocs(q);

            if (mapsSnapshot.empty) {
                console.log('⚠️ Không có gameMaps trong Firestore');
                return [];
            }

            const recordMaps = [];
            mapsSnapshot.forEach(doc => {
                const mapData = doc.data();

                // Kiểm tra xem người dùng có nắm giữ kỷ lục không
                if (mapData.recordRacer === userNickname) {
                    recordMaps.push({
                        id: doc.id,
                        name: mapData.name || doc.id,
                        imageUrl: mapData.imageUrl || '',
                        recordTime: mapData.recordTime || '—',
                        recordCar: mapData.recordCar || '—',
                        recordPet: mapData.recordPet || '—',
                        recordRacer: mapData.recordRacer
                    });
                }
            });

            console.log(`🎯 Tìm thấy ${recordMaps.length} bản đồ có kỷ lục`);
            return recordMaps;
        } catch (error) {
            console.error('❌ Lỗi khi tải record maps:', error);
            return [];
        }
    }

    /**
     * Load user stats
     */
    async loadUserStats(targetUid = null) {
        try {
            // Get current user from Firebase Auth or window.auth
            let user = this.currentUser;

            if (!user && window.auth && window.auth.currentUser) {
                user = window.auth.currentUser;
                this.currentUser = user;
            }

            if (!user && !targetUid) {
                console.warn('⚠️ Không tìm thấy user đang đăng nhập');
                this.userStats = this.getPlaceholderStats();
                if (window.notificationSystem) {
                    window.notificationSystem.addNotification({
                        type: 'warning',
                        title: 'Thông báo',
                        message: 'Vui lòng đăng nhập để xem hồ sơ cá nhân'
                    });
                }
                return;
            }

            const userId = targetUid || user.uid;
            console.log('👤 User đang xem:', userId);

            // Import Firestore functions
            const { getFirestore, doc, getDoc, collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
            const db = getFirestore();

            // Load user profile data from Firestore and get nickname
            let userNickname = '';
            try {
                const userDoc = await getDoc(doc(db, "users", userId));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (!targetUid) this.currentUserData = userData; // Lưu để dùng lại
                    this.userStats.bio = userData.bio || '';
                    this.userStats.socialLinks = userData.socialLinks || {};
                    userNickname = userData.nickname || userData.displayName || (user ? user.displayName : '') || '';
                    console.log('✅ Đã tải user profile từ Firestore');
                    console.log('🏷️ Nickname:', userNickname);
                }
            } catch (error) {
                console.log('⚠️ Không thể tải profile data:', error);
                // Vẫn tiếp tục với displayName nếu có lỗi
                userNickname = user ? user.displayName : '';
                console.log('ℹ️ Sử dụng displayName thay thế:', userNickname);
            }

            if (!userNickname) {
                console.warn('⚠️ Không tìm thấy nickname, dùng displayName');
                userNickname = user ? user.displayName : '';
            }

            // Load record maps
            const recordMaps = await this.loadRecordMaps(userNickname);
            this.userStats.recordMaps = recordMaps;

            // Get all race records and filter by nickname
            const q = query(collection(db, "raceRecords"), where("racerName", "==", userNickname));
            const recordsSnapshot = await getDocs(q);

            if (recordsSnapshot.empty) {
                console.log('⚠️ Không có race records trong Firestore');

                // Fallback: Try to get data from localStorage
                const localRaces = this.loadFromLocalStorage(userNickname);
                if (localRaces.length > 0) {
                    console.log('📦 Sử dụng dữ liệu từ localStorage');
                    this.calculateStatsFromRaces(localRaces);
                    return;
                }

                console.log('❌ Không có dữ liệu, hiển thị placeholder');
                this.userStats = this.getPlaceholderStats();
                return;
            }

            // Calculate stats from records
            const userRecords = recordsSnapshot.docs.map(doc => doc.data());
            console.log(`📊 Tìm thấy ${userRecords.length} records cho ${userNickname}`);

            if (userRecords.length === 0) {
                console.log('⚠️ Không tìm thấy records trong Firestore, thử localStorage');
                // Try localStorage as fallback
                const localRaces = this.loadFromLocalStorage(userNickname);
                if (localRaces.length > 0) {
                    console.log('📦 Sử dụng dữ liệu từ localStorage');
                    this.calculateStatsFromRaces(localRaces);
                    return;
                }

                console.log('❌ Không có dữ liệu, hiển thị placeholder');
                this.userStats = this.getPlaceholderStats();
                return;
            }

            // Calculate stats from records
            this.calculateStatsFromRaces(userRecords);

        } catch (error) {
            console.error('❌ Lỗi khi tải thống kê:', error);
            this.userStats = this.getPlaceholderStats();
        }
    }

    /**
     * Load data from localStorage
     */
    loadFromLocalStorage(userNickname) {
        try {
            const allRaces = JSON.parse(localStorage.getItem('allRaces') || '[]');

            if (!userNickname) {
                console.log('⚠️ Không có nickname để tìm trong localStorage');
                return [];
            }

            // Filter races by user's nickname
            const userRaces = [];
            allRaces.forEach(race => {
                if (race.maps) {
                    race.maps.forEach(map => {
                        if (map.racers) {
                            map.racers.forEach((racer, index) => {
                                if (racer.name === userNickname && racer.time) {
                                    userRaces.push({
                                        racerName: racer.name,
                                        timeString: racer.time,
                                        car: racer.car || '',
                                        pet: racer.pet || '',
                                        position: index + 1,
                                        points: racer.points || 0
                                    });
                                }
                            });
                        }
                    });
                }
            });

            console.log(`📦 Tìm thấy ${userRaces.length} races từ localStorage cho nickname: ${userNickname}`);
            return userRaces;
        } catch (error) {
            console.error('Lỗi khi đọc localStorage:', error);
            return [];
        }
    }

    /**
     * Calculate stats from race records
     */
    calculateStatsFromRaces(records) {
        const totalRaces = records.length;

        // Find best position
        const positions = records.map(r => parseInt(r.position || r.racerIndex + 1)).filter(p => !isNaN(p));
        const topPosition = positions.length > 0 ? Math.min(...positions) : null;

        // Find best time
        const times = records.map(r => {
            const timeStr = r.timeString || r.time;
            return this.timeToSeconds(timeStr);
        }).filter(t => t > 0);
        const bestTimeSeconds = times.length > 0 ? Math.min(...times) : null;
        const bestTime = bestTimeSeconds ? this.secondsToTimeString(bestTimeSeconds) : null;

        // Calculate win rate (assuming position 1-3 is a win)
        const wins = records.filter(r => {
            const pos = parseInt(r.position || r.racerIndex + 1);
            return pos <= 3;
        }).length;
        const winRate = totalRaces > 0 ? ((wins / totalRaces) * 100).toFixed(1) : 0;

        // Calculate total points
        const totalPoints = records.reduce((sum, r) => sum + (parseInt(r.points) || 0), 0);

        // Favorite cars
        const carCounts = {};
        records.forEach(r => {
            if (r.car) {
                carCounts[r.car] = (carCounts[r.car] || 0) + 1;
            }
        });
        const favoriteCars = Object.entries(carCounts)
            .map(([name, uses]) => ({ name, uses }))
            .sort((a, b) => b.uses - a.uses)
            .slice(0, 5);

        // Favorite pets
        const petCounts = {};
        records.forEach(r => {
            if (r.pet) {
                petCounts[r.pet] = (petCounts[r.pet] || 0) + 1;
            }
        });
        const favoritePets = Object.entries(petCounts)
            .map(([name, uses]) => ({ name, uses }))
            .sort((a, b) => b.uses - a.uses)
            .slice(0, 5);

        this.userStats = {
            ...this.userStats,
            totalRaces,
            topPosition: topPosition ? `${topPosition}${this.getOrdinalSuffix(topPosition)}` : '—',
            bestTime: bestTime || '—',
            winRate: winRate,
            totalPoints,
            favoriteCars,
            favoritePets
        };

        console.log('✅ Stats calculated:', this.userStats);
    }

    /**
     * Get placeholder stats
     */
    getPlaceholderStats() {
        return {
            totalRaces: 0,
            topPosition: '—',
            bestTime: '—',
            winRate: 0,
            totalPoints: 0,
            favoriteCars: [],
            favoritePets: [],
            recordMaps: [],
            bio: 'Chào mừng bạn đến với hồ sơ cá nhân! Hãy tham gia đua xe để xem thống kê của bạn.',
            socialLinks: {}
        };
    }

    /**
     * Convert time string to seconds
     */
    timeToSeconds(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return 0;

        // Format: mm'ss'ms
        const match = timeStr.match(/(\d+)'(\d+)'(\d+)/);
        if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const milliseconds = parseInt(match[3]);
            return minutes * 60 + seconds + milliseconds / 100;
        }
        return 0;
    }

    /**
     * Convert seconds to time string
     */
    secondsToTimeString(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${String(minutes).padStart(2, '0')}'${String(secs).padStart(2, '0')}'${String(ms).padStart(2, '0')}`;
    }

    /**
     * Get ordinal suffix for numbers (1st, 2nd, 3rd, etc.)
     */
    getOrdinalSuffix(num) {
        const j = num % 10;
        const k = num % 100;
        if (j === 1 && k !== 11) return 'st';
        if (j === 2 && k !== 12) return 'nd';
        if (j === 3 && k !== 13) return 'rd';
        return 'th';
    }

    /**
     * Lấy user profile URL
     */
    getProfileURL(userId) {
        return `profile.html?user=${userId}`;
    }

    /**
     * Update profile picture
     */
    async updateProfilePicture(file) {
        // Implement file upload
        return { success: true };
    }

    /**
     * Get profile summary widget
     */
    getProfileWidget() {
        return `
            <div style="
                background: rgba(18, 18, 26, 0.7);
                border: 1px solid rgba(0, 243, 255, 0.1);
                border-radius: 12px;
                padding: 16px;
                cursor: pointer;
                transition: all 0.3s ease;
            " onclick="userProfileManager.createProfilePage()">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="
                        width: 50px;
                        height: 50px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, var(--neon-cyan), var(--neon-blue));
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <i class="fas fa-user"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: var(--neon-cyan);">${this.currentUser?.displayName || 'User'}</div>
                        <div style="font-size: 0.85rem; color: #cbd5e0;">📊 Level ${Math.floor((this.userStats.totalPoints || 0) / 100)}</div>
                    </div>
                </div>
            </div>
        `;
    }
}

// Khởi tạo singleton
const userProfileManager = new UserProfileManager();

// Gán vào window để có thể truy cập toàn cục
window.userProfileManager = userProfileManager;

// Export cho các module khác
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { userProfileManager };
}
