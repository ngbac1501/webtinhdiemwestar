/**
 * PermissionSystem - Role-based Access Control & Audit Logging
 * Manages user roles, permissions, and tracks all actions
 * Auto-initializes on page load
 */

class PermissionSystem {
  constructor() {
    this.currentUser = null;
    this.currentRole = 'viewer';
    this.permissions = new Map();
    this.auditLog = [];
    this.isInitialized = false;
    this.roleHierarchy = {
      admin: 999,
      moderator: 50,
      editor: 25,
      user: 10,
      viewer: 1
    };
    this.init();
  }

  /**
   * Initialize permission system
   */
  async init() {
    try {
      console.log('🔐 PermissionSystem initializing...');

      // Load current user
      await this.loadCurrentUser();

      // Define roles and permissions
      this.defineRoles();

      // Setup permission checking
      this.setupPermissionChecking();

      // Load audit log
      this.loadAuditLog();

      this.isInitialized = true;
      console.log('✅ PermissionSystem initialized');
    } catch (error) {
      console.error('❌ PermissionSystem init error:', error);
    }
  }

  /**
   * Load current user from auth
   */
  async loadCurrentUser() {
    // This would normally get user from Firebase Auth
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    this.currentUser = user;
    this.currentRole = user.role || 'viewer';
  }

  /**
   * Define roles and their permissions
   */
  defineRoles() {
    const roles = {
      admin: {
        name: 'Quản Trị Viên',
        description: 'Toàn quyền truy cập',
        permissions: [
          'create_race',
          'edit_race',
          'delete_race',
          'view_all_users',
          'manage_users',
          'manage_roles',
          'view_audit_log',
          'export_data',
          'import_data',
          'manage_settings',
          'delete_data',
          'view_analytics',
          'manage_system'
        ]
      },
      moderator: {
        name: 'Điều Hành Viên',
        description: 'Quản lý nội dung và người dùng',
        permissions: [
          'create_race',
          'edit_race',
          'delete_race',
          'view_all_users',
          'manage_users',
          'view_audit_log',
          'export_data',
          'view_analytics'
        ]
      },
      editor: {
        name: 'Biên Tập Viên',
        description: 'Chỉnh sửa nội dung',
        permissions: [
          'create_race',
          'edit_race',
          'edit_own_race',
          'view_analytics'
        ]
      },
      user: {
        name: 'Người Dùng',
        description: 'Người dùng thường',
        permissions: [
          'create_race',
          'edit_own_race',
          'view_own_data',
          'view_profile',
          'use_chat'
        ]
      },
      viewer: {
        name: 'Khách',
        description: 'Chỉ xem',
        permissions: [
          'view_public_data',
          'view_profile',
          'use_chat'
        ]
      }
    };

    // Store permissions for each role
    Object.entries(roles).forEach(([role, data]) => {
      this.permissions.set(role, new Set(data.permissions));
    });
  }

  /**
   * Check if user has permission
   */
  hasPermission(permission) {
    if (this.currentRole === 'admin') return true; // Admin has all permissions

    const rolePermissions = this.permissions.get(this.currentRole);
    return rolePermissions ? rolePermissions.has(permission) : false;
  }

  /**
   * Check if user has role
   */
  hasRole(role) {
    const currentHierarchy = this.roleHierarchy[this.currentRole] || 0;
    const requiredHierarchy = this.roleHierarchy[role] || 0;
    return currentHierarchy >= requiredHierarchy;
  }

  /**
   * Setup permission checking for DOM elements
   */
  setupPermissionChecking() {
    // Hide/disable elements based on permissions
    document.addEventListener('DOMContentLoaded', () => {
      this.applyPermissions();
    });

    // Also apply on load
    this.applyPermissions();
  }

  /**
   * Apply permissions to DOM elements
   */
  applyPermissions() {
    // Find all elements with data-permission attribute
    const permissionedElements = document.querySelectorAll('[data-permission]');

    permissionedElements.forEach(element => {
      const requiredPermission = element.dataset.permission;

      if (!this.hasPermission(requiredPermission)) {
        element.style.display = 'none';
        element.disabled = true;
      } else {
        element.style.display = '';
        element.disabled = false;
      }
    });

    // Find all elements with data-role attribute
    const roleElements = document.querySelectorAll('[data-role]');

    roleElements.forEach(element => {
      const requiredRole = element.dataset.role;

      if (!this.hasRole(requiredRole)) {
        element.style.display = 'none';
        element.disabled = true;
      } else {
        element.style.display = '';
        element.disabled = false;
      }
    });
  }

