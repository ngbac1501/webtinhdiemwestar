/**
 * Data Export/Import Manager
 * Cho phép export/import dữ liệu từ Firestore
 */

class DataExportImport {
    constructor() {
        this.SUPPORTED_FORMATS = ['csv', 'json', 'xlsx'];
    }

    /**
     * Export dữ liệu sang JSON
     */
    async exportToJSON(data, filename = 'westar-data') {
        try {
            const jsonStr = JSON.stringify(data, null, 2);
            this.downloadFile(
                jsonStr,
                `${filename}_${this.getTimestamp()}.json`,
                'application/json'
            );
            return { success: true, message: 'Export JSON thành công' };
        } catch (error) {
            console.error('Export JSON error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Export dữ liệu sang CSV
     */
    async exportToCSV(data, filename = 'westar-data') {
        try {
            if (!Array.isArray(data)) {
                throw new Error('Dữ liệu phải là một array');
            }

            if (data.length === 0) {
                throw new Error('Không có dữ liệu để export');
            }

            // Lấy tất cả các keys từ tất cả các objects
            const allKeys = new Set();
            data.forEach(obj => {
                Object.keys(obj).forEach(key => allKeys.add(key));
            });

            const headers = Array.from(allKeys);
            const csv = [];

            // Thêm header
            csv.push(headers.map(h => this.escapeCSV(String(h))).join(','));

            // Thêm dữ liệu
            data.forEach(row => {
                const values = headers.map(header => {
                    const value = row[header];
                    if (value === null || value === undefined) return '';
                    if (typeof value === 'object') {
                        return this.escapeCSV(JSON.stringify(value));
                    }
                    return this.escapeCSV(String(value));
                });
                csv.push(values.join(','));
            });

            const csvContent = csv.join('\n');
            this.downloadFile(
                csvContent,
                `${filename}_${this.getTimestamp()}.csv`,
                'text/csv;charset=utf-8;'
            );

            return { success: true, message: `Export CSV thành công (${data.length} hàng)` };
        } catch (error) {
            console.error('Export CSV error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Import dữ liệu từ JSON
     */
    async importFromJSON(file) {
        try {
            const content = await this.readFile(file);
            const data = JSON.parse(content);
            return { success: true, data, count: Array.isArray(data) ? data.length : 1 };
        } catch (error) {
            console.error('Import JSON error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Import dữ liệu từ CSV
     */
    async importFromCSV(file) {
        try {
            const content = await this.readFile(file);
            const lines = content.trim().split('\n');
            
            if (lines.length < 1) {
                throw new Error('File CSV trống');
            }

            const headers = lines[0].split(',').map(h => h.trim());
            const data = [];

            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                const obj = {};

                headers.forEach((header, index) => {
                    obj[header] = values[index] || '';
                });

                // Skip empty rows
                if (Object.values(obj).some(v => v !== '')) {
                    data.push(obj);
                }
            }

            return { success: true, data, count: data.length };
        } catch (error) {
            console.error('Import CSV error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Export toàn bộ database
     */
    async exportFullDatabase(db, collections) {
        try {
            const fullData = {};

            for (const collectionName of collections) {
                const snapshot = await getDocs(collection(db, collectionName));
                fullData[collectionName] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }

            await this.exportToJSON(fullData, 'westar-full-backup');
            return { success: true, message: 'Backup toàn bộ database thành công' };
        } catch (error) {
            console.error('Full export error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Import dữ liệu vào Firestore (với xác nhận trước)
     */
    async importToFirestore(db, collectionName, data) {
        try {
            if (!Array.isArray(data)) {
                throw new Error('Dữ liệu phải là một array');
            }

            const results = {
                success: 0,
                failed: 0,
                errors: []
            };

            for (const item of data) {
                try {
                    const docRef = doc(db, collectionName, item.id);
                    await setDoc(docRef, item);
                    results.success++;
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        item: item.id,
                        error: error.message
                    });
                }
            }

            return { success: true, results };
        } catch (error) {
            console.error('Import to Firestore error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Helper: Download file
     */
    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Helper: Đọc file
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    /**
     * Helper: Escape CSV content
     */
    escapeCSV(str) {
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    /**
     * Helper: Parse CSV line
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    /**
     * Helper: Generate timestamp
     */
    getTimestamp() {
        return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    }

    /**
     * Generate export report (HTML)
     */
    generateReport(data, title = 'Export Report') {
        const timestamp = new Date().toLocaleString('vi-VN');
        const itemCount = Array.isArray(data) ? data.length : Object.keys(data).length;

        const html = `
            <!DOCTYPE html>
            <html lang="vi">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .header { border-bottom: 2px solid #00f3ff; margin-bottom: 20px; }
                    .stats { background: #0a0a0f; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
                    .stats p { margin: 10px 0; color: #e2e8f0; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ccc; }
                    th { background: #f0f0f0; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${title}</h1>
                </div>
                <div class="stats">
                    <p><strong>Ngày export:</strong> ${timestamp}</p>
                    <p><strong>Tổng items:</strong> ${itemCount}</p>
                </div>
                <table>
                    ${Array.isArray(data) ? `
                        <thead>
                            <tr>
                                ${Object.keys(data[0] || {}).map(key => `<th>${key}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(row => `
                                <tr>
                                    ${Object.values(row).map(val => `<td>${val}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    ` : ''}
                </table>
            </body>
            </html>
        `;

        return html;
    }
}

// Khởi tạo singleton
const dataExportImport = new DataExportImport();

// Export cho các module khác
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { dataExportImport };
}
