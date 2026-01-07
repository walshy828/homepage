window.ArchivesController = class ArchivesController {
    constructor(app) {
        this.app = app;
        this.archives = [];
        this.filter = 'unread'; // unread, read, all
        this.timeRange = 'all'; // all, 30, 90, 365
        this.searchQuery = '';
        this.pollInterval = null;
        this.selectedIds = new Set();
    }

    async init() {
        // Can be deferred
    }

    async load() {
        this.app.currentPage = 'archives'; // Update state
        window.location.hash = '#archives';
        this.app.updateNavigationState();
        this.selectedIds.clear(); // Reset selection on page load

        const container = document.getElementById('main-content') || document.querySelector('.main-content');
        if (!container) return;

        container.innerHTML = `
            <div class="page-container fade-in">
                <header class="page-header">
                    <div class="header-left">
                        <h1 class="page-title">Reading List</h1>
                        <p class="page-subtitle">Premium web archiving with full-text search</p>
                    </div>
                    <div class="header-right">
                        <button class="btn btn-primary" onclick="window.archivesController.openAddModal()" type="button">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Save Article
                        </button>
                    </div>
                </header>

                <div class="archive-filters">
                    <div class="archive-search">
                        <span class="archive-search-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>
                        <input type="text" id="archive-search-input" placeholder="Search title, URL, or article content..." value="${this.searchQuery}">
                    </div>
                    <div class="filter-chip ${this.filter === 'unread' ? 'active' : ''}" onclick="window.archivesController.setFilter('unread')">Reading List</div>
                    <div class="filter-chip ${this.filter === 'read' ? 'active' : ''}" onclick="window.archivesController.setFilter('read')">Finished</div>
                    <div class="filter-chip ${this.filter === 'all' ? 'active' : ''}" onclick="window.archivesController.setFilter('all')">All</div>
                    
                    <div class="time-filters" style="margin-left: auto;">
                        <div class="time-chip ${this.timeRange === 'all' ? 'active' : ''}" onclick="window.archivesController.setTimeRange('all')">All Time</div>
                        <div class="time-chip ${this.timeRange === '30' ? 'active' : ''}" onclick="window.archivesController.setTimeRange('30')">Last 30d</div>
                        <div class="time-chip ${this.timeRange === '90' ? 'active' : ''}" onclick="window.archivesController.setTimeRange('90')">Last 90d</div>
                        <div class="time-chip ${this.timeRange === '365' ? 'active' : ''}" onclick="window.archivesController.setTimeRange('365')">Last Year</div>
                    </div>
                </div>
                
                <div class="archives-grid" id="archives-grid">
                    <div class="loading-state"><span class="spinner"></span></div>
                </div>

                <!-- Mass Edit Toolbar -->
                <div id="mass-edit-toolbar" class="mass-edit-toolbar">
                    <div class="mass-edit-info">
                        <span id="selected-count">0</span> selected
                    </div>
                    <div class="mass-edit-actions">
                        <button class="btn btn-sm btn-outline" onclick="window.archivesController.bulkAction('archive')">Archive</button>
                        <button class="btn btn-sm btn-outline" onclick="window.archivesController.bulkAction('unarchive')">Restore</button>
                        <button class="btn btn-sm btn-danger" onclick="window.archivesController.bulkAction('delete')">Delete</button>
                        <button class="btn btn-icon circle" onclick="window.archivesController.clearSelection()" title="Clear Selection">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Setup search listener
        const searchInput = document.getElementById('archive-search-input');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    this.searchQuery = e.target.value.trim();
                    this.fetchAndRender();
                }, 300);
            });
        }

        await this.fetchAndRender();
        this.startPolling();
    }

    startPolling() {
        this.stopPolling();
        this.pollInterval = setInterval(() => {
            const hasPending = this.archives.some(a => a.status === 'pending');
            if (hasPending && this.app.currentPage === 'archives') {
                this.fetchAndRender(true); // silent refresh
            } else if (!hasPending) {
                this.stopPolling();
            }
        }, 5000);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    async setFilter(filter) {
        this.filter = filter;
        this.load(); // Full reload to update filter UI
    }

    async setTimeRange(range) {
        this.timeRange = range;
        this.load();
    }

    async fetchAndRender(silent = false) {
        const grid = document.getElementById('archives-grid');
        if (grid && !grid.querySelector('.spinner') && !silent) {
            grid.innerHTML = '<div class="loading-state"><span class="spinner"></span></div>';
        }

        try {
            const isRead = this.filter === 'all' ? null : (this.filter === 'read');
            const days = this.timeRange === 'all' ? null : parseInt(this.timeRange);
            const data = await api.getArchives(0, 50, this.searchQuery, isRead, days);

            // If silent refresh, check if status changed
            if (silent) {
                const pendingBefore = this.archives.filter(a => a.status === 'pending').length;
                const pendingAfter = data.filter(a => a.status === 'pending').length;

                // Also check if any failed items appeared
                const failedBefore = this.archives.filter(a => a.status === 'failed').length;
                const failedAfter = data.filter(a => a.status === 'failed').length;

                if (pendingBefore !== pendingAfter || failedBefore !== failedAfter) {
                    this.archives = data;
                    this.renderGrid();
                    if (pendingAfter < pendingBefore) {
                        this.app.showToast("Article processing updated", "success");
                    }
                }
            } else {
                this.archives = data;
                this.renderGrid();
            }

            // Resume polling if we still have pending items
            if (this.archives.some(a => a.status === 'pending')) {
                this.startPolling();
            }
        } catch (e) {
            console.error(e);
            if (grid && !silent) grid.innerHTML = `<div class="error-state">Failed to load archives: ${e.message}</div>`;
        }
    }

    renderGrid() {
        const grid = document.getElementById('archives-grid');
        if (!grid) return;

        if (this.archives.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon" style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                    <h3>${this.searchQuery ? 'No results found' : 'Your list is empty'}</h3>
                    <p class="text-secondary">${this.searchQuery ? 'Try adjusting your search terms.' : 'Save articles to read them later in a premium PDF format.'}</p>
                </div>`;
            return;
        }

        grid.innerHTML = this.archives.map(item => this.renderCard(item)).join('');
    }

    renderCard(item) {
        const imageUrl = item.screenshot_path ? `/data/${item.screenshot_path}` : 'https://placehold.co/600x400/2a2a2a/FFF?text=Processing...';
        const statusClass = item.status;
        const statusLabel = item.status === 'completed' ? '' : `<div class="status-badge ${item.status}">${item.status}</div>`;
        const readLabel = item.is_read ? `<div class="read-badge">ARCHIVED</div>` : '';
        const isSelected = this.selectedIds.has(item.id);

        return `
            <div id="archive-${item.id}" class="archive-card ${statusClass} ${item.is_read ? 'read' : ''} ${isSelected ? 'selected' : ''}" onclick="window.archivesController.handleCardClick(${item.id}, event)">
                <div class="archive-preview-wrapper">
                    <input type="checkbox" class="archive-selector" ${isSelected ? 'checked' : ''} onclick="event.stopPropagation(); window.archivesController.toggleSelection(${item.id})">
                    <img src="${imageUrl}" alt="${item.title}" class="archive-preview" loading="lazy">
                    ${statusLabel}
                    ${readLabel}
                    <div class="archive-overlay">
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button class="archive-direct-link" onclick="event.stopPropagation(); window.open('${item.url}', '_blank')" title="Go to Source site">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            </button>
                            <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.2); margin: 0 4px;"></div>
                            ${!item.is_read && item.status === 'completed' ? `
                                <button class="btn-icon circle primary" onclick="event.stopPropagation(); window.archivesController.toggleRead(${item.id}, true)" title="Finish & Archive">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                </button>
                            ` : ''}
                            ${item.status === 'failed' ? `
                                <button class="btn-icon circle primary" onclick="event.stopPropagation(); window.archivesController.retryArchive(${item.id})" title="Retry Capture">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                </button>
                            ` : ''}
                            <button class="btn-icon circle danger" onclick="event.stopPropagation(); window.archivesController.deleteArchive(${item.id})" title="Delete Permanentely">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="archive-info">
                    <h3 class="archive-title" title="${item.title}">${item.title}</h3>
                    <div class="archive-meta">
                        <span class="archive-date">${new Date(item.created_at).toLocaleDateString()}</span>
                        <span class="archive-domain">${this.getDomain(item.url)}</span>
                    </div>
                    <div class="archive-footer-actions">
                         <div class="archive-footer-btn" onclick="event.stopPropagation(); window.open('${item.url}', '_blank')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                            Direct Source
                         </div>
                    </div>
                    ${item.status === 'failed' && item.summary ? `<div class="archive-error-text" style="font-size:0.75rem; color:var(--color-danger); margin-top:4px;">${item.summary}</div>` : ''}
                </div>
            </div>
        `;
    }

    getDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return 'External';
        }
    }

    async toggleRead(id, isRead) {
        try {
            await api.updateArchive(id, { is_read: isRead });
            this.fetchAndRender(true);
            this.app.showToast(isRead ? "Article moved to Permanent Archive" : "Moved back to Reading List", "success");
        } catch (e) {
            this.app.showToast("Error updating article: " + e.message, "error");
        }
    }

    async retryArchive(id) {
        try {
            const item = this.archives.find(a => a.id === id);
            if (!item) return;

            this.app.showToast("Retrying capture...", "info");
            // Delete and re-add for a fresh start
            await api.createArchive(item.url, item.title);
            await api.deleteArchive(id);
            this.fetchAndRender();
        } catch (e) {
            this.app.showToast("Retry failed: " + e.message, "error");
        }
    }

    async openAddModal() {
        const url = prompt("Enter the URL to save for later reading:");
        if (url) {
            if (!url.startsWith('http')) {
                alert("Please enter a valid URL starting with http:// or https://");
                return;
            }
            try {
                this.app.showToast("Saving article...", "info");
                const newItem = await api.createArchive(url);
                this.app.showToast("Article saved! Capturing PDF and extracting content...", "success");
                await this.fetchAndRender();
                this.startPolling();
            } catch (e) {
                this.app.showToast("Error saving article: " + e.message, "error");
            }
        }
    }

    async openReader(id) {
        const item = this.archives.find(a => a.id === id);
        if (!item) return;

        if (item.status === 'pending') {
            this.app.showToast("This article is still processing. Please wait.", "info");
            return;
        }
        if (item.status === 'failed') {
            const errorMsg = item.summary || "Archiving failed.";
            this.app.showToast(`${errorMsg} Opening live site instead.`, "error");
            window.open(item.url, '_blank');
            return;
        }
        if (!item.pdf_file_path) {
            this.app.showToast("Archived document missing. Opening live link instead.", "info");
            window.open(item.url, '_blank');
            return;
        }

        // Open PDF in new tab
        const pdfUrl = `/data/${item.pdf_file_path}`;
        window.open(pdfUrl, '_blank');

        // Mark as read automatically
        if (!item.is_read) {
            this.toggleRead(item.id, true);
        }
    }

    async deleteArchive(id) {
        if (confirm("Are you sure you want to delete this permanently? This cannot be undone.")) {
            try {
                await api.deleteArchive(id);
                this.archives = this.archives.filter(a => a.id !== id);
                this.renderGrid();
                this.app.showToast("Article deleted", "success");
            } catch (e) {
                this.app.showToast("Error deleting: " + e.message, "error");
            }
        }
    }

    handleCardClick(id, event) {
        // If we have selections, clicking a card toggles selection
        if (this.selectedIds.size > 0) {
            this.toggleSelection(id);
        } else {
            // Normal behavior: open reader
            this.openReader(id);
        }
    }

    toggleSelection(id) {
        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
            document.getElementById(`archive-${id}`)?.classList.remove('selected');
            const checkbox = document.querySelector(`#archive-${id} .archive-selector`);
            if (checkbox) checkbox.checked = false;
        } else {
            this.selectedIds.add(id);
            document.getElementById(`archive-${id}`)?.classList.add('selected');
            const checkbox = document.querySelector(`#archive-${id} .archive-selector`);
            if (checkbox) checkbox.checked = true;
        }
        this.updateMassEditToolbar();
    }

    clearSelection() {
        this.selectedIds.clear();
        this.archives.forEach(item => {
            document.getElementById(`archive-${item.id}`)?.classList.remove('selected');
            const checkbox = document.querySelector(`#archive-${item.id} .archive-selector`);
            if (checkbox) checkbox.checked = false;
        });
        this.updateMassEditToolbar();
    }

    updateMassEditToolbar() {
        const toolbar = document.getElementById('mass-edit-toolbar');
        const countSpan = document.getElementById('selected-count');

        if (this.selectedIds.size > 0) {
            toolbar.classList.add('active');
            if (countSpan) countSpan.textContent = this.selectedIds.size;
        } else {
            toolbar.classList.remove('active');
        }
    }

    async bulkAction(action) {
        if (this.selectedIds.size === 0) return;

        const count = this.selectedIds.size;
        let confirmMsg = `Apply "${action}" to ${count} items?`;
        if (action === 'delete') confirmMsg = `Are you sure you want to delete ${count} items permanently?`;

        if (confirm(confirmMsg)) {
            try {
                this.app.showToast(`Processing ${count} items...`, "info");
                await api.bulkArchive(Array.from(this.selectedIds), action);
                this.app.showToast(`Successfully ${action}d ${count} items`, "success");
                this.selectedIds.clear();
                this.fetchAndRender();
            } catch (e) {
                this.app.showToast(`Bulk ${action} failed: ` + e.message, "error");
            }
        }
    }
}
