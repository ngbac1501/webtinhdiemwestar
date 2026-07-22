import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged
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
    onSnapshot,
    arrayUnion,
    arrayRemove,
    increment,
    serverTimestamp,
    where,
    collectionGroup
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ─── Firebase Config ──────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyDtFpBAuZ_3JHmMXq1uVShq4sm0zK9xqEI",
    authDomain: "tinhdiemtheog.firebaseapp.com",
    projectId: "tinhdiemtheog",
    storageBucket: "tinhdiemtheog.firebasestorage.app",
    messagingSenderId: "52564586448",
    appId: "1:52564586448:web:983bdc321423b81f5a53d5",
    measurementId: "G-PFTMHMTF6J"
};

// Init Firebase (avoid duplicate apps)
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ─── State ────────────────────────────────────────────────────────────────────
let allMaps = [];
let currentMapId = null;
let currentUser = null;
let currentUserProfile = null; // Cached Firestore profile (photoBase64, photoURL, etc.)
let commentsUnsubscribe = null;
let likesUnsubscribe = null;
let userProfileCache = {}; // uid -> { photoBase64, photoURL, displayName }
let cachedComments = []; // Stores loaded comments of the currently selected map
let currentCommentSort = 'asc'; // 'asc' = oldest first, 'desc' = newest first
let currentCommentPage = 1;
const commentsPerPage = 10;

// Guest fingerprint (for non-logged-in users)
function getGuestId() {
    let gid = localStorage.getItem('discuss_guest_id');
    if (!gid) {
        gid = 'guest_' + Math.random().toString(36).substr(2, 12) + '_' + Date.now();
        localStorage.setItem('discuss_guest_id', gid);
    }
    return gid;
}

function getEffectiveUserId() {
    return currentUser ? currentUser.uid : getGuestId();
}

function getEffectiveUserName() {
    if (currentUser) {
        return currentUser.displayName || currentUser.email?.split('@')[0] || 'Người dùng';
    }
    const saved = localStorage.getItem('discuss_guest_name');
    return saved || null;
}

// ─── Auth Guard ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    currentUserProfile = null;

    if (!user) {
        // Not logged in → redirect to home with a message
        sessionStorage.setItem('discuss_redirect_msg', 'Bạn cần đăng nhập để vào Diễn Đàn.');
        window.location.replace('./index.html');
        return;
    }

    // Fetch Firestore profile for avatar & nickname
    try {
        const { getDoc, doc: firestoreDoc } = await import(
            'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
        );
        const snap = await getDoc(firestoreDoc(db, 'users', user.uid));
        if (snap.exists()) {
            currentUserProfile = snap.data();
            userProfileCache[user.uid] = currentUserProfile;
        }
    } catch (e) {
        console.warn('Could not load user profile:', e);
    }

    updateAuthUI();
    updateCommentFormAuth();

    // If map is currently selected, trigger reload so that admin buttons render immediately
    if (currentMapId) {
        listenToDiscussion(currentMapId);
    }
});

function isCurrentUserAdmin() {
    return currentUserProfile && (currentUserProfile.isAdmin === true || currentUserProfile.role === 'admin');
}

function updateAuthUI() {
    const authInfo = document.getElementById('auth-info');
    if (!authInfo) return;
    if (currentUser) {
        const name = currentUser.displayName || currentUser.email?.split('@')[0] || 'Người dùng';
        authInfo.textContent = name;
    } else {
        authInfo.textContent = 'Khách';
    }
}

// Resolve avatar src: photoBase64 > photoURL > null
function resolveAvatar(profile) {
    if (!profile) return null;
    if (profile.photoBase64) return profile.photoBase64;
    if (profile.photoURL && profile.photoURL !== 'logoWS.png') return profile.photoURL;
    return null;
}

// Global fallback for img onerror (avoids HTML quote escaping issues in onerror attribute)
window._avatarErr = function(el, initials, sizeClass, colorClass) {
    const div = document.createElement('div');
    div.className = `${sizeClass} rounded-full ${colorClass} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`;
    div.textContent = initials;
    el.parentNode?.replaceChild(div, el);
};

// Build avatar HTML (img or initials fallback)
function buildAvatar(src, name, sizeClass = 'w-8 h-8', colorClass = 'bg-purple-600') {
    const initials = (name || 'A').charAt(0).toUpperCase();
    const avatarColors = ['bg-purple-600','bg-cyan-600','bg-pink-600','bg-blue-600','bg-emerald-600','bg-orange-600'];
    const color = colorClass !== 'bg-purple-600' ? colorClass : avatarColors[(name || '').charCodeAt(0) % avatarColors.length];
    if (src) {
        // Use single-quoted onerror to avoid double-quote conflict; pass args safely via data attributes
        return `<img src="${escHtml(src)}" class="${sizeClass} rounded-full object-cover flex-shrink-0 border border-white/10"
            onerror="_avatarErr(this,'${initials}','${sizeClass}','${color}')">`;
    }
    return `<div class="${sizeClass} rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0">${initials}</div>`;
}


