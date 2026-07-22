/**
 * MobileAppUX - Progressive Web App & Mobile-like Experience
 * Provides PWA support, offline mode, bottom navigation, swipe gestures
 * Auto-initializes on page load
 */

class MobileAppUX {
  constructor() {
    this.isOnline = navigator.onLine;
    this.pwaInstalled = false;
    this.swipeThreshold = 50;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.isInitialized = false;
    this.init();
  }

  /**
   * Initialize mobile UX
   */
  async init() {
    try {
      console.log('📱 MobileAppUX initializing...');
      
      // Register service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {
          // Service worker not available - offline features won't work
        });
      }

      // Setup PWA features
      this.setupPWA();
      
      // Setup offline detection
      this.setupOfflineDetection();
      
      // Setup mobile navigation
      this.setupMobileNavigation();
      
      // Setup swipe gestures
      this.setupSwipeGestures();
      
      // Setup viewport
      this.setupViewport();
      
      // Adapt layout for mobile
      this.adaptLayoutForMobile();

      this.isInitialized = true;
      console.log('✅ MobileAppUX initialized');
    } catch (error) {
      console.error('❌ MobileAppUX init error:', error);
    }
  }

  /**
   * Setup PWA install prompt
   */
  setupPWA() {
    let deferredPrompt;

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      this.showInstallButton(deferredPrompt);
    });

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA installed successfully');
      this.pwaInstalled = true;
      notificationSystem?.addNotification({
        type: 'success',
        title: 'Ứng Dụng Đã Cài',
        message: 'WebTinhDiem đã được cài thành công'
      });
    });
  }

  /**
   * Show install button
   */
  showInstallButton(deferredPrompt) {
    // Add install button to header
    const header = document.querySelector('header') || document.querySelector('nav');
    if (!header) return;

    const installBtn = document.createElement('button');
    installBtn.id = 'pwa-install-btn';
    installBtn.className = 'fixed bottom-24 right-4 z-40 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-3 rounded-lg font-medium shadow-lg transition-all flex items-center gap-2 animate-slideInUp';
    installBtn.innerHTML = '<i class="fas fa-download"></i> Cài App';
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          console.log('✅ User accepted install');
        }
        deferredPrompt = null;
        installBtn.remove();
      }
    });

    document.body.appendChild(installBtn);
  }

  /**
   * Setup offline detection
   */
  setupOfflineDetection() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.showOfflineIndicator(false);
      notificationSystem?.addNotification({
        type: 'success',
        title: 'Kết Nối Lại',
        message: 'Đã kết nối internet'
      });
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showOfflineIndicator(true);
      notificationSystem?.addNotification({
        type: 'warning',
        title: 'Chế Độ Offline',
        message: 'Bạn đang ở chế độ offline - một số tính năng có thể bị hạn chế'
      });
    });

    // Initial check
    if (!navigator.onLine) {
      this.showOfflineIndicator(true);
    }
  }

  /**
   * Show offline indicator
   */
  showOfflineIndicator(isOffline) {
    let indicator = document.getElementById('offline-indicator');

    if (isOffline) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.className = 'fixed top-0 left-0 right-0 z-[9998] bg-red-600 text-white py-2 text-center font-medium';
        document.body.appendChild(indicator);
      }
      indicator.innerHTML = '<i class="fas fa-wifi-slash mr-2"></i> Bạn đang ở chế độ OFFLINE';
      indicator.style.display = 'block';
    } else {
      if (indicator) {
        indicator.style.display = 'none';
      }
    }
  }

  /**
   * Setup mobile bottom navigation
   */
  setupMobileNavigation() {
    // Check if already exists
    if (document.getElementById('mobile-bottom-nav')) return;

    const nav = document.createElement('nav');
    nav.id = 'mobile-bottom-nav';
    nav.className = 'fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-cyan-500/30 flex justify-around items-center h-16 md:hidden';
    nav.innerHTML = `
      <button class="mobile-nav-btn flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-cyan-400 transition-colors" data-page="dashboard">
        <i class="fas fa-home text-xl"></i>
        <span class="text-xs mt-1">Trang Chủ</span>
      </button>
      <button class="mobile-nav-btn flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-cyan-400 transition-colors" data-page="search">
        <i class="fas fa-search text-xl"></i>
        <span class="text-xs mt-1">Tìm</span>
      </button>
      <button class="mobile-nav-btn flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-cyan-400 transition-colors" data-page="profile">
        <i class="fas fa-user text-xl"></i>
        <span class="text-xs mt-1">Hồ Sơ</span>
      </button>
      <button class="mobile-nav-btn flex flex-col items-center justify-center w-full h-full text-slate-400 hover:text-cyan-400 transition-colors" data-page="menu">
        <i class="fas fa-bars text-xl"></i>
        <span class="text-xs mt-1">Menu</span>
      </button>
    `;

    document.body.appendChild(nav);

    // Attach click listeners
    nav.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = e.currentTarget.dataset.page;
        this.navigateToPage(page);
      });
    });

    // Adjust body padding for mobile
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const adjustPadding = (e) => {
      const mainContent = document.querySelector('main') || document.body;
      if (e.matches) {
        mainContent.style.paddingBottom = '80px';
      } else {
        mainContent.style.paddingBottom = '0';
      }
    };
    adjustPadding(mediaQuery);
    mediaQuery.addListener(adjustPadding);
  }

  /**
   * Navigate to page
   */
  navigateToPage(page) {
    switch (page) {
      case 'dashboard':
        window.location.href = './index.html';
        break;
      case 'search':
        if (window.searchFiltersManager) {
          window.searchFiltersManager.performSearch('');
        }
        break;
      case 'profile':
        if (window.userProfileManager) {
          window.userProfileManager.createProfilePage();
        }
        break;
      case 'menu':
        this.showMobileMenu();
        break;
    }
  }

  /**
   * Show mobile menu
   */
  showMobileMenu() {
    const modal = document.createElement('div');
    modal.id = 'mobile-menu-modal';
    modal.className = 'fixed inset-0 bg-black/50 z-[9999] flex flex-col justify-end md:hidden animate-slideUp';
    modal.innerHTML = `
      <div class="bg-slate-900 border-t border-cyan-500/30 rounded-t-xl p-4 space-y-2 max-h-[60vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-white font-bold text-lg">Menu</h3>
          <button onclick="document.getElementById('mobile-menu-modal')?.remove()" class="text-slate-400 hover:text-white">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>

        <button class="w-full text-left px-4 py-3 text-slate-300 hover:bg-slate-800 rounded transition-colors flex items-center gap-3" onclick="if(window.themeManager) window.themeManager.toggleTheme(); document.getElementById('mobile-menu-modal')?.remove()">
          <i class="fas fa-moon text-cyan-400"></i>
          <span>Chế Độ Sáng/Tối</span>
        </button>

        <button class="w-full text-left px-4 py-3 text-slate-300 hover:bg-slate-800 rounded transition-colors flex items-center gap-3" onclick="window.location.href='./login.html'">
          <i class="fas fa-sign-out-alt text-cyan-400"></i>
          <span>Đăng Xuất</span>
        </button>

        <div class="border-t border-slate-700 pt-4 mt-4">
          <p class="text-slate-500 text-xs text-center">WebTinhDiem v2.0</p>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  /**
   * Setup swipe gestures
   */
  setupSwipeGestures() {
    document.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
      this.touchStartY = e.changedTouches[0].screenY;
    }, false);

    document.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const touchEndY = e.changedTouches[0].screenY;

      this.handleSwipe(this.touchStartX, touchEndX, this.touchStartY, touchEndY);
    }, false);
  }

  /**
   * Handle swipe gestures
   */
  handleSwipe(startX, endX, startY, endY) {
    const diffX = startX - endX;
    const diffY = startY - endY;

    // Horizontal swipe
    if (Math.abs(diffX) > this.swipeThreshold && Math.abs(diffY) < this.swipeThreshold) {
      if (diffX > 0) {
        // Swiped left
        this.onSwipeLeft();
      } else {
        // Swiped right
        this.onSwipeRight();
      }
    }

    // Vertical swipe
    if (Math.abs(diffY) > this.swipeThreshold && Math.abs(diffX) < this.swipeThreshold) {
      if (diffY > 0) {
        // Swiped up
        this.onSwipeUp();
      } else {
        // Swiped down
        this.onSwipeDown();
      }
    }
  }

  /**
   * Swipe left handler
   */
  onSwipeLeft() {
    console.log('📱 Swiped left');
  }

  /**
   * Swipe right handler
   */
  onSwipeRight() {
    console.log('📱 Swiped right');
    // Could go to previous page
  }

  /**
   * Swipe up handler
   */
  onSwipeUp() {
    console.log('📱 Swiped up');
    // Could open search or menu
  }

  /**
   * Swipe down handler
   */
  onSwipeDown() {
    console.log('📱 Swiped down');
    // Could refresh or show menu
  }

  /**
   * Setup responsive viewport
   */
  setupViewport() {
    if (!document.querySelector('meta[name="viewport"]')) {
      const viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
      document.head.appendChild(viewport);
    }
  }

  /**
   * Adapt layout for mobile
   */
  adaptLayoutForMobile() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (isMobile) {
      // Hide desktop-specific elements
      const desktopElements = document.querySelectorAll('[data-desktop-only]');
      desktopElements.forEach(el => el.style.display = 'none');

      // Show mobile-specific elements
      const mobileElements = document.querySelectorAll('[data-mobile-only]');
      mobileElements.forEach(el => el.style.display = '');

      // Optimize font sizes
      document.documentElement.style.fontSize = '16px';

      // Disable text selection optimization
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    }
  }

  /**
   * Setup offline data sync
   */
  setupOfflineSync() {
    // Store actions when offline
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      try {
        return await originalFetch.apply(this, args);
      } catch (error) {
        if (!navigator.onLine) {
          console.log('📱 Storing action for offline sync');
          // Queue action for later sync
          const queue = JSON.parse(localStorage.getItem('syncQueue') || '[]');
          queue.push({
            url: args[0],
            options: args[1],
            timestamp: Date.now()
          });
          localStorage.setItem('syncQueue', JSON.stringify(queue));
          return new Response('Offline - queued for sync');
        }
        throw error;
      }
    };
  }

  /**
   * Check if app is running as PWA
   */
  isRunningAsApp() {
    const isInStandaloneMode = 
      (window.navigator.standalone === true) || 
      (window.matchMedia('(display-mode: standalone)').matches);
    return isInStandaloneMode;
  }

  /**
   * Get battery status
   */
  async getBatteryStatus() {
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        return {
          level: battery.level,
          charging: battery.charging,
          chargingTime: battery.chargingTime,
          dischargingTime: battery.dischargingTime
        };
      } catch (error) {
        console.error('❌ Battery API error:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Request full screen
   */
  requestFullScreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    }
  }

  /**
   * Setup installation helper
   */
  setupInstallationHelper() {
    const html = `
    <style>
      @media (max-width: 768px) {
        .mobile-app-hint {
          position: fixed;
          bottom: 100px;
          right: 16px;
          z-index: 45;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      }
    </style>
    `;
    document.head.insertAdjacentHTML('beforeend', html);
  }
}

// Auto-initialize
window.mobileAppUX = window.mobileAppUX || new MobileAppUX();
console.log('✅ MobileAppUX loaded');
