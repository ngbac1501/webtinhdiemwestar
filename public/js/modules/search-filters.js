/**
 * Advanced Search & Filters System
 * Hỗ trợ search toàn cục, filters nâng cao, autocomplete
 */

class SearchFiltersManager {
    constructor() {
        this.searchIndex = new Map();
        this.filters = {};
        this.searchHistory = this.loadSearchHistory();
        this.init();
    }

    /**
     * Khởi tạo hệ thống search
     */
    init() {
        this.createSearchBar();
        this.setupSearchListeners();
    }

    /**
     * Tạo global search bar
     */
    createSearchBar() {
        const header = document.querySelector('header') || document.querySelector('nav');
        if (!header) return;

        const searchContainer = document.createElement('div');
        searchContainer.id = 'global-search-container';
        searchContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
            max-width: 500px;
            margin: 0 auto;
        `;

        searchContainer.innerHTML = `
            <div style="position: relative; width: 100%;">
                <input 
                    id="global-search-input"
                    type="text"
                    placeholder="🔍 Tìm kiếm bản đồ, xe, thú cưng..."
                    style="
                        width: 100%;
                        padding: 12px 16px;
                        background: rgba(18, 18, 26, 0.8);
                        border: 1px solid rgba(0, 243, 255, 0.2);
                        border-radius: 20px;
                        color: #e2e8f0;
                        font-size: 0.95rem;
                        transition: all 0.3s ease;
                        outline: none;
                    "
                />
                <div 
                    id="search-autocomplete"
                    style="
                        position: absolute;
                        top: 100%;
                        left: 0;
                        right: 0;
                        background: rgba(18, 18, 26, 0.95);
                        border: 1px solid rgba(0, 243, 255, 0.3);
                        border-top: none;
                        border-radius: 0 0 12px 12px;
                        max-height: 300px;
                        overflow-y: auto;
                        z-index: 1000;
                        display: none;
                        margin-top: 4px;
                    "
                ></div>
            </div>
            <button id="filter-toggle" style="
                background: linear-gradient(135deg, rgba(0, 243, 255, 0.1), rgba(0, 102, 255, 0.1));
                border: 1px solid rgba(0, 243, 255, 0.2);
                color: var(--neon-cyan);
                padding: 10px 14px;
                border-radius: 20px;
                cursor: pointer;
                transition: all 0.3s ease;
                font-weight: 600;
            ">
                <i class="fas fa-sliders-h"></i> Filters
            </button>
        `;

        // Insert after logo/title
        const titleElement = header.querySelector('h1') || header.firstChild;
        if (titleElement && titleElement.nextSibling) {
            header.insertBefore(searchContainer, titleElement.nextSibling);
        } else {
            header.appendChild(searchContainer);
        }
    }

    /**
     * Setup search listeners
     */
    setupSearchListeners() {
        const input = document.getElementById('global-search-input');
        const autocomplete = document.getElementById('search-autocomplete');
        const filterBtn = document.getElementById('filter-toggle');

        if (!input) return;

        // Search input
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            
            if (query.length === 0) {
                autocomplete.style.display = 'none';
                return;
            }

            this.performSearch(query);
            this.showAutocomplete(query);
        });

        // Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = input.value.trim();
                if (query) {
                    this.addToSearchHistory(query);
                    this.handleSearch(query);
                }
            }
        });

        // Click outside
        document.addEventListener('click', (e) => {
            if (!input.contains(e.target) && !autocomplete.contains(e.target)) {
                autocomplete.style.display = 'none';
            }
        });

        // Filter button
        if (filterBtn) {
            filterBtn.addEventListener('click', () => this.showFilterPanel());
        }
    }

    /**
     * Thực hiện tìm kiếm
     */
    performSearch(query) {
        const results = {
            maps: [],
            cars: [],
            pets: [],
            users: []
        };

        const q = query.toLowerCase();

        // Search trong dữ liệu
        if (window.ALL_MAPS) {
            results.maps = window.ALL_MAPS.filter(m =>
                m.name?.toLowerCase().includes(q) ||
                m.description?.toLowerCase().includes(q)
            ).slice(0, 3);
        }

        if (window.ALL_CARS) {
            results.cars = window.ALL_CARS.filter(c =>
                c.name?.toLowerCase().includes(q) ||
                c.type?.toLowerCase().includes(q)
            ).slice(0, 3);
        }

        if (window.ALL_PETS) {
            results.pets = window.ALL_PETS.filter(p =>
                p.name?.toLowerCase().includes(q) ||
                p.type?.toLowerCase().includes(q)
            ).slice(0, 3);
        }

        return results;
    }

    /**
     * Hiển thị autocomplete suggestions
     */
    showAutocomplete(query) {
        const autocomplete = document.getElementById('search-autocomplete');
        if (!autocomplete) return;

        const results = this.performSearch(query);
        const historyMatches = this.searchHistory
            .filter(h => h.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 2);

        let html = '';

        // History
        if (historyMatches.length > 0) {
            html += '<div style="border-bottom: 1px solid rgba(0, 243, 255, 0.1); padding: 8px 0;">';
            html += '<div style="padding: 8px 12px; font-size: 0.8rem; color: #718096; text-transform: uppercase;">Lịch sử tìm kiếm</div>';
            historyMatches.forEach(match => {
                html += `
                    <div onclick="document.getElementById('global-search-input').value='${match}'; document.getElementById('search-autocomplete').style.display='none';" style="
                        padding: 10px 12px;
                        cursor: pointer;
                        color: var(--neon-cyan);
                        transition: all 0.2s ease;
                    " onmouseover="this.style.background='rgba(0, 243, 255, 0.1)'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-history"></i> ${match}
                    </div>
                `;
            });
            html += '</div>';
        }

        // Maps
        if (results.maps.length > 0) {
            html += '<div style="border-bottom: 1px solid rgba(0, 243, 255, 0.1); padding: 8px 0;">';
            html += '<div style="padding: 8px 12px; font-size: 0.8rem; color: #718096; text-transform: uppercase;">Bản đồ</div>';
            results.maps.forEach(map => {
                html += `
                    <div onclick="window.location.href='map-detail.html?id=${map.id}'" style="
                        padding: 10px 12px;
                        cursor: pointer;
                        color: #e2e8f0;
                        transition: all 0.2s ease;
                    " onmouseover="this.style.background='rgba(0, 243, 255, 0.1)'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-map"></i> ${map.name} <span style="color: #718096;">(${map.difficulty})</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Cars
        if (results.cars.length > 0) {
            html += '<div style="border-bottom: 1px solid rgba(0, 243, 255, 0.1); padding: 8px 0;">';
            html += '<div style="padding: 8px 12px; font-size: 0.8rem; color: #718096; text-transform: uppercase;">Xe</div>';
            results.cars.forEach(car => {
                html += `
                    <div style="
                        padding: 10px 12px;
                        cursor: pointer;
                        color: #e2e8f0;
                        transition: all 0.2s ease;
                    " onmouseover="this.style.background='rgba(0, 243, 255, 0.1)'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-car"></i> ${car.name} <span style="color: #718096;">(${car.rarity})</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        // Pets
        if (results.pets.length > 0) {
            html += '<div style="padding: 8px 0;">';
            html += '<div style="padding: 8px 12px; font-size: 0.8rem; color: #718096; text-transform: uppercase;">Thú cưng</div>';
            results.pets.forEach(pet => {
                html += `
                    <div style="
                        padding: 10px 12px;
                        cursor: pointer;
                        color: #e2e8f0;
                        transition: all 0.2s ease;
                    " onmouseover="this.style.background='rgba(0, 243, 255, 0.1)'" onmouseout="this.style.background='transparent'">
                        <i class="fas fa-paw"></i> ${pet.name} <span style="color: #718096;">(${pet.type})</span>
                    </div>
                `;
            });
            html += '</div>';
        }

        autocomplete.innerHTML = html || '<div style="padding: 12px; color: #718096;">Không tìm thấy kết quả</div>';
        autocomplete.style.display = 'block';
    }

    /**
     * Hiển thị filter panel
     */
    showFilterPanel() {
        const panel = document.getElementById('filter-panel') || this.createFilterPanel();
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }

    /**
     * Tạo filter panel
     */
    createFilterPanel() {
        const panel = document.createElement('div');
        panel.id = 'filter-panel';
        panel.style.cssText = `
            position: fixed;
            left: 20px;
            top: 120px;
            width: 300px;
            background: rgba(18, 18, 26, 0.95);
            border: 1px solid rgba(0, 243, 255, 0.3);
            border-radius: 12px;
            padding: 16px;
            z-index: 1000;
            display: none;
            box-shadow: 0 10px 30px rgba(0, 243, 255, 0.2);
        `;

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="margin: 0; color: var(--neon-cyan);">Bộ lọc nâng cao</h3>
                <button onclick="document.getElementById('filter-panel').style.display='none'" style="
                    background: none;
                    border: none;
                    color: var(--neon-cyan);
                    cursor: pointer;
                    font-size: 1.2rem;
                ">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <div>
                    <label style="display: block; margin-bottom: 6px; color: var(--neon-cyan); font-size: 0.9rem;">Loại</label>
                    <select id="filter-type" style="
                        width: 100%;
                        padding: 8px;
                        background: rgba(18, 18, 26, 0.8);
                        border: 1px solid rgba(0, 243, 255, 0.2);
                        border-radius: 6px;
                        color: #e2e8f0;
                    ">
                        <option value="">Tất cả</option>
                        <option value="map">Bản đồ</option>
                        <option value="car">Xe</option>
                        <option value="pet">Thú cưng</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 6px; color: var(--neon-cyan); font-size: 0.9rem;">Độ khó</label>
                    <select id="filter-difficulty" style="
                        width: 100%;
                        padding: 8px;
                        background: rgba(18, 18, 26, 0.8);
                        border: 1px solid rgba(0, 243, 255, 0.2);
                        border-radius: 6px;
                        color: #e2e8f0;
                    ">
                        <option value="">Tất cả</option>
                        <option value="3 sao">3 sao</option>
                        <option value="4 sao">4 sao</option>
                        <option value="5 sao">5 sao</option>
                        <option value="6 sao">6 sao</option>
                        <option value="7 sao">7 sao</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 6px; color: var(--neon-cyan); font-size: 0.9rem;">Độ hiếm</label>
                    <select id="filter-rarity" style="
                        width: 100%;
                        padding: 8px;
                        background: rgba(18, 18, 26, 0.8);
                        border: 1px solid rgba(0, 243, 255, 0.2);
                        border-radius: 6px;
                        color: #e2e8f0;
                    ">
                        <option value="">Tất cả</option>
                        <option value="Common">Thường</option>
                        <option value="Uncommon">Hiếm</option>
                        <option value="Rare">Rất hiếm</option>
                        <option value="Epic">Huyền thoại</option>
                    </select>
                </div>
                
                <button onclick="document.getElementById('filter-panel').dispatchEvent(new Event('apply'))" style="
                    width: 100%;
                    padding: 10px;
                    background: linear-gradient(135deg, var(--neon-cyan), var(--neon-blue));
                    border: none;
                    color: #000;
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s ease;
                ">
                    Áp dụng lọc
                </button>
            </div>
        `;

        document.body.appendChild(panel);
        return panel;
    }

    /**
     * Xử lý tìm kiếm
     */
    handleSearch(query) {
        // Emit event để các component khác xử lý
        window.dispatchEvent(new CustomEvent('globalSearch', {
            detail: { query }
        }));
    }

    /**
     * Thêm vào lịch sử tìm kiếm
     */
    addToSearchHistory(query) {
        if (!query) return;

        this.searchHistory = [
            query,
            ...this.searchHistory.filter(h => h !== query)
        ].slice(0, 10);

        this.saveSearchHistory();
    }

    /**
     * Lưu lịch sử tìm kiếm
     */
    saveSearchHistory() {
        localStorage.setItem('westar-search-history', JSON.stringify(this.searchHistory));
    }

    /**
     * Tải lịch sử tìm kiếm
     */
    loadSearchHistory() {
        try {
            return JSON.parse(localStorage.getItem('westar-search-history')) || [];
        } catch {
            return [];
        }
    }

    /**
     * Clear search history
     */
    clearSearchHistory() {
        this.searchHistory = [];
        this.saveSearchHistory();
    }
}

// Khởi tạo singleton
const searchFiltersManager = new SearchFiltersManager();

// Export cho các module khác
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { searchFiltersManager };
}