// Update the author row in comment form based on login state
function updateCommentFormAuth() {
    const wrap = document.getElementById('comment-author-wrap');
    if (!wrap) return;

    if (currentUser) {
        const name = currentUserProfile?.nickname
            || currentUserProfile?.displayName
            || currentUser.displayName
            || currentUser.email?.split('@')[0]
            || 'Người dùng';
        const avatarSrc = resolveAvatar(currentUserProfile);
        const avatarHTML = buildAvatar(avatarSrc, name, 'w-7 h-7', 'bg-purple-600');
        wrap.innerHTML = `
            <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
                ${avatarHTML}
                <span class="text-sm text-purple-200 font-medium truncate">${escHtml(name)}</span>
                <span class="ml-auto text-xs text-purple-400/70 flex-shrink-0 flex items-center gap-1">
                    <i class="fas fa-check-circle"></i>Đã đăng nhập
                </span>
            </div>`;
    } else {
        const savedName = localStorage.getItem('discuss_guest_name') || '';
        wrap.innerHTML = `
            <input type="text" id="comment-author" value="${escHtml(savedName)}"
                placeholder="Tên của bạn (tuỳ chọn)"
                class="w-full bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors" />`;
    }
}

// ─── Load All Maps ────────────────────────────────────────────────────────────
async function loadAllMaps() {
    try {
        const snap = await getDocs(collection(db, 'gameMaps'));
        allMaps = [];
        snap.forEach(docSnap => {
            const d = docSnap.data();
            allMaps.push({ id: docSnap.id, ...d });
        });
        allMaps.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    } catch (e) {
        console.error('Failed to load maps:', e);
    }
}

// ─── Search ───────────────────────────────────────────────────────────────────
function buildDropdownHTML(maps) {
    if (maps.length === 0) {
        return `<div class="px-4 py-3 text-slate-400 text-sm text-center">Không tìm thấy bản đồ</div>`;
    }
    return maps.map(m => `
        <button class="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-all duration-150 border-b border-slate-700/20 last:border-0"
            onclick="selectMap('${m.id}')">
            <div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-700 flex items-center justify-center">
                ${m.imageUrl
                ? `<img src="${m.imageUrl}" class="w-full h-full object-cover" onerror="this.style.display='none'">`
                : `<i class="fas fa-map text-slate-500 text-xs"></i>`}
            </div>
            <div class="flex-1 min-w-0">
                <div class="font-semibold text-white text-sm truncate">${escHtml(m.name || 'Bản đồ')}</div>
                <div class="text-xs text-slate-400">${escHtml(m.difficulty || '')}${m.recordTime ? ' · ⏱ ' + escHtml(m.recordTime) : ''}</div>
            </div>
            ${(m.videoUrl || m.bestRecordVideo) ? '<i class="fas fa-video text-cyan-400 text-xs flex-shrink-0"></i>' : ''}
        </button>
    `).join('');
}

function updateClearButtons() {
    const desktopInput = document.getElementById('map-search-input');
    const mobileInput = document.getElementById('map-search-input-mobile');

    // Desktop
    if (desktopInput) {
        const hasText = desktopInput.value.length > 0;
        const btn = document.getElementById('clear-search-btn');
        const icon = document.getElementById('search-map-icon');
        if (btn) btn.classList.toggle('hidden', !hasText);
        if (icon) icon.classList.toggle('hidden', hasText);
    }

    // Mobile
    if (mobileInput) {
        const hasText = mobileInput.value.length > 0;
        const btn = document.getElementById('clear-search-btn-mobile');
        if (btn) btn.classList.toggle('hidden', !hasText);
    }
}

window.clearSearch = function() {
    const input = document.getElementById('map-search-input');
    if (input) {
        input.value = '';
        updateClearButtons();
        const dropdown = document.getElementById('search-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    }
};

window.clearSearchMobile = function() {
    const input = document.getElementById('map-search-input-mobile');
    if (input) {
        input.value = '';
        updateClearButtons();
        const dropdown = document.getElementById('search-dropdown-mobile');
        if (dropdown) dropdown.classList.add('hidden');
    }
};

function wireSearchInput(inputEl, dropdownEl) {
    if (!inputEl || !dropdownEl) return;

    inputEl.addEventListener('input', () => {
        updateClearButtons();
        const q = inputEl.value.trim().toLowerCase();
        if (!q) { dropdownEl.classList.add('hidden'); return; }
        const filtered = allMaps.filter(m => (m.name || '').toLowerCase().includes(q)).slice(0, 8);
        dropdownEl.innerHTML = buildDropdownHTML(filtered);
        dropdownEl.classList.remove('hidden');
    });
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') dropdownEl.classList.add('hidden');
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrap')) dropdownEl.classList.add('hidden');
    });
}

function initSearch() {
    // Desktop
    wireSearchInput(
        document.getElementById('map-search-input'),
        document.getElementById('search-dropdown')
    );
    // Mobile
    wireSearchInput(
        document.getElementById('map-search-input-mobile'),
        document.getElementById('search-dropdown-mobile')
    );
    updateClearButtons();
}



