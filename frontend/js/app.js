/**
 * Homepage Dashboard - Main Application (Enhanced)
 */

class TagInput {
    constructor(container, initialTags = [], onChange = null) {
        this.container = container;
        this.tags = [...initialTags];
        this.onChange = onChange;
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.container.className = 'tag-input-container';

        this.tags.forEach((tag, index) => {
            const pill = document.createElement('span');
            pill.className = 'tag-pill';
            pill.innerHTML = `${tag} <span class="remove-tag" data-index="${index}">×</span>`;
            pill.querySelector('.remove-tag').onclick = (e) => {
                e.preventDefault();
                this.removeTag(index);
            };
            this.container.appendChild(pill);
        });

        const input = document.createElement('input');
        input.className = 'tag-input-field';
        input.placeholder = this.tags.length ? '' : 'Add tags (Enter to add)...';
        input.addEventListener('keydown', (e) => this.handleInput(e));
        input.addEventListener('blur', (e) => this.addTag(e.target.value)); // Add on blur too
        this.container.appendChild(input);
        this.input = input;
    }

    handleInput(e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            this.addTag(e.target.value);
        } else if (e.key === 'Backspace' && !e.target.value && this.tags.length) {
            this.removeTag(this.tags.length - 1);
        }
    }

    addTag(value) {
        let tag = value.trim().toLowerCase();
        if (!tag) return;

        // Ensure hashtag prefix for consistency
        if (!tag.startsWith('#')) tag = `#${tag}`;

        if (!this.tags.includes(tag)) {
            this.tags.push(tag);
            this.render();
            this.input.focus();
            if (this.onChange) this.onChange(this.tags);
        } else {
            this.input.value = ''; // Clear even if invalid/duplicate
        }
    }

    removeTag(index) {
        this.tags.splice(index, 1);
        this.render();
        if (this.onChange) this.onChange(this.tags);
    }

    setTags(newTags) {
        this.tags = [...newTags];
        this.render();
        if (this.onChange) this.onChange(this.tags);
    }

    getTags() {
        return this.tags;
    }
}

class SearchController {
    constructor(app, containerId = 'global-search-bar') {
        this.app = app;
        this.container = document.getElementById(containerId);
        this.input = document.getElementById('global-search-input');
        this.dropdown = document.getElementById('search-dropdown');
        this.timeout = null;
        this.selectedIndex = -1;
        this.results = [];
        this.init();
    }

    init() {
        if (!this.container || !this.input) return;

        this.input.addEventListener('input', (e) => this.handleInput(e));
        this.input.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.input.addEventListener('focus', () => {
            if (this.input.value.trim().length > 0) this.dropdown.style.display = 'block';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Keyboard shortcut (Cmd/Ctrl + K)
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.input.focus();
            }
        });
    }

    handleInput(e) {
        const query = e.target.value.trim();

        if (this.timeout) clearTimeout(this.timeout);

        if (query.length === 0) {
            this.closeDropdown();
            return;
        }

        this.timeout = setTimeout(() => this.performSearch(query), 300);
    }

    handleKeydown(e) {
        if (!this.results.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex + 1) % this.results.length;
            this.updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = (this.selectedIndex - 1 + this.results.length) % this.results.length;
            this.updateSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.selectedIndex >= 0 && this.results[this.selectedIndex]) {
                const item = this.results[this.selectedIndex];
                if (item.type === 'link') {
                    window.open(item.url, '_blank');
                } else if (item.type === 'note') {
                    this.app.openNoteModal(item.id);
                }
                this.closeDropdown();
            }
        } else if (e.key === 'Tab') {
            if (this.selectedIndex >= 0 && this.results[this.selectedIndex]) {
                const item = this.results[this.selectedIndex];
                if (item.type === 'link') {
                    e.preventDefault();
                    this.app.editLink(item.id);
                    this.closeDropdown();
                }
            }
        } else if (e.key === 'Escape') {
            this.closeDropdown();
        }
    }

    async performSearch(query) {
        try {
            this.results = await api.search(query);
            this.renderResults();
            this.dropdown.style.display = 'block';
        } catch (err) {
            console.error('Search failed:', err);
        }
    }

    renderResults() {
        if (!this.results || this.results.length === 0) {
            this.dropdown.innerHTML = '<div class="search-empty">No results found</div>';
            this.selectedIndex = -1;
            return;
        }

        const links = this.results.filter(r => r.type === 'link');
        const notes = this.results.filter(r => r.type === 'note');

        let html = '';

        if (links.length > 0) {
            html += '<div class="search-section-title">Links</div>';
            html += links.map((item, index) => this.renderItem(item, index)).join('');
        }

        if (notes.length > 0) {
            // Adjust index for continuous navigation
            const startIndex = links.length;
            html += '<div class="search-section-title">Notes</div>';
            html += notes.map((item, index) => this.renderItem(item, startIndex + index)).join('');
        }

        this.dropdown.innerHTML = html;

        // Auto-select first item
        this.selectedIndex = 0;
        this.updateSelection();
        // Add click handlers
        this.dropdown.querySelectorAll('.search-result').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const index = parseInt(el.dataset.index);
                this.selectItem(index);
            });
        });
    }

    renderItem(item, index) {
        return `
            <div class="search-result" data-index="${index}" data-id="${item.id}" data-type="${item.type}">
                <div class="search-result-icon">${item.icon}</div>
                <div class="search-result-content">
                    <div class="search-result-title">${item.title}</div>
                    <div class="search-result-subtitle">${this.app.sanitizeContent(item.subtitle)}</div>
                </div>
            </div>
        `;
    }

    handleKeydown(e) {
        if (!this.results.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
            this.updateSelection();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
            this.updateSelection();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (this.selectedIndex >= 0) {
                this.selectItem(this.selectedIndex);
            }
        } else if (e.key === 'Escape') {
            this.closeDropdown();
            this.input.blur();
        }
    }

    updateSelection() {
        const items = this.dropdown.querySelectorAll('.search-result');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }

    selectItem(index) {
        const item = this.results[index];
        if (!item) return;

        if (item.type === 'link') {
            window.open(item.url, '_blank');
        } else if (item.type === 'note') {
            this.app.openNoteModal(item.id);
        }

        this.closeDropdown();
        this.input.value = '';
    }

    closeDropdown() {
        this.dropdown.style.display = 'none';
        this.selectedIndex = -1;
    }
}

class App {
    constructor() {
        this.user = null;
        this.socket = null;
        this.maxRetries = 5;
        this.retryDelay = 2000;
        this.dashboard = null;
        this.grid = null;
        this.allLinks = [];
        this.allNotes = [];
        this.currentPage = 'dashboard'; // dashboard, notes
        this.editMode = false; // View mode by default
        this.activeNoteTag = null;
        this.viewMode = localStorage.getItem('viewMode') || 'grid'; // grid | list
        this.sortMode = localStorage.getItem('sortMode') || 'updated_desc'; // updated_desc | updated_asc | title_asc | title_desc
    }

    // Helper to sort items
    sortItems(items, sortMode) {
        const sorted = [...items];
        sorted.sort((a, b) => {
            switch (sortMode) {
                case 'updated_asc': return new Date(a.updated_at) - new Date(b.updated_at);
                case 'updated_desc': return new Date(b.updated_at) - new Date(a.updated_at);
                case 'title_asc': return a.title.localeCompare(b.title);
                case 'title_desc': return b.title.localeCompare(a.title);
                default: return 0;
            }
        });
        return sorted;
    }
    timeAgo(dateString) {
        if (!dateString) return '';

        // Fix for backend sending UTC without 'Z'
        // If it looks like ISO but no Z/offset, append Z
        if (dateString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/)) {
            dateString += 'Z';
        }

        const date = new Date(dateString);
        // Handle timezone if needed, but usually server sends UTC and browser converts
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        // Handle future dates (clock skew or timezone issues)
        if (seconds < 0) return "Just now";
        if (seconds < 60) return "Just now";