  /**
   * Create permission management modal
   */
  createPermissionManager() {
    if (!this.hasPermission('manage_roles')) {
      notificationSystem?.addNotification({
        type: 'error',
        message: 'Bạn không có quyền quản lý vai trò'
      });
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'permission-manager-modal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn';
    modal.innerHTML = `
      <div class="bg-slate-900 border border-purple-500/30 rounded-xl shadow-2xl shadow-purple-500/20 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-purple-500/20 p-6">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <i class="fas fa-shield-alt text-purple-400 text-2xl"></i>
              <div>
                <h2 class="text-2xl font-bold text-white">Quản Lý Vai Trò & Quyền</h2>
                <p class="text-sm text-slate-400">Cấu hình quyền truy cập người dùng</p>
              </div>
            </div>
            <button onclick="document.getElementById('permission-manager-modal')?.remove()" class="text-slate-400 hover:text-white transition-colors">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="p-6 space-y-6">
          <!-- Roles Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${this.getRolesList().map(role => `
              <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-white font-bold">${role.name}</h3>
                  <span class="text-xs px-2 py-1 bg-purple-600/20 text-purple-300 rounded">${role.permissions.length} quyền</span>
                </div>
                <p class="text-sm text-slate-400 mb-3">${role.description}</p>
                <button onclick="permissionSystem.showRoleDetails('${role.id}')" class="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-all">
                  Quản Lý Quyền
                </button>
              </div>
            `).join('')}
          </div>

          <!-- User Management -->
          <div class="border-t border-slate-700 pt-6">
            <h3 class="text-white font-bold mb-4 flex items-center gap-2">
              <i class="fas fa-users text-purple-400"></i>
              Quản Lý Người Dùng
            </h3>
            <div id="user-list" class="space-y-3"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this.loadUserList();
  }

  /**
   * Get roles list
   */
  getRolesList() {
    return [
      {
        id: 'admin',
        name: 'Quản Trị Viên',
        description: 'Toàn quyền truy cập',
        permissions: Array.from(this.permissions.get('admin') || [])
      },
      {
        id: 'moderator',
        name: 'Điều Hành Viên',
        description: 'Quản lý nội dung',
        permissions: Array.from(this.permissions.get('moderator') || [])
      },
      {
        id: 'editor',
        name: 'Biên Tập Viên',
        description: 'Chỉnh sửa nội dung',
        permissions: Array.from(this.permissions.get('editor') || [])
      },
      {
        id: 'user',
        name: 'Người Dùng',
        description: 'Người dùng thường',
        permissions: Array.from(this.permissions.get('user') || [])
      },
      {
        id: 'viewer',
        name: 'Khách',
        description: 'Chỉ xem',
        permissions: Array.from(this.permissions.get('viewer') || [])
      }
    ];
  }

  /**
   * Show role details
   */
  showRoleDetails(roleId) {
    const role = this.permissions.get(roleId);
    if (!role) return;

    const details = document.createElement('div');
    details.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-fadeIn';
    details.innerHTML = `
      <div class="bg-slate-900 border border-purple-500/30 rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-white font-bold text-lg">Quyền của Vai Trò: ${roleId}</h3>
          <button onclick="this.closest('div').remove()" class="text-slate-400 hover:text-white">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          ${Array.from(role).map(permission => `
            <label class="flex items-center gap-2 p-2 hover:bg-slate-800 rounded cursor-pointer">
              <input type="checkbox" checked class="w-4 h-4" onchange="permissionSystem.updateRolePermission('${roleId}', '${permission}', this.checked)">
              <span class="text-sm text-slate-300">${permission}</span>
            </label>
          `).join('')}
        </div>

        <div class="flex gap-3 mt-6">
          <button onclick="permissionSystem.saveRolePermissions('${roleId}')" class="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-all">
            Lưu
          </button>
          <button onclick="this.closest('div').remove()" class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-all">
            Hủy
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(details);
  }

  /**
   * Load user list
   */
  loadUserList() {
    const container = document.getElementById('user-list');
    if (!container) return;

    // Simulated users - would normally load from database
    const users = [
      { id: 1, name: 'Admin User', email: 'admin@example.com', role: 'admin' },
      { id: 2, name: 'Moderator User', email: 'mod@example.com', role: 'moderator' },
      { id: 3, name: 'Regular User', email: 'user@example.com', role: 'user' }
    ];

    container.innerHTML = users.map(user => `
      <div class="flex items-center justify-between p-3 bg-slate-800/50 border border-slate-700 rounded">
        <div>
          <p class="text-white font-medium">${user.name}</p>
          <p class="text-sm text-slate-400">${user.email}</p>
        </div>
        <select onchange="permissionSystem.updateUserRole(${user.id}, this.value)" class="bg-slate-700 text-white text-sm px-3 py-1 rounded">
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Moderator</option>
          <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
          <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
          <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
        </select>
      </div>
    `).join('');
  }

  /**
   * Update user role
   */
  updateUserRole(userId, newRole) {
    this.logAction('UPDATE_USER_ROLE', {
      userId,
      newRole,
      timestamp: new Date().toISOString()
    });

    notificationSystem?.addNotification({
      type: 'success',
      message: `Đã cập nhật vai trò người dùng`
    });
  }

  /**
   * Update role permission
   */
  updateRolePermission(roleId, permission, isGranted) {
    const role = this.permissions.get(roleId);
    if (isGranted) {
      role.add(permission);
    } else {
      role.delete(permission);
    }
  }

  /**
   * Save role permissions
   */
  saveRolePermissions(roleId) {
    this.logAction('SAVE_ROLE_PERMISSIONS', {
      roleId,
      permissions: Array.from(this.permissions.get(roleId) || []),
      timestamp: new Date().toISOString()
    });

    notificationSystem?.addNotification({
      type: 'success',
      message: `Đã lưu quyền cho vai trò ${roleId}`
    });
  }

  /**
   * Log action to audit log
   */
  logAction(action, details = {}) {
    const logEntry = {
      id: Date.now(),
      action,
      userId: this.currentUser?.id || 'unknown',
      userRole: this.currentRole,
      timestamp: new Date().toISOString(),
      details,
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent
    };

    this.auditLog.unshift(logEntry);

    // Keep only last 1000 entries in memory
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(0, 1000);
    }

    // Save to localStorage
    this.saveAuditLog();

    // Emit event
    window.dispatchEvent(new CustomEvent('auditLogEntry', { detail: logEntry }));
  }

