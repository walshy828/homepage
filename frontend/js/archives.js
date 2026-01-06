/**
 * Homepage Dashboard - Archives Controller
 */
window.ArchivesController = class ArchivesController {
    constructor(app) {
        this.app = app;
        this.archives = [];
    }

    async init() {
        // Can be deferred until page load
    }

    async load() {
        this.app.currentPage = 'archives'; // Update state
        window.location.hash = '#archives';

        // Update Sidebar active state
        this.app.updateNavigationState();

        // Render Skeleton
        const container = document.getElementById('main-content') || document.querySelector('.main-content');
        if (!container) return;

        container.innerHTML = `
            <div class="page-container fade-in">
                <header class="page-header">
                    <div class="header-left">
                        <h1 class="page-title">Reading List</h1>
                        <p class="page-subtitle">Saved articles for offline reading</p>
                    </div>
                    <div class="header-right">
                        <button class="btn btn-primary" onclick="window.archivesController.openAddModal()">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Save Article
                        </button>
                    </div>
                </header>
                
                <div class="archives-grid" id="archives-grid">
                    <div class="loading-state"><span class="spinner"></span></div>
                </div>
            </div>
        `;

        try {
            this.archives = await api.getArchives();
            this.renderGrid();
        } catch (e) {
            console.error(e);
            const grid = document.getElementById('archives-grid');
            if (grid) grid.innerHTML = `<div class="error-state">Failed to load archives</div>`;
        }
    }

    renderGrid() {
        const grid = document.getElementById('archives-grid');
        if (!grid) return;

        if (this.archives.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon" style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                    <h3>Your reading list is empty</h3>
                    <p class="text-secondary">Save articles to read them later, even offline.</p>
                </div>`;
            return;
        }

        grid.innerHTML = this.archives.map(item => this.renderCard(item)).join('');
    }

    renderCard(item) {
        // Construct paths
        const imageUrl = item.screenshot_path ? `/data/${item.screenshot_path}` : 'https://placehold.co/600x400/2a2a2a/FFF?text=Processing...';

        const statusClass = item.status;
        const statusLabel = item.status === 'completed' ? '' : `<div class="status-badge ${item.status}">${item.status}</div>`;

        return `
            <div class="archive-card ${statusClass}" onclick="window.archivesController.openReader(${item.id})">
                <div class="archive-preview-wrapper">
                    <img src="${imageUrl}" alt="${item.title}" class="archive-preview" loading="lazy">
                    ${statusLabel}
                    <div class="archive-overlay">
                        <button class="btn-icon circle danger" onclick="event.stopPropagation(); window.archivesController.deleteArchive(${item.id})" title="Delete">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
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

    async openAddModal() {
        const url = prompt("Enter the URL to save for later reading:");
        if (url) {
            if (!url.startsWith('http')) {
                alert("Please enter a valid URL starting with http:// or https://");
                return;
            }
            try {
                await api.createArchive(url);
                if (this.app.showToast) this.app.showToast("Article saved! Processing in background.", "success");
                else alert("Article saved!");

                // Reload to show pending state
                this.load();
            } catch (e) {
                if (this.app.showToast) this.app.showToast("Error saving article: " + e.message, "error");
                else alert("Error: " + e.message);
            }
        }
    }

    async openReader(id) {
        const item = this.archives.find(a => a.id === id);
        if (!item) return;

        if (item.status === 'pending') {
            alert("This article is still processing. Please wait.");
            return;
        }
        if (item.status === 'failed') {
            alert("This article failed to archive.");
            return;
        }

        // Open content in new tab
        const contentUrl = `/data/${item.content_file_path}`;
        window.open(contentUrl, '_blank');
    }

    async deleteArchive(id) {
        if (confirm("Are you sure you want to delete this archived article?")) {
            try {
                await api.deleteArchive(id);
                this.archives = this.archives.filter(a => a.id !== id);
                this.renderGrid();
                if (this.app.showToast) this.app.showToast("Article deleted", "success");
            } catch (e) {
                alert("Error deleting: " + e.message);
            }
        }
    }
}