        let interval = Math.floor(seconds / 31536000);
        if (interval >= 1) return interval + "y ago";

        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) return interval + "mo ago";

        interval = Math.floor(seconds / 604800);
        if (interval >= 1) return interval + "w ago";

        interval = Math.floor(seconds / 86400);
        if (interval >= 1) return interval + "d ago";

        interval = Math.floor(seconds / 3600);
        if (interval >= 1) return interval + "h ago";

        interval = Math.floor(seconds / 60);
        if (interval >= 1) return interval + "m ago";

        return Math.floor(seconds) + "s ago";
    }

    toggleViewMode(mode) {
        this.viewMode = mode;
        localStorage.setItem('viewMode', mode);

        // visual update
        document.querySelectorAll('.view-toggle-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('onclick')?.includes(`'${mode}'`)) {
                btn.classList.add('active');
            }
        });

        if (this.currentPage === 'notes') this.renderNotesPage();
        else if (this.currentPage === 'links') this.renderLinksPage();
    }

    setSortMode(mode) {
        this.sortMode = mode;
        localStorage.setItem('sortMode', mode);
        if (this.currentPage === 'notes') this.renderNotesPage();
        else if (this.currentPage === 'links') this.renderLinksPage();
    }

    execCmd(cmd, value = null) {
        document.execCommand(cmd, false, value);
    }

    async init() {
        this.initTheme();
        if (!api.token) { this.showAuth(); return; }
        // Show loading while checking auth
        document.getElementById('app').innerHTML = '<div class="auth-page"><div class="loading-state"><span class="spinner"></span><p>Loading dashboard...</p></div></div>';
        try {
            this.user = await api.getMe();
            await this.loadDashboard();
        } catch (e) {
            this.showAuth();
        }
    }

    initTheme() {
        const saved = localStorage.getItem('theme') || 'system';
        this.setTheme(saved);
    }

    setTheme(theme) {
        localStorage.setItem('theme', theme);
        if (theme === 'system') theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
        this.updateThemeIcon();
    }

    toggleTheme() {
        const current = localStorage.getItem('theme') || 'system';
        this.setTheme(current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark');
    }

    updateThemeIcon() {
        const btn = document.querySelector('.theme-toggle');
        if (!btn) return;
        const theme = document.documentElement.getAttribute('data-theme');
        btn.innerHTML = theme === 'dark'
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
    }

    showAuth() {
        document.getElementById('app').innerHTML = `
            <div class="auth-page"><div class="auth-card">
                <div class="auth-header">
                    <div class="app-logo-icon" style="margin: 0 auto var(--spacing-md);"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
                    <h1 class="auth-title">Homepage Dashboard</h1>
                    <p class="auth-subtitle">Sign in to your dashboard</p>
                </div>
                <form id="login-form">
                    <div class="form-group"><label class="form-label">Username or Email</label><input type="text" class="input" name="username" required></div>
                    <div class="form-group"><label class="form-label">Password</label><input type="password" class="input" name="password" required></div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Sign In</button>
                </form>
                <div class="auth-footer">Don't have an account? <a href="#" id="show-register">Sign up</a></div>
            </div></div>`;
        document.getElementById('login-form').addEventListener('submit', e => this.handleLogin(e));
        document.getElementById('show-register').addEventListener('click', e => { e.preventDefault(); this.showRegister(); });
    }

    showRegister() {
        document.getElementById('app').innerHTML = `
            <div class="auth-page"><div class="auth-card">
                <div class="auth-header"><h1 class="auth-title">Create Account</h1><p class="auth-subtitle">Start building your dashboard</p></div>
                <form id="register-form">
                    <div class="form-group"><label class="form-label">Email</label><input type="email" class="input" name="email" required></div>
                    <div class="form-group"><label class="form-label">Username</label><input type="text" class="input" name="username" required minlength="3"></div>
                    <div class="form-group"><label class="form-label">Password</label><input type="password" class="input" name="password" required minlength="6"></div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Create Account</button>
                </form>
                <div class="auth-footer">Already have an account? <a href="#" id="show-login">Sign in</a></div>
            </div></div>`;
        document.getElementById('register-form').addEventListener('submit', e => this.handleRegister(e));
        document.getElementById('show-login').addEventListener('click', e => { e.preventDefault(); this.showAuth(); });
    }

    async handleLogin(e) {
        e.preventDefault();
        const form = e.target, btn = form.querySelector('button[type="submit"]');
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
        try {
            await api.login(form.username.value, form.password.value);
            this.user = await api.getMe();
            await this.loadDashboard();
        } catch (err) { this.showToast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Sign In'; }
    }

    async handleRegister(e) {
        e.preventDefault();
        const form = e.target, btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            await api.register(form.email.value, form.username.value, form.password.value);
            await api.login(form.username.value, form.password.value);
            this.user = await api.getMe();
            await this.loadDashboard();
        } catch (err) { this.showToast(err.message, 'error'); btn.disabled = false; btn.textContent = 'Create Account'; }
    }

    async loadDashboard() {
        this.dashboard = await api.getDefaultDashboard();
        this.allLinks = await api.getLinks();
        this.allNotes = await api.getNotes();

        // Handle URL Routing on Load
        const hash = window.location.hash;
        if (hash === '#links') this.currentPage = 'links';
        else if (hash === '#notes') this.currentPage = 'notes';
        else this.currentPage = 'dashboard';

        this.renderApp();

        if (this.currentPage === 'links') {
            this.showLinksPage();
        } else if (this.currentPage === 'notes') {
            this.renderNotesPage();
        } else {
            document.getElementById('main-content').innerHTML = '<div class="dashboard-container"><div class="grid-stack" id="grid"></div></div>';
            await this.initDashboard();
        }
    }

    renderApp() {
        const iconHtml = this.dashboard?.icon
            ? `<span class="app-logo-emoji">${this.dashboard.icon}</span>`
            : `<div class="app-logo-icon"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`;

        document.getElementById('app').innerHTML = `
            <div class="app ${this.editMode ? 'edit-mode' : 'view-mode'}">
                <header class="app-header">
                    <div class="app-logo" onclick="app.openDashboardSettings()">
                        ${iconHtml}
                        <span>${this.dashboard?.name || 'Dashboard'}</span>
                        <svg class="edit-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </div>
                    
                    <div class="search-container">
                        <div class="search-bar" id="global-search-bar">
                            <span class="search-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                            <input type="text" class="search-input" id="global-search-input" placeholder="Search links or notes..." autocomplete="off">
                            <div class="search-shortcuts">
                                <span class="shortcut-hint">⌘K</span>
                            </div>
                            <!-- Dropdown for results -->
                            <div class="search-dropdown" id="search-dropdown" style="display: none;"></div>
                        </div>
                    </div>

                    <div class="header-actions">
                        <div class="new-content-menu">
                            <button class="btn btn-primary btn-icon-only" id="add-new-btn" title="Add New (⌘I)">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                            <div class="dropdown-menu" id="add-new-dropdown">
                                <div class="dropdown-item" onclick="app.openAddLinkModal()">
                                    <span class="icon">🔗</span> Link
                                    <span class="shortcut">L</span>
                                </div>
                                <div class="dropdown-item" onclick="app.openAddNoteModal()">
                                    <span class="icon">📝</span> Note
                                    <span class="shortcut">N</span>
                                </div>
                            </div>
                        </div>

                        <div class="desktop-actions">
                            <button class="btn nav-btn ${this.currentPage === 'dashboard' ? 'btn-primary' : 'btn-ghost'}" onclick="app.showDashboard()">Dashboard</button>
                            <button class="btn nav-btn ${this.currentPage === 'links' ? 'btn-primary' : 'btn-ghost'}" onclick="app.showLinksPage()">Links</button>
                            <button class="btn nav-btn ${this.currentPage === 'notes' ? 'btn-primary' : 'btn-ghost'}" onclick="app.showNotesPage()">Notes</button>
                            
                            <button class="btn btn-primary edit-mode-only" onclick="app.openWidgetDrawer()">
                                <span class="icon">➕</span> Add Widget
                            </button>

                            <button class="edit-mode-toggle btn ${this.editMode ? 'btn-primary' : 'btn-ghost'}" onclick="app.toggleEditMode()" title="${this.editMode ? 'Switch to view mode' : 'Switch to edit mode'}">
                                ${this.editMode ? '✓ Done' : '✎ Edit'}
                            </button>
                            
                            <div class="user-menu">
                                <div class="user-avatar" onclick="app.toggleUserMenu()">${this.user?.username?.charAt(0).toUpperCase() || 'U'}</div>
                                <div class="user-dropdown" id="user-dropdown">
                                    <div class="user-dropdown-item" onclick="app.toggleTheme()">Toggle Theme</div>
                                    <div class="user-dropdown-item" onclick="app.openSettings()">Settings</div>
                                    <div class="user-dropdown-divider"></div>
                                    <div class="user-dropdown-item" onclick="app.logout()">Sign Out</div>
                                </div>
                            </div>
                        </div>
                         <button class="mobile-menu-btn" onclick="app.toggleMobileMenu()">☰</button>
                    </div>
                    
                    <div class="mobile-menu-dropdown" id="mobile-menu-dropdown">
                         <div class="mobile-menu-item" onclick="app.showDashboard(); app.toggleMobileMenu()">Dashboard</div>
                        <div class="mobile-menu-item" onclick="app.showNotesPage(); app.toggleMobileMenu()">Notes</div>
                        <div class="mobile-menu-divider"></div>
                         <div class="mobile-menu-item" onclick="app.openAddLinkModal(); app.toggleMobileMenu()">+ Add Link</div>
                         <div class="mobile-menu-item" onclick="app.openAddNoteModal(); app.toggleMobileMenu()">+ Add Note</div>
                        <div class="mobile-menu-divider"></div>
                        <div class="mobile-menu-item" onclick="app.toggleEditMode(); app.toggleMobileMenu()">${this.editMode ? 'Done Editing' : 'Edit Dashboard'}</div>
                         <div class="mobile-menu-item" onclick="app.toggleTheme(); app.toggleMobileMenu()">Toggle Theme</div>
                        <div class="mobile-menu-item" onclick="app.openSettings(); app.toggleMobileMenu()">Settings</div>
                        <div class="mobile-menu-item" onclick="app.logout()">Sign Out</div>
                    </div>
                </header>
                <main class="app-main"><div id="main-content"></div></main>
            </div>
            <div id="toast-container" class="toast-container"></div>
            <div id="modal-overlay" class="modal-overlay"></div>`;
        this.updateThemeIcon();
        this.initKeyboardShortcuts();

        // Initialize Search
        this.searchController = new SearchController(this);

        // Initialize Add Menu
        this.initAddMenu();
    }

    initAddMenu() {
        const btn = document.getElementById('add-new-btn');
        const menu = document.getElementById('add-new-dropdown');
        if (!btn || !menu) return;

        // Toggle menu
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show');
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!btn.contains(e.target) && !menu.contains(e.target)) {
                menu.classList.remove('show');
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't process shortcuts if modal is open
            const modalOpen = document.getElementById('modal-overlay')?.classList.contains('active');
            if (modalOpen) return;

            // Cmd/Ctrl + I for Import/Insert/Add
            if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
                e.preventDefault();
                menu.classList.toggle('show');
            }

            // Shortcuts when menu is open
            if (menu.classList.contains('show')) {
                if (e.key === 'l') { // Link
                    this.openAddLinkModal();
                    menu.classList.remove('show');
                } else if (e.key === 'n') { // Note
                    this.openAddNoteModal();
                    menu.classList.remove('show');
                } else if (e.key === 'Escape') {
                    menu.classList.remove('show');
                }
            }
        });
    }

    toggleEditMode() {
        this.editMode = !this.editMode;
        document.querySelector('.app').className = `app ${this.editMode ? 'edit-mode' : 'view-mode'}`;
        const btn = document.querySelector('.edit-mode-toggle');
        if (btn) {
            btn.className = `edit-mode-toggle btn ${this.editMode ? 'btn-primary' : 'btn-ghost'}`;
            btn.innerHTML = this.editMode ? '✓ Editing' : '✎ Edit';
            btn.title = this.editMode ? 'Switch to view mode' : 'Switch to edit mode';
        }
        // Enable/disable grid editing
        if (this.grid) {
            this.grid.enableMove(this.editMode);
            this.grid.enableResize(this.editMode);
        }
        this.refreshLinksWidgets();
        // No toast - it covers important buttons
    }

    async openDashboardSettings() {
        this.showModal('Dashboard Settings', `
            <form id="dashboard-settings-form">
                <div class="form-group">
                    <label class="form-label">Dashboard Name</label>
                    <input class="input" name="name" value="${this.dashboard?.name || 'My Dashboard'}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Icon (emoji)</label>
                    <input class="input" name="icon" value="${this.dashboard?.icon || ''}" placeholder="🏠 or leave empty for default">
                    <div class="emoji-picker">${['🏠', '💼', '🎮', '📊', '🎵', '📺', '💻', '🌐', '⚡', '🔧', '📁', '🎯'].map(e => `<span class="emoji-option" onclick="document.querySelector('[name=icon]').value='${e}'">${e}</span>`).join('')}</div>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%">Save</button>
            </form>
        `);
        document.getElementById('dashboard-settings-form').addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.target;
            await api.updateDashboard(this.dashboard.id, { name: form.name.value, icon: form.icon.value || null });
            this.dashboard.name = form.name.value;
            this.dashboard.icon = form.icon.value || null;
            document.querySelector('.app-logo span').textContent = this.dashboard.name;
            const logoContainer = document.querySelector('.app-logo');
            if (this.dashboard.icon) {
                logoContainer.querySelector('.app-logo-icon, .app-logo-emoji')?.remove();
                logoContainer.insertAdjacentHTML('afterbegin', `<span class="app-logo-emoji">${this.dashboard.icon}</span>`);
            }
            this.closeModal();
            this.showToast('Dashboard settings saved');
        });
    }

    async showDashboard() {
        this.currentPage = 'dashboard';
        document.getElementById('main-content').innerHTML = '<div class="dashboard-container"><div class="grid-stack" id="grid"></div></div>';
        await this.initDashboard();
        this.updateHeaderButtons();
    }

    updateHeaderButtons() {
        document.querySelectorAll('.header-actions .nav-btn').forEach((b, i) => {
            if (this.currentPage === 'dashboard') b.className = `btn nav-btn ${i === 0 ? 'btn-primary' : 'btn-ghost'}`;
            else if (this.currentPage === 'notes') b.className = `btn nav-btn ${i === 1 ? 'btn-primary' : 'btn-ghost'}`;
        });
    }

    async showNotesPage() {
        this.currentPage = 'notes';
        this.updateHeaderButtons();
        this.allNotes = await api.getNotes();
        this.activeNoteTag = null; // Reset filter on enter
        this.renderNotesPage();
    }

    renderNotesPage() {
        this.currentPage = 'notes';
        window.location.hash = '#notes';
        this.updateNavButtons();

        const content = document.getElementById('main-content');

        // Extract and sort tags
        const allTags = new Set();
        this.allNotes.forEach(note => {
            if (note.tags) note.tags.forEach(t => allTags.add(t));
        });
        const sortedTags = Array.from(allTags).sort();

        const tagsHtml = sortedTags.map(tag =>
            `<button class="btn btn-sm ${this.activeNoteTag === tag ? 'btn-primary' : ''}" onclick="app.filterNotesByTag('${tag}')">${tag}</button>`
        ).join('');

        content.innerHTML = `
            <div class="notes-page">
                <div class="notes-header" style="flex-direction:column; align-items:flex-start; gap:var(--spacing-md);">
                    <div style="width:100%; display:flex; justify-content:space-between; align-items:center;">
                        <h2>All Notes</h2>
                        <div class="page-controls">
                            <select class="sort-select" onchange="app.setSortMode(this.value)">
                                <option value="updated_desc" ${this.sortMode === 'updated_desc' ? 'selected' : ''}>Newest</option>
                                <option value="updated_asc" ${this.sortMode === 'updated_asc' ? 'selected' : ''}>Oldest</option>
                                <option value="title_asc" ${this.sortMode === 'title_asc' ? 'selected' : ''}>Title A-Z</option>
                                <option value="title_desc" ${this.sortMode === 'title_desc' ? 'selected' : ''}>Title Z-A</option>
                            </select>
                            <div class="view-toggle">
                                <button class="view-toggle-btn ${this.viewMode === 'grid' ? 'active' : ''}" onclick="app.toggleViewMode('grid')" title="Grid View">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                </button>
                                <button class="view-toggle-btn ${this.viewMode === 'list' ? 'active' : ''}" onclick="app.toggleViewMode('list')" title="List View">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                                </button>
                            </div>
                             <button class="btn btn-primary" onclick="app.openAddNoteModal()">+ New Note</button>
                        </div>
                    </div>
                    ${sortedTags.length || this.activeNoteTag ? `
                    <div class="notes-filters-row" style="display:flex; justify-content:space-between; width:100%; align-items:center; gap:var(--spacing-md)">
                         <div class="notes-tags-filter" style="display:flex; gap:var(--spacing-sm); flex-wrap:wrap; flex:1;">
                            <button class="btn btn-sm ${!this.activeNoteTag ? 'btn-primary' : ''}" onclick="app.filterNotesByTag(null)">All</button>
                            ${tagsHtml}
                        </div>
                        <input type="text" class="input" id="notes-search" placeholder="Search notes..." style="width:200px;">
                    </div>` : `
                    <div style="width:100%; display:flex; justify-content:flex-end;">
                        <input type="text" class="input" id="notes-search" placeholder="Search notes..." style="width:200px;">
                    </div>`}
                </div>
                <div id="notes-grid" class="${this.viewMode === 'grid' ? 'notes-grid' : 'list-view-container'}"></div>
            </div>`;

        document.getElementById('notes-search').addEventListener('input', e => this.filterNotes(e.target.value));

        // Initial render
        this.filterNotes('');
    }

    renderNoteListItem(note) {
        const age = this.timeAgo(note.updated_at);
        const tagsHtml = (note.tags && note.tags.length)
            ? `<div style="display:flex; gap:4px;">${note.tags.map(t => `<span class="tag-pill-sm">${t}</span>`).join('')}</div>`
            : '';

        return `
        <div class="list-item" onclick="app.openNoteModal(${note.id})">
            <div class="list-item-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div class="list-item-content">
                <div class="list-item-title">${note.title}</div>
                <div class="list-item-meta">
                   <span>${age}</span>
                   ${tagsHtml}
                </div>
            </div>
            <div class="list-item-actions">
                <button class="btn-icon" onclick="event.stopPropagation(); app.toggleNoteWidget(${note.id})" title="${note.show_as_widget ? 'Hide from dashboard' : 'Show on dashboard'}">
                   ${note.show_as_widget ? '★' : '☆'}
                </button>
                <button class="btn-icon" onclick="event.stopPropagation(); app.editNote(${note.id})">✎</button>
                <button class="btn-icon" onclick="event.stopPropagation(); app.confirmDeleteNote(${note.id})">🗑</button>
            </div>
        </div>`;
    }

    async toggleNoteWidget(noteId) {
        const note = this.allNotes.find(n => n.id === noteId);
        if (!note) return;
        await api.updateNote(noteId, { show_as_widget: !note.show_as_widget });
        this.allNotes = await api.getNotes();
        if (this.currentPage === 'notes') this.filterNotes(document.getElementById('notes-search')?.value || '');
        else if (this.currentPage === 'dashboard') await this.initDashboard();
        this.showToast(!note.show_as_widget ? 'Note added to dashboard' : 'Note hidden from dashboard');
    }



    filterNotesByTag(tag) {
        const searchInput = document.getElementById('notes-search');
        const currentSearch = searchInput ? searchInput.value : '';

        this.activeNoteTag = tag;
        this.renderNotesPage();

        const newInput = document.getElementById('notes-search');
        if (newInput) {
            newInput.value = currentSearch;
            this.filterNotes(currentSearch);
            newInput.focus();
        }
    }

    filterNotes(query) {
        const grid = document.getElementById('notes-grid');
        if (!grid) return;

        const term = query.toLowerCase();
        let filtered = this.allNotes.filter(n => {
            const matchesSearch = n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term);
            const matchesTag = this.activeNoteTag ? (n.tags && n.tags.includes(this.activeNoteTag)) : true;
            return matchesSearch && matchesTag;
        });

        filtered = this.sortItems(filtered, this.sortMode);

        if (this.viewMode === 'grid') {
            grid.className = 'notes-grid';
            grid.innerHTML = filtered.map(n => this.renderNoteCard(n)).join('');
        } else {
            grid.className = 'list-view-container';
            grid.innerHTML = filtered.map(n => this.renderNoteListItem(n)).join('');
        }
    }

    async toggleNoteWidget(noteId) {
        const note = this.allNotes.find(n => n.id === noteId);
        if (!note) return;
        await api.updateNote(noteId, { show_as_widget: !note.show_as_widget });
        this.allNotes = await api.getNotes();
        if (this.currentPage === 'notes') this.renderNotesPage();
        else if (this.currentPage === 'dashboard') await this.initDashboard();
        this.showToast(!note.show_as_widget ? 'Note added to dashboard' : 'Note hidden from dashboard');
    }

    openNoteModal(id) { this.editNote(id); }

    initQuickAdd() {
        const input = document.getElementById('quick-add');
        if (!input) return;
        this.quickAddState = { isProcessing: false, selectedWidgetId: null, showWidgetPicker: false };

        input.addEventListener('keydown', async e => {
            if (this.quickAddState.isProcessing) { e.preventDefault(); return; }

            // Tab to show widget picker for links
            if (e.key === 'Tab' && input.value.trim()) {
                e.preventDefault();
                const isUrl = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(input.value.trim());
                if (isUrl) this.showWidgetPicker(input);
                return;
            }

            if (e.key === 'Enter' && input.value.trim()) {
                e.preventDefault();
                await this.handleQuickAdd(input.value.trim());
            }
        });

        // Close widget picker on outside click
        document.addEventListener('click', e => {
            if (!e.target.closest('.quick-add-container')) this.hideWidgetPicker();
        });
    }

    showWidgetPicker(input) {
        const container = input.closest('.quick-add-container');
        let picker = container.querySelector('.widget-picker');
        if (picker) { picker.remove(); this.quickAddState.showWidgetPicker = false; return; }

        const linksWidgets = Array.from(document.querySelectorAll('.links-widget')).map(el => ({
            id: parseInt(el.dataset.id),
            title: el.querySelector('.widget-title span')?.textContent || 'Links'
        }));

        picker = document.createElement('div');
        picker.className = 'widget-picker';
        picker.innerHTML = `
            <div class="widget-picker-header">Add link to widget:</div>
            <div class="widget-picker-option ${!this.quickAddState.selectedWidgetId ? 'selected' : ''}" data-id="">
                <span>📋</span> Unassigned (all widgets)
            </div>
            ${linksWidgets.map(w => `
                <div class="widget-picker-option ${this.quickAddState.selectedWidgetId === w.id ? 'selected' : ''}" data-id="${w.id}">
                    <span>🔗</span> ${w.title}
                </div>`).join('')}
            <div class="widget-picker-footer">Press Enter to save, Tab to toggle</div>
        `;
        container.appendChild(picker);
        this.quickAddState.showWidgetPicker = true;

        picker.querySelectorAll('.widget-picker-option').forEach(opt => {
            opt.addEventListener('click', () => {
                this.quickAddState.selectedWidgetId = opt.dataset.id ? parseInt(opt.dataset.id) : null;
                picker.querySelectorAll('.widget-picker-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                input.focus();
            });
        });
    }

    hideWidgetPicker() {
        const picker = document.querySelector('.widget-picker');
        if (picker) picker.remove();
        this.quickAddState.showWidgetPicker = false;
    }

    setQuickAddLoading(loading, message = '') {
        const input = document.getElementById('quick-add');
        const container = input?.closest('.quick-add-container');
        if (!input || !container) return;

        this.quickAddState.isProcessing = loading;
        input.disabled = loading;

        let indicator = container.querySelector('.quick-add-indicator');
        if (loading) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'quick-add-indicator';
                container.appendChild(indicator);
            }
            indicator.innerHTML = `<span class="spinner-small"></span> ${message}`;
            input.classList.add('loading');
        } else {
            if (indicator) indicator.remove();
            input.classList.remove('loading');
        }
    }

    async handleQuickAdd(text) {
        const input = document.getElementById('quick-add');
        const isUrl = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(text);

        if (isUrl) {
            let url = text;
            if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
            this.setQuickAddLoading(true, 'Saving link...');
            try {
                const hostname = new URL(url).hostname.replace('www.', '');
                await api.createLink({ url, title: hostname, widget_id: this.quickAddState.selectedWidgetId }, true);
                this.allLinks = await api.getLinks();
                input.value = '';
                this.hideWidgetPicker();
                this.quickAddState.selectedWidgetId = null;
                this.showToast(`✓ Link "${hostname}" saved!`, 'success');
                this.refreshLinksWidgets();
            } catch (err) {
                this.showToast('Failed to save link: ' + err.message, 'error');
            } finally {
                this.setQuickAddLoading(false);
            }
        } else {
            this.setQuickAddLoading(true, 'Saving note...');
            try {
                const title = text.length > 50 ? text.slice(0, 47) + '...' : text;
                await api.createNote({ title, content: text, show_as_widget: true });
                this.allNotes = await api.getNotes();
                input.value = '';
                this.showToast(`✓ Note "${title}" saved to dashboard!`, 'success');
                if (this.currentPage === 'dashboard') await this.initDashboard();
            } catch (err) {
                this.showToast('Failed to save note: ' + err.message, 'error');
            } finally {
                this.setQuickAddLoading(false);
            }
        }
    }

    enableInlineEdit(noteId, container) {
        const note = this.allNotes.find(n => n.id === noteId);
        if (!note) return;

        const currentContent = note.content;
        const height = Math.max(container.offsetHeight, 150);

        container.innerHTML = `
        <div class="rich-editor-wrapper" style="height:${height}px">
            <div class="rich-editor-toolbar">
                <button class="rich-editor-btn" type="button" onclick="app.execCmd('bold')" title="Bold">B</button>
                <button class="rich-editor-btn" type="button" onclick="app.execCmd('italic')" title="Italic">I</button>
                <button class="rich-editor-btn" type="button" onclick="app.execCmd('underline')" title="Underline">U</button>
                <button class="rich-editor-btn" type="button" onclick="app.execCmd('insertUnorderedList')" title="Bullet List">•</button>
                <button class="rich-editor-btn" type="button" onclick="app.execCmd('formatBlock', 'PRE')" title="Code Block">Code</button>
            </div>
            <div class="rich-editor-content" contenteditable="true" onblur="app.saveInlineNote(${noteId}, this)">${currentContent}</div>
        </div>`;

        const editor = container.querySelector('.rich-editor-content');
        editor.focus();
    }

    async saveInlineNote(noteId, editor) {
        const newContent = editor.innerHTML;
        const note = this.allNotes.find(n => n.id === noteId);

        if (note && newContent !== note.content) {
            // Optimistic update
            note.content = newContent;

            try {
                await api.updateNote(noteId, { content: newContent, is_code: false }); // Always HTML now
                // this.allNotes = await api.getNotes(); // No need to re-fetch if we update local state correctly, avoids flicker
                this.showToast('Note saved');
            } catch (e) {
                this.showToast('Failed to save note', 'error');
                console.error(e);
            }
        }

        // Render back to view mode
        // Find the container again in case it changed
        const widgetBody = editor.closest('.widget-body');
        if (widgetBody) {
            widgetBody.innerHTML = `<div class="note-full-content">${newContent}</div>`;
        }
    }

    async initDashboard() {
        this.currentPage = 'dashboard';
        window.location.hash = '#dashboard';
        this.updateNavButtons();

        let gridEl = document.getElementById('grid');
        if (!gridEl) {
            document.getElementById('main-content').innerHTML = '<div class="dashboard-container"><div class="grid-stack" id="grid"></div></div>';
            gridEl = document.getElementById('grid');
        }

        if (this.grid) {
            try { this.grid.destroy(false); } catch (e) { /* ignore */ }
            gridEl.innerHTML = ''; // Clean slate
        }

        this.grid = GridStack.init({
            column: 12,
            cellHeight: 80,
            margin: 8,
            float: true,
            animate: true,
            disableDrag: !this.editMode,
            disableResize: !this.editMode,
            draggable: { handle: '.widget-header' },
            resizable: { handles: 'se,sw' },
            // Responsive breakpoints for stacking on mobile
            columnOpts: {
                breakpoints: [
                    { w: 480, c: 1 },   // 1 column on phones
                    { w: 768, c: 6 },   // 6 columns on tablets
                    { w: 1024, c: 12 }  // 12 columns on desktop
                ]
            }
        }, gridEl);

        if (this.grid) {
            this.grid.on('change', () => this.savePositions());
        }

        const widgets = await api.getDashboardWidgets(this.dashboard.id);
        for (const w of widgets) this.addWidget(w);
        // Add note widgets
        const noteWidgets = this.allNotes.filter(n => n.show_as_widget);
        for (const n of noteWidgets) this.addNoteWidget(n);
    }

    addWidget(widget) {
        this.grid.addWidget({ id: widget.id, x: widget.grid_x, y: widget.grid_y, w: widget.grid_w, h: widget.grid_h, content: this.renderWidgetContent(widget) });
        this.initWidgetLogic(widget);
    }

    // Handle single vs double click on note widget body
    handleNoteWidgetClick(noteId, event) {
        // Prevent double-fire
        if (this._noteClickTimer) {
            clearTimeout(this._noteClickTimer);
            this._noteClickTimer = null;
            // Double click - edit
            this.editNote(noteId);
            return;
        }

        // Single click - delay to check for double
        this._noteClickTimer = setTimeout(() => {
            this._noteClickTimer = null;
            this.viewNote(noteId);
        }, 250);
    }

    sanitizeContent(content) {
        if (!content) return '';
        // Strip all on* event handlers (onerror, onclick, onload, etc.) to prevent XSS and infinite loops
        let safe = content.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
        // Also strip script tags
        safe = safe.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        return safe;
    }

    addNoteWidget(note) {
        const id = `note-${note.id}`;
        const safeContent = this.sanitizeContent(note.content);
        this.grid.addWidget({
            id, x: note.widget_grid_x, y: note.widget_grid_y, w: note.widget_grid_w, h: note.widget_grid_h, content: `
            <div class="widget note-widget" data-note-id="${note.id}" data-type="note">
                <div class="widget-header">
                    <div class="widget-title"><svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${note.title}</span></div>
                    <div class="widget-actions">
                        <button class="widget-action-btn" onclick="app.viewNote(${note.id})" title="View">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        </button>
                        <button class="widget-action-btn" onclick="app.editNote(${note.id})" title="Edit">✎</button>
                        <button class="widget-action-btn" onclick="app.toggleNoteWidget(${note.id})" title="Hide">×</button>
                    </div>
                </div>
                <div class="widget-body note-widget-body" onclick="app.handleNoteWidgetClick(${note.id}, event)">${note.is_code ? `<pre class="note-code"><code>${safeContent}</code></pre>` : `<div class="note-full-content">${safeContent}</div>`}</div>
            </div>` });
    }

    enableInlineEdit(noteId, container, event) {
        // Prevent re-initialization if editor is already active
        if (container.querySelector('.ql-container')) return;

        const note = this.allNotes.find(n => n.id === noteId);
        if (!note) return;

        // Capture click coordinates if available
        const clickX = event ? event.clientX : null;
        const clickY = event ? event.clientY : null;

        const safeContent = this.sanitizeContent(note.content);

        const height = Math.max(container.offsetHeight, 150);

        // Clear container and setup for Quill
        container.innerHTML = `<div id="editor-${noteId}" style="height: ${height}px;">${safeContent}</div>`;

        // Initialize Quill
        const quill = new Quill(`#editor-${noteId}`, {
            theme: 'snow',
            modules: {
                toolbar: {
                    container: [
                        ['bold', 'italic', 'underline', 'strike'],
                        ['blockquote', 'code-block'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['clean']
                    ]
                }
            }
        });

        // Add custom expand button to toolbar
        const toolbar = container.querySelector('.ql-toolbar');
        if (toolbar) {
            const expandBtn = document.createElement('span');
            expandBtn.classList.add('ql-formats');
            expandBtn.style.marginLeft = 'auto';
            expandBtn.innerHTML = `<button type="button" class="ql-expand" onclick="app.switchToModalEditor(${noteId})" title="Expand to Modal"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>`;
            toolbar.appendChild(expandBtn);
        }

        // Focus and selection logic
        quill.focus();

        // Save on blur (using selection-change event as proxy for blur)
        quill.on('selection-change', (range, oldRange, source) => {
            if (range === null && oldRange !== null) {
                this.saveInlineNote(noteId, quill.root);
            }
        });

        // Attempt to place cursor at click position (Quill handles this well natively, but we can try to be precise)
        if (clickX && clickY) {
            // Quill doesn't have a direct "cursor from point" API that's stable across versions, 
            // but simple focus usually puts cursor at end or clicked location if it captured the event.
            // Since we replaced the DOM, the original click target is gone. 
            // We rely on Quill's native behavior after focus.
        }
    }

    async switchToModalEditor(noteId) {
        // Manually trigger save from inline editor state first
        const widgetBody = document.querySelector(`.widget[data-note-id="${noteId}"] .widget-body`);
        const editorContent = widgetBody?.querySelector('.ql-editor'); // Quill's content editable div class

        if (editorContent) {
            // This will update this.allNotes and render the widget back to view mode
            await this.saveInlineNote(noteId, editorContent);
        }

        // Open the full modal editor
        this.editNote(noteId);
    }

    saveAndCloseModal() {
        const form = document.querySelector('.modal form');
        if (form) form.requestSubmit();
    }

    renderWidgetContent(widget) {
        return `<div class="widget ${widget.widget_type}-widget" data-id="${widget.id}" data-type="${widget.widget_type}">
            <div class="widget-header">
                <div class="widget-title">${this.getWidgetIcon(widget.widget_type)}<span>${widget.title}</span></div>
                <div class="widget-actions">
                    ${['links', 'weather'].includes(widget.widget_type) ? `<button class="widget-action-btn" onclick="app.openWidgetConfig(${widget.id})" title="Configure">⚙</button>` : ''}
                    <button class="widget-action-btn" onclick="app.refreshWidget(${widget.id})" title="Refresh">↻</button>
                    <button class="widget-action-btn" onclick="app.deleteWidget(${widget.id})" title="Delete">×</button>
                </div>
            </div>
            <div class="widget-body" id="widget-body-${widget.id}"><div class="widget-loading"><span class="spinner"></span></div></div>
        </div>`;
    }

    getWidgetIcon(type) {
        const icons = {
            links: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>',
            notes: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            weather: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>',
            docker: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
            proxmox: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg>',
            clock: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
        };
        return icons[type] || icons.links;
    }

    async initWidgetLogic(widget) {
        const body = document.getElementById(`widget-body-${widget.id}`);
        if (!body) return;
        try {
            switch (widget.widget_type) {
                case 'links': await this.loadLinksWidget(body, widget); break;
                case 'weather': await this.loadWeatherWidget(body, widget); break;
                case 'docker': await this.loadDockerWidget(body, widget); break;
                case 'proxmox': await this.loadProxmoxWidget(body, widget); break;
                case 'clock': this.loadClockWidget(body, widget); break;
                default: body.innerHTML = '<div class="widget-empty">Widget not supported</div>';
            }
        } catch (e) { body.innerHTML = `<div class="widget-error">${e.message}</div>`; }
    }

    getFaviconUrl(url) { try { return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`; } catch { return null; } }

    async loadLinksWidget(body, widget) {
        const config = widget.config || {};
        let links = await api.getLinks({ widget_id: widget.id });
        // If no links assigned to this widget, show unassigned links
        if (config.filterCategory) links = links.filter(l => l.category === config.filterCategory);
        links = links.slice(0, config.maxLinks || 10);
        // Sort by display_order
        links.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        const showIcon = config.showIcon !== false, showTitle = config.showTitle !== false, showCategory = config.showCategory !== false;
        const iconsOnly = showIcon && !showTitle && !showCategory;


        // Helper to render icon (Emoji, URL, or Favicon)
        const renderIcon = (l, sizeClass) => {
            if (l.custom_icon) {
                const icon = l.custom_icon.trim();
                // Check if URL (simple check for protocol or known image extensions if starting with www/http)
                if (icon.match(/^(https?:\/\/|\/|www\.)/i) || icon.match(/\.(png|jpg|jpeg|gif|ico|svg|webp)$/i)) {
                    return `<img class="${sizeClass}" src="${icon}" alt="icon" onerror="this.outerHTML='<span class=link-custom-icon>${icon}</span>'">`; // Fallback to text if img fails
                }
                // Assume Emoji
                return `<span class="link-custom-icon">${icon}</span>`;
            }
            // Favicon fallback
            return `<img class="${sizeClass}" src="${this.getFaviconUrl(l.url)}" onerror="this.outerHTML='<span class=link-favicon-placeholder>${l.title.charAt(0).toUpperCase()}</span>'" alt="">`;
        };

        const renderLinkContent = (l, i, isGrid) => {
            if (isGrid) {
                return `<a href="${l.url}" target="_blank" class="link-icon-item" data-id="${l.id}" data-index="${i}" data-url="${l.url}" title="${l.title}\n${l.url}" draggable="${this.editMode}">
                    ${renderIcon(l, 'link-favicon-lg')}
                </a>`;
            }
            // Tags display
            let tagsHtml = '';
            if (l.custom_tags && l.custom_tags.length) {
                tagsHtml = `<div class="link-tags-list">${l.custom_tags.map(t => `<span class="link-tag-pill">${t}</span>`).join('')}</div>`;
            }

            return `<div class="link-item-wrapper" draggable="${this.editMode}" data-id="${l.id}" data-index="${i}">
                    ${this.editMode ? '<span class="link-drag-handle" title="Drag to reorder">⋮⋮</span>' : ''}
                    <a href="${l.url}" target="_blank" class="link-item" data-url="${l.url}">
                        ${showIcon ? renderIcon(l, 'link-favicon') : ''}
                        <div class="link-info">
                            ${showTitle ? `<div class="link-title">${l.title}</div>` : ''}
                            ${tagsHtml}
                        </div>
                        ${showCategory && (!tagsHtml) ? `<span class="link-category">${l.category}</span>` : ''}
                    </a>
                    <div class="link-actions">
                        <button class="link-action-btn" onclick="app.editLink(${l.id})" title="Edit">✎</button>
                        <button class="link-action-btn" onclick="app.deleteLink(${l.id})" title="Delete">×</button>
                    </div>
                </div>`;
        };

        if (iconsOnly) {
            body.innerHTML = links.length ? `<div class="link-grid" data-widget-id="${widget.id}">${links.map((l, i) => renderLinkContent(l, i, true)).join('')}</div>
            <button class="add-link-btn" onclick="app.openAddLinkModal(${widget.id})">+ Add Link</button>`
                : `<div class="widget-empty">No links<br><button class="btn btn-sm" onclick="app.openAddLinkModal(${widget.id})">Add Link</button></div>`;
        } else {
            body.innerHTML = links.length ? `<div class="link-list" data-widget-id="${widget.id}">${links.map((l, i) => renderLinkContent(l, i, false)).join('')}</div>
            <button class="add-link-btn" onclick="app.openAddLinkModal(${widget.id})">+ Add Link</button>`
                : `<div class="widget-empty">No links<br><button class="btn btn-sm" onclick="app.openAddLinkModal(${widget.id})">Add Link</button></div>`;
        }

        // Enable drag-to-reorder in edit mode
        if (this.editMode && links.length > 1) {
            this.initLinkDragReorder(body, widget.id);
        }

        // Link Preview Hover Logic
        if (config.showPreviews !== false && !this.editMode) {

            const linkElements = body.querySelectorAll('a.link-item, a.link-icon-item');
            linkElements.forEach(el => {
                el.addEventListener('mouseenter', (e) => {

                    this.showLinkPreview(e, el.dataset.url);
                });
                el.addEventListener('mouseleave', () => {

                    this.hideLinkPreview();
                });
            });
        } else {

        }

        if (config.autoFit) {
            // Slight delay to ensure DOM is rendered calculation is correct
            setTimeout(() => this.autoFitWidget(widget.id), 50);
        }
    }

    // Link Preview Methods
    showLinkPreview(event, url) {
        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        this.previewTimeout = setTimeout(async () => {

            let card = document.getElementById('link-preview-card');
            if (!card) {
                card = document.createElement('div');
                card.id = 'link-preview-card';
                card.className = 'link-preview-card';
                document.body.appendChild(card);
            }

            // Position card near cursor but not under it
            const x = event.clientX + 20;
            const y = event.clientY + 20;

            // Adjust if out of bounds (basic)
            const winWidth = window.innerWidth;
            const winHeight = window.innerHeight;

            let finalX = x;
            let finalY = y;

            if (x + 300 > winWidth) finalX = event.clientX - 320;
            if (y + 200 > winHeight) finalY = event.clientY - 220;

            card.style.left = `${finalX}px`;
            card.style.top = `${finalY}px`;
            card.innerHTML = `<div class="spinner" style="margin: 20px auto;"></div>`;
            card.classList.add('visible');

            try {
                const data = await api.getLinkPreview(url);

                if (data.title) {
                    card.innerHTML = `
                        ${data.image ? `<img src="${data.image}" class="link-preview-image">` : ''}
                        <div class="link-preview-content">
                            <div class="link-preview-title">${data.title}</div>
                            ${data.description ? `<div class="link-preview-desc">${data.description}</div>` : ''}
                        </div>
                    `;
                } else {
                    card.innerHTML = `<div class="link-preview-content"><div class="link-preview-title">No preview available</div></div>`;
                }
            } catch (e) {
                console.error('Preview fetch error:', e);
                card.classList.remove('visible');
            }
        }, 600); // 600ms delay
    }

    hideLinkPreview() {
        if (this.previewTimeout) clearTimeout(this.previewTimeout);
        const card = document.getElementById('link-preview-card');
        if (card) {
            card.classList.remove('visible');
        }
    }

    autoFitWidget(widgetId) {
        if (!this.grid) return;
        // Find the GridStack item element
        const items = this.grid.getGridItems();
        const widgetEl = items.find(el => parseInt(el.gridstackNode.id) === widgetId);
        if (!widgetEl) return;

        const body = widgetEl.querySelector('.widget-body');
        if (!body) return;

        // Guardrails
        const MIN_ROWS = 2;
        const MAX_ROWS = 6;
        const CELL_HEIGHT = 80;
        const MARGIN = 8;
        const HEADER_HEIGHT_APPROX = 50;

        // Determine content height
        // For list, scrollHeight is good. For grid, same.
        const contentHeight = body.scrollHeight;

        // Total px height needed ~ Header + Content + Padding
        // We use scrollHeight which includes padding of content if box-sizing is border-box? 
        // Let's assume contentHeight + Header is roughly right.
        const totalHeightNeeded = contentHeight + HEADER_HEIGHT_APPROX;

        // Calculate rows: (Pixels + Margin) / (Cell + Margin)
        // formula: rows = ceil( (totalHeight + margin) / (cellHeight + margin) ) ??
        // Actually: gridHeight = rows * cellHeight + (rows - 1) * margin
        // gridHeight + margin = rows * (cellHeight + margin)
        // rows = (gridHeight + margin) / (cellHeight + margin)

        let rows = Math.ceil((totalHeightNeeded + MARGIN) / (CELL_HEIGHT + MARGIN));

        // Apply guardrails
        rows = Math.max(MIN_ROWS, Math.min(rows, MAX_ROWS));

        const node = widgetEl.gridstackNode;
        if (node && node.h !== rows) {
            this.grid.update(widgetEl, { h: rows });
        }
    }

    initKeyboardShortcuts() {
        // Global Shortcuts
        document.addEventListener('keydown', (e) => {
            // Check if modal is open - if so, ignore most shortcuts
            const modalOpen = document.getElementById('modal-overlay')?.classList.contains('active');

            // ESC: Always allow (to close modals)
            if (e.key === 'Escape') {
                const activeElement = document.activeElement;
                if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
                    activeElement.blur();
                }
                this.closeModal();
                this.hideLinkPreview();
                return;
            }

            // Don't process other shortcuts if modal is open
            if (modalOpen) return;

            // CMD/CTRL + K: Focus Command Bar
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('command-input')?.focus();
            }
        });

        // Command Bar Logic
        const commandInput = document.getElementById('command-input');
        if (commandInput) {
            commandInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleCommandBarSubmit(commandInput.value);
                    commandInput.value = '';
                }
            });
        }
    }

    handleCommandBarSubmit(value) {
        if (!value) return;
        value = value.trim();

        // Simple heuristic: URL vs Text
        const isUrl = /^(http|www\.)/i.test(value) || value.includes('.com') || value.includes('.org') || value.includes('.net');

        if (isUrl) {
            // Improve URL if missing protocol
            if (!/^https?:\/\//i.test(value)) {
                value = 'https://' + value;
            }
            this.openAddLinkModal(null, value); // Open modal with URL pre-filled
        } else {
            // Treat as Note or Search (For now, open Note modal)
            this.openExpandedQuickAdd(value);
        }
    }

    initLinkDragReorder(container, widgetId) {
        const list = container.querySelector('.link-list, .link-grid');
        if (!list) return;

        let draggedItem = null;

        list.querySelectorAll('[draggable="true"]').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                draggedItem = null;
                this.saveLinkOrder(list, widgetId);
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggedItem || draggedItem === item) return;
                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    item.parentNode.insertBefore(draggedItem, item);
                } else {
                    item.parentNode.insertBefore(draggedItem, item.nextSibling);
                }
            });
        });
    }

    async saveLinkOrder(list, widgetId) {
        const items = list.querySelectorAll('[data-id]');
        const updates = [];
        items.forEach((item, index) => {
            const linkId = parseInt(item.dataset.id);
            updates.push(api.updateLink(linkId, { display_order: index }));
        });
        await Promise.all(updates);
        // Update local cache
        this.allLinks = await api.getLinks();
    }

    async loadWeatherWidget(body, widget) {
        const config = widget.config || {};
        const location = config.location || this.user?.default_weather_location || 'New York';
        try {
            const weather = await api.getWeather(location);

            // Format functions
            const formatDate = (dateStr) => {
                const date = new Date(dateStr);
                const format = config.dateFormat || 'default';
                if (format === 'short') return date.toLocaleDateString();
                if (format === 'long') return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            };

            const formatTime = (dateObj) => {
                const format = config.timeFormat || '12';
                return dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: format === '12' });
            };

            const now = new Date();
            let currentInfoHtml = '';

            // Current Weather Display Construction
            if (config.showCurrentTemp !== false) {
                currentInfoHtml += `
                 <div class="weather-main-row">
                    <img class="weather-icon" src="https://openweathermap.org/img/wn/${weather.current.icon}@2x.png" alt="">
                    <div><div class="weather-temp">${Math.round(weather.current.temperature)}°</div><div class="weather-details">${weather.current.description}</div></div>
                 </div>`;
            }

            let extraInfoHtml = '';
            if (config.showCurrentDate !== false) {
                extraInfoHtml += `<div class="weather-current-date">${formatDate(now)}</div>`;
            }
            if (config.showCurrentTime) {
                extraInfoHtml += `<div class="weather-current-time">${formatTime(now)}</div>`;
            }

            let forecastHtml = '';
            if (config.showForecast !== false) {
                forecastHtml = `<div class="weather-forecast">${weather.forecast.slice(0, 5).map(d => `
                <div class="forecast-day">
                    <div class="forecast-day-name">${new Date(d.date).toLocaleDateString('en', { weekday: 'short' })}</div>
                    <img class="forecast-icon" src="https://openweathermap.org/img/wn/${d.icon}.png" alt="">
                    <div class="forecast-temps"><span class="forecast-high">${Math.round(d.temp_high)}°</span><span class="forecast-low">${Math.round(d.temp_low)}°</span></div>
                </div>`).join('')}</div>`;
            }

            body.innerHTML = `
                <div class="weather-container">
                    <div class="weather-location">${weather.current.location}</div>
                    ${currentInfoHtml}
                    ${extraInfoHtml ? `<div class="weather-extra-info">${extraInfoHtml}</div>` : ''}
                    ${forecastHtml}
                </div>`;

        } catch (e) {
            body.innerHTML = `<div class="widget-error">
                <div class="error-icon">☁️</div>
                <div class="error-title">Location not found</div>
                <div class="error-message">Could not load weather for "${location}".<br>Please try deleting and recreating with a valid City or Zip code.</div>
            </div>`;
        }
    }

    async loadDockerWidget(body, widget) {
        try {
            const data = await api.getDockerContainers();
            if (!data.containers || data.containers.length === 0) {
                body.innerHTML = '<div class="widget-empty">No containers found</div>';
                return;
            }
            body.innerHTML = `<div class="container-list">${data.containers.slice(0, 8).map(c => `
                <div class="container-item"><div class="container-status ${c.status}"></div>
                <div class="container-info"><div class="container-name">${c.name}</div><div class="container-image">${c.image}</div></div>
                ${c.cpu_percent !== null ? `<div class="container-stats"><span>CPU: ${c.cpu_percent}%</span></div>` : ''}</div>`).join('')}</div>`;
        } catch (err) {
            body.innerHTML = `<div class="widget-error">
                <div class="error-icon">🐳</div>
                <div class="error-title">Docker not available</div>
                <div class="error-message">Configure Docker socket access in settings</div>
            </div>`;
        }
    }

    async loadProxmoxWidget(body, widget) {
        try {
            const data = await api.getProxmoxStatus();
            if (!data.vms || data.vms.length === 0) {
                body.innerHTML = '<div class="widget-empty">No VMs found</div>';
                return;
            }
            body.innerHTML = `<div class="vm-list">${data.vms.slice(0, 8).map(v => `<div class="vm-item"><span class="container-status ${v.status}"></span><span class="vm-type">${v.type}</span><span class="vm-name">${v.name}</span><span class="vm-stats">CPU: ${v.cpu.toFixed(1)}%</span></div>`).join('')}</div>`;
        } catch (err) {
            body.innerHTML = `<div class="widget-error">
                <div class="error-icon">🖥️</div>
                <div class="error-title">Proxmox not available</div>
                <div class="error-message">Configure Proxmox API in settings</div>
            </div>`;
        }
    }

    loadClockWidget(body, widget) {
        // Clear existing interval if any
        if (widget.intervalId) clearInterval(widget.intervalId);

        const config = widget.config || {};
        const showTime = config.showTime !== false;
        const showDate = config.showDate !== false;
        const showCalendar = config.showCalendar === true;

        // Initial Layout
        body.innerHTML = `
            <div class="clock-display" id="clock-display-${widget.id}"></div>
            ${showCalendar ? `<div class="calendar-container" id="calendar-container-${widget.id}"></div>` : ''}
        `;

        const updateClock = () => {
            const now = new Date();
            const timeOpts = { hour: 'numeric', minute: '2-digit', hour12: config.timeFormat !== '24' };
            if (config.timeFormat === '24') {
                timeOpts.hour = '2-digit';
                timeOpts.hour12 = false;
            }

            let dateOpts = { weekday: 'long', month: 'long', day: 'numeric' };
            if (config.dateFormat === 'short') dateOpts = { month: 'numeric', day: 'numeric', year: '2-digit' };
            else if (config.dateFormat === 'medium') dateOpts = { month: 'short', day: 'numeric', year: 'numeric' };

            const timeStr = now.toLocaleTimeString('en-US', timeOpts);
            const dateStr = now.toLocaleDateString('en-US', dateOpts);

            const clockContainer = document.getElementById(`clock-display-${widget.id}`);
            if (clockContainer) {
                let html = '';
                if (showTime) html += `<div class="clock-time" style="font-size: ${showCalendar ? '2rem' : '3rem'}">${timeStr}</div>`;
                if (showDate) html += `<div class="clock-date" style="font-size: ${showCalendar ? '1rem' : '1.2rem'}">${dateStr}</div>`;
                clockContainer.innerHTML = html;
            }
        };

        updateClock();
        widget.intervalId = setInterval(updateClock, 1000);

        if (showCalendar) {
            const now = new Date();
            this.renderWidgetCalendar(widget.id, now.getFullYear(), now.getMonth());
        }
    }

    renderWidgetCalendar(widgetId, year, month) {
        const container = document.getElementById(`calendar-container-${widgetId}`);
        if (!container) return;

        const date = new Date(year, month, 1);
        const monthName = date.toLocaleDateString('en-US', { month: 'long' });
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayIndex = date.getDay(); // 0 = Sunday
        const today = new Date();

        let calendarHtml = `
            <div class="calendar-header">
                <button class="btn btn-icon btn-sm" onclick="app.changeCalendarMonth(${widgetId}, ${month - 1})">←</button>
                <div class="calendar-month-label">${monthName} ${year}</div>
                <button class="btn btn-icon btn-sm" onclick="app.changeCalendarMonth(${widgetId}, ${month + 1})">→</button>
            </div>
            <div class="calendar-grid">
                <div class="calendar-day-header">Su</div>
                <div class="calendar-day-header">Mo</div>
                <div class="calendar-day-header">Tu</div>
                <div class="calendar-day-header">We</div>
                <div class="calendar-day-header">Th</div>
                <div class="calendar-day-header">Fr</div>
                <div class="calendar-day-header">Sa</div>
        `;

        // Empty cells for previous month
        for (let i = 0; i < firstDayIndex; i++) {
            calendarHtml += `<div class="calendar-day empty"></div>`;
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            calendarHtml += `<div class="calendar-day ${isToday ? 'today' : ''}">${i}</div>`;
        }

        calendarHtml += `</div>`;
        container.innerHTML = calendarHtml;

        // Store current view state on the widget object if needed, 
        // but for now we pass explicit next/prev values in onclick
    }

    changeCalendarMonth(widgetId, newMonth) {
        // Handle year wrap-around
        const date = new Date(new Date().getFullYear(), newMonth, 1);
        this.renderWidgetCalendar(widgetId, date.getFullYear(), date.getMonth());
    }

    async savePositions() {
        if (!this.grid || !this.dashboard) return;
        // Only save positions if we are in full desktop mode (12 columns)
        // This prevents saving mobile/tablet responsive layout changes as permanent
        if (this.grid.getColumn() !== 12) return;

        const items = this.grid.getGridItems();
        const positions = [], notePositions = [];
        for (const el of items) {
            const node = el.gridstackNode;
            const noteId = el.querySelector('[data-note-id]')?.dataset.noteId;
            if (noteId) notePositions.push({ id: parseInt(noteId), x: node.x, y: node.y, w: node.w, h: node.h });
            else if (node.id) positions.push({ id: parseInt(node.id), grid_x: node.x, grid_y: node.y, grid_w: node.w, grid_h: node.h });
        }
        if (positions.length) await api.updateWidgetPositions(this.dashboard.id, positions);
        for (const np of notePositions) await api.updateNote(np.id, { widget_grid_x: np.x, widget_grid_y: np.y, widget_grid_w: np.w, widget_grid_h: np.h });
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) {
            // Toast container doesn't exist yet (e.g., on auth page), use alert fallback
            console.log(`[${type}] ${message}`);
            return;
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    toggleUserMenu() { document.getElementById('user-dropdown').classList.toggle('open'); }
    logout() { api.setToken(null); window.location.reload(); }

    toggleMobileMenu() {
        const menu = document.getElementById('mobile-menu-dropdown');
        menu.classList.toggle('open');
    }

    openExpandedQuickAdd() {
        const input = document.getElementById('quick-add');
        const value = input.value.trim();

        // Intelligent routing based on input
        if (value.startsWith('http')) {
            // It's a link
            this.showModal('Add Link', `
                <form id="add-link-form">
                    <div class="form-group"><label class="form-label">URL</label><input class="input" name="url" value="${value}" required></div>
                    <div class="form-group"><label class="form-label">Title</label><input class="input" name="title" placeholder="Auto-fetched if empty"></div>
                    <div class="form-group"><label class="form-label">Category</label><input class="input" name="category" list="categories" placeholder="Category">
                        <datalist id="categories">${['Social', 'Dev', 'News', 'Tools'].map(c => `<option value="${c}">`).join('')}</datalist></div>
                    <div class="form-group"><label class="form-label">Custom Icon (emoji, optional)</label><input class="input" name="custom_icon" placeholder="e.g. 🔗, 🏠, 💻"></div>
                    <div class="form-group"><label class="form-label">Widget</label>
                        <select class="input" name="widget_id">${this.getLinksWidgets().map(w => `<option value="${w.id}">${w.title}</option>`).join('')}</select>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width:100%" id="add-link-submit">Add Link</button>
                    ${!this.getLinksWidgets().length ? '<p class="error-text" style="margin-top:8px">No Link Widgets found. Add one first!</p>' : ''}
                </form>`);
            this.bindAddLinkForm();
        } else {
            // Default to Note/Text
            this.showModal('Add Note', `
                <form id="add-note-form">
                    <div class="form-group">
                        <label class="form-label">Content</label>
                        <div id="quick-note-editor" style="height: 150px;">${value}</div>
                    </div>
                    <div class="form-group"><label class="form-label">Category</label><input class="input" name="category" placeholder="General"></div>
                    <div class="form-group"><label class="checkbox"><input type="checkbox" name="show_as_widget"> Show as Widget</label></div>
                    <button type="submit" class="btn btn-primary" style="width:100%">Add Note</button>
                </form>`);

            const quill = new Quill('#quick-note-editor', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        ['bold', 'italic', 'underline', 'strike'],
                        ['blockquote', 'code-block'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['clean']
                    ]
                }
            });

            document.getElementById('add-note-form').addEventListener('submit', async e => {
                e.preventDefault();
                const content = quill.root.innerHTML;
                await api.createNote({ content: content, category: e.target.category.value || 'General', show_as_widget: e.target.show_as_widget.checked });
                this.allNotes = await api.getNotes(); // Refresh local state
                this.closeModal();
                this.showToast('Note added');
                if (this.currentPage === 'notes') this.renderNotesPage();
                else this.loadDashboard();
            });
        }
        input.value = ''; // clear input
    }

    async refreshWidget(id) {
        const widgets = await api.getDashboardWidgets(this.dashboard.id);
        const widget = widgets.find(w => w.id === id);
        if (widget) {
            // Update widget title in header
            const titleEl = document.querySelector(`[data-id="${id}"] .widget-title span`);
            if (titleEl) titleEl.textContent = widget.title;
            // Update widget body
            this.initWidgetLogic(widget);
        }
    }

    refreshLinksWidgets() {
        document.querySelectorAll('.links-widget').forEach(el => {
            const id = el.dataset.id;
            if (id) this.refreshWidget(parseInt(id));
        });
    }

    async deleteWidget(id) {
        if (!confirm('Delete this widget?')) return;
        await api.deleteWidget(id);
        const el = document.querySelector(`[data-id="${id}"]`)?.closest('.grid-stack-item');
        if (el) this.grid.removeWidget(el);
        this.showToast('Widget deleted');
    }

    async deleteLink(id) {
        if (!confirm('Delete this link?')) return;
        await api.deleteLink(id);

        // Refresh local data state
        this.allLinks = await api.getLinks();

        this.refreshLinksWidgets();
        // If on links page, refresh the grid there too
        if (this.currentPage === 'links') this.renderLinksPage();
        this.showToast('Link deleted');
    }

    openWidgetDrawer() {
        const types = ['links', 'weather', 'docker', 'proxmox', 'clock'];
        this.showModal('Add Widget', `<div class="widget-toolbar" style="flex-wrap: wrap;">
            ${types.map(t => `<button class="widget-toolbar-item" onclick="app.createWidget('${t}')">${this.getWidgetIcon(t)}<span class="widget-toolbar-label">${t.charAt(0).toUpperCase() + t.slice(1)}</span></button>`).join('')}
        </div>`);
    }

    async createWidget(type) {
        // Ensure we're on the dashboard page with grid initialized
        if (this.currentPage !== 'dashboard' || !this.grid) {
            await this.showDashboard();
        }

        // Intercept weather widget creation to ask for location
        if (type === 'weather') {
            this.openWeatherLocationModal();
            return;
        }

        // Find the bottom-most position to add new widget there
        let maxY = 0;
        if (this.grid) {
            const items = this.grid.getGridItems();
            items.forEach(item => {
                const node = item.gridstackNode;
                if (node && (node.y + node.h) > maxY) {
                    maxY = node.y + node.h;
                }
            });
        }
        const widget = await api.createWidget({ dashboard_id: this.dashboard.id, widget_type: type, title: type.charAt(0).toUpperCase() + type.slice(1), grid_x: 0, grid_y: maxY, grid_w: 4, grid_h: 3 });
        if (this.grid) {
            this.addWidget(widget);
        }
        this.closeModal();
        this.showToast('Widget added');
    }

    openWeatherLocationModal() {
        this.showModal('Add Weather Widget', `
            <form id="weather-location-form">
                <div class="form-group">
                    <label class="form-label">Location</label>
                    <input class="input" name="location" placeholder="e.g. London, UK or 10001" required>
                    <p class="help-text" style="font-size: var(--font-size-xs); color: var(--color-text-tertiary); margin-top: 4px;">
                        Supported formats:
                        <br>• City Name (e.g. "New York")
                        <br>• City, Country Code (e.g. "London, UK")
                        <br>• Zip/Postal Code (e.g. "10001" or "SW1")
                    </p>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%">Add Widget</button>
            </form>
        `);

        document.getElementById('weather-location-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const location = e.target.location.value.trim();
            if (location) {
                this.createWeatherWidget(location);
            }
        });
    }

    async createWeatherWidget(location) {
        // Find the bottom-most position to add new widget there
        let maxY = 0;
        if (this.grid) {
            const items = this.grid.getGridItems();
            items.forEach(item => {
                const node = item.gridstackNode;
                if (node && (node.y + node.h) > maxY) {
                    maxY = node.y + node.h;
                }
            });
        }

        try {
            const widget = await api.createWidget({
                dashboard_id: this.dashboard.id,
                widget_type: 'weather',
                title: 'Weather',
                grid_x: 0,
                grid_y: maxY,
                grid_w: 4,
                grid_h: 2,
                config: { location: location }
            });

            if (this.grid) {
                this.addWidget(widget);
            }
            this.closeModal();
            this.showToast('Weather widget added');
        } catch (error) {
            console.error('Failed to create weather widget:', error);
            this.showToast('Failed to add widget');
        }
    }

    showModal(title, content, headerActions = '') {
        const overlay = document.getElementById('modal-overlay');
        overlay.innerHTML = `<div class="modal" onclick="event.stopPropagation()"><div class="modal-header"><h3 class="modal-title">${title}</h3><div style="display:flex;gap:var(--spacing-xs);align-items:center;">${headerActions}<button class="btn btn-ghost btn-icon modal-close-btn" onclick="app.closeModal()" title="Close">×</button></div></div><div class="modal-body">${content}</div></div>`;
        overlay.classList.add('active');

        // Close modal when clicking outside
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.closeModal();
            }
        };
    }

    closeModal() { document.getElementById('modal-overlay').classList.remove('active'); }

    async showLinksPage() {
        this.currentPage = 'links';
        window.location.hash = '#links';
        this.updateNavButtons();

        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="links-page-container fade-in">
                <div class="page-header">
                    <h2>Links Library</h2>
                    <div class="page-controls">
                        <select class="sort-select" onchange="app.setSortMode(this.value)">
                                <option value="updated_desc" ${this.sortMode === 'updated_desc' ? 'selected' : ''}>Newest</option>
                                <option value="updated_asc" ${this.sortMode === 'updated_asc' ? 'selected' : ''}>Oldest</option>
                                <option value="title_asc" ${this.sortMode === 'title_asc' ? 'selected' : ''}>Title A-Z</option>
                                <option value="title_desc" ${this.sortMode === 'title_desc' ? 'selected' : ''}>Title Z-A</option>
                        </select>
                        <div class="view-toggle">
                            <button class="view-toggle-btn ${this.viewMode === 'grid' ? 'active' : ''}" onclick="app.toggleViewMode('grid')" title="Grid View">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                            </button>
                            <button class="view-toggle-btn ${this.viewMode === 'list' ? 'active' : ''}" onclick="app.toggleViewMode('list')" title="List View">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            </button>
                        </div>
                        <div class="search-bar-wrapper">
                            <input type="text" id="links-search" placeholder="Search links or #tags..." class="search-input">
                        </div>
                        <button class="btn btn-primary" onclick="app.openAddLinkModal()">+ Add Link</button>
                    </div>
                </div>
                <div id="links-page-grid" class="${this.viewMode === 'grid' ? 'links-page-grid' : 'list-view-container'}">
                    <div class="spinner"></div>
                </div>
            </div>`;

        // Load links
        if (!this.allLinks || !this.allLinks.length) this.allLinks = await api.getLinks();

        // Setup Search Listener
        const searchInput = document.getElementById('links-search');
        if (searchInput) {
            searchInput.focus();
            searchInput.addEventListener('input', (e) => this.renderLinksPage(e.target.value));
        }

        // Initial Render
        this.renderLinksPage();
    }

    renderLinksPage(query = '') {
        if (!query) {
            const input = document.getElementById('links-search');
            if (input) query = input.value;
        }

        const grid = document.getElementById('links-page-grid');
        if (!grid) return;

        const term = query.toLowerCase();
        let filtered = this.allLinks.filter(l =>
            l.title.toLowerCase().includes(term) ||
            l.url.toLowerCase().includes(term) ||
            (l.custom_tags && l.custom_tags.some(t => t.toLowerCase().includes(term))) ||
            (l.category && l.category.toLowerCase().includes(term))
        );

        filtered = this.sortItems(filtered, this.sortMode);

        if (!filtered.length) {
            grid.innerHTML = '<div class="empty-state">No links found matching your search.</div>';
            return;
        }

        if (this.viewMode === 'grid') {
            grid.className = 'links-page-grid';
            grid.innerHTML = filtered.map(l => this.renderLinkCardInternal(l)).join('');
        } else {
            grid.className = 'list-view-container';
            grid.innerHTML = filtered.map(l => this.renderLinkListItem(l)).join('');
        }
    }

    renderLinkCardInternal(l) {
        let tagsHtml = '';
        if (l.custom_tags && l.custom_tags.length) {
            tagsHtml = `<div class="link-card-tags">${l.custom_tags.map(t => `<span class="tag-pill-sm">${t}</span>`).join('')}</div>`;
        }
        return `
            <div class="link-card">
                <div class="link-card-header">
                    <div class="link-card-icon">
                        ${l.custom_icon ?
                (l.custom_icon.match(/^(http|www)/) ? `<img src="${l.custom_icon}" class="link-icon-img" onerror="this.style.display='none'">` : `<span>${l.custom_icon}</span>`)
                : `<img src="${this.getFaviconUrl(l.url)}" class="link-icon-img" onerror="this.outerHTML='<span class=link-favicon-placeholder>${l.title.charAt(0).toUpperCase()}</span>'">`
            }
                    </div>
                    <div class="link-card-actions">
                         <button onclick="app.editLink(${l.id})" class="btn-icon">✎</button>
                         <button onclick="window.open('${l.url}', '_blank')" class="btn-icon">↗</button>
                    </div>
                </div>
                <div class="link-card-body">
                    <div class="link-card-title" title="${l.title}">${l.title}</div>
                    <div class="link-card-url" title="${l.url}">${l.url.replace(/^https?:\/\//, '')}</div>
                    ${tagsHtml}
                </div>
            </div>`;
    }

    renderLinkListItem(l) {
        let tagsHtml = '';
        if (l.custom_tags && l.custom_tags.length) {
            tagsHtml = `<div style="display:flex; gap:4px;">${l.custom_tags.map(t => `<span class="tag-pill-sm">${t}</span>`).join('')}</div>`;
        }

        const iconHtml = l.custom_icon ?
            (l.custom_icon.match(/^(http|www)/) ? `<img src="${l.custom_icon}" onerror="this.style.display='none'">` : `<span>${l.custom_icon}</span>`)
            : `<img src="${this.getFaviconUrl(l.url)}" onerror="this.outerHTML='<span class=link-favicon-placeholder>${l.title.charAt(0).toUpperCase()}</span>'">`;

        return `
        <div class="list-item">
            <div class="list-item-icon">${iconHtml}</div>
            <div class="list-item-content">
                <div class="list-item-title"><a href="${l.url}" target="_blank" style="color:inherit; text-decoration:none;">${l.title}</a></div>
                <div class="list-item-meta" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                   ${tagsHtml}
                   <span class="link-url-dull">${l.url.replace(/^https?:\/\//, '').substring(0, 30)}...</span>
                   <span style="color:var(--color-text-tertiary); font-size:0.7rem; border-left:1px solid var(--color-border); padding-left:8px;" title="Created: ${l.created_at ? new Date(l.created_at).toLocaleString() : 'Unknown'}">Created ${this.timeAgo(l.created_at)}</span>
                   <span style="color:var(--color-text-tertiary); font-size:0.7rem;" title="Updated: ${l.updated_at ? new Date(l.updated_at).toLocaleString() : 'Unknown'}">Updated ${this.timeAgo(l.updated_at)}</span>
                </div>
            </div>
            <div class="list-item-actions">
                <button class="btn-icon" onclick="app.editLink(${l.id})">✎</button>
                <button class="btn-icon" onclick="window.open('${l.url}', '_blank')">↗</button>
            </div>
        </div>`;
    }

    updateNavButtons() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('btn-primary', 'btn-ghost');
            if (btn.textContent.trim().toLowerCase() === this.currentPage) {
                btn.classList.add('btn-primary');
            } else {
                btn.classList.add('btn-ghost');
            }
        });
    }

    async openAddLinkModal(widgetId = null, initialUrl = '') {
        // Get all link widgets for dropdown
        const allWidgets = await api.getDashboardWidgets(this.dashboard.id);
        const linkWidgets = allWidgets.filter(w => w.widget_type === 'links');

        // Get default widget from settings or use first available
        const defaultWidgetId = widgetId || localStorage.getItem('defaultLinkWidget') || (linkWidgets[0]?.id || '');

        const widgetOptions = linkWidgets.map(w =>
            `<option value="${w.id}" ${w.id == defaultWidgetId ? 'selected' : ''}>${w.title}</option>`
        ).join('');

        this.showModal('Add Link', `<form id="add-link-form">
            <div class="form-group"><label class="form-label">URL</label><input type="url" class="input" name="url" placeholder="https://example.com" required value="${initialUrl}"></div>
            <div class="form-group"><label class="form-label">Title</label><input class="input" name="title" placeholder="Optional - Auto-fetched"></div>
            <div class="form-group"><label class="form-label">Custom Icon</label><input class="input" name="custom_icon" placeholder="Emoji or https://..."></div>
            
            <div class="form-group">
                <label class="form-label">Add to Widget</label>
                <select class="input" name="widget_id" id="widget-selector">
                    <option value="">Unassigned</option>
                    ${widgetOptions}
                </select>
                <div class="form-hint" style="margin-top:4px; font-size:0.75rem; color:var(--color-text-tertiary);">
                    <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
                        <input type="checkbox" id="set-default-widget" style="margin:0;">
                        <span>Set as my default widget</span>
                    </label>
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
                    Tags
                    <button type="button" class="btn btn-sm btn-ghost" id="auto-tag-btn" style="font-size:0.8rem;">✨ AI Suggest</button>
                </label>
                <div id="tag-input-container"></div>
                <div class="form-hint" style="margin-top:4px; font-size:0.75rem; color:var(--color-text-tertiary);">Hit Enter to add tags. #first tag becomes category.</div>
            </div>

            <button type="submit" class="btn btn-primary" style="width:100%" id="add-link-submit">Add Link</button>
        </form>`);

        // Auto-focus URL
        const urlInput = document.querySelector('#add-link-form [name="url"]');
        setTimeout(() => urlInput.focus(), 100);

        // Auto-prefix https:// as user types
        urlInput.addEventListener('input', (e) => {
            let value = e.target.value;
            // Only auto-prefix if user has typed something and it doesn't already have a protocol
            if (value && !value.match(/^https?:\/\//i)) {
                // Don't prefix if they're in the middle of typing "http://"
                if (!value.startsWith('http')) {
                    e.target.value = 'https://' + value;
                    // Move cursor to end
                    e.target.setSelectionRange(e.target.value.length, e.target.value.length);
                }
            }
        });

        // Init Tag Input
        const tagContainer = document.getElementById('tag-input-container');
        const tagInput = new TagInput(tagContainer, []);

        // AI Logic
        const autoTagBtn = document.getElementById('auto-tag-btn');
        const titleInput = document.querySelector('#add-link-form [name="title"]');

        autoTagBtn.onclick = async () => {
            const url = urlInput.value.trim();
            if (!url) { this.showToast('Enter URL first', 'error'); return; }
            autoTagBtn.textContent = 'Thinking...';
            autoTagBtn.disabled = true;

            try {
                const res = await api.suggestTags(url, titleInput.value);
                if (res.tags && res.tags.length) {
                    // Add unique tags
                    const currentTags = tagInput.getTags();
                    const newTags = res.tags.filter(t => !currentTags.includes(t));
                    newTags.forEach(t => tagInput.addTag(t));
                    this.showToast(`Added ${newTags.length} tags`);
                } else {
                    this.showToast('No tags suggested');
                }
            } catch (e) {
                this.showToast('AI Error: ' + e.message, 'error');
            } finally {
                autoTagBtn.innerHTML = '✨ AI Suggest';
                autoTagBtn.disabled = false;
            }
        };

        document.getElementById('add-link-form').addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.target;
            const btn = form.querySelector('#add-link-submit');
            if (btn.disabled) return;

            let url = form.url.value.trim();
            // Basic URL fix and validation
            if (!url.match(/^https?:\/\//)) {
                if (url.match(/^[\w.-]+\.[a-z]{2,}/)) {
                    url = 'https://' + url;
                } else {
                    this.showToast('Invalid URL format', 'error');
                    return;
                }
            }

            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-small"></span> Adding...';

            try {
                const title = form.title.value || new URL(url).hostname.replace('www.', '');
                const widgetId = form.widget_id.value ? parseInt(form.widget_id.value) : null;
                const custom_icon = form.custom_icon.value || null;
                const tags = tagInput.getTags();

                // Save default widget preference if checkbox is checked
                const setDefaultCheckbox = document.getElementById('set-default-widget');
                if (setDefaultCheckbox?.checked && widgetId) {
                    localStorage.setItem('defaultLinkWidget', widgetId);
                    this.showToast('Default widget saved');
                }

                // Map first tag to category for compatibility
                const category = tags.length > 0 ? tags[0].replace('#', '') : 'uncategorized';

                await api.createLink({
                    url,
                    title,
                    widget_id: widgetId,
                    custom_icon,
                    custom_tags: tags,
                    category
                });

                this.allLinks = await api.getLinks();
                this.closeModal();
                this.showToast('Link added');

                // Immediate update
                if (this.currentPage === 'links') this.renderLinksPage();
                else if (this.currentPage === 'dashboard') await this.initDashboard();
                else this.refreshLinksWidgets(); // Fallback if elsewhere

            } catch (err) {
                this.showToast('Failed: ' + err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Add Link';
            }
        });
    }

    async editLink(id) {
        const link = this.allLinks.find(l => l.id === id);
        if (!link) return;

        this.showModal('Edit Link', `<form id="edit-link-form">
            <div class="form-group"><label class="form-label">URL</label><input class="input" name="url" value="${link.url}" required></div>
            <div class="form-group"><label class="form-label">Title</label><input class="input" name="title" value="${link.title}"></div>
            <div class="form-group"><label class="form-label">Custom Icon</label><input class="input" name="custom_icon" value="${link.custom_icon || ''}" placeholder="Emoji or URL"></div>
            
            <div class="form-group">
                <label class="form-label" style="display:flex; justify-content:space-between; align-items:center;">
                    Tags
                    <button type="button" class="btn btn-sm btn-ghost" id="edit-auto-tag-btn" style="font-size:0.8rem;">✨ Refresh Tags</button>
                </label>
                <div id="edit-tag-input-container"></div>
            </div>

            <div style="display:flex;gap:var(--spacing-sm)">
                <button type="submit" class="btn btn-primary" style="flex:1">Save Changes</button>
                <button type="button" class="btn" onclick="app.deleteLink(${id})">Delete</button>
            </div>
        </form>`);

        // Init Tag Input
        const tagContainer = document.getElementById('edit-tag-input-container');
        // Handle migration: if custom_tags is empty but category exists, use category
        let initialTags = link.custom_tags || [];
        if (!initialTags.length && link.category && link.category !== 'uncategorized') {
            initialTags = [`#${link.category}`];
        }
        const tagInput = new TagInput(tagContainer, initialTags);

        // AI Logic for Edit
        const autoTagBtn = document.getElementById('edit-auto-tag-btn');
        const urlInput = document.querySelector('#edit-link-form [name="url"]');
        const titleInput = document.querySelector('#edit-link-form [name="title"]');

        // Auto-prefix https:// as user types
        urlInput.addEventListener('input', (e) => {
            let value = e.target.value;
            if (value && !value.match(/^https?:\/\//i)) {
                if (!value.startsWith('http')) {
                    e.target.value = 'https://' + value;
                    e.target.setSelectionRange(e.target.value.length, e.target.value.length);
                }
            }
        });

        autoTagBtn.onclick = async () => {
            const url = urlInput.value.trim();
            autoTagBtn.textContent = 'Thinking...';
            autoTagBtn.disabled = true;

            try {
                const res = await api.suggestTags(url, titleInput.value);
                if (res.tags && res.tags.length) {
                    const currentTags = tagInput.getTags();
                    const newTags = res.tags.filter(t => !currentTags.includes(t));
                    newTags.forEach(t => tagInput.addTag(t));
                    this.showToast(`Added ${newTags.length} tags`);
                } else {
                    this.showToast('No new tags found');
                }
            } catch (e) {
                this.showToast('AI Error: ' + e.message, 'error');
            } finally {
                autoTagBtn.innerHTML = '✨ Refresh Tags';
                autoTagBtn.disabled = false;
            }
        };

        document.getElementById('edit-link-form').addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.target;

            let url = form.url.value.trim();
            // Basic URL fix and validation
            if (!url.match(/^https?:\/\//)) {
                if (url.match(/^[\w.-]+\.[a-z]{2,}/)) {
                    url = 'https://' + url;
                } else {
                    this.showToast('Invalid URL format', 'error');
                    return;
                }
            }

            const tags = tagInput.getTags();
            const category = tags.length > 0 ? tags[0].replace('#', '') : 'uncategorized';

            await api.updateLink(id, {
                url: form.url.value,
                title: form.title.value,
                custom_icon: form.custom_icon.value || null,
                custom_tags: tags,
                category
            });

            this.allLinks = await api.getLinks();
            this.closeModal();
            this.showToast('Link updated');
            this.refreshLinksWidgets();
        });
    }

    renderNoteCard(note) {
        const age = this.timeAgo(note.updated_at);
        const tagsHtml = (note.tags && note.tags.length)
            ? `<div class="link-tags-list" style="margin-bottom:var(--spacing-xs)">${note.tags.map(t => `<span class="link-tag-pill">${t}</span>`).join('')}</div>`
            : '';
        const safeContent = this.sanitizeContent(note.content);

        return `<div class="note-card ${note.show_as_widget ? 'on-dashboard' : ''}" data-id="${note.id}">
            <div class="note-card-header">
                <h3>${note.title}</h3>
                <div class="note-card-actions">
                    <button class="note-visibility-btn ${note.show_as_widget ? 'visible' : ''}" onclick="app.toggleNoteWidget(${note.id})" title="${note.show_as_widget ? 'Hide from dashboard' : 'Show on dashboard'}">
                        ${note.show_as_widget ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'}
                    </button>
                    ${note.category ? `<span class="badge">${note.category}</span>` : ''}
                </div>
            </div>
            <div class="note-card-content" onclick="app.openNoteModal(${note.id})">
                ${tagsHtml}
                <div class="note-content-preview">${safeContent}</div>
            </div>
            <div class="note-card-meta">
                <span class="note-age" title="Updated ${new Date(note.updated_at).toLocaleString()}">${age}</span>
            </div>
        </div>`;
    }

    // Modal for adding/editing notes with Rich Editor (Quill) and Tags
    openAddNoteModal() {
        this.showModal('Add Note', `<form id="add-note-form">
            <div class="form-group"><label class="form-label">Title</label><input class="input" name="title" placeholder="Optional (auto-generated if empty)"></div>
            <div class="form-group"><label class="form-label">Content</label>
                <div id="add-note-editor" style="height: 200px;"></div>
            </div>
            <div class="form-group">
                <label class="form-label">Tags</label>
                <div id="note-tag-input-container"></div>
            </div>
            <div class="form-group"><label class="checkbox"><input type="checkbox" name="show_as_widget" checked> Show on dashboard</label></div>
            <button type="submit" class="btn btn-primary" style="width:100%">Save Note</button>
        </form>`);

        const quill = new Quill('#add-note-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['clean']
                ]
            }
        });

        // Auto-focus editor
        setTimeout(() => quill.focus(), 100);

        // Init Tag Input
        const tagInput = new TagInput(document.getElementById('note-tag-input-container'), []);

        document.getElementById('add-note-form').addEventListener('submit', async e => {
            e.preventDefault();
            const content = quill.root.innerHTML;
            let title = e.target.title.value.trim();

            // Auto-title logic
            if (!title) {
                const text = quill.getText().trim();
                title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
                if (!title) title = 'Untitled Note';
            }

            const tags = tagInput.getTags();

            await api.createNote({
                title: title,
                content: content,
                show_as_widget: e.target.show_as_widget.checked,
                tags: tags
            });

            this.allNotes = await api.getNotes();
            this.closeModal();
            this.showToast('Note saved');

            // Immediate update
            if (this.currentPage === 'notes') this.renderNotesPage();
            else if (this.currentPage === 'dashboard') await this.initDashboard();
        });
    }

    async editNote(id) {
        const note = this.allNotes.find(n => n.id === id);
        if (!note) return;

        let content = this.sanitizeContent(note.content);

        this.showModal('Edit Note', `<form id="edit-note-form">
            <div class="form-group"><label class="form-label">Title</label><input class="input" name="title" value="${note.title}" required></div>
            <div class="form-group"><label class="form-label">Content</label>
                 <div id="edit-note-editor" style="height: 300px;">${content}</div>
            </div>
            <div class="form-group">
                <label class="form-label">Tags</label>
                <div id="edit-note-tag-input-container"></div>
            </div>
            <div class="form-group"><label class="checkbox"><input type="checkbox" name="show_as_widget" ${note.show_as_widget ? 'checked' : ''}> Show on dashboard</label></div>
            <div style="display:flex;gap:var(--spacing-sm)"><button type="submit" class="btn btn-primary" style="flex:1">Save</button><button type="button" class="btn" onclick="app.confirmDeleteNote(${id})">Delete</button></div>
        </form>`);

        const quill = new Quill('#edit-note-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['clean']
                ]
            }
        });

        if (!quill) {
            console.error('Failed to initialize Quill editor');
            this.showToast('Error loading editor', 'error');
            this.closeModal();
            return;
        }

        // Add custom collapse button to toolbar
        const toolbar = document.querySelector('.ql-toolbar');
        if (toolbar) {
            const collapseBtn = document.createElement('span');
            collapseBtn.classList.add('ql-formats');
            collapseBtn.style.marginLeft = 'auto';
            collapseBtn.innerHTML = `<button type="button" class="ql-collapse" onclick="app.saveAndCloseModal()" title="Collapse & Save"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg></button>`;
            toolbar.appendChild(collapseBtn);
        }

        // Init Tag Input
        const tagInput = new TagInput(document.getElementById('edit-note-tag-input-container'), note.tags || []);

        document.getElementById('edit-note-form').addEventListener('submit', async e => {
            e.preventDefault();
            const content = quill.root.innerHTML;
            const tags = tagInput.getTags();

            await api.updateNote(id, {
                title: e.target.title.value,
                content: content,
                show_as_widget: e.target.show_as_widget.checked,
                tags: tags
            });

            this.allNotes = await api.getNotes();
            this.closeModal();
            this.showToast('Note updated');
            if (this.currentPage === 'notes') this.renderNotesPage();
            else await this.initDashboard();
        });
    }

    viewNote(id) {
        const note = this.allNotes.find(n => n.id === id);
        if (!note) return;
        const safeContent = this.sanitizeContent(note.content);

        const headerActions = `
            <button class="btn btn-ghost btn-icon" onclick="app.closeModal(); app.editNote(${id});" title="Edit Note">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon" onclick="app.confirmDeleteNote(${id})" title="Delete Note">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
        `;

        this.showModal(note.title, `
            <div class="note-view-content ql-editor" style="max-height: 70vh; overflow-y: auto; user-select: text; padding: var(--spacing-md); border-radius: var(--radius-md);">
                ${note.is_code ? `<pre class="note-code"><code>${safeContent}</code></pre>` : safeContent}
            </div>
        `, headerActions);
    }

    // Alias for backward compatibility
    openNoteModal(id) { this.viewNote(id); }

    async confirmDeleteNote(id) {
        if (confirm('Delete this note?')) {
            await api.deleteNote(id);
            this.allNotes = await api.getNotes();
            this.closeModal();
            this.showToast('Note deleted');
            if (this.currentPage === 'notes') this.renderNotesPage();
            else await this.initDashboard();
        }
    }

    async openWidgetConfig(widgetId) {
        const widgets = await api.getDashboardWidgets(this.dashboard.id);
        const widget = widgets.find(w => w.id === widgetId);
        if (!widget) return;
        const config = widget.config || {};

        if (widget.widget_type === 'weather') {
            this.showModal('Configure Weather Widget', `<form id="widget-config-form">
                <div class="form-group"><label class="form-label">Widget Title</label><input class="input" name="title" value="${widget.title}"></div>
                <div class="form-group"><label class="form-label">Location</label><input class="input" name="location" value="${config.location || ''}" placeholder="e.g., New York, London, 01745"></div>
                
                <div class="form-group-row">
                    <div class="form-group">
                        <label class="form-label">Date Format</label>
                        <select class="input" name="dateFormat">
                            <option value="default" ${config.dateFormat === 'default' ? 'selected' : ''}>Default (Mon, Jan 1)</option>
                            <option value="short" ${config.dateFormat === 'short' ? 'selected' : ''}>Short (1/1/24)</option>
                            <option value="long" ${config.dateFormat === 'long' ? 'selected' : ''}>Long (January 1, 2024)</option>
                        </select>
                    </div>
                     <div class="form-group">
                        <label class="form-label">Time Format</label>
                        <select class="input" name="timeFormat">
                            <option value="12" ${config.timeFormat === '12' ? 'selected' : ''}>12-hour (1:00 PM)</option>
                            <option value="24" ${config.timeFormat === '24' ? 'selected' : ''}>24-hour (13:00)</option>
                        </select>
                    </div>
                </div>

                <div class="form-group"><label class="checkbox"><input type="checkbox" name="showCurrentTemp" ${config.showCurrentTemp !== false ? 'checked' : ''}> Show Current Temperature</label></div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="showCurrentDate" ${config.showCurrentDate !== false ? 'checked' : ''}> Show Current Date</label></div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="showCurrentTime" ${config.showCurrentTime ? 'checked' : ''}> Show Current Time</label></div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="showForecast" ${config.showForecast !== false ? 'checked' : ''}> Show 5-Day Forecast</label></div>

                <button type="submit" class="btn btn-primary" style="width:100%">Save</button>
            </form>`);
            document.getElementById('widget-config-form').addEventListener('submit', async e => {
                e.preventDefault();
                const form = e.target;
                const newConfig = {
                    location: form.location.value,
                    dateFormat: form.dateFormat.value,
                    timeFormat: form.timeFormat.value,
                    showCurrentTemp: form.showCurrentTemp.checked,
                    showCurrentDate: form.showCurrentDate.checked,
                    showCurrentTime: form.showCurrentTime.checked,
                    showForecast: form.showForecast.checked
                };
                await api.updateWidget(widgetId, { title: form.title.value, config: newConfig });
                this.closeModal();
                this.showToast('Widget configured');
                this.refreshWidget(widgetId);
            });
        } else if (widget.widget_type === 'clock') {
            this.showModal('Configure Clock Widget', `<form id="widget-config-form">
                <div class="form-group"><label class="form-label">Widget Title</label><input class="input" name="title" value="${widget.title}"></div>
                
                <div class="form-group-row">
                    <div class="form-group">
                        <label class="form-label">Date Format</label>
                        <select class="input" name="dateFormat">
                            <option value="full" ${config.dateFormat === 'full' ? 'selected' : ''}>Full (Monday, January 1)</option>
                            <option value="short" ${config.dateFormat === 'short' ? 'selected' : ''}>Short (1/1/24)</option>
                            <option value="medium" ${config.dateFormat === 'medium' ? 'selected' : ''}>Medium (Jan 1, 2024)</option>
                        </select>
                    </div>
                     <div class="form-group">
                        <label class="form-label">Time Format</label>
                        <select class="input" name="timeFormat">
                            <option value="12" ${config.timeFormat === '12' ? 'selected' : ''}>12-hour (1:00 PM)</option>
                            <option value="24" ${config.timeFormat === '24' ? 'selected' : ''}>24-hour (13:00)</option>
                        </select>
                    </div>
                </div>

                <div class="form-group"><label class="checkbox"><input type="checkbox" name="showTime" ${config.showTime !== false ? 'checked' : ''}> Show Time</label></div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="showDate" ${config.showDate !== false ? 'checked' : ''}> Show Date</label></div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="showCalendar" ${config.showCalendar ? 'checked' : ''}> Show Monthly Calendar</label></div>

                <button type="submit" class="btn btn-primary" style="width:100%">Save</button>
            </form>`);
            document.getElementById('widget-config-form').addEventListener('submit', async e => {
                e.preventDefault();
                const form = e.target;
                const newConfig = {
                    dateFormat: form.dateFormat.value,
                    timeFormat: form.timeFormat.value,
                    showTime: form.showTime.checked,
                    showDate: form.showDate.checked,
                    showCalendar: form.showCalendar.checked
                };
                await api.updateWidget(widgetId, { title: form.title.value, config: newConfig });
                this.closeModal();
                this.showToast('Widget configured');
                this.refreshWidget(widgetId);
            });
        } else if (widget.widget_type === 'links') {
            const categories = ['all', 'news', 'technology', 'social', 'work', 'shopping', 'entertainment', 'education', 'finance', 'other', 'uncategorized'];
            this.showModal('Configure Links Widget', `<form id="widget-config-form">
                <div class="form-group"><label class="form-label">Widget Title</label><input class="input" name="title" value="${widget.title}"></div>
                <div class="form-group"><label class="form-label">Filter by Category</label>
                    <select class="input" name="filterCategory">${categories.map(c => `<option value="${c === 'all' ? '' : c}" ${config.filterCategory === c || (!config.filterCategory && c === 'all') ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label class="form-label">Max Links</label><input class="input" name="maxLinks" type="number" value="${config.maxLinks || 10}" min="1" max="50"></div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="showIcon" ${config.showIcon !== false ? 'checked' : ''}> Show favicon</label></div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="showTitle" ${config.showTitle !== false ? 'checked' : ''}> Show title</label></div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="showCategory" ${config.showCategory !== false ? 'checked' : ''}> Show category</label></div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="showPreviews" ${config.showPreviews !== false ? 'checked' : ''}> Show Link Previews</label></div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="autoFit" ${config.autoFit ? 'checked' : ''}> Auto-fit Height (Min 2, Max 6 rows)</label></div>
                <button type="submit" class="btn btn-primary" style="width:100%">Save</button>
            </form>`);
            document.getElementById('widget-config-form').addEventListener('submit', async e => {
                e.preventDefault();
                const form = e.target;
                const newConfig = {
                    filterCategory: form.filterCategory.value || null,
                    maxLinks: parseInt(form.maxLinks.value),
                    showIcon: form.showIcon.checked,
                    showTitle: form.showTitle.checked,
                    showCategory: form.showCategory.checked,
                    showPreviews: form.showPreviews.checked,
                    autoFit: form.autoFit.checked
                };
                await api.updateWidget(widgetId, { title: form.title.value, config: newConfig });
                this.closeModal();
                this.showToast('Widget configured');
                this.refreshWidget(widgetId);
            });
        }
    }

    openSettings() {
        this.toggleUserMenu();
        this.showModal('Settings', `<div class="settings-section">
            <div class="settings-row"><div><div class="settings-label">Theme</div><div class="settings-description">Choose your preferred color scheme</div></div>
                <select class="input" style="width:auto" onchange="app.setTheme(this.value)">
                    <option value="system" ${localStorage.getItem('theme') === 'system' ? 'selected' : ''}>System</option>
                    <option value="light" ${localStorage.getItem('theme') === 'light' ? 'selected' : ''}>Light</option>
                    <option value="dark" ${localStorage.getItem('theme') === 'dark' ? 'selected' : ''}>Dark</option>
                </select>
            </div>
            <div class="settings-row"><div><div class="settings-label">Weather Location</div><div class="settings-description">Default location for weather widgets</div></div>
                <input class="input" style="width:200px" value="${this.user?.default_weather_location || ''}" onchange="app.updateUserSetting('default_weather_location', this.value)">
            </div>
        </div>`);
    }

    async updateUserSetting(key, value) {
        await api.updateMe({ [key]: value });
        this.user[key] = value;
        this.showToast('Setting saved');
    }
}

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