// ─── Select Map ───────────────────────────────────────────────────────────────
window.selectMap = function(mapId) {
    // Close all dropdowns
    ['search-dropdown', 'search-dropdown-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const map = allMaps.find(m => m.id === mapId);
    if (!map) return;

    // Update search inputs
    ['map-search-input', 'map-search-input-mobile'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = map.name || '';
    });
    currentMapId = mapId;
    updateClearButtons();

    // Update URL
    const url = new URL(window.location);
    url.searchParams.set('map', mapId);
    window.history.pushState({}, '', url);

    renderMapCard(map);
    updateCommentFormAuth(); // Apply auth state to newly rendered form

    listenToDiscussion(mapId);

    // Scroll to discussion on mobile
    const area = document.getElementById('discussion-area');
    if (area && window.innerWidth < 880) {
        setTimeout(() => area.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
};

function getStarCount(difficulty) {
    const starCounts = {
        "Cực khó": 7,
        "7 sao": 7,
        "Cực khó (7 sao)": 7,
        "Rất khó": 6,
        "6 sao": 6,
        "Rất khó (6 sao)": 6,
        "Khó": 5,
        "5 sao": 5,
        "Khó (5 sao)": 5,
        "Trung bình": 4,
        "4 sao": 4,
        "Trung bình (4 sao)": 4,
        "Dễ": 3,
        "3 sao": 3,
        "Dễ (3 sao)": 3
    };
    return starCounts[difficulty] || 0;
}

function renderMapCard(map) {
    const area = document.getElementById('discussion-area');
    if (!area) return;

    const hasVideo = !!(map.videoUrl || map.bestRecordVideo);
    const videoUrl = map.videoUrl || map.bestRecordVideo || '';

    const starCount = getStarCount(map.difficulty);
    const starsHTML = starCount > 0 ? `
        <div class="absolute top-3 left-3 z-20 flex gap-0.5 bg-black/40 border border-white/10 px-2 py-1 rounded-lg backdrop-blur-sm">
            ${Array(starCount).fill(0).map(() => `<i class="fas fa-star text-yellow-400 text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"></i>`).join('')}
        </div>
    ` : '';

    area.innerHTML = `
        <div id="map-card" class="discuss-card animate__animated animate__fadeInUp animate__faster">
            <div class="map-card-header relative overflow-hidden rounded-xl mb-4 bg-slate-950">
                ${map.imageUrl
                ? `<img src="${map.imageUrl}" class="w-full h-56 sm:h-72 md:h-80 object-cover rounded-xl brightness-[0.6] transition-all duration-300" alt="${map.name}"
                       onerror="this.parentNode.innerHTML='<div class=\\'w-full h-56 sm:h-72 md:h-80 bg-slate-800 rounded-xl flex items-center justify-center\\'><i class=\\'fas fa-map text-4xl text-slate-600\\'></i></div>'">`
                : `<div class="w-full h-56 sm:h-72 md:h-80 bg-slate-800 rounded-xl flex items-center justify-center"><i class="fas fa-map text-4xl text-slate-600"></i></div>`}
                ${starsHTML}
                <div class="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent rounded-xl"></div>
                <div class="absolute bottom-3 left-4 right-4">
                    <h2 class="text-xl font-bold text-white font-orbitron">${map.name || 'Bản đồ'}</h2>
                    <div class="flex items-center gap-3 mt-1 flex-wrap">
                        ${map.recordTime ? `<span class="text-xs text-slate-300"><i class="fas fa-stopwatch mr-1"></i>${map.recordTime}</span>` : ''}
                        ${map.recordRacer ? `<span class="text-xs text-slate-300"><i class="fas fa-user mr-1"></i>${map.recordRacer}</span>` : ''}
                    </div>
                </div>
                ${hasVideo ? `
                <div class="absolute inset-0 flex items-center justify-center z-20">
                    <button onclick="openVideoPlayer('${escHtml(videoUrl)}', '${escHtml(map.name || 'Bản đồ')}')"
                        class="btn-play-video group cursor-pointer">
                        <div class="relative flex items-center justify-center w-20 h-20 rounded-full bg-cyan-500/30 border-2 border-cyan-400/80 backdrop-blur-md hover:bg-cyan-500/60 shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:shadow-[0_0_50px_rgba(6,182,212,0.8)] transition-all duration-300 transform group-hover:scale-110">
                            <i class="fas fa-play text-white text-3xl ml-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"></i>
                            <div class="absolute inset-[-6px] rounded-full border border-cyan-400/40 animate-ping opacity-60"></div>
                        </div>
                    </button>
                </div>` : ''}
            </div>
            <!-- Map Description -->
            ${map.description ? `<p class="text-sm text-slate-400 mb-4 px-1">${escHtml(map.description)}</p>` : ''}

            <!-- Action Buttons -->
            <div class="flex items-center gap-3 mb-5">
                <button id="like-btn" onclick="toggleLike()" 
                    class="action-btn flex items-center gap-2 px-4 py-2 rounded-lg border transition-all duration-200 group">
                    <i class="fas fa-heart text-base transition-transform group-hover:scale-125"></i>
                    <span id="like-count" class="text-sm font-semibold">0</span>
                    <span class="text-xs hidden sm:inline">Thích</span>
                </button>

                <button onclick="scrollToComments()" 
                    class="action-btn-ghost flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600/50 text-slate-300 hover:border-purple-500/50 hover:text-purple-300 transition-all duration-200">
                    <i class="fas fa-comment-dots text-base"></i>
                    <span id="comment-count" class="text-sm font-semibold">0</span>
                    <span class="text-xs hidden sm:inline">Bình luận</span>
                </button>

                <button onclick="shareMap()" 
                    class="action-btn-ghost flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600/50 text-slate-300 hover:border-green-500/50 hover:text-green-300 transition-all duration-200 ml-auto">
                    <i class="fas fa-share-nodes text-base"></i>
                    <span class="text-xs hidden sm:inline">Chia sẻ</span>
                </button>
            </div>

            <!-- Comment Section -->
            <div id="comment-section">
                <h3 class="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <i class="fas fa-comments text-purple-400"></i> Bình luận
                </h3>

                <!-- Add Comment Form -->
                <div class="add-comment-form mb-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <div id="comment-author-wrap" class="mb-2">
                        <!-- Filled dynamically based on auth state -->
                    </div>
                    <div class="flex gap-2">
                        <textarea id="comment-text" rows="2" placeholder="Nhập bình luận của bạn..."
                            class="flex-1 bg-slate-900/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60 transition-colors resize-none"></textarea>
                        <button onclick="submitComment()" id="submit-comment-btn"
                            class="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all duration-200 hover:scale-105 self-end flex-shrink-0">
                            <i class="fas fa-paper-plane mr-1"></i> Gửi
                        </button>
                    </div>
                </div>

                <!-- Comment Toolbar -->
                <div id="comment-toolbar" class="hidden"></div>

                <!-- Comments List -->
                <div id="comments-list" class="space-y-3">
                    <div class="text-center py-6 text-slate-500 text-sm">
                        <i class="fas fa-spinner fa-spin mr-2"></i> Đang tải bình luận...
                    </div>
                </div>
            </div>
        </div>
    `;
}

function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getDifficultyColor(d) {
    const map = {
        '3 sao': 'bg-green-500/20 text-green-300 border border-green-500/30',
        '4 sao': 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        '5 sao': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
        '6 sao': 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
        '7 sao': 'bg-red-500/20 text-red-300 border border-red-500/30',
        'Dễ': 'bg-green-500/20 text-green-300 border border-green-500/30',
        'Dễ (3 sao)': 'bg-green-500/20 text-green-300 border border-green-500/30',
        'Trung bình': 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        'Trung bình (4 sao)': 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
        'Khó': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
        'Khó (5 sao)': 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
        'Rất khó': 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
        'Rất khó (6 sao)': 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
        'Cực khó': 'bg-red-500/20 text-red-300 border border-red-500/30',
        'Cực khó (7 sao)': 'bg-red-500/20 text-red-300 border border-red-500/30',
    };
    return map[d] || 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
}

// ─── Realtime Listeners ───────────────────────────────────────────────────────
function listenToDiscussion(mapId) {
    // Cleanup old listeners
    if (commentsUnsubscribe) commentsUnsubscribe();
    if (likesUnsubscribe) likesUnsubscribe();

    const discussDocRef = doc(db, 'mapDiscussions', mapId);

    // Listen to likes
    likesUnsubscribe = onSnapshot(discussDocRef, (snap) => {
        const data = snap.exists() ? snap.data() : {};
        const likes = data.likes || [];
        const count = likes.length;
        const uid = getEffectiveUserId();
        const liked = likes.includes(uid);

        const btn = document.getElementById('like-btn');
        const countEl = document.getElementById('like-count');
        if (countEl) countEl.textContent = count;
        if (btn) {
            if (liked) {
                btn.className = 'action-btn flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/60 text-red-400 bg-red-500/10 transition-all duration-200 group liked';
            } else {
                btn.className = 'action-btn flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600/50 text-slate-300 hover:border-red-500/50 hover:text-red-400 transition-all duration-200 group';
            }
        }
    });

    // Listen to comments
    const commentsRef = collection(db, 'mapDiscussions', mapId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    commentsUnsubscribe = onSnapshot(q, (snap) => {
        cachedComments = [];
        snap.forEach(d => cachedComments.push({ id: d.id, ...d.data() }));

        const totalPages = Math.ceil(cachedComments.length / commentsPerPage);
        if (currentCommentPage > totalPages) {
            currentCommentPage = Math.max(1, totalPages);
        }

        renderCommentsList(mapId);

        const countEl = document.getElementById('comment-count');
        if (countEl) countEl.textContent = cachedComments.length;
    });
}

// ─── Comments & Sorting & Pagination ───────────────────────────────────────────
function renderCommentsList(mapId) {
    const list = document.getElementById('comments-list');
    const toolbar = document.getElementById('comment-toolbar');
    if (!list) return;

    if (cachedComments.length === 0) {
        if (toolbar) toolbar.classList.add('hidden');
        list.innerHTML = `
            <div class="text-center py-8 text-slate-500 text-sm">
                <i class="fas fa-comment-slash text-2xl mb-2 block opacity-40"></i>
                Chưa có bình luận nào. Hãy là người đầu tiên!
            </div>`;
        return;
    }

    const sortedComments = [...cachedComments].sort((a, b) => {
        const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
        const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
        return currentCommentSort === 'asc' ? timeA - timeB : timeB - timeA;
    });

    const totalPages = Math.ceil(sortedComments.length / commentsPerPage);
    const startIdx = (currentCommentPage - 1) * commentsPerPage;
    const paginatedComments = sortedComments.slice(startIdx, startIdx + commentsPerPage);

    if (toolbar) {
        toolbar.classList.remove('hidden');
        renderCommentToolbar(totalPages);
    }

    const uid = getEffectiveUserId();
    const isAdmin = isCurrentUserAdmin();

    list.innerHTML = paginatedComments.map(c => {
        const isOwner = c.userId === uid;
        const canDelete = isOwner || isAdmin;
        const canEdit = isOwner;
        const timeStr = formatTime(c.createdAt);

        const cachedProfile = c.userId ? userProfileCache[c.userId] : null;
        const avatarSrc = resolveAvatar(cachedProfile) || c.avatarUrl || null;
        const avatarHTML = buildAvatar(avatarSrc, c.author || 'A', 'w-8 h-8');

        return `
            <div id="comment-${c.id}" class="comment-item flex gap-3 animate__animated animate__fadeInUp animate__faster rounded-xl p-2 transition-all duration-500">
                ${avatarHTML}
                <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2 mb-0.5">
                        <span class="text-sm font-semibold text-white">${escHtml(c.author || 'Ẩn danh')}</span>
                        <span class="text-xs text-slate-500">${timeStr}</span>
                        ${(canEdit || canDelete) ? `
                        <div class="comment-actions ml-auto flex items-center gap-1.5 flex-shrink-0">
                            ${canEdit ? `
                            <button onclick="startEditComment('${mapId}', '${c.id}', this)" class="text-xs text-slate-500 hover:text-purple-400 transition-colors flex-shrink-0">
                                <i class="fas fa-edit mr-0.5"></i>Sửa
                            </button>
                            ` : ''}
                            ${(canEdit && canDelete) ? `<span class="text-slate-700 text-[10px]">|</span>` : ''}
                            ${canDelete ? `
                            <button onclick="deleteComment('${mapId}', '${c.id}')" class="text-xs text-slate-500 hover:text-red-400 transition-colors flex-shrink-0">
                                <i class="fas fa-trash-alt mr-0.5"></i>Xóa
                            </button>
                            ` : ''}
                        </div>
                        ` : ''}
                    </div>
                    <div class="comment-content text-sm text-slate-300 break-words mt-0.5">${escHtml(c.text || '')}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderCommentToolbar(totalPages) {
    const toolbar = document.getElementById('comment-toolbar');
    if (!toolbar) return;

    let paginationHTML = '';
    if (totalPages > 1) {
        paginationHTML += `
            <button onclick="changeCommentPage(${currentCommentPage - 1})" ${currentCommentPage === 1 ? 'disabled' : ''}
                class="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-xs text-slate-300 font-medium transition-colors cursor-pointer">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `
                <button onclick="changeCommentPage(${i})"
                    class="w-7 h-7 flex items-center justify-center rounded text-xs font-semibold transition-colors cursor-pointer
                    ${currentCommentPage === i ? 'bg-purple-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}">
                    ${i}
                </button>
            `;
        }

        paginationHTML += `
            <button onclick="changeCommentPage(${currentCommentPage + 1})" ${currentCommentPage === totalPages ? 'disabled' : ''}
                class="w-7 h-7 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-xs text-slate-300 font-medium transition-colors cursor-pointer">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
    }

    toolbar.innerHTML = `
        <div class="flex items-center justify-between mb-4 border-b border-slate-850 pb-3 flex-wrap gap-2 text-xs">
            <div class="flex items-center gap-2">
                <span class="text-slate-400">Sắp xếp:</span>
                <select onchange="changeCommentSort(this.value)" class="bg-slate-900 border border-slate-700/60 rounded px-2 py-1 text-white focus:outline-none focus:border-purple-500 cursor-pointer">
                    <option value="asc" ${currentCommentSort === 'asc' ? 'selected' : ''}>Cũ nhất trước</option>
                    <option value="desc" ${currentCommentSort === 'desc' ? 'selected' : ''}>Mới nhất trước</option>
                </select>
            </div>
            <div class="flex items-center gap-1.5 ml-auto">
                ${paginationHTML}
            </div>
        </div>
    `;
}

window.changeCommentSort = function(sortVal) {
    currentCommentSort = sortVal;
    currentCommentPage = 1;
    if (currentMapId) renderCommentsList(currentMapId);
};

window.changeCommentPage = function(page) {
    currentCommentPage = page;
    if (currentMapId) renderCommentsList(currentMapId);

    const section = document.getElementById('comment-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function formatTime(ts) {
    if (!ts) return 'vừa xong';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
    return date.toLocaleDateString('vi-VN');
}

window.submitComment = async function() {
    if (!currentMapId) return;

    const authorEl = document.getElementById('comment-author');
    const textEl = document.getElementById('comment-text');
    const submitBtn = document.getElementById('submit-comment-btn');
    if (!textEl) return;

    const text = textEl.value.trim();
    if (!text) {
        textEl.focus();
        textEl.classList.add('border-red-500/60');
        setTimeout(() => textEl.classList.remove('border-red-500/60'), 1500);
        return;
    }

    // Determine author name
    let author;
    if (currentUser) {
        // Always use logged-in display name
        author = currentUser.displayName || currentUser.email?.split('@')[0] || 'Người dùng';
    } else {
        const authorEl = document.getElementById('comment-author');
        author = (authorEl?.value || '').trim();
        if (author) {
            localStorage.setItem('discuss_guest_name', author);
        } else {
            author = localStorage.getItem('discuss_guest_name') || 'Ẩn danh';
        }
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Đang gửi...';
    }

    try {
        const commentsRef = collection(db, 'mapDiscussions', currentMapId, 'comments');
        const avatarUrl = resolveAvatar(currentUserProfile) || null;
        const effectiveUid = getEffectiveUserId();
        // Update local cache so avatar shows immediately for own comments
        if (effectiveUid && avatarUrl) {
            userProfileCache[effectiveUid] = userProfileCache[effectiveUid] || {};
            userProfileCache[effectiveUid].photoBase64 = currentUserProfile?.photoBase64 || null;
            userProfileCache[effectiveUid].photoURL = currentUserProfile?.photoURL || null;
        }
        await addDoc(commentsRef, {
            text,
            author,
            userId: effectiveUid,
            avatarUrl,   // stored for future display without re-fetching profile
            createdAt: serverTimestamp()
        });
        textEl.value = '';
        showToast('Bình luận đã được gửi!', 'success');
    } catch (e) {
        console.error(e);
        showToast('Gửi bình luận thất bại. Thử lại sau!', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane mr-1"></i> Gửi';
        }
    }
};

window.deleteComment = async function(mapId, commentId) {
    if (!confirm('Bạn có chắc muốn xóa bình luận này?')) return;
    try {
        await deleteDoc(doc(db, 'mapDiscussions', mapId, 'comments', commentId));
        showToast('Đã xóa bình luận.', 'info');
    } catch (e) {
        console.error(e);
        showToast('Không thể xóa bình luận.', 'error');
    }
};

window.startEditComment = function(mapId, commentId, buttonEl) {
    const commentItem = buttonEl.closest('.comment-item');
    if (!commentItem) return;

    const contentEl = commentItem.querySelector('.comment-content');
    if (!contentEl) return;

    const originalText = contentEl.dataset.originalText || contentEl.textContent.trim();
    contentEl.dataset.originalText = originalText;

    contentEl.innerHTML = `
        <div class="mt-2 flex flex-col gap-2">
            <textarea class="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-purple-500 resize-none" rows="2">${escHtml(originalText)}</textarea>
            <div class="flex items-center gap-2 self-end">
                <button onclick="cancelEditComment(this)" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium">Hủy</button>
                <button onclick="saveEditComment('${mapId}', '${commentId}', this)" class="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-xs text-white font-medium">Lưu</button>
            </div>
        </div>
    `;

    const actionsEl = commentItem.querySelector('.comment-actions');
    if (actionsEl) actionsEl.classList.add('hidden');
};

window.cancelEditComment = function(buttonEl) {
    const commentItem = buttonEl.closest('.comment-item');
    if (!commentItem) return;

    const contentEl = commentItem.querySelector('.comment-content');
    if (!contentEl) return;

    const originalText = contentEl.dataset.originalText || '';
    contentEl.innerHTML = escHtml(originalText);

    const actionsEl = commentItem.querySelector('.comment-actions');
    if (actionsEl) actionsEl.classList.remove('hidden');
};

window.saveEditComment = async function(mapId, commentId, buttonEl) {
    const commentItem = buttonEl.closest('.comment-item');
    if (!commentItem) return;

    const textarea = commentItem.querySelector('textarea');
    if (!textarea) return;

    const newText = textarea.value.trim();
    if (!newText) return;

    buttonEl.disabled = true;
    buttonEl.textContent = 'Đang lưu...';

    try {
        await updateDoc(doc(db, 'mapDiscussions', mapId, 'comments', commentId), {
            text: newText,
            updatedAt: serverTimestamp()
        });
        showToast('Đã cập nhật bình luận!', 'success');
    } catch (e) {
        console.error(e);
        showToast('Cập nhật bình luận thất bại!', 'error');
        cancelEditComment(buttonEl);
    }
};

window.scrollToComments = function() {
    const section = document.getElementById('comment-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ─── Likes ────────────────────────────────────────────────────────────────────
window.toggleLike = async function() {
    if (!currentMapId) return;
    const uid = getEffectiveUserId();
    const ref = doc(db, 'mapDiscussions', currentMapId);

    const btn = document.getElementById('like-btn');
    const isLiked = btn?.classList.contains('liked');

    try {
        const snap = await getDoc(ref);
        if (!snap.exists()) {
            await setDoc(ref, { likes: [uid] });
        } else {
            if (isLiked) {
                await updateDoc(ref, { likes: arrayRemove(uid) });
            } else {
                await updateDoc(ref, { likes: arrayUnion(uid) });
            }
        }
        // Animate
        if (btn) {
            btn.classList.add('scale-110');
            setTimeout(() => btn.classList.remove('scale-110'), 200);
        }
    } catch (e) {
        console.error(e);
        showToast('Không thể cập nhật like. Thử lại!', 'error');
    }
};

// ─── Share ────────────────────────────────────────────────────────────────────
window.shareMap = function() {
    if (!currentMapId) return;
    const url = new URL(window.location);
    url.searchParams.set('map', currentMapId);
    const shareUrl = url.toString();

    if (navigator.share) {
        const map = allMaps.find(m => m.id === currentMapId);
        navigator.share({
            title: `WeStar · ${map?.name || 'Bản đồ'}`,
            text: `Xem thảo luận về bản đồ ${map?.name || ''} trên WeStar!`,
            url: shareUrl
        }).catch(() => copyToClipboard(shareUrl));
    } else {
        copyToClipboard(shareUrl);
    }
};

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Đã sao chép link chia sẻ!', 'success');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Đã sao chép link chia sẻ!', 'success');
    });
}

// ─── Video Player ─────────────────────────────────────────────────────────────
window.openVideoPlayer = function(videoUrl, mapTitle) {
    if (!videoUrl) return;
    window._currentVideoUrl = videoUrl;

    const modal = document.getElementById('video-modal');
    const contentEl = document.getElementById('video-content');
    const loadingEl = document.getElementById('video-loading');
    const titleEl = document.getElementById('video-modal-title');
    if (!modal || !contentEl) return;

    if (titleEl) {
        titleEl.textContent = mapTitle ? `RECORD - ${mapTitle.toUpperCase()}` : 'VIDEO BEST RECORD';
    }

    contentEl.innerHTML = '';
    if (loadingEl) loadingEl.classList.remove('hidden');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const embedUrl = resolveVideoEmbed(videoUrl);
    if (!embedUrl) {
        if (loadingEl) loadingEl.classList.add('hidden');
        contentEl.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
            <i class="fas fa-video-slash text-4xl mb-3 text-cyan-400/60"></i>
            <p class="text-sm">Không thể xem trực tiếp định dạng video này</p>
            <button onclick="openCurrentVideoExternal()" class="mt-3 px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 hover:bg-cyan-500/40 text-cyan-300 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all">
                <i class="fas fa-external-link-alt"></i> Mở link trong tab mới / App
            </button>
        </div>`;
        return;
    }

    if (embedUrl.type === 'iframe') {
        const iframe = document.createElement('iframe');
        iframe.src = embedUrl.src;
        iframe.className = 'w-full h-full border-0';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
        iframe.allowFullscreen = true;
        iframe.onload = () => { if (loadingEl) loadingEl.classList.add('hidden'); };
        contentEl.appendChild(iframe);
    } else if (embedUrl.type === 'video') {
        if (loadingEl) loadingEl.classList.add('hidden');
        contentEl.innerHTML = `<video src="${escHtml(embedUrl.src)}" controls autoplay playsinline class="w-full h-full object-contain bg-black rounded-lg"></video>`;
    }
};

window.openCurrentVideoExternal = function() {
    if (window._currentVideoUrl) {
        window.open(window._currentVideoUrl, '_blank', 'noopener,noreferrer');
    }
};

window.toggleVideoFullscreen = function() {
    const container = document.getElementById('video-aspect-container') || document.getElementById('video-content');
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

function resolveVideoEmbed(url) {
    if (!url) return null;

    // YouTube
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        return { type: 'iframe', src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0&playsinline=1` };
    }

    // Bilibili
    const biliMatch = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+|av\d+)/i);
    if (biliMatch) {
        const id = biliMatch[1];
        const src = id.startsWith('BV')
            ? `https://player.bilibili.com/player.html?bvid=${id}&autoplay=1`
            : `https://player.bilibili.com/player.html?aid=${id.replace('av', '')}&autoplay=1`;
        return { type: 'iframe', src };
    }

    // Google Drive
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
        return { type: 'iframe', src: `https://drive.google.com/file/d/${driveMatch[1]}/preview?autoplay=1` };
    }

    // Direct video
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
        return { type: 'video', src: url };
    }

    // Fallback iframe
    if (url.startsWith('http')) {
        return { type: 'iframe', src: url };
    }

    return null;
}

window.closeVideoModal = function() {
    const modal = document.getElementById('video-modal');
    const contentEl = document.getElementById('video-content');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
    if (contentEl) contentEl.innerHTML = '';
};

// ─── Toast Notifications ──────────────────────────────────────────────────────
function showToast(message, type = 'info') {
    const colors = {
        success: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
        error: 'bg-red-500/20 border-red-500/50 text-red-300',
        info: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
    };
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };

    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm text-sm font-medium shadow-2xl animate__animated animate__fadeInUp animate__faster ${colors[type]}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${escHtml(message)}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.replace('animate__fadeInUp', 'animate__fadeOutDown');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ─── Deep Link / URL Param ────────────────────────────────────────────────────
function checkUrlParam() {
    const params = new URLSearchParams(window.location.search);
    const mapId = params.get('map');
    if (mapId) {
        const map = allMaps.find(m => m.id === mapId);
        if (map) {
            const input = document.getElementById('map-search-input');
            if (input) input.value = map.name || '';
            currentMapId = mapId;
            renderMapCard(map);
            listenToDiscussion(mapId);
        }
    }
}

// ─── Featured Maps (default view) ────────────────────────────────────────────
function renderFeaturedMaps() {
    const container = document.getElementById('featured-maps');
    if (!container) return;

    // Update stats
    const totalMaps = allMaps.length;
    const mapsWithVideo = allMaps.filter(m => m.videoUrl || m.bestRecordVideo).length;
    const statMapsEl = document.getElementById('stat-maps');
    const statVideosEl = document.getElementById('stat-videos');
    if (statMapsEl) statMapsEl.textContent = totalMaps;
    if (statVideosEl) statVideosEl.textContent = mapsWithVideo;

    // Show up to 8 maps with videos first, then rest
    const withVideo = allMaps.filter(m => m.videoUrl || m.bestRecordVideo);
    const withoutVideo = allMaps.filter(m => !m.videoUrl && !m.bestRecordVideo);
    const featured = [...withVideo, ...withoutVideo].slice(0, 8);

    if (featured.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-sm text-center py-6">Chưa có bản đồ nào.</p>';
        return;
    }

    container.innerHTML = featured.map(m => {
        const hasVideo = !!(m.videoUrl || m.bestRecordVideo);
        const diffColor = getDifficultyColor(m.difficulty);
        return `
            <button onclick="selectMap('${m.id}')"
                class="feat-map-btn group">
                <div class="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-700 flex items-center justify-center">
                    ${m.imageUrl
                    ? `<img src="${m.imageUrl}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" alt="" onerror="this.style.display='none'">`
                    : `<i class='fas fa-map text-slate-500 text-sm'></i>`}
                    ${hasVideo ? `<div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <i class="fas fa-play text-white text-xs"></i>
                    </div>` : ''}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">${escHtml(m.name || 'Bản đồ')}</div>
                    <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        ${m.difficulty ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full ${diffColor}">${escHtml(m.difficulty)}</span>` : ''}
                        ${hasVideo ? `<span class="text-[10px] text-cyan-400"><i class="fas fa-video mr-0.5"></i>Video</span>` : ''}
                    </div>
                </div>
                <i class="fas fa-chevron-right text-slate-700 group-hover:text-slate-500 text-xs transition-colors flex-shrink-0"></i>
            </button>
        `;
    }).join('');
}

window.openCommentHistory = async function() {
    const modal = document.getElementById('history-modal');
    const list = document.getElementById('history-list');
    if (!modal || !list) return;

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    list.innerHTML = `
        <div class="text-center py-12 text-slate-500 text-sm">
            <i class="fas fa-spinner fa-spin mr-2"></i> Đang tải nhật ký bình luận...
        </div>
    `;

    const uid = getEffectiveUserId();
    if (!uid) {
        list.innerHTML = `<div class="text-center py-12 text-slate-400 text-sm">Vui lòng đăng nhập để xem lịch sử.</div>`;
        return;
    }

    const displayComments = (comments) => {
        comments.sort((a, b) => {
            const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
            const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
            return timeB - timeA;
        });

        if (comments.length === 0) {
            list.innerHTML = `
                <div class="text-center py-12 text-slate-500 text-sm">
                    <i class="fas fa-comment-slash text-3xl mb-3 block opacity-30"></i>
                    Bạn chưa viết bình luận nào.
                </div>`;
            return;
        }

        list.innerHTML = comments.map(c => {
            const mapObj = allMaps.find(m => m.id === c.mapId);
            const mapName = mapObj ? mapObj.name : 'Bản đồ';
            const timeStr = formatTime(c.createdAt);

            return `
                <div id="hist-item-${c.id}" onclick="navigateToCommentFromHistory('${c.mapId}', '${c.id}', event)" class="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/30 flex flex-col gap-2 hover:border-purple-500/20 hover:bg-slate-800/60 transition-all text-left cursor-pointer">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                        <span class="text-xs font-semibold text-purple-400 flex items-center gap-1">
                            <i class="fas fa-map-pin"></i> ${escHtml(mapName)}
                        </span>
                        <div class="flex items-center gap-2">
                            <span class="text-[11px] text-slate-500">${timeStr}</span>
                            <span class="text-slate-700 text-[10px]">|</span>
                            <button onclick="deleteCommentFromHistory('${c.mapId}', '${c.id}', event)" 
                                    class="text-[11px] text-slate-500 hover:text-red-400 transition-colors cursor-pointer flex items-center gap-0.5">
                                <i class="fas fa-trash-alt text-[10px]"></i> Xóa
                            </button>
                        </div>
                    </div>
                    <div class="text-sm text-slate-300 break-words">${escHtml(c.text)}</div>
                </div>`;
        }).join('');
    };

    try {
        const { getDocs, query, collectionGroup, where } = await import(
            'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
        );

        const q = query(collectionGroup(db, 'comments'), where('userId', '==', uid));
        const snap = await getDocs(q);

        const myComments = [];
        snap.forEach(d => {
            const data = d.data();
            const mapId = d.ref.parent.parent.id;
            myComments.push({
                id: d.id,
                mapId,
                text: data.text || '',
                createdAt: data.createdAt,
                ...data
            });
        });

        displayComments(myComments);
    } catch (e) {
        console.warn('collectionGroup query failed (index might be missing), falling back to parallel fetching...', e);
        
        try {
            const { getDocs, query, collection, where } = await import(
                'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'
            );

            const promises = allMaps.map(async (m) => {
                try {
                    const q = query(collection(db, 'mapDiscussions', m.id, 'comments'), where('userId', '==', uid));
                    const snap = await getDocs(q);
                    const comments = [];
                    snap.forEach(d => {
                        const data = d.data();
                        comments.push({
                            id: d.id,
                            mapId: m.id,
                            text: data.text || '',
                            createdAt: data.createdAt,
                            ...data
                        });
                    });
                    return comments;
                } catch (err) {
                    return [];
                }
            });

            const results = await Promise.all(promises);
            const myComments = results.flat();
            displayComments(myComments);
        } catch (fallbackError) {
            console.error('Fallback query failed:', fallbackError);
            list.innerHTML = `<div class="text-center py-12 text-red-400 text-sm">Có lỗi xảy ra khi tải nhật ký. Vui lòng thử lại sau!</div>`;
        }
    }
};

window.closeCommentHistory = function() {
    const modal = document.getElementById('history-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
};

window.navigateToCommentFromHistory = function(mapId, commentId, event) {
    if (event && event.target.closest('button')) return;

    closeCommentHistory();
    selectMap(mapId);

    let attempts = 0;
    const scrollToTarget = () => {
        const targetEl = document.getElementById(`comment-${commentId}`);
        if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Neon violet glow animation
            targetEl.classList.add('bg-purple-500/20', 'ring-2', 'ring-purple-500/50', 'shadow-[0_0_15px_rgba(168,85,247,0.4)]');
            setTimeout(() => {
                targetEl.classList.remove('bg-purple-500/20', 'ring-2', 'ring-purple-500/50', 'shadow-[0_0_15px_rgba(168,85,247,0.4)]');
            }, 2500);
        } else if (attempts < 15) {
            attempts++;
            setTimeout(scrollToTarget, 100);
        }
    };
    setTimeout(scrollToTarget, 250);
};

window.deleteCommentFromHistory = async function(mapId, commentId, event) {
    if (event) event.stopPropagation(); // Stop navigation click handler trigger
    if (!confirm('Bạn có chắc muốn xóa bình luận này?')) return;
    try {
        await deleteDoc(doc(db, 'mapDiscussions', mapId, 'comments', commentId));
        showToast('Đã xóa bình luận thành công.', 'info');

        const el = document.getElementById(`hist-item-${commentId}`);
        if (el) {
            el.remove();

            const list = document.getElementById('history-list');
            if (list && list.children.length === 0) {
                list.innerHTML = `
                    <div class="text-center py-12 text-slate-500 text-sm">
                        <i class="fas fa-comment-slash text-3xl mb-3 block opacity-30"></i>
                        Bạn chưa viết bình luận nào.
                    </div>`;
            }
        }
    } catch (e) {
        console.error(e);
        showToast('Không thể xóa bình luận này.', 'error');
    }
};

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
    await loadAllMaps();
    initSearch();
    renderFeaturedMaps();
    checkUrlParam();

    // Keyboard shortcut: Escape closes video and history modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeVideoModal();
            closeCommentHistory();
        }
    });
}

init();


