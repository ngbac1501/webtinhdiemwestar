/**
 * AnalyticsDashboard - Advanced Analytics & Reporting System
 * Provides trend analysis, heatmaps, export reports, and prediction analytics
 * Auto-initializes on page load
 */

class AnalyticsDashboard {
  constructor() {
    this.analyticsData = [];
    this.charts = new Map();
    this.isInitialized = false;
    this.eventListeners = new Map();
    this.init();
  }

  /**
   * Initialize analytics dashboard
   */
  async init() {
    try {
      console.log('📊 AnalyticsDashboard initializing...');
      this.isInitialized = true;
      this.setupEventListeners();
      console.log('✅ AnalyticsDashboard initialized');
    } catch (error) {
      console.error('❌ Analytics init error:', error);
    }
  }

  /**
   * Setup event listeners for dashboard
   */
  setupEventListeners() {
    // Listen for data updates
    window.addEventListener('dataUpdated', (e) => {
      this.onDataUpdate(e.detail);
    });

    // Listen for race completion
    window.addEventListener('raceCompleted', (e) => {
      this.trackRaceMetrics(e.detail);
    });
  }

  /**
   * Create analytics dashboard modal
   */
  createDashboard() {
    const modal = document.createElement('div');
    modal.id = 'analytics-dashboard-modal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn';
    modal.innerHTML = `
      <div class="bg-slate-900 border border-cyan-500/30 rounded-xl shadow-2xl shadow-cyan-500/20 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-cyan-500/20 p-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <i class="fas fa-chart-line text-cyan-400 text-2xl"></i>
              <div>
                <h2 class="text-2xl font-bold text-white">Analytics Dashboard</h2>
                <p class="text-sm text-slate-400">Phân tích và báo cáo chi tiết</p>
              </div>
            </div>
            <button onclick="document.getElementById('analytics-dashboard-modal')?.remove()" class="text-slate-400 hover:text-white transition-colors">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-2 bg-slate-800/50 border-b border-slate-700 p-4 overflow-x-auto">
          <button class="analytics-tab-btn active px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 whitespace-nowrap transition-all hover:bg-cyan-500/30" data-tab="overview">
            <i class="fas fa-chart-pie mr-2"></i>Tổng Quan
          </button>
          <button class="analytics-tab-btn px-4 py-2 rounded-lg text-slate-400 whitespace-nowrap transition-all hover:bg-slate-700/50" data-tab="trends">
            <i class="fas fa-arrow-trend-up mr-2"></i>Xu Hướng
          </button>
          <button class="analytics-tab-btn px-4 py-2 rounded-lg text-slate-400 whitespace-nowrap transition-all hover:bg-slate-700/50" data-tab="performance">
            <i class="fas fa-tachometer-alt mr-2"></i>Hiệu Suất
          </button>
          <button class="analytics-tab-btn px-4 py-2 rounded-lg text-slate-400 whitespace-nowrap transition-all hover:bg-slate-700/50" data-tab="heatmap">
            <i class="fas fa-fire mr-2"></i>Heatmap
          </button>
          <button class="analytics-tab-btn px-4 py-2 rounded-lg text-slate-400 whitespace-nowrap transition-all hover:bg-slate-700/50" data-tab="reports">
            <i class="fas fa-file-pdf mr-2"></i>Báo Cáo
          </button>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6">
          <!-- Overview Tab -->
          <div id="analytics-overview" class="analytics-tab-content space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- Total Races -->
              <div class="bg-slate-800/50 border border-blue-500/30 rounded-lg p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-slate-400 text-sm">Tổng Cuộc Đua</p>
                    <p class="text-2xl font-bold text-blue-400" id="stat-total-races">0</p>
                  </div>
                  <i class="fas fa-flag text-3xl text-blue-500/30"></i>
                </div>
              </div>

              <!-- Average Time -->
              <div class="bg-slate-800/50 border border-purple-500/30 rounded-lg p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-slate-400 text-sm">Thời Gian TB</p>
                    <p class="text-2xl font-bold text-purple-400" id="stat-avg-time">-</p>
                  </div>
                  <i class="fas fa-hourglass-end text-3xl text-purple-500/30"></i>
                </div>
              </div>

              <!-- Best Time -->
              <div class="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-slate-400 text-sm">Thời Gian Tốt Nhất</p>
                    <p class="text-2xl font-bold text-cyan-400" id="stat-best-time">-</p>
                  </div>
                  <i class="fas fa-star text-3xl text-cyan-500/30"></i>
                </div>
              </div>

              <!-- Win Rate -->
              <div class="bg-slate-800/50 border border-green-500/30 rounded-lg p-4">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-slate-400 text-sm">Tỷ Lệ Thắng</p>
                    <p class="text-2xl font-bold text-green-400" id="stat-win-rate">-</p>
                  </div>
                  <i class="fas fa-trophy text-3xl text-green-500/30"></i>
                </div>
              </div>
            </div>

            <!-- Charts Row -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Time Distribution -->
              <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <h3 class="text-white font-semibold mb-4 flex items-center gap-2">
                  <i class="fas fa-chart-bar text-cyan-400"></i>
                  Phân Bố Thời Gian
                </h3>
                <canvas id="analytics-time-distribution" height="200"></canvas>
              </div>

              <!-- Race Frequency -->
              <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <h3 class="text-white font-semibold mb-4 flex items-center gap-2">
                  <i class="fas fa-chart-line text-purple-400"></i>
                  Tần Suất Cuộc Đua
                </h3>
                <canvas id="analytics-race-frequency" height="200"></canvas>
              </div>
            </div>
          </div>

          <!-- Trends Tab -->
          <div id="analytics-trends" class="analytics-tab-content hidden space-y-6">
            <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 class="text-white font-semibold mb-4 flex items-center gap-2">
                <i class="fas fa-arrow-trend-up text-green-400"></i>
                Xu Hướng Thời Gian
              </h3>
              <canvas id="analytics-time-trend" height="300"></canvas>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <h3 class="text-white font-semibold mb-4">Xu Hướng Tháng</h3>
                <div id="analytics-monthly-trend" class="space-y-3"></div>
              </div>

              <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <h3 class="text-white font-semibold mb-4">Top Tracks</h3>
                <div id="analytics-top-tracks" class="space-y-2"></div>
              </div>
            </div>
          </div>

          <!-- Performance Tab -->
          <div id="analytics-performance" class="analytics-tab-content hidden space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p class="text-slate-400 text-sm mb-2">Consistency Score</p>
                <div class="text-3xl font-bold text-blue-400" id="performance-consistency">0%</div>
                <div class="w-full bg-slate-700 rounded-full h-2 mt-2">
                  <div id="performance-consistency-bar" class="bg-blue-500 h-2 rounded-full" style="width: 0%"></div>
                </div>
              </div>

              <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p class="text-slate-400 text-sm mb-2">Improvement Rate</p>
                <div class="text-3xl font-bold text-green-400" id="performance-improvement">0%</div>
                <div class="w-full bg-slate-700 rounded-full h-2 mt-2">
                  <div id="performance-improvement-bar" class="bg-green-500 h-2 rounded-full" style="width: 0%"></div>
                </div>
              </div>

              <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <p class="text-slate-400 text-sm mb-2">Overall Rating</p>
                <div class="text-3xl font-bold text-purple-400" id="performance-rating">0/100</div>
                <div class="w-full bg-slate-700 rounded-full h-2 mt-2">
                  <div id="performance-rating-bar" class="bg-purple-500 h-2 rounded-full" style="width: 0%"></div>
                </div>
              </div>
            </div>

            <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 class="text-white font-semibold mb-4">Phân Tích Chi Tiết Hiệu Suất</h3>
              <div id="analytics-performance-details" class="space-y-3"></div>
            </div>
          </div>

          <!-- Heatmap Tab -->
          <div id="analytics-heatmap" class="analytics-tab-content hidden space-y-6">
            <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 class="text-white font-semibold mb-4">Heatmap - Thời Gian Theo Ngày/Giờ</h3>
              <canvas id="analytics-heatmap-canvas" height="250"></canvas>
              <div class="mt-4 flex items-center justify-between text-sm text-slate-400">
                <span>Ít hoạt động</span>
                <div class="flex gap-2">
                  <div class="w-4 h-4 bg-blue-900"></div>
                  <div class="w-4 h-4 bg-cyan-600"></div>
                  <div class="w-4 h-4 bg-green-500"></div>
                  <div class="w-4 h-4 bg-yellow-500"></div>
                  <div class="w-4 h-4 bg-red-500"></div>
                </div>
                <span>Nhiều hoạt động</span>
              </div>
            </div>
          </div>

          <!-- Reports Tab -->
          <div id="analytics-reports" class="analytics-tab-content hidden space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onclick="analyticsDashboard.exportReport('pdf')" class="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2">
                <i class="fas fa-file-pdf"></i>
                Xuất PDF
              </button>
              <button onclick="analyticsDashboard.exportReport('csv')" class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2">
                <i class="fas fa-file-csv"></i>
                Xuất CSV
              </button>
              <button onclick="analyticsDashboard.exportReport('json')" class="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2">
                <i class="fas fa-code"></i>
                Xuất JSON
              </button>
              <button onclick="analyticsDashboard.generateCustomReport()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2">
                <i class="fas fa-sliders-h"></i>
                Báo Cáo Tùy Chỉnh
              </button>
            </div>

            <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h3 class="text-white font-semibold mb-4">Báo Cáo Gần Đây</h3>
              <div id="analytics-recent-reports" class="space-y-2"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.attachTabListeners();
    this.loadAnalyticsData();
  }

  /**
   * Attach tab switching listeners
   */
  attachTabListeners() {
    const tabButtons = document.querySelectorAll('.analytics-tab-btn');
    const tabContents = document.querySelectorAll('.analytics-tab-content');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.currentTarget.dataset.tab;

        // Update active button
        tabButtons.forEach(b => {
          b.classList.remove('active', 'bg-cyan-500/20', 'text-cyan-400', 'border-cyan-500/50');
          b.classList.add('text-slate-400', 'hover:bg-slate-700/50');
        });
        e.currentTarget.classList.add('active', 'bg-cyan-500/20', 'text-cyan-400', 'border-cyan-500/50');
        e.currentTarget.classList.remove('text-slate-400', 'hover:bg-slate-700/50');

        // Update active tab
        tabContents.forEach(tab => tab.classList.add('hidden'));
        const activeTab = document.getElementById(`analytics-${tabName}`);
        if (activeTab) {
          activeTab.classList.remove('hidden');
          this.renderTabContent(tabName);
        }
      });
    });
  }

  /**
   * Load analytics data from storage/database
   */
  async loadAnalyticsData() {
    try {
      // Get from IndexedDB cache first
      const cached = await performanceOptimizer?.getCachedData('analytics-data');
      if (cached) {
        this.analyticsData = cached;
      } else {
        // Load from Firestore or localStorage
        this.analyticsData = JSON.parse(localStorage.getItem('allRaces') || '[]');
      }

      this.calculateStatistics();
      this.renderTabContent('overview');
    } catch (error) {
      console.error('❌ Error loading analytics:', error);
    }
  }

  /**
   * Calculate statistics from race data
   */
  calculateStatistics() {
    if (this.analyticsData.length === 0) return;

    const times = this.analyticsData.map(r => this.parseTime(r.time));
    const validTimes = times.filter(t => !isNaN(t));

    const totalRaces = this.analyticsData.length;
    const avgTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    const bestTime = Math.min(...validTimes);
    const worstTime = Math.max(...validTimes);

    // Calculate win rate (top 3 finishes)
    const top3Count = this.analyticsData.filter(r => r.position <= 3).length;
    const winRate = ((top3Count / totalRaces) * 100).toFixed(1);

    // Update UI
    document.getElementById('stat-total-races').textContent = totalRaces;
    document.getElementById('stat-avg-time').textContent = this.formatTime(avgTime);
    document.getElementById('stat-best-time').textContent = this.formatTime(bestTime);
    document.getElementById('stat-win-rate').textContent = winRate + '%';

    // Calculate performance metrics
    this.calculatePerformanceMetrics(validTimes);
  }

  /**
   * Calculate performance metrics
   */
  calculatePerformanceMetrics(times) {
    if (times.length < 2) return;

    // Consistency: lower std deviation = higher consistency
    const mean = times.reduce((a, b) => a + b) / times.length;
    const variance = times.reduce((sq, n) => sq + Math.pow(n - mean, 2)) / times.length;
    const stdDev = Math.sqrt(variance);
    const consistency = Math.max(0, 100 - (stdDev * 10));

    // Improvement: compare first vs last 5 races
    const recentTimes = times.slice(-5);
    const earlierTimes = times.slice(0, Math.min(5, times.length - 5));
    const improvement = earlierTimes.length > 0 ? 
      ((earlierTimes[0] - recentTimes[recentTimes.length - 1]) / earlierTimes[0] * 100) : 0;

    // Overall rating
    const rating = (consistency * 0.4 + Math.max(0, improvement) * 0.3 + (100 - stdDev) * 0.3);

    document.getElementById('performance-consistency').textContent = consistency.toFixed(0) + '%';
    document.getElementById('performance-consistency-bar').style.width = consistency + '%';

    document.getElementById('performance-improvement').textContent = improvement.toFixed(1) + '%';
    document.getElementById('performance-improvement-bar').style.width = Math.max(0, improvement) + '%';

    document.getElementById('performance-rating').textContent = rating.toFixed(0) + '/100';
    document.getElementById('performance-rating-bar').style.width = (rating / 100 * 100) + '%';
  }

  /**
   * Render specific tab content
   */
  renderTabContent(tabName) {
    switch (tabName) {
      case 'overview':
        this.renderOverview();
        break;
      case 'trends':
        this.renderTrends();
        break;
      case 'performance':
        this.renderPerformance();
        break;
      case 'heatmap':
        this.renderHeatmap();
        break;
      case 'reports':
        this.renderReports();
        break;
    }
  }

  /**
   * Render overview tab with charts
   */
  renderOverview() {
    if (this.analyticsData.length === 0) return;

    // Time Distribution Chart
    setTimeout(() => {
      const ctx = document.getElementById('analytics-time-distribution')?.getContext('2d');
      if (ctx) {
        const times = this.analyticsData.map(r => this.parseTime(r.time)).sort((a, b) => a - b);
        const buckets = {
          '< 2:00': times.filter(t => t < 120).length,
          '2:00 - 2:30': times.filter(t => t >= 120 && t < 150).length,
          '2:30 - 3:00': times.filter(t => t >= 150 && t < 180).length,
          '> 3:00': times.filter(t => t >= 180).length
        };

        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: Object.keys(buckets),
            datasets: [{
              label: 'Số Lần Chạy',
              data: Object.values(buckets),
              backgroundColor: [
                'rgba(0, 243, 255, 0.5)',
                'rgba(0, 102, 255, 0.5)',
                'rgba(157, 0, 255, 0.5)',
                'rgba(255, 0, 204, 0.5)'
              ],
              borderColor: [
                'rgb(0, 243, 255)',
                'rgb(0, 102, 255)',
                'rgb(157, 0, 255)',
                'rgb(255, 0, 204)'
              ],
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } },
              x: { grid: { color: 'rgba(255,255,255,0.1)' } }
            }
          }
        });
      }
    }, 100);

    // Race Frequency Chart
    setTimeout(() => {
      const ctx = document.getElementById('analytics-race-frequency')?.getContext('2d');
      if (ctx) {
        const last7Days = this.getLast7DaysData();
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: Object.keys(last7Days),
            datasets: [{
              label: 'Cuộc Đua Mỗi Ngày',
              data: Object.values(last7Days),
              borderColor: 'rgb(157, 0, 255)',
              backgroundColor: 'rgba(157, 0, 255, 0.1)',
              tension: 0.4,
              fill: true
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: true }
            },
            scales: {
              y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.1)' } },
              x: { grid: { color: 'rgba(255,255,255,0.1)' } }
            }
          }
        });
      }
    }, 200);
  }

  /**
   * Render trends tab
   */
  renderTrends() {
    if (this.analyticsData.length === 0) return;

    setTimeout(() => {
      const ctx = document.getElementById('analytics-time-trend')?.getContext('2d');
      if (ctx) {
        const sortedData = [...this.analyticsData].sort((a, b) => new Date(a.date) - new Date(b.date));
        const times = sortedData.map(r => this.parseTime(r.time));

        new Chart(ctx, {
          type: 'line',
          data: {
            labels: sortedData.map(r => r.date?.substring(0, 10) || 'Unknown'),
            datasets: [{
              label: 'Thời Gian Chạy',
              data: times,
              borderColor: 'rgb(0, 243, 255)',
              backgroundColor: 'rgba(0, 243, 255, 0.1)',
              tension: 0.4,
              fill: true,
              pointRadius: 3,
              pointBackgroundColor: 'rgb(0, 243, 255)'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: {
              y: { grid: { color: 'rgba(255,255,255,0.1)' } },
              x: { grid: { color: 'rgba(255,255,255,0.1)' } }
            }
          }
        });
      }
    }, 100);

    // Monthly trend
    const monthlyTrend = this.getMonthlyTrend();
    const trendHtml = Object.entries(monthlyTrend).map(([month, data]) => `
      <div class="flex items-center justify-between text-sm">
        <span class="text-slate-400">${month}</span>
        <span class="font-semibold text-cyan-400">${data.count} cuộc - TB: ${data.avgTime}</span>
      </div>
    `).join('');

    const trendContainer = document.getElementById('analytics-monthly-trend');
    if (trendContainer) trendContainer.innerHTML = trendHtml;

    // Top tracks
    const topTracks = this.getTopTracks();
    const tracksHtml = topTracks.map((track, idx) => `
      <div class="flex items-center justify-between p-2 bg-slate-700/20 rounded">
        <span class="text-slate-300">${idx + 1}. ${track.name}</span>
        <span class="text-cyan-400 font-semibold">${track.count} lần</span>
      </div>
    `).join('');

    const tracksContainer = document.getElementById('analytics-top-tracks');
    if (tracksContainer) tracksContainer.innerHTML = tracksHtml;
  }

  /**
   * Render performance tab
   */
  renderPerformance() {
    const details = document.getElementById('analytics-performance-details');
    if (!details) return;

    const cars = this.getCarPerformance();
    const pets = this.getPetPerformance();

    let html = '<div class="grid grid-cols-1 md:grid-cols-2 gap-4">';
    
    html += '<div><h4 class="text-slate-300 font-semibold mb-2">Xe Tốt Nhất</h4>';
    html += cars.slice(0, 5).map((car, idx) => `
      <div class="flex justify-between text-sm p-2 bg-slate-700/20 rounded">
        <span>${car.name}</span>
        <span class="text-green-400">${car.avgTime}</span>
      </div>
    `).join('');
    html += '</div>';

    html += '<div><h4 class="text-slate-300 font-semibold mb-2">Pet Tốt Nhất</h4>';
    html += pets.slice(0, 5).map((pet, idx) => `
      <div class="flex justify-between text-sm p-2 bg-slate-700/20 rounded">
        <span>${pet.name}</span>
        <span class="text-blue-400">${pet.avgTime}</span>
      </div>
    `).join('');
    html += '</div></div>';

    details.innerHTML = html;
  }

  /**
   * Render heatmap
   */
  renderHeatmap() {
    setTimeout(() => {
      const ctx = document.getElementById('analytics-heatmap-canvas')?.getContext('2d');
      if (ctx) {
        const heatmapData = this.generateHeatmapData();
        const chart = new Chart(ctx, {
          type: 'bubble',
          data: {
            datasets: heatmapData.map(item => ({
              label: item.label,
              data: item.data,
              backgroundColor: item.color
            }))
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { title: { display: true, text: 'Giờ Trong Ngày' } },
              y: { title: { display: true, text: 'Ngày Trong Tuần' } }
            }
          }
        });
      }
    }, 100);
  }

  /**
   * Render reports tab
   */
  renderReports() {
    const recentReports = JSON.parse(localStorage.getItem('generatedReports') || '[]');
    const reportsHtml = recentReports.slice(0, 10).map(report => `
      <div class="flex items-center justify-between p-3 bg-slate-700/20 rounded">
        <div>
          <p class="text-white text-sm">${report.name}</p>
          <p class="text-slate-400 text-xs">${new Date(report.date).toLocaleString('vi-VN')}</p>
        </div>
        <button onclick="analyticsDashboard.downloadReport('${report.id}')" class="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded transition-all">
          Tải
        </button>
      </div>
    `).join('');

    const container = document.getElementById('analytics-recent-reports');
    if (container) container.innerHTML = reportsHtml || '<p class="text-slate-400 text-sm">Chưa có báo cáo nào</p>';
  }

  /**
   * Export report in different formats
   */
  async exportReport(format) {
    try {
      const reportData = {
        generatedAt: new Date().toISOString(),
        totalRaces: this.analyticsData.length,
        races: this.analyticsData
      };

      let content, filename, mimeType;

      if (format === 'pdf') {
        // Simple PDF export (would need jsPDF library for production)
        content = this.generatePDFContent(reportData);
        filename = `analytics-report-${Date.now()}.txt`;
        mimeType = 'text/plain';
      } else if (format === 'csv') {
        content = this.convertToCSV(this.analyticsData);
        filename = `analytics-report-${Date.now()}.csv`;
        mimeType = 'text/csv';
      } else if (format === 'json') {
        content = JSON.stringify(reportData, null, 2);
        filename = `analytics-report-${Date.now()}.json`;
        mimeType = 'application/json';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();

      // Save to reports history
      this.saveReportToHistory(filename, format);

      notificationSystem?.addNotification({
        type: 'success',
        title: 'Xuất Thành Công',
        message: `Báo cáo ${format.toUpperCase()} đã được tải xuống`
      });
    } catch (error) {
      console.error('❌ Export error:', error);
      notificationSystem?.addNotification({
        type: 'error',
        message: 'Lỗi xuất báo cáo'
      });
    }
  }

  /**
   * Save report to history
   */
  saveReportToHistory(filename, format) {
    const reports = JSON.parse(localStorage.getItem('generatedReports') || '[]');
    reports.unshift({
      id: Date.now(),
      name: filename,
      format: format,
      date: new Date().toISOString()
    });
    localStorage.setItem('generatedReports', JSON.stringify(reports.slice(0, 20)));
  }

  /**
   * Generate custom report
   */
  generateCustomReport() {
    notificationSystem?.addNotification({
      type: 'info',
      message: 'Tính năng báo cáo tùy chỉnh sắp được cập nhật'
    });
  }

  /**
   * Download specific report
   */
  downloadReport(reportId) {
    const reports = JSON.parse(localStorage.getItem('generatedReports') || '[]');
    const report = reports.find(r => r.id == reportId);
    if (report) {
      notificationSystem?.addNotification({
        type: 'info',
        message: 'Tải xuống: ' + report.name
      });
    }
  }

  /**
   * Helper: Parse time string to seconds
   */
  parseTime(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.match(/(\d+):(\d+)\.?(\d*)/);
    if (!parts) return 0;
    return parseInt(parts[1]) * 60 + parseInt(parts[2]) + (parseInt(parts[3] || 0) / 100);
  }

  /**
   * Helper: Format seconds to time string
   */
  formatTime(seconds) {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs}`;
  }

