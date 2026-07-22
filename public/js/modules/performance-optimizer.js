/**
 * Performance & Caching Optimization
 * IndexedDB caching, lazy loading, request batching
 */

class PerformanceOptimizer {
    constructor() {
        this.dbName = 'WeStar-Cache';
        this.version = 1;
        this.db = null;
        this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
        this.pendingRequests = new Map();
        this.init();
    }

    /**
     * Khởi tạo IndexedDB
     */
    async init() {
        try {
            this.db = await this.openDB();
            console.log('✅ Performance optimizer initialized');
            this.startAutoCleanup();
        } catch (error) {
            console.error('❌ Failed to initialize performance optimizer:', error);
        }
    }

    /**
     * Stale-While-Revalidate Caching Pattern (Tối ưu Firestore load)
     * Lấy dữ liệu từ cache trả về tức thì, đồng thời fetch Firebase ngầm để update
     */
    async fetchWithCache(collectionName, fetchFn, updateCallback = null) {
        let isCacheHit = false;

        // 1. Cố gắng lấy từ Cache (Hiển thị UI tức thì)
        const cachedData = await this.getCachedData(collectionName);
        if (cachedData) {
            isCacheHit = true;
            if (updateCallback) updateCallback(cachedData, true); // true = isCached
        }

        // 2. Fetch từ Firebase ngầm
        try {
            const freshData = await fetchFn();
            
            // So sánh đơn giản xem dữ liệu có thay đổi không (Tùy chọn)
            const freshJson = JSON.stringify(freshData);
            const cachedJson = cachedData ? JSON.stringify(cachedData) : '';
            
            if (freshJson !== cachedJson) {
                // Update Cache
                await this.cacheData(collectionName, freshData);
                
                // Trả về UI bản mới nhất nếu có callback
                if (updateCallback) updateCallback(freshData, false);
            }
            
            return freshData; // Trả về data mới nhất
        } catch (error) {
            console.error(`❌ SWR Fetch Error [${collectionName}]:`, error);
            if (!isCacheHit) {
                throw error; // Ném lỗi nếu cả cache và fetch đều tịt
            }
            return cachedData;
        }
    }

