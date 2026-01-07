/**
 * Homepage Dashboard - API Client
 */
class API {
    constructor() {
        this.baseUrl = '/api';
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        // Dynamic timeout: 5 minutes for system maintenance, 8s otherwise
        const isMaintenance = endpoint.includes('/system/');
        const timeoutDuration = isMaintenance ? 300000 : 8000;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

        try {
            const response = await fetch(url, { ...options, headers, signal: controller.signal });
            clearTimeout(timeoutId);
            if (response.status === 401) {
                this.setToken(null);
                window.location.href = '/login';
                return null;
            }
            if (response.status === 204) return null;
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'API request failed');
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error(`Request timed out after ${timeoutDuration / 1000}s: ${endpoint}`);
                throw new Error('Operation timed out. For large database imports, this may still be processing in the background. Please check again in a minute.');
            }
            console.error('API Error:', error);
            throw error;
        }
    }
    async download(endpoint, filename) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min for downloads

        try {
            const response = await fetch(url, { headers, signal: controller.signal });
            clearTimeout(timeoutId);
            if (response.status === 401) {
                this.setToken(null);
                window.location.href = '/login';
                return;
            }
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename || endpoint.split('/').pop();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Download Error:', error);
            throw error;
        }
    }

    async register(email, username, password) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, username, password }),
        });
    }

    async login(username, password) {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        const response = await fetch(`${this.baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Login failed');
        this.setToken(data.access_token);
        return data;
    }

    async getMe() { return this.request('/auth/me'); }
    async updateMe(data) { return this.request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }); }
    async getDashboards() { return this.request('/dashboards'); }
    async getDefaultDashboard() { return this.request('/dashboards/default'); }
    async createDashboard(data) { return this.request('/dashboards', { method: 'POST', body: JSON.stringify(data) }); }
    async updateDashboard(id, data) { return this.request(`/dashboards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
    async deleteDashboard(id) { return this.request(`/dashboards/${id}`, { method: 'DELETE' }); }
    async getDashboardWidgets(dashboardId) { return this.request(`/dashboards/${dashboardId}/widgets`); }
    async updateWidgetPositions(dashboardId, positions) {
        return this.request(`/dashboards/${dashboardId}/widgets/positions`, { method: 'PUT', body: JSON.stringify(positions) });
    }
    async createWidget(data) { return this.request('/widgets', { method: 'POST', body: JSON.stringify(data) }); }
    async updateWidget(id, data) { return this.request(`/widgets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
    async deleteWidget(id) { return this.request(`/widgets/${id}`, { method: 'DELETE' }); }
    async getLinks(params = {}) { return this.request(`/links?${new URLSearchParams(params)}`); }
    async createLink(data, autoCategorize = false) {
        return this.request(`/links?auto_categorize=${autoCategorize}`, { method: 'POST', body: JSON.stringify(data) });
    }
    async updateLink(id, data) { return this.request(`/links/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
    async deleteLink(id) { return this.request(`/links/${id}`, { method: 'DELETE' }); }
    async clickLink(id) { return this.request(`/links/${id}/click`, { method: 'POST' }); }
    async categorizeLinks(linkIds = [], all = false) {
        return this.request('/links/categorize', { method: 'POST', body: JSON.stringify({ link_ids: linkIds, categorize_all: all }) });
    }
    async getLinkPreview(url) { return this.request(`/links/preview?url=${encodeURIComponent(url)}`); }
    async suggestTags(url, title = null) {
        let qs = `url=${encodeURIComponent(url)}`;
        if (title) qs += `&title=${encodeURIComponent(title)}`;
        return this.request(`/links/tags/suggest?${qs}`);
    }
    async getLinkCategories() { return this.request('/links/categories'); }

    async requestPasswordReset(email) {
        return this.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    }

    async resetPassword(token, newPassword) {
        return this.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, new_password: newPassword }),
        });
    }

    async changePassword(currentPassword, newPassword) {
        return this.request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
        });
    }

    async getNotes(params = {}) { return this.request(`/notes?${new URLSearchParams(params)}`); }
    async createNote(data) { return this.request('/notes', { method: 'POST', body: JSON.stringify(data) }); }
    async updateNote(id, data) { return this.request(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
    async deleteNote(id) { return this.request(`/notes/${id}`, { method: 'DELETE' }); }
    async archiveNote(id) { return this.request(`/notes/${id}/archive`, { method: 'PATCH' }); }
    async unarchiveNote(id) { return this.request(`/notes/${id}/unarchive`, { method: 'PATCH' }); }
    async bulkUpdateNotes(data) { return this.request('/notes/bulk-update', { method: 'POST', body: JSON.stringify(data) }); }
    async bulkDeleteNotes(data) { return this.request('/notes/bulk-delete', { method: 'POST', body: JSON.stringify(data) }); }
    async viewNote(id) { return this.request(`/notes/${id}/view`, { method: 'POST' }); }
    async getIntegrationStatus() { return this.request('/integrations/status'); }
    async getDockerContainers(includeStats = true) { return this.request(`/integrations/docker?include_stats=${includeStats}`); }
    async controlDockerContainer(id, action) { return this.request(`/integrations/docker/${id}/${action}`, { method: 'POST' }); }
    async getProxmoxStatus() { return this.request('/integrations/proxmox'); }
    async controlProxmoxVM(node, type, vmid, action) {
        return this.request(`/integrations/proxmox/${node}/${type}/${vmid}/${action}`, { method: 'POST' });
    }
    async search(query) { return this.request(`/search?q=${encodeURIComponent(query)}`); }
    async getWeather(location) { return this.request(`/integrations/weather/${encodeURIComponent(location)}`); }

    // Archives / Read Later
    async getArchives(skip = 0, limit = 50, q = null, is_read = null, days = null) {
        let endpoint = `/archives?skip=${skip}&limit=${limit}`;
        if (q) endpoint += `&q=${encodeURIComponent(q)}`;
        if (is_read !== null) endpoint += `&is_read=${is_read}`;
        if (days !== null) endpoint += `&days=${days}`;
        return this.request(endpoint);
    }
    async createArchive(url, title = null) { return this.request('/archives', { method: 'POST', body: JSON.stringify({ url, title }) }); }
    async updateArchive(id, data) { return this.request(`/archives/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
    async deleteArchive(id) { return this.request(`/archives/${id}`, { method: 'DELETE' }); }
    async bulkArchive(ids, action) { return this.request('/archives/bulk', { method: 'POST', body: JSON.stringify({ ids, action }) }); }

    // System / Backups
    async createBackup() { return this.request('/system/backup', { method: 'POST' }); }
    async getBackups() { return this.request('/system/backups'); }
    async restoreBackup(filename) { return this.request(`/system/backups/${filename}/restore`, { method: 'POST' }); }
    async deleteBackup(filename) { return this.request(`/system/backups/${filename}`, { method: 'DELETE' }); }
    async importDatabase(file) {
        const formData = new FormData();
        formData.append('file', file);

        const url = `${this.baseUrl}/system/import`;
        const headers = { 'Authorization': `Bearer ${this.token}` };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 min for imports

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Import failed');
            return data;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Database import is taking a long time. It is likely still processing on the server. Please wait a few minutes before checking your dashboard.');
            }
            throw error;
        }
    }
}

const api = new API();
