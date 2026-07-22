/**
 * Real-time Notifications System
 * Quản lý thông báo toast, bell notifications, và event tracking
 */

class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.maxNotifications = 5;
        this.notificationDuration = 5000; // 5 seconds
        this.events = new Map();
        this.unreadCount = 0;
        this.init();
    }

    /**
     * Khởi tạo hệ thống thông báo
     */
    init() {
        this.createNotificationContainer();
        this.createBellIcon();
        this.restoreNotifications();
    }

    /**
     * Tạo container cho notifications
     */
    createNotificationContainer() {
        if (document.getElementById('notification-container')) return;

        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-width: 400px;
        `;

        document.body.appendChild(container);
    }

    /**
     * Tạo bell icon trong header
     */
    createBellIcon() {
        // Không hiển thị bell icon trên trang map-detail và configdata
        if (window.location.pathname.includes('map-detail.html') || window.location.pathname.includes('configdata.html')) return;

        const header = document.querySelector('header') || document.querySelector('nav');
        if (!header) return;

        const existingBell = document.getElementById('notification-bell');
        // Nếu đã có bell icon trong HTML thì không tạo mới/ghi đè để tránh mất các element con (như notification-count)
        if (existingBell && existingBell.children.length > 0) return;

        const bellContainer = existingBell || document.createElement('div');
        bellContainer.id = 'notification-bell';
        bellContainer.innerHTML = `
            <div style="position: relative; display: inline-block; cursor: pointer;">
                <i class="fas fa-bell" style="font-size: 1.3rem; color: var(--neon-cyan); transition: all 0.3s ease;"></i>
                <span id="unread-badge" style="
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background: var(--neon-red);
                    color: white;
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.75rem;
                    font-weight: bold;
                    display: none;
                ">0</span>
            </div>
        `;

        if (!document.getElementById('notification-bell')) {
            const headerRight = header.querySelector('.flex-1') || header;
            headerRight.appendChild(bellContainer);
        }
    }

    /**
     * Thêm notification
     */
    addNotification(options = {}) {
        const {
            type = 'info', // success, error, warning, info
            title = 'Thông báo',
            message = '',
            duration = this.notificationDuration,
            icon = null,
            action = null,
            persistent = false
        } = options;

        const notification = {
            id: Date.now(),
            type,
            title,
            message,
            icon,
            action,
            persistent,
            timestamp: new Date(),
            read: false
        };

        this.notifications.unshift(notification);

        // Giới hạn số lượng notifications
        if (this.notifications.length > 20) {
            this.notifications = this.notifications.slice(0, 20);
        }

        // Hiển thị toast
        this.showToast(notification);

        // Cập nhật badge
        this.updateBadge();

        // Lưu lại
        this.saveNotifications();

        return notification.id;
    }

    /**
     * Hiển thị toast notification
     */
    showToast(notification) {
        const container = document.getElementById('notification-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.id = `notification-${notification.id}`;
        toast.style.cssText = `
            background: linear-gradient(135deg, rgba(18, 18, 26, 0.95), rgba(30, 30, 46, 0.95));
            border: 1px solid var(--neon-cyan);
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 10px 30px rgba(0, 243, 255, 0.2);
            animation: slideIn 0.3s ease-out;
            display: flex;
            gap: 12px;
            align-items: flex-start;
            min-width: 300px;
        `;

        const iconColor = this.getIconColor(notification.type);
        const icon = this.getNotificationIcon(notification.type);

        toast.innerHTML = `
            <div style="color: ${iconColor}; font-size: 1.2rem; flex-shrink: 0;">
                <i class="${notification.icon || icon}"></i>
            </div>
            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 600; margin-bottom: 4px; color: ${iconColor};">
                    ${notification.title}
                </div>
                <div style="font-size: 0.9rem; color: #cbd5e0; margin-bottom: 8px;">
                    ${notification.message}
                </div>
                ${notification.action ? `
                    <button onclick="${notification.action}" style="
                        background: ${iconColor};
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.85rem;
                        font-weight: 600;
                        transition: all 0.2s ease;
                    ">
                        Xem chi tiết
                    </button>
                ` : ''}
            </div>
            <button onclick="document.getElementById('notification-${notification.id}').remove();" style="
                background: none;
                border: none;
                color: #cbd5e0;
                cursor: pointer;
                font-size: 1.2rem;
                padding: 0;
                flex-shrink: 0;
                transition: all 0.2s ease;
            ">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(toast);

        // Auto remove
        if (!notification.persistent) {
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease-out forwards';
                setTimeout(() => toast.remove(), 300);
            }, notification.persistent ? Infinity : this.notificationDuration);
        }
    }


    /**
     * Cập nhật badge
     */
    updateBadge() {
        const badge = document.getElementById('unread-badge');
        if (!badge) return;

        this.unreadCount = this.notifications.filter(n => !n.read).length;

        if (this.unreadCount > 0) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    /**
     * Xóa notification
     */
    removeNotification(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        const element = document.getElementById(`notification-${id}`);
        if (element) element.remove();
        this.updateBadge();
        this.saveNotifications();
    }

    /**
     * Clear all notifications
     */
    clearAll() {
        this.notifications = [];
        this.unreadCount = 0;
        this.updateBadge();
        const container = document.getElementById('notification-container');
        if (container) container.innerHTML = '';
        this.saveNotifications();
    }

    /**
     * Event listeners
     */
    on(eventName, callback) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        this.events.get(eventName).push(callback);
    }

    /**
     * Trigger event
     */
    emit(eventName, data) {
        if (this.events.has(eventName)) {
            this.events.get(eventName).forEach(callback => callback(data));
        }
    }

    /**
     * Helper: Get icon color
     */
    getIconColor(type) {
        const colors = {
            success: 'var(--neon-green)',
            error: 'var(--neon-red)',
            warning: 'var(--neon-yellow)',
            info: 'var(--neon-cyan)'
        };
        return colors[type] || colors.info;
    }

    /**
     * Helper: Get notification icon
     */
    getNotificationIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-warning',
            info: 'fas fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    /**
     * Helper: Time ago
     */
    timeAgo(timestamp) {
        const now = new Date();
        const diff = now - new Date(timestamp);
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return 'Vừa xong';
        if (minutes < 60) return `${minutes}m trước`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h trước`;

        const days = Math.floor(hours / 24);
        return `${days}d trước`;
    }

    /**
     * Save notifications to localStorage
     */
    saveNotifications() {
        try {
            const toSave = this.notifications.slice(0, 20);
            localStorage.setItem('westar-notifications', JSON.stringify(toSave));
        } catch (error) {
            console.error('Error saving notifications:', error);
        }
    }

    /**
     * Restore notifications from localStorage
     */
    restoreNotifications() {
        try {
            const saved = localStorage.getItem('westar-notifications');
            if (saved) {
                this.notifications = JSON.parse(saved);
                this.updateBadge();
            }
        } catch (error) {
            console.error('Error restoring notifications:', error);
        }
    }
}

// Add CSS animations
{
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// Khởi tạo singleton
const notificationSystem = new NotificationSystem();

// Export cho các module khác
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { notificationSystem };
}