    /**
     * Mở IndexedDB
     */
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Cache store
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache', { keyPath: 'key' });
                }

                // Analytics store
                if (!db.objectStoreNames.contains('analytics')) {
                    const analyticsStore = db.createObjectStore('analytics', { keyPath: 'id', autoIncrement: true });
                    analyticsStore.createIndex('timestamp', 'timestamp');
                }

                // Search history store
                if (!db.objectStoreNames.contains('searchHistory')) {
                    db.createObjectStore('searchHistory', { keyPath: 'query' });
                }
            };
        });
    }

    /**
     * Cache data with expiry
     */
    async cacheData(key, data, expiryMs = this.cacheExpiry) {
        try {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');

            await new Promise((resolve, reject) => {
                const request = store.put({
                    key,
                    data,
                    timestamp: Date.now(),
                    expiry: Date.now() + expiryMs
                });

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });

            console.log(`💾 Cached: ${key}`);
        } catch (error) {
            console.error('Cache error:', error);
        }
    }

    /**
     * Retrieve cached data
     */
    async getCachedData(key) {
        try {
            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');

            return new Promise((resolve, reject) => {
                const request = store.get(key);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const result = request.result;

                    // Check if expired
                    if (result && result.expiry > Date.now()) {
                        resolve(result.data);
                    } else {
                        // Delete expired using a separate readwrite transaction
                        if (result) {
                            try {
                                const writeTx = this.db.transaction(['cache'], 'readwrite');
                                const writeStore = writeTx.objectStore('cache');
                                writeStore.delete(key);
                            } catch (e) {
                                console.error('Failed to delete expired cache in background:', e);
                            }
                        }
                        resolve(null);
                    }
                };
            });
        } catch (error) {
            console.error('Cache retrieve error:', error);
            return null;
        }
    }

    /**
     * Request batching & deduplication
     */
    async batchRequest(key, fetchFn, delay = 100) {
        // Nếu request đang pending, return same promise
        if (this.pendingRequests.has(key)) {
            return this.pendingRequests.get(key);
        }

        const promise = new Promise((resolve) => {
            setTimeout(async () => {
                try {
                    const result = await fetchFn();
                    this.pendingRequests.delete(key);
                    resolve(result);
                } catch (error) {
                    this.pendingRequests.delete(key);
                    resolve(null);
                }
            }, delay);
        });

        this.pendingRequests.set(key, promise);
        return promise;
    }

    /**
     * Lazy load images
     */
    setupLazyLoading() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '50px'
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            observer.observe(img);
        });
    }

    /**
     * Setup infinite scroll with pagination
     */
    setupInfiniteScroll(container, loadMoreFn, threshold = 200) {
        let isLoading = false;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !isLoading) {
                    isLoading = true;

                    loadMoreFn().then(() => {
                        isLoading = false;
                    });
                }
            });
        }, {
            rootMargin: `${threshold}px`
        });

        // Create sentinel element
        const sentinel = document.createElement('div');
        sentinel.id = 'infinite-scroll-sentinel';
        sentinel.style.height = '1px';
        container.appendChild(sentinel);

        observer.observe(sentinel);
    }

    /**
     * Throttle function calls
     */
    throttle(fn, delay) {
        let lastCall = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return fn.apply(this, args);
            }
        };
    }

    /**
     * Debounce function calls
     */
    debounce(fn, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    /**
     * Record analytics event
     */
    async recordEvent(eventName, data = {}) {
        try {
            const transaction = this.db.transaction(['analytics'], 'readwrite');
            const store = transaction.objectStore('analytics');

            await new Promise((resolve, reject) => {
                const request = store.add({
                    event: eventName,
                    data,
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                });

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });

            console.log(`📊 Event recorded: ${eventName}`);
        } catch (error) {
            console.error('Analytics error:', error);
        }
    }

    /**
     * Get analytics summary
     */
    async getAnalyticsSummary(hours = 24) {
        try {
            const transaction = this.db.transaction(['analytics'], 'readonly');
            const store = transaction.objectStore('analytics');
            const index = store.index('timestamp');
            const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

            return new Promise((resolve, reject) => {
                const request = index.getAll(IDBKeyRange.lowerBound(cutoffTime));

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const events = request.result;
                    const summary = {
                        totalEvents: events.length,
                        eventTypes: {},
                        topEvents: {}
                    };

                    events.forEach(event => {
                        summary.eventTypes[event.event] = (summary.eventTypes[event.event] || 0) + 1;
                    });

                    const sorted = Object.entries(summary.eventTypes)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5);

                    sorted.forEach(([event, count]) => {
                        summary.topEvents[event] = count;
                    });

                    resolve(summary);
                };
            });
        } catch (error) {
            console.error('Analytics summary error:', error);
            return null;
        }
    }

    /**
     * Auto cleanup expired cache
     */
    startAutoCleanup() {
        setInterval(async () => {
            try {
                const transaction = this.db.transaction(['cache'], 'readwrite');
                const store = transaction.objectStore('cache');
                const now = Date.now();

                const request = store.getAll();
                request.onsuccess = () => {
                    request.result.forEach(item => {
                        if (item.expiry < now) {
                            store.delete(item.key);
                        }
                    });
                };
            } catch (error) {
                console.error('Cleanup error:', error);
            }
        }, 5 * 60 * 1000); // Every 5 minutes
    }

    /**
     * Clear all cache
     */
    async clearAllCache() {
        try {
            const transaction = this.db.transaction(['cache'], 'readwrite');
            const store = transaction.objectStore('cache');

            return new Promise((resolve, reject) => {
                const request = store.clear();

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    console.log('✅ Cache cleared');
                    resolve();
                };
            });
        } catch (error) {
            console.error('Clear cache error:', error);
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        try {
            const transaction = this.db.transaction(['cache'], 'readonly');
            const store = transaction.objectStore('cache');

            return new Promise((resolve, reject) => {
                const request = store.getAll();

                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const items = request.result;
                    const now = Date.now();
                    const valid = items.filter(item => item.expiry > now);

                    resolve({
                        totalItems: items.length,
                        validItems: valid.length,
                        expiredItems: items.length - valid.length,
                        totalSize: JSON.stringify(items).length
                    });
                };
            });
        } catch (error) {
            console.error('Cache stats error:', error);
            return null;
        }
    }

    /**
     * Monitor performance metrics
     */
    getPerformanceMetrics() {
        const metrics = {
            pageLoadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
            domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
            resourceTiming: performance.getEntriesByType('resource'),
            memoryUsage: performance.memory ? {
                usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
                totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
                jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
            } : 'Not available'
        };

        return metrics;
    }
}

// Khởi tạo singleton
export const performanceOptimizer = new PerformanceOptimizer();

// Compatibility for non-module imports (if any)
if (typeof window !== 'undefined') {
    window.performanceOptimizer = performanceOptimizer;
}