  /**
   * Helper: Get last 7 days data
   */
  getLast7DaysData() {
    const data = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().substring(0, 10);
      const count = this.analyticsData.filter(r => r.date?.substring(0, 10) === dateStr).length;
      data[dateStr] = count;
    }
    return data;
  }

  /**
   * Helper: Get monthly trend
   */
  getMonthlyTrend() {
    const monthMap = {};
    this.analyticsData.forEach(race => {
      const date = new Date(race.date);
      const month = date.toLocaleString('vi-VN', { month: 'long', year: 'numeric' });
      if (!monthMap[month]) monthMap[month] = { count: 0, times: [] };
      monthMap[month].count++;
      monthMap[month].times.push(this.parseTime(race.time));
    });

    Object.keys(monthMap).forEach(month => {
      const times = monthMap[month].times;
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      monthMap[month].avgTime = this.formatTime(avg);
    });

    return monthMap;
  }

  /**
   * Helper: Get top tracks
   */
  getTopTracks() {
    const trackMap = {};
    this.analyticsData.forEach(race => {
      const track = race.track || 'Unknown';
      trackMap[track] = (trackMap[track] || 0) + 1;
    });

    return Object.entries(trackMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Helper: Get car performance
   */
  getCarPerformance() {
    const carMap = {};
    this.analyticsData.forEach(race => {
      const car = race.car || 'Unknown';
      if (!carMap[car]) carMap[car] = { name: car, times: [] };
      carMap[car].times.push(this.parseTime(race.time));
    });

    return Object.values(carMap)
      .map(car => ({
        name: car.name,
        avgTime: this.formatTime(car.times.reduce((a, b) => a + b, 0) / car.times.length)
      }))
      .sort((a, b) => this.parseTime(a.avgTime) - this.parseTime(b.avgTime));
  }

  /**
   * Helper: Get pet performance
   */
  getPetPerformance() {
    const petMap = {};
    this.analyticsData.forEach(race => {
      const pet = race.pet || 'Unknown';
      if (!petMap[pet]) petMap[pet] = { name: pet, times: [] };
      petMap[pet].times.push(this.parseTime(race.time));
    });

    return Object.values(petMap)
      .map(pet => ({
        name: pet.name,
        avgTime: this.formatTime(pet.times.reduce((a, b) => a + b, 0) / pet.times.length)
      }))
      .sort((a, b) => this.parseTime(a.avgTime) - this.parseTime(b.avgTime));
  }

  /**
   * Helper: Generate heatmap data
   */
  generateHeatmapData() {
    const heatmap = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let day = 0; day < 7; day++) {
        const count = this.analyticsData.filter(r => {
          const d = new Date(r.date);
          return d.getHours() === hour && d.getDay() === day;
        }).length;

        if (count > 0) {
          heatmap.push({
            x: hour,
            y: day,
            r: count * 2
          });
        }
      }
    }

    return [{
      label: 'Activity',
      data: heatmap,
      color: 'rgba(0, 243, 255, 0.6)'
    }];
  }

  /**
   * Helper: Convert to CSV
   */
  convertToCSV(data) {
    const headers = ['Track', 'Time', 'Position', 'Car', 'Pet', 'Date'];
    const rows = data.map(r => [
      r.track || '',
      r.time || '',
      r.position || '',
      r.car || '',
      r.pet || '',
      r.date || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Helper: Generate PDF content
   */
  generatePDFContent(data) {
    return `
ANALYTICS REPORT
Generated: ${new Date().toLocaleString('vi-VN')}

SUMMARY
Total Races: ${data.totalRaces}
Report Period: ${data.generatedAt}

RACES DATA
${JSON.stringify(data.races, null, 2)}
    `;
  }

  /**
   * Track race metrics
   */
  trackRaceMetrics(raceData) {
    this.analyticsData.push({
      ...raceData,
      date: new Date().toISOString()
    });

    // Save to IndexedDB
    if (performanceOptimizer) {
      performanceOptimizer.cacheData('analytics-data', this.analyticsData);
    }
  }

  /**
   * Handle data updates
   */
  onDataUpdate(data) {
    this.loadAnalyticsData();
  }
}

// Auto-initialize
window.analyticsDashboard = window.analyticsDashboard || new AnalyticsDashboard();
console.log('✅ AnalyticsDashboard loaded');
