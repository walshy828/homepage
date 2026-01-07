window.ArchivesController = class ArchivesController {
    constructor(app) {
        this.app = app;
        this.archives = [];
        this.filter = 'unread'; // unread, read, all
        this.searchQuery = '';
    }

    async init() {
        // Can be deferred
    }

    async load() {
        this.app.currentPage = 'archives'; // Update state
        window.location.hash = '#archives';
        this.app.updateNavigationState();

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
                        <button class="btn btn-primary" onclick="window.archivesController.openAddModal()">
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
                </div>
                
                <div class="archives-grid" id="archives-grid">
                    <div class="loading-state"><span class="spinner"></span></div>
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
    }

    async setFilter(filter) {
        this.filter = filter;
        this.load(); // Full reload to update filter UI
    }

    async fetchAndRender() {
        const grid = document.getElementById('archives-grid');
        if (grid && !grid.querySelector('.spinner')) {
            grid.innerHTML = '<div class="loading-state"><span class="spinner"></span></div>';
        }

        try {
            const isRead = this.filter === 'all' ? null : (this.filter === 'read');
            this.archives = await api.getArchives(0, 50, this.searchQuery, isRead);
            this.renderGrid();
        } catch (e) {
            console.error(e);
            if (grid) grid.innerHTML = `<div class="error-state">Failed to load archives: ${e.message}</div>`;
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

        return `
            <div class="archive-card ${statusClass} ${item.is_read ? 'read' : ''}" onclick="window.archivesController.openReader(${item.id})">
                <div class="archive-preview-wrapper">
                    <img src="${imageUrl}" alt="${item.title}" class="archive-preview" loading="lazy">
                    ${statusLabel}
                    ${readLabel}
                    <div class="archive-overlay">
                        <div style="display: flex; gap: 8px;">
                            ${!item.is_read && item.status === 'completed' ? `
                                <button class="btn-icon circle primary" onclick="event.stopPropagation(); window.archivesController.toggleRead(${item.id}, true)" title="Finish & Archive">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                </button>
                            ` : ''}
                            ${item.is_read ? `
                                <button class="btn-icon circle info" onclick="event.stopPropagation(); window.archivesController.toggleRead(${item.id}, false)" title="Move back to Reading List">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m0 0H15"></path></svg>
                                </button>
                            ` : ''}
                            <button class="btn-icon circle info" onclick="event.stopPropagation(); window.open('${item.url}', '_blank')" title="View Live Site">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            </button>
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
            this.fetchAndRender();
            this.app.showToast(isRead ? "Article moved to Permanent Archive" : "Moved back to Reading List", "success");
        } catch (e) {
            this.app.showToast("Error updating article: " + e.message, "error");
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
                await api.createArchive(url);
                this.app.showToast("Article saved! Capturing PDF and extracting content...", "success");
                this.fetchAndRender();
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
            this.app.showToast("This article failed to archive.", "error");
            return;
        }

        // Open PDF in new tab
        const pdfUrl = `/data/${item.pdf_file_path}`;
        window.open(pdfUrl, '_blank');

        // Mark as read automatically if it's the first time
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
}