  /**
   * Save audit log
   */
  saveAuditLog() {
    try {
      localStorage.setItem('auditLog', JSON.stringify(this.auditLog.slice(0, 500)));
    } catch (error) {
      console.error('❌ Error saving audit log:', error);
    }
  }

  /**
   * Load audit log
   */
  loadAuditLog() {
    try {
      const log = JSON.parse(localStorage.getItem('auditLog') || '[]');
      this.auditLog = log;
    } catch (error) {
      console.error('❌ Error loading audit log:', error);
    }
  }

  /**
   * View audit log
   */
  viewAuditLog() {
    if (!this.hasPermission('view_audit_log')) {
      notificationSystem?.addNotification({
        type: 'error',
        message: 'Bạn không có quyền xem nhật ký kiểm tra'
      });
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn';
    modal.innerHTML = `
      <div class="bg-slate-900 border border-blue-500/30 rounded-xl w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div class="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-blue-500/20 p-6 flex items-center justify-between">
          <h2 class="text-2xl font-bold text-white flex items-center gap-3">
            <i class="fas fa-history text-blue-400"></i>
            Nhật Ký Kiểm Tra
          </h2>
          <button onclick="this.closest('div').parentElement.remove()" class="text-slate-400 hover:text-white">
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>

        <div class="p-6 space-y-2">
          ${this.auditLog.slice(0, 100).map(entry => `
            <div class="p-3 bg-slate-800/50 border border-slate-700 rounded text-sm">
              <div class="flex items-center justify-between mb-1">
                <span class="font-semibold text-cyan-400">${entry.action}</span>
                <span class="text-xs text-slate-500">${new Date(entry.timestamp).toLocaleString('vi-VN')}</span>
              </div>
              <div class="flex items-center gap-2 text-slate-400">
                <i class="fas fa-user text-xs"></i>
                <span>${entry.userId}</span>
                <span class="text-slate-600">•</span>
                <span class="text-slate-500">${entry.userRole}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  /**
   * Get client IP (simplified)
   */
  getClientIP() {
    return 'N/A';
  }

  /**
   * Check action permission before executing
   */
  async checkActionPermission(action, context = {}) {
    const permissionMap = {
      'create_race': 'create_race',
      'edit_race': 'edit_race',
      'delete_race': 'delete_race',
      'export_data': 'export_data',
      'import_data': 'import_data',
      'manage_users': 'manage_users'
    };

    const requiredPermission = permissionMap[action];

    if (!requiredPermission || this.hasPermission(requiredPermission)) {
      this.logAction(action, context);
      return true;
    }

    notificationSystem?.addNotification({
      type: 'error',
      message: `Bạn không có quyền thực hiện: ${action}`
    });

    return false;
  }

  /**
   * Get user permissions
   */
  getUserPermissions(role = this.currentRole) {
    return Array.from(this.permissions.get(role) || []);
  }

  /**
   * Set current user role
   */
  setUserRole(userId, role) {
    if (!this.hasPermission('manage_users')) {
      return false;
    }

    this.logAction('SET_USER_ROLE', {
      userId,
      newRole: role,
      oldRole: this.currentRole
    });

    return true;
  }
}

// Auto-initialize
window.permissionSystem = window.permissionSystem || new PermissionSystem();
console.log('✅ PermissionSystem loaded');
