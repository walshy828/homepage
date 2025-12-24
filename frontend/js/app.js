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
        let iconHtml = item.icon;
        // Check if icon is a URL (image)
        if (item.icon && (item.icon.match(/^(https?:\/\/|\/|www\.)/i) || item.icon.match(/\.(png|jpg|jpeg|gif|ico|svg|webp)$/i))) {
            iconHtml = `<img class="search-result-icon-img" src="${item.icon}" alt="" style="width:20px;height:20px;border-radius:4px;object-fit:cover;" onerror="this.outerHTML='<span>${item.icon}</span>'">`;
        } else {
            // Wrap emoji/text in span for alignment
            iconHtml = `<span>${item.icon}</span>`;
        }

        return `
            <div class="search-result" data-index="${index}" data-id="${item.id}" data-type="${item.type}">
                <div class="search-result-icon">${iconHtml}</div>
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
        this.activeLinkTag = null;
        this.viewMode = localStorage.getItem('viewMode') || 'grid'; // grid | list
        this.sortMode = localStorage.getItem('sortMode') || 'updated_desc'; // updated_desc | updated_asc | title_asc | title_desc
        this._isDirty = false;

        this.linkLibraryPrefs = JSON.parse(localStorage.getItem('linkLibraryPrefs')) || {
            showDescription: true,
            showStats: true,
            showAssignedWidget: true
        };
        this.linkWidgetFilter = 'all';

        // Browser navigation warning
        window.addEventListener('beforeunload', (e) => {
            if (this._isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    // Helper to sort items
    sortItems(items, sortMode) {
        // For server-side sorted modes, return as-is
        if (sortMode === 'recent' || sortMode === 'popular') {
            return items;
        }

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

    async setSortMode(mode) {
        this.sortMode = mode;
        localStorage.setItem('sortMode', mode);

        // For links library with 'recent' or 'popular', reload from API
        if (this.currentPage === 'links' && (mode === 'recent' || mode === 'popular')) {
            this.allLinks = await api.getLinks({ sort_by: mode });
        }

        if (this.currentPage === 'notes') this.renderNotesPage();
        else if (this.currentPage === 'links') this.renderLinksPage();
    }

    setWidgetFilter(widgetId) {
        this.linkWidgetFilter = widgetId;
        this.renderLinksPage();
    }

    execCmd(cmd, value = null) {
        document.execCommand(cmd, false, value);
    }

    async init() {
        this.initTheme();

        // Handle Password Reset Routing
        const urlParams = new URLSearchParams(window.location.search);
        const resetToken = urlParams.get('token');
        if (resetToken) {
            this.showResetPassword(resetToken);
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

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

    showAuth(errorMessage = null) {
        document.getElementById('app').innerHTML = `
            <div class="auth-page"><div class="auth-card">
                <div class="auth-header">
                    <div class="app-logo-icon" style="margin: 0 auto var(--spacing-md);"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
                    <h1 class="auth-title">Homepage Dashboard</h1>
                    <p class="auth-subtitle">Sign in to your dashboard</p>
                </div>
                ${errorMessage ? `<div class="auth-error" id="auth-error">${errorMessage}</div>` : '<div class="auth-error" id="auth-error" style="display: none;"></div>'}
                <form id="login-form">
                    <div class="form-group">
                        <label class="form-label">Username or Email</label>
                        <input type="text" class="input" name="username" required autocomplete="username">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <div class="password-input-wrapper">
                            <input type="password" class="input" id="login-password" name="password" required autocomplete="current-password">
                            <button type="button" class="password-toggle-btn" onclick="app.togglePasswordVisibility('login-password')" title="Show password">
                                <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="auth-links" style="text-align: right; margin-bottom: var(--spacing-md);">
                        <a href="#" id="forgot-password" style="font-size: 0.875rem; color: var(--color-accent);">Forgot password?</a>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Sign In</button>
                </form>
                <div class="auth-footer">Don't have an account? <a href="#" id="show-register">Sign up</a></div>
            </div></div>`;
        document.getElementById('login-form').addEventListener('submit', e => this.handleLogin(e));
        document.getElementById('show-register').addEventListener('click', e => { e.preventDefault(); this.showRegister(); });
        document.getElementById('forgot-password').addEventListener('click', e => { e.preventDefault(); this.showForgotPassword(); });
    }

    showRegister() {
        document.getElementById('app').innerHTML = `
            <div class="auth-page"><div class="auth-card">
                <div class="auth-header"><h1 class="auth-title">Create Account</h1><p class="auth-subtitle">Start building your dashboard</p></div>
                <div class="auth-error" id="auth-error" style="display: none;"></div>
                <form id="register-form">
                    <div class="form-group"><label class="form-label">Email</label><input type="email" class="input" name="email" required autocomplete="email"></div>
                    <div class="form-group"><label class="form-label">Username</label><input type="text" class="input" name="username" required minlength="3" autocomplete="username"></div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <div class="password-input-wrapper">
                            <input type="password" class="input" id="register-password" name="password" required minlength="6" autocomplete="new-password">
                            <button type="button" class="password-toggle-btn" onclick="app.togglePasswordVisibility('register-password')" title="Show password">
                                <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                        </div>
                        <small style="color: var(--color-text-tertiary); font-size: 0.75rem;">Minimum 6 characters</small>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Create Account</button>
                </form>
                <div class="auth-footer">Already have an account? <a href="#" id="show-login">Sign in</a></div>
            </div></div>`;
        document.getElementById('register-form').addEventListener('submit', e => this.handleRegister(e));
        document.getElementById('show-login').addEventListener('click', e => { e.preventDefault(); this.showAuth(); });
    }

    async handleLogin(e) {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button[type="submit"]');
        const errorDiv = document.getElementById('auth-error');

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        errorDiv.style.display = 'none';

        try {
            await api.login(form.username.value, form.password.value);
            this.user = await api.getMe();
            await this.loadDashboard();
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Sign In';
            errorDiv.textContent = err.message || 'Login failed. Please check your credentials and try again.';
            errorDiv.style.display = 'block';
            form.password.value = ''; // Clear password field
            form.password.focus();
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button[type="submit"]');
        const errorDiv = document.getElementById('auth-error');

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        errorDiv.style.display = 'none';

        try {
            await api.register(form.email.value, form.username.value, form.password.value);
            await api.login(form.username.value, form.password.value);
            this.user = await api.getMe();
            await this.loadDashboard();
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Create Account';
            errorDiv.textContent = err.message || 'Registration failed. Please try again.';
            errorDiv.style.display = 'block';
            form.password.value = ''; // Clear password field
            form.password.focus();
        }
    }

    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const button = input.nextElementSibling;

        if (input.type === 'password') {
            input.type = 'text';
            button.setAttribute('title', 'Hide password');
            button.querySelector('.eye-icon').innerHTML = `
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
        } else {
            input.type = 'password';
            button.setAttribute('title', 'Show password');
            button.querySelector('.eye-icon').innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
        }
    }

    showForgotPassword() {
        document.getElementById('app').innerHTML = `
            <div class="auth-page"><div class="auth-card">
                <div class="auth-header">
                    <h1 class="auth-title">Reset Password</h1>
                    <p class="auth-subtitle">Enter your email to receive reset instructions</p>
                </div>
                <div class="auth-error" id="auth-error" style="display: none;"></div>
                <div class="auth-success" id="auth-success" style="display: none;"></div>
                <form id="forgot-password-form">
                    <div class="form-group">
                        <label class="form-label">Email Address</label>
                        <input type="email" class="input" name="email" required autocomplete="email">
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Send Reset Link</button>
                </form>
                <div class="auth-footer"><a href="#" id="back-to-login">Back to Sign In</a></div>
            </div></div>`;

        document.getElementById('forgot-password-form').addEventListener('submit', e => this.handleForgotPassword(e));
        document.getElementById('back-to-login').addEventListener('click', e => { e.preventDefault(); this.showAuth(); });
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button[type="submit"]');
        const errorDiv = document.getElementById('auth-error');
        const successDiv = document.getElementById('auth-success');

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';

        try {
            await api.requestPasswordReset(form.email.value);
            btn.style.display = 'none';
            form.email.disabled = true;
            successDiv.textContent = 'Password reset instructions have been sent to your email. Please check your inbox.';
            successDiv.style.display = 'block';
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Send Reset Link';
            errorDiv.textContent = err.message || 'Failed to send reset link. Please try again.';
            errorDiv.style.display = 'block';
        }
    }

    showResetPassword(token) {
        document.getElementById('app').innerHTML = `
            <div class="auth-page"><div class="auth-card">
                <div class="auth-header">
                    <h1 class="auth-title">Set New Password</h1>
                    <p class="auth-subtitle">Enter your new password below</p>
                </div>
                <div class="auth-error" id="auth-error" style="display: none;"></div>
                <form id="reset-password-form">
                    <input type="hidden" name="token" value="${token}">
                    <div class="form-group">
                        <label class="form-label">New Password</label>
                        <div class="password-input-wrapper">
                            <input type="password" class="input" id="new-password" name="password" required minlength="6" autocomplete="new-password">
                            <button type="button" class="password-toggle-btn" onclick="app.togglePasswordVisibility('new-password')" title="Show password">
                                <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                        </div>
                        <small style="color: var(--color-text-tertiary); font-size: 0.75rem;">Minimum 6 characters</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Confirm Password</label>
                        <div class="password-input-wrapper">
                            <input type="password" class="input" id="confirm-password" name="confirm_password" required minlength="6" autocomplete="new-password">
                            <button type="button" class="password-toggle-btn" onclick="app.togglePasswordVisibility('confirm-password')" title="Show password">
                                <svg class="eye-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%;">Reset Password</button>
                </form>
                <div class="auth-footer"><a href="#" id="back-to-login">Back to Sign In</a></div>
            </div></div>`;

        document.getElementById('reset-password-form').addEventListener('submit', e => this.handleResetPassword(e));
        document.getElementById('back-to-login').addEventListener('click', e => { e.preventDefault(); this.showAuth(); });
    }

    async handleResetPassword(e) {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('button[type="submit"]');
        const errorDiv = document.getElementById('auth-error');

        const password = form.password.value;
        const confirmPassword = form.confirm_password.value;

        if (password !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match.';
            errorDiv.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
        errorDiv.style.display = 'none';

        try {
            await api.resetPassword(form.token.value, password);
            this.showToast('Password reset successfully! Please sign in with your new password.');
            setTimeout(() => this.showAuth(), 1500);
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Reset Password';
            errorDiv.textContent = err.message || 'Failed to reset password. The link may have expired.';
            errorDiv.style.display = 'block';
        }
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
        const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

        const logoIconHtml = this.dashboard?.icon
            ? `<span class="sidebar-logo-emoji">${this.dashboard.icon}</span>`
            : `<div class="sidebar-logo-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>`;

        document.getElementById('app').innerHTML = `
            <div class="app ${this.editMode ? 'edit-mode' : 'view-mode'}">
                <!-- Sidebar Navigation -->
                <nav class="app-sidebar-nav ${sidebarCollapsed ? 'collapsed' : ''}" id="app-sidebar">
                    <div class="sidebar-header">
                        <button class="sidebar-toggle-btn" onclick="app.toggleSidebar()" title="Toggle Sidebar (⌘B)">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"/>
                            </svg>
                        </button>
                        <div class="sidebar-logo" onclick="app.showDashboard()">
                            ${logoIconHtml}
                            <span class="sidebar-logo-text">${this.dashboard?.name || 'Dashboard'}</span>
                        </div>
                    </div>
                    
                    <div class="sidebar-nav">
                        <!-- Main Navigation -->
                        <div class="sidebar-section">
                            <div class="sidebar-section-title">Navigate</div>
                            <div class="sidebar-item ${this.currentPage === 'dashboard' ? 'active' : ''}" onclick="app.showDashboard(); app.closeMobileSidebar();" title="Dashboard (G then D)">
                                <span class="sidebar-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg></span>
                                <span class="sidebar-item-text">Dashboard</span>
                                <span class="sidebar-item-shortcut">G→D</span>
                            </div>
                            <div class="sidebar-item ${this.currentPage === 'links' ? 'active' : ''}" onclick="app.showLinksPage(); app.closeMobileSidebar();" title="Links (G then L)">
                                <span class="sidebar-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
                                <span class="sidebar-item-text">Links</span>
                                <span class="sidebar-item-shortcut">G→L</span>
                            </div>
                            <div class="sidebar-item ${this.currentPage === 'notes' ? 'active' : ''}" onclick="app.showNotesPage(); app.closeMobileSidebar();" title="Notes (G then N)">
                                <span class="sidebar-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>
                                <span class="sidebar-item-text">Notes</span>
                                <span class="sidebar-item-shortcut">G→N</span>
                            </div>
                        </div>
                        
                        <div class="sidebar-divider"></div>
                        
                        <!-- Actions -->
                        <div class="sidebar-section">
                            <div class="sidebar-section-title">Actions</div>
                            <div class="sidebar-item ${this.editMode ? 'active' : ''}" onclick="app.toggleEditMode(); app.closeMobileSidebar();" title="Toggle Edit Mode (E)">
                                <span class="sidebar-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></span>
                                <span class="sidebar-item-text">${this.editMode ? '✓ Editing' : 'Edit Mode'}</span>
                                <span class="sidebar-item-shortcut">E</span>
                            </div>
                            <div class="sidebar-item edit-mode-only" onclick="app.openWidgetDrawer(); app.closeMobileSidebar();" title="Add Widget (N)">
                                <span class="sidebar-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></span>
                                <span class="sidebar-item-text">Add Widget</span>
                                <span class="sidebar-item-shortcut">N</span>
                            </div>
                        </div>
                        
                        <div class="sidebar-divider"></div>
                        
                        <!-- Settings -->
                        <div class="sidebar-section">
                            <div class="sidebar-section-title">Settings</div>
                            <div class="sidebar-item" onclick="app.toggleTheme(); app.closeMobileSidebar();" title="Toggle Theme">
                                <span class="sidebar-item-icon" id="theme-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg></span>
                                <span class="sidebar-item-text">Toggle Theme</span>
                            </div>
                            <div class="sidebar-item" onclick="app.openDashboardSettings(); app.closeMobileSidebar();" title="Dashboard Settings">
                                <span class="sidebar-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
                                <span class="sidebar-item-text">Dashboard Settings</span>
                            </div>
                            <div class="sidebar-item" onclick="app.openSettings(); app.closeMobileSidebar();" title="User Settings">
                                <span class="sidebar-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg></span>
                                <span class="sidebar-item-text">User Settings</span>
                            </div>
                            <div class="sidebar-item" onclick="app.showKeyboardHelp();" title="Keyboard Shortcuts (?)">
                                <span class="sidebar-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg></span>
                                <span class="sidebar-item-text">Keyboard Shortcuts</span>
                                <span class="sidebar-item-shortcut">?</span>
                            </div>
                        </div>
                        
                        <div class="sidebar-divider"></div>
                        
                        <!-- User -->
                        <div class="sidebar-section">
                            <div class="sidebar-item" onclick="app.logout();" title="Sign Out">
                                <span class="sidebar-item-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span>
                                <span class="sidebar-item-text">Sign Out (${this.user?.username || 'User'})</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="sidebar-footer">
                        <div style="padding: 10px; font-size: 10px; color: var(--color-text-tertiary); text-align: center; opacity: 0.5;">
                            Version 1.37
                        </div>
                    </div>
                </nav>
                
                <!-- Mobile Sidebar Overlay -->
                <div class="sidebar-overlay" id="sidebar-overlay" onclick="app.closeMobileSidebar()"></div>
                
                <!-- Main Content -->
                <div class="app-content-wrapper">
                    <!-- Top Bar (Search + Add) -->
                    <header class="app-topbar">
                        <button class="mobile-menu-toggle" onclick="app.openMobileSidebar()" title="Menu">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                        </button>
                        
                        <div class="search-container">
                            <div class="search-bar" id="global-search-bar">
                                <span class="search-icon"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                                <input type="text" class="search-input" id="global-search-input" placeholder="Search links or notes..." autocomplete="off">
                                <div class="search-shortcuts">
                                    <span class="shortcut-hint">/</span>
                                </div>
                                <div class="search-dropdown" id="search-dropdown" style="display: none;"></div>
                            </div>
                        </div>
                        
                        <div class="header-actions">
                            <div class="new-content-menu">
                                <button class="btn btn-primary btn-add-dropdown" id="add-new-btn" title="Add New (N or ⌘N)">
                                    <svg class="add-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="12" y1="5" x2="12" y2="19"/>
                                        <line x1="5" y1="12" x2="19" y2="12"/>
                                    </svg>
                                    <svg class="dropdown-arrow" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="6 9 12 15 18 9"/>
                                    </svg>
                                </button>
                                <div class="dropdown-menu" id="add-new-dropdown">
                                    <div class="dropdown-item" onclick="app.openAddLinkModal()">
                                        <span class="icon">🔗</span> Link
                                        <span class="shortcut">A→L / ⌘⇧L</span>
                                    </div>
                                    <div class="dropdown-item" onclick="app.openAddNoteModal()">
                                        <span class="icon">📝</span> Note
                                        <span class="shortcut">A→N / ⌘⇧N</span>
                                    </div>
                                    <div class="dropdown-item" onclick="app.openAddCodeModal()">
                                        <span class="icon">💻</span> Code Block
                                        <span class="shortcut">A→C</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>
                    
                    <main class="app-main"><div id="main-content"></div></main>
                </div>
            </div>
            <div id="toast-container" class="toast-container"></div>
            <div id="modal-overlay" class="modal-overlay"></div>
            <div id="note-fullpage-overlay" class="note-fullpage-overlay"></div>
            <div id="keyboard-help-overlay" class="keyboard-help-overlay"></div>
            <div id="link-preview-card" class="link-preview-card"></div>`;

        this.updateThemeIcon();
        this.initKeyboardShortcuts();
        this.initSidebar();

        // Initialize Search
        this.searchController = new SearchController(this);

        // Initialize Add Menu
        this.initAddMenu();

        // Initialize Link Previews
        this.initLinkPreviews();
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

        // Keyboard shortcuts for menu specifically
        document.addEventListener('keydown', (e) => {
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

    closeAddMenu() {
        const menu = document.getElementById('add-new-dropdown');
        if (menu) menu.classList.remove('show');
    }

    // ============================================
    // Sidebar Methods
    // ============================================

    initSidebar() {
        // Sidebar is already initialized in renderApp with localStorage state
        // This method handles any additional setup
    }

    toggleSidebar() {
        const sidebar = document.getElementById('app-sidebar');
        if (!sidebar) return;

        sidebar.classList.toggle('collapsed');
        const isCollapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebarCollapsed', isCollapsed);
    }

    openMobileSidebar() {
        const sidebar = document.getElementById('app-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.add('mobile-open');
        if (overlay) overlay.classList.add('active');
    }

    closeMobileSidebar() {
        const sidebar = document.getElementById('app-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (overlay) overlay.classList.remove('active');
    }

    // ============================================
    // Keyboard Shortcuts Help Modal
    // ============================================

    showKeyboardHelp() {
        const overlay = document.getElementById('keyboard-help-overlay');
        if (!overlay) return;

        overlay.innerHTML = `
            <div class="keyboard-help-modal">
                <div class="keyboard-help-header">
                    <h2 class="keyboard-help-title">Keyboard Shortcuts</h2>
                    <button class="keyboard-help-close" onclick="app.closeKeyboardHelp()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="keyboard-help-body">
                    <div class="keyboard-section">
                        <div class="keyboard-section-title">Navigation (G then...)</div>
                        <div class="keyboard-shortcut-row">
                            <span class="keyboard-shortcut-label">Go to Dashboard</span>
                            <span class="keyboard-shortcut-keys"><span class="key">G</span><span class="key-arrow">→</span><span class="key">D</span></span>
                        </div>
                        <div class="keyboard-shortcut-row">
                            <span class="keyboard-shortcut-label">Go to Links</span>
                            <span class="keyboard-shortcut-keys"><span class="key">G</span><span class="key-arrow">→</span><span class="key">L</span></span>
                        </div>
                        <div class="keyboard-shortcut-row">
                            <span class="keyboard-shortcut-label">Go to Notes</span>
                            <span class="keyboard-shortcut-keys"><span class="key">G</span><span class="key-arrow">→</span><span class="key">N</span></span>
                        </div>
                    </div>
                    
                    <div class="keyboard-section">
                        <div class="keyboard-section-title">Add Content (A then...)</div>
                        <div class="keyboard-shortcut-row">
                            <span class="keyboard-shortcut-label">Add Link</span>
                            <span class="keyboard-shortcut-keys"><span class="key">A</span><span class="key-arrow">→</span><span class="key">L</span> or <span class="key">⌘</span><span class="key">⇧</span><span class="key">L</span></span>
                        </div>
                        <div class="keyboard-shortcut-row">
                            <span class="keyboard-shortcut-label">Add Note</span>
                            <span class="keyboard-shortcut-keys"><span class="key">A</span><span class="key-arrow">→</span><span class="key">N</span> or <span class="key">⌘</span><span class="key">⇧</span><span class="key">N</span></span>
                        </div>
                    </div>
                    
                    <div class="keyboard-section">
                        <div class="keyboard-section-title">Quick Actions</div>
                        <div class="keyboard-shortcut-row">
                            <span class="keyboard-shortcut-label">Focus Search</span>
                            <span class="keyboard-shortcut-keys"><span class="key">/</span> or <span class="key">⌘</span><span class="key">K</span></span>
                        </div>
                        <div class="keyboard-shortcut-row">
                            <span class="keyboard-shortcut-label">Toggle Sidebar</span>
                            <span class="keyboard-shortcut-keys"><span class="key">⌘</span><span class="key">B</span></span>
                        </div>
                        <div class="keyboard-shortcut-row">
                            <span class="keyboard-shortcut-label">Toggle Edit Mode</span>
                            <span class="keyboard-shortcut-keys"><span class="key">E</span></span>
                        </div>
                        <div class="keyboard-shortcut-row">
                            <span class="keyboard-shortcut-label">Open Add Menu</span>
                            <span class="keyboard-shortcut-keys"><span class="key">N</span> or <span class="key">⌘</span><span class="key">N</span></span>
                        </div>
                    </div>
                    
                    <div class="keyboard-section">
                        <div class="keyboard-section-title">General</div>
                        <div class="keyboard-shortcut-row">
                            <span class="keyboard-shortcut-label">Show this help</span>
                            <span class="keyboard-shortcut-keys"><span class="key">?</span></span>
                        </div>
                        <div class="keyboard-shortcut-row">
                            <span class="keyboard-shortcut-label">Close / Cancel</span>
                            <span class="keyboard-shortcut-keys"><span class="key">Esc</span></span>
                        </div>
                        <div class="keyboard-shortcut-row">
                            <span class="keyboard-shortcut-label">Save (in editor)</span>
                            <span class="keyboard-shortcut-keys"><span class="key">⌘</span><span class="key">S</span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        overlay.classList.add('active');

        // Close on click outside
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                this.closeKeyboardHelp();
            }
        };
    }

    closeKeyboardHelp() {
        const overlay = document.getElementById('keyboard-help-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    toggleEditMode() {
        this.editMode = !this.editMode;
        document.querySelector('.app').className = `app ${this.editMode ? 'edit-mode' : 'view-mode'}`;

        // Update navigation states (Sidebar + Header)
        this.updateNavigationState();

        // Enable/disable grid editing
        if (this.grid) {
            this.grid.setStatic(!this.editMode);
            this.grid.enableMove(this.editMode);
            this.grid.enableResize(this.editMode);
        }

        // Lightweight update for links instead of heavy grid.update
        this.updateLinkDraggability();
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
        this.updateNavigationState();
    }

    updateHeaderButtons() {
        document.querySelectorAll('.header-actions .nav-btn').forEach((b, i) => {
            if (this.currentPage === 'dashboard') b.className = `btn nav-btn ${i === 0 ? 'btn-primary' : 'btn-ghost'}`;
            else if (this.currentPage === 'notes') b.className = `btn nav-btn ${i === 1 ? 'btn-primary' : 'btn-ghost'}`;
        });
    }

    async showNotesPage() {
        this.currentPage = 'notes';
        this.updateNavigationState();
        this.allNotes = await api.getNotes();
        this.activeNoteTag = null; // Reset filter on enter
        this.renderNotesPage();
    }

    renderNotesPage() {
        this.currentPage = 'notes';
        window.location.hash = '#notes';
        this.updateNavButtons();

        const content = document.getElementById('main-content');



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
                    <div id="notes-tag-cloud" style="width:100%; margin-bottom: var(--spacing-sm);"></div>
                    <div style="width:100%; display:flex; justify-content:space-between; align-items:center; gap:var(--spacing-md)">
                        <div style="flex:1"></div>
                        <input type="text" class="input" id="notes-search" placeholder="Search notes..." style="width:200px;">
                    </div>
                </div>
                <div id="notes-grid" class="${this.viewMode === 'grid' ? 'notes-grid' : 'list-view-container'}"></div>
            </div>`;

        document.getElementById('notes-search').addEventListener('input', e => this.filterNotes(e.target.value));

        // Render Tag Cloud
        this.renderTagCloud(document.getElementById('notes-tag-cloud'), this.allNotes, 'notes');

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
                   <span title="Created: ${note.created_at ? new Date(note.created_at).toLocaleString() : ''} | Updated: ${note.updated_at ? new Date(note.updated_at).toLocaleString() : ''}">${age}</span>
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

        // Highlight all code blocks if hljs is available
        if (window.hljs) {
            setTimeout(() => hljs.highlightAll(), 0);
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
        this.widgets = widgets; // Store for positioning logic
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

        // Check if note is less than 24 hours old
        const isNew = (new Date() - new Date(note.created_at)) < 24 * 60 * 60 * 1000;

        const noteContent = note.is_code
            ? `<pre class="note-code language-${note.code_language || 'plaintext'}"><code>${safeContent}</code></pre>`
            : `<div class="note-full-content">${safeContent}</div>`;

        this.grid.addWidget({
            id, x: note.widget_grid_x, y: note.widget_grid_y, w: note.widget_grid_w, h: note.widget_grid_h, content: `
            <div class="widget note-widget" data-note-id="${note.id}" data-type="note">
                <div class="widget-header">
                    <div class="widget-title">
                        ${isNew ? '<span class="badge-new">New</span>' : ''}
                        <svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span class="editable-title" style="pointer-events: auto;" ondblclick="app.startInlineTitleEdit(this, 'note', ${note.id})">${note.title}</span></div>
                    <div class="widget-actions">
                        <button class="widget-action-btn" onclick="app.viewNote(${note.id})" title="View">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                        </button>
                        <button class="widget-action-btn" onclick="app.editNote(${note.id})" title="Edit">✎</button>
                        <button class="widget-action-btn" onclick="app.toggleNoteWidget(${note.id})" title="Hide">×</button>
                    </div>
                </div>
                <div class="widget-body note-widget-body" onclick="app.handleNoteWidgetClick(${note.id}, event)">${noteContent}</div>
            </div>` });

        if (note.is_code && window.hljs) {
            setTimeout(() => hljs.highlightAll(), 0);
        }
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

    // ============================================
    // Link Preview Logic
    // ============================================

    initLinkPreviews() {
        if (this._linkPreviewsInitialized) return;
        this._linkPreviewsInitialized = true;

        const previewCard = document.getElementById('link-preview-card');
        // We wait for it to exist in the DOM if called too early, 
        // but it's called after innerHTML is set in renderApp.

        let currentTarget = null;
        let hoverTimeout = null;

        // Global delegate listener for hover events on links
        document.addEventListener('mouseover', (e) => {
            // Hide preview if interacting with a dropdown OR if any dropdown is open
            if (e.target.closest('.dropdown-menu, .dropdown-container') || document.querySelector('.dropdown-menu.show')) {
                this.hideLinkPreview();
                if (hoverTimeout) clearTimeout(hoverTimeout);
                currentTarget = null;
                return;
            }

            const linkEl = e.target.closest('.link-icon-item, .link-item, .link-card, .list-item a, .search-result[data-type="link"]');

            if (!linkEl) {
                if (currentTarget) {
                    console.log('Preview: Leaving link zone');
                    currentTarget = null;
                    if (hoverTimeout) clearTimeout(hoverTimeout);
                    this.hideLinkPreview();
                }
                return;
            }

            if (linkEl === currentTarget) return; // Already hovering this link

            console.log('Preview: Entering link', linkEl);
            currentTarget = linkEl;

            // Don't show preview in edit mode
            if (this.editMode) {
                console.log('Preview: Blocked by edit mode');
                return;
            }

            const linkId = linkEl.dataset.id || (linkEl.closest('[data-id]')?.dataset.id);
            if (!linkId) {
                console.log('Preview: No linkId found on element');
                return;
            }

            console.log('Preview: Setting timeout for linkId', linkId);
            if (hoverTimeout) clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => {
                console.log('Preview: Showing preview for linkId', linkId);
                this.showLinkPreview(linkId, linkEl);
            }, 300);
        });

        document.addEventListener('mouseout', (e) => {
            const toElement = e.relatedTarget;
            const linkEl = e.target.closest('.link-icon-item, .link-item, .link-card, .list-item a, .search-result[data-type="link"]');

            // If moved to something outside the current link
            if (linkEl && (!toElement || !linkEl.contains(toElement))) {
                currentTarget = null;
                if (hoverTimeout) clearTimeout(hoverTimeout);
                this.hideLinkPreview();
            }
        });

        // Hide on scroll or click
        window.addEventListener('scroll', () => this.hideLinkPreview(), { passive: true });
        document.addEventListener('click', (e) => {
            this.hideLinkPreview();
            // Close all open dropdown menus if clicking outside a dropdown container
            if (!e.target.closest('.dropdown-container')) {
                document.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
                document.querySelectorAll('.dropdown-container.active').forEach(c => c.classList.remove('active'));
            }
        });
    }

    async showLinkPreview(linkId, targetEl) {
        console.log(`Preview: [Step 1] showLinkPreview called for ID: ${linkId}`);
        const id = parseInt(linkId);
        if (isNaN(id)) {
            console.error('Preview: [Error] Invalid linkId', linkId);
            return;
        }

        // Ensure allLinks is populated
        if (!this.allLinks || this.allLinks.length === 0) {
            console.log('Preview: [Step 2] allLinks is empty, fetching...');
            try {
                this.allLinks = await api.getLinks();
                console.log('Preview: [Step 2] Fetched links, count:', this.allLinks.length);
            } catch (err) {
                console.error('Preview: [Error] Failed to fetch links', err);
                return;
            }
        }

        const link = this.allLinks.find(l => l.id === id);
        if (!link) {
            console.warn(`Preview: [Warning] Link ID ${id} not found in allLinks. Current count: ${this.allLinks.length}`);
            // If not found, it might be a new link or something. Try a quick refresh of the list.
            console.log('Preview: Attempting to refresh link list...');
            try {
                this.allLinks = await api.getLinks();
                const refreshedLink = this.allLinks.find(l => l.id === id);
                if (!refreshedLink) {
                    console.error(`Preview: [Error] Link ID ${id} still not found after refresh.`);
                    return;
                }
                return this.showLinkPreview(linkId, targetEl); // Retry once
            } catch (err) {
                return;
            }
        }

        console.log('Preview: [Step 3] Found link:', link.title);
        const previewCard = document.getElementById('link-preview-card');
        if (!previewCard) {
            console.error('Preview: #link-preview-card not found in DOM');
            return;
        }

        const rect = targetEl.getBoundingClientRect();
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        // Build content
        const tagsHtml = (link.custom_tags && link.custom_tags.length)
            ? `<div class="link-preview-tags">${link.custom_tags.map(t => `<span class="link-preview-tag">${t}</span>`).join('')}</div>`
            : '';

        const iconUrl = link.custom_icon && link.custom_icon.match(/^(http|www)/)
            ? link.custom_icon
            : (link.favicon_url || this.getFaviconUrl(link.url));

        const previewImageUrl = link.image_url || iconUrl;
        const age = this.timeAgo(link.created_at);

        previewCard.innerHTML = `
            <div class="link-preview-image-container">
                <img src="${previewImageUrl}" class="link-preview-image" onerror="this.src='${iconUrl}'; this.onerror=function(){this.style.display='none'; this.nextElementSibling.style.display='block';}">
                <div class="link-preview-placeholder" style="display:none;">🔗</div>
            </div>
            <div class="link-preview-body">
                <div class="link-preview-title">${link.title}</div>
                <div class="link-preview-url">${link.url.replace(/^https?:\/\//, '')}</div>
                ${link.description ? `<div class="link-preview-description">${this.sanitizeContent(link.description)}</div>` : ''}
                ${tagsHtml}
            </div>
            <div class="link-preview-footer">
                <div class="link-preview-stats">
                    <span title="Click count">🖱️ ${link.click_count || 0}</span>
                </div>
                <span>Added ${age}</span>
            </div>
        `;

        // Position logic
        let left = rect.left + (rect.width / 2) - 160; // Center horz
        let top = rect.bottom + 10; // Below

        // Keep on screen
        if (left < 10) left = 10;
        if (left + 320 > winWidth - 10) left = winWidth - 330;

        // Flip to top if not enough room below
        const cardHeight = previewCard.offsetHeight || 300;
        if (top + cardHeight > winHeight - 10) {
            top = rect.top - cardHeight - 10;
            // If still no room, just place at bottom with padding
            if (top < 10) top = rect.bottom + 10;
        }

        previewCard.style.left = `${left}px`;
        previewCard.style.top = `${top}px`;
        previewCard.classList.add('active');
    }

    hideLinkPreview() {
        const previewCard = document.getElementById('link-preview-card');
        if (previewCard) {
            previewCard.classList.remove('active');
        }
    }

    renderWidgetContent(widget) {
        const config = widget.config || {};
        const classes = [`widget`, `${widget.widget_type}-widget`];
        if (config.hide_title) classes.push('hide-title-bar');
        if (config.icons_only) classes.push('icons-only');
        if (this.editMode) classes.push('edit-mode');

        const isLinks = widget.widget_type === 'links';
        const iconsOnlyBtn = isLinks ? `
            <button class="widget-action-btn edit-only icons-only-toggle ${config.icons_only ? 'active' : ''}" 
                onclick="event.stopPropagation(); app.toggleWidgetConfig(${widget.id}, 'icons_only')" 
                title="${config.icons_only ? 'Show Titles' : 'Icons Only Mode'}">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            </button>
        ` : '';

        return `<div class="${classes.join(' ')}" data-id="${widget.id}" data-type="${widget.widget_type}">
            <div class="widget-header">
                <div class="widget-title" style="pointer-events: none;">${this.getWidgetIcon(widget.widget_type)}<span class="editable-title" style="pointer-events: auto;" ondblclick="app.startInlineTitleEdit(this, 'widget', ${widget.id})">${widget.title}</span></div>
            <div class="widget-actions">
                ${iconsOnlyBtn}
                <button class="widget-action-btn edit-only" onclick="app.openWidgetConfig(${widget.id})" title="Configure"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></button>
                <button class="widget-action-btn edit-only" onclick="app.deleteWidget(${widget.id})" title="Delete"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>
            </div>
            </div>
            <div class="widget-body" id="widget-body-${widget.id}"><div class="widget-loading"><span class="spinner"></span></div></div>
        </div>`;
    }

    async toggleWidgetConfig(widgetId, key) {
        const widgets = await api.getDashboardWidgets(this.dashboard.id);
        const widget = widgets.find(w => w.id === widgetId);
        if (!widget) return;

        const config = widget.config || {};
        config[key] = !config[key];

        try {
            await api.updateWidget(widgetId, { config });
            this.refreshWidget(widgetId);
        } catch (err) {
            console.error('Failed to toggle widget config', err);
            this.showToast('Failed to update widget', 'error');
        }
    }

    toggleDropdown(btn) {
        event.stopPropagation();
        this.hideLinkPreview();
        const container = btn.closest('.dropdown-container');
        const menu = btn.nextElementSibling;
        const isShowing = menu.classList.contains('show');

        // Close all other dropdowns
        document.querySelectorAll('.dropdown-menu.show').forEach(m => {
            if (m !== menu) {
                m.classList.remove('show');
                m.closest('.dropdown-container')?.classList.remove('active');
            }
        });

        if (isShowing) {
            menu.classList.remove('show');
            container.classList.remove('active');
        } else {
            menu.classList.add('show');
            container.classList.add('active');
        }
    }

    getWidgetIcon(type) {
        const icons = {
            links: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>',
            notes: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            weather: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>',
            docker: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
            proxmox: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/></svg>',
            clock: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
            todo: '<svg class="widget-title-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
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
                case 'notes': await this.loadNotesWidget(body, widget); break;
                case 'clock': this.loadClockWidget(body, widget); break;
                case 'todo': this.loadTodoWidget(body, widget); break;
                default: body.innerHTML = '<div class="widget-empty">Widget not supported</div>';
            }
        } catch (e) { body.innerHTML = `<div class="widget-error">${e.message}</div>`; }
    }

    getFaviconUrl(url) { try { return `https://www.google.com/s2/favicons?sz=32&domain=${new URL(url).hostname}`; } catch { return null; } }

    async loadLinksWidget(body, widget) {
        const config = widget.config || {};
        let links;

        if (config.mode === 'recent') {
            links = await api.getLinks({ sort_by: 'recent' });
        } else {
            links = await api.getLinks({ widget_id: widget.id });
        }

        // If no links assigned to this widget, show unassigned links logic only for standard mode?
        // Actually, existing logic for standard mode assigns by widget_id.

        if (config.filterCategory) links = links.filter(l => l.category === config.filterCategory);

        const limit = config.limit || (config.maxLinks || 10);
        links = links.slice(0, limit);

        // Sort by display_order ONLY if standard mode
        if (config.mode !== 'recent') {
            links.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
        }

        const showIcon = config.showIcon !== false, showTitle = config.showTitle !== false, showTags = config.showTags === true;
        const iconsOnly = config.icons_only || (showIcon && !showTitle && !showTags);


        // Helper to render icon (Emoji, URL, or Favicon)
        const renderIcon = (l, sizeClass) => {
            if (l.custom_icon) {
                const icon = l.custom_icon.trim();
                // Check if URL
                if (icon.match(/^(https?:\/\/|\/|www\.)/i) || icon.match(/\.(png|jpg|jpeg|gif|ico|svg|webp)$/i)) {
                    return `<img class="${sizeClass}" src="${icon}" alt="icon" onerror="this.outerHTML='<span class=link-favicon-placeholder>${l.title.charAt(0).toUpperCase()}</span>'">`;
                }
                // Assume Emoji or single character
                const displayIcon = [...icon].slice(0, 2).join(''); // Handle composite emojis up to 2 clusters or just 2 chars
                return `<span class="link-custom-icon">${displayIcon}</span>`;
            }
            // Favicon fallback
            const fUrl = l.favicon_url || this.getFaviconUrl(l.url);
            return `<img class="${sizeClass}" src="${fUrl}" onerror="this.outerHTML='<span class=link-favicon-placeholder>${l.title.charAt(0).toUpperCase()}</span>'" alt="">`;
        };

        const renderLinkContent = (l, i, isGrid) => {
            if (isGrid) {
                return `<a href="${l.url}" target="_blank" class="link-icon-item" data-id="${l.id}" data-index="${i}" data-url="${l.url}" title="${l.title}\n${l.url}" draggable="${this.editMode}" onclick="app.clickLink(${l.id})">
                    ${renderIcon(l, 'link-favicon-lg')}
                </a>`;
            }
            // Tags display
            let tagsHtml = '';
            // Only show tags if enabled in config
            if (showTags && l.custom_tags && l.custom_tags.length) {
                tagsHtml = `<div class="link-tags-list">${l.custom_tags.map(t => `<span class="link-tag-pill">${t}</span>`).join('')}</div>`;
            }

            return `<div class="link-item-wrapper" draggable="${this.editMode}" data-id="${l.id}" data-index="${i}">
                    ${this.editMode ? '<span class="link-drag-handle" title="Drag to reorder">⋮⋮</span>' : ''}
                    <div class="link-item" onclick="app.clickLink(${l.id}); window.open('${l.url}', '_blank')">
                        ${showIcon ? renderIcon(l, 'link-favicon') : ''}
                        <div class="link-info">
                            ${showTitle ? `<div class="link-title" ondblclick="app.startInlineTitleEdit(this, 'link', ${l.id})">${l.title}</div>` : ''}
                            ${tagsHtml}
                        </div>
                    </div>
                    <div class="link-actions">
                        <button class="link-action-btn" onclick="event.stopPropagation(); app.editLink(${l.id})" title="Edit">✎</button>
                        <button class="link-action-btn" onclick="event.stopPropagation(); app.deleteLink(${l.id})" title="Delete">×</button>
                    </div>
                </div>`;
        };

        if (iconsOnly) {
            const size = config.icon_size || 'md';
            body.innerHTML = links.length ? `<div class="link-grid size-${size}" data-widget-id="${widget.id}">${links.map((l, i) => renderLinkContent(l, i, true)).join('')}</div>
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


        if (config.autoFit) {
            // Slight delay to ensure DOM is rendered calculation is correct
            setTimeout(() => this.autoFitWidget(widget.id), 50);
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
        // State for sequence shortcuts
        this._pendingKey = null;
        this._pendingKeyTimeout = null;

        // Global Shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't process shortcuts if typing in an input
            const activeElement = document.activeElement;
            const isTyping = activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable ||
                activeElement.classList.contains('ql-editor') ||
                activeElement.closest('.CodeMirror') ||
                activeElement.closest('.cm-editor');

            // Check if any modal/overlay is open
            const modalOpen = document.getElementById('modal-overlay')?.classList.contains('active');
            const fullpageOpen = document.getElementById('note-fullpage-overlay')?.classList.contains('active');
            const keyboardHelpOpen = document.getElementById('keyboard-help-overlay')?.classList.contains('active');

            // ESC: Always allow (to close modals/help)
            if (e.key === 'Escape') {
                if (isTyping) {
                    activeElement.blur();
                }
                this.closeModal();
                this.closeKeyboardHelp();
                this.closeNoteFullpage();
                this.closeMobileSidebar();
                this.hideLinkPreview?.();
                this._pendingKey = null;
                return;
            }

            // CMD/CTRL + S: Save active form (Modal or Fullpage Note)
            // This is handled before the early returns so it works while typing
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();

                // 1. Check if a standard form modal is open
                if (modalOpen) {
                    const form = document.querySelector('#modal-overlay form');
                    if (form) {
                        form.requestSubmit();
                        return;
                    }
                }

                // 2. Check if the fullpage note editor is open
                if (fullpageOpen && this._currentFullpageNoteId) {
                    const saveBtn = document.getElementById('fullpage-save-btn');
                    if (saveBtn && !saveBtn.disabled) {
                        this.saveNoteFullpage(this._currentFullpageNoteId);
                        return;
                    }
                }
            }

            // Don't process other shortcuts if modal is open or typing
            if (modalOpen || fullpageOpen || keyboardHelpOpen) return;
            if (isTyping) return;

            // ? : Show keyboard help
            if (e.key === '?' || (e.shiftKey && e.key === '/')) {
                e.preventDefault();
                this.showKeyboardHelp();
                return;
            }

            // / : Focus search
            if (e.key === '/') {
                e.preventDefault();
                document.getElementById('global-search-input')?.focus();
                return;
            }

            // CMD/CTRL + K: Focus Search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('global-search-input')?.focus();
                return;
            }

            // CMD/CTRL + B: Toggle Sidebar
            if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
                e.preventDefault();
                this.toggleSidebar();
                return;
            }

            // CMD/CTRL + I or N or CMD/CTRL + N: Open add menu
            if (((e.metaKey || e.ctrlKey) && (e.key === 'i' || e.key === 'n')) || (e.key === 'n' && !e.metaKey && !e.ctrlKey)) {
                e.preventDefault();
                const menu = document.getElementById('add-new-dropdown');
                menu?.classList.toggle('show');
                return;
            }

            // CMD/CTRL + SHIFT + N: Add Note
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                this.openAddNoteModal();
                return;
            }

            // CMD/CTRL + SHIFT + L: Add Link
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                this.openAddLinkModal();
                return;
            }

            // E: Toggle Edit Mode (only on dashboard)
            if (e.key === 'e' && this.currentPage === 'dashboard') {
                e.preventDefault();
                this.toggleEditMode();
                return;
            }

            // Sequence shortcuts (G→D, G→L, G→N, A→L, A→N)
            const now = Date.now();

            // Check for second key in sequence
            if (this._pendingKey && (now - this._pendingKeyTime) < 500) {
                const sequence = this._pendingKey + e.key.toLowerCase();
                this._pendingKey = null;
                clearTimeout(this._pendingKeyTimeout);

                // Navigation sequences
                if (sequence === 'gd') {
                    e.preventDefault();
                    this.showDashboard();
                    return;
                }
                if (sequence === 'gl') {
                    e.preventDefault();
                    this.showLinksPage();
                    return;
                }
                if (sequence === 'gn') {
                    e.preventDefault();
                    this.showNotesPage();
                    return;
                }

                // Add sequences
                if (sequence === 'al') {
                    e.preventDefault();
                    this.openAddLinkModal();
                    return;
                }
                if (sequence === 'an') {
                    e.preventDefault();
                    this.openAddNoteModal();
                    return;
                }
            }

            // Start sequence with G or A
            if (e.key === 'g' || e.key === 'a') {
                this._pendingKey = e.key.toLowerCase();
                this._pendingKeyTime = now;
                this._pendingKeyTimeout = setTimeout(() => {
                    this._pendingKey = null;
                }, 500);
                return;
            }
        });

        // Command Bar Logic (for search input)
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInput.blur();
                    searchInput.value = '';
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

        const isGrid = list.classList.contains('link-grid');

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

                if (isGrid) {
                    // For grid, check horizontal center
                    const midX = rect.left + rect.width / 2;
                    if (e.clientX < midX) {
                        list.insertBefore(draggedItem, item);
                    } else {
                        list.insertBefore(draggedItem, item.nextSibling);
                    }
                } else {
                    // For list, check vertical center
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        list.insertBefore(draggedItem, item);
                    } else {
                        list.insertBefore(draggedItem, item.nextSibling);
                    }
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



    async loadNotesWidget(body, widget) {
        const config = widget.config || {};
        let notes;

        if (config.mode === 'recent') {
            notes = await api.getNotes({ sort_by: 'recent' });
        } else {
            // Placeholder: Standard notes widget showing specific category or all?
            // For now, default to recent if not specified, or all pinned?
            notes = await api.getNotes({ pinned_only: true });
        }

        const limit = config.limit || 5;
        notes = notes.slice(0, limit);

        if (!notes || notes.length === 0) {
            body.innerHTML = '<div class="widget-empty">No notes found</div>';
            return;
        }

        body.innerHTML = `<div class="link-list">
            ${notes.map(n => `
                <div class="list-item" onclick="app.viewNote(${n.id})">
                    <div class="list-item-main">
                        <div class="list-item-title">${n.title}</div>
                        <div class="list-item-meta" style="display:flex; justify-content:space-between; align-items:center;">
                             <span></span>
                             <span title="Created: ${n.created_at ? new Date(n.created_at).toLocaleString() : ''} | Updated: ${n.updated_at ? new Date(n.updated_at).toLocaleString() : ''}" style="color:var(--color-text-tertiary); font-size:0.7em;">${this.timeAgo(n.updated_at)}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>`;
    }

    // Existing loadWeatherWidget...
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
        const date = new Date(new Date().getFullYear(), newMonth, 1);
        this.renderWidgetCalendar(widgetId, date.getFullYear(), date.getMonth());
    }

    async savePositions() {
        if (!this.grid || !this.dashboard) return;

        // Critical Fix: ONLY save if in edit mode. Viewing on mobile triggers 'change' events due to responsiveness,
        // but we must not save those distorted layouts or any layout changes unless explicitly editing.
        if (!this.editMode) return;

        // Still keep column check as safety
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
                    <div class="form-group" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <label class="form-label" style="margin:0;">Content</label>
                        <div class="editor-type-switch" id="quick-note-type-switch">
                            <button type="button" class="editor-type-btn active" data-type="rich">Standard</button>
                            <button type="button" class="editor-type-btn" data-type="code">Code Block</button>
                        </div>
                    </div>
                    <div id="quick-note-editor-container" style="height: 180px; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden;">
                        <div id="quick-note-rich-editor" style="height: 100%; border:none;">${value}</div>
                        <div id="quick-note-code-editor" style="height: 100%; display:none;"></div>
                    </div>
                    
                    <div class="form-group" id="lang-group" style="display:none; margin-top:8px;">
                        <label class="form-label">Language</label>
                        <select class="input" name="code_language">
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="htmlmixed">HTML/XML</option>
                            <option value="css">CSS</option>
                            <option value="clike">C / C++ / Java</option>
                            <option value="shell">Bash/Shell</option>
                            <option value="markdown">Markdown</option>
                        </select>
                    </div>

                    <div class="form-group" style="margin-top:12px;"><label class="form-label">Category</label><input class="input" name="category" placeholder="General"></div>
                    <div class="form-group"><label class="checkbox"><input type="checkbox" name="show_as_widget"> Show as Widget</label></div>
                    <button type="submit" class="btn btn-primary" style="width:100%">Add Note</button>
                </form>`);

            let currentEditorType = 'rich';
            const quill = new Quill('#quick-note-rich-editor', {
                theme: 'snow',
                modules: { toolbar: [['bold', 'italic', 'underline', 'strike'], ['blockquote', 'code-block'], ['clean']] }
            });

            let cm = null;
            const switchBtns = document.querySelectorAll('#quick-note-type-switch .editor-type-btn');
            switchBtns.forEach(btn => {
                btn.onclick = () => {
                    const type = btn.dataset.type;
                    if (type === currentEditorType) return;

                    const oldType = currentEditorType;
                    currentEditorType = type;
                    switchBtns.forEach(b => b.classList.toggle('active', b === btn));

                    document.getElementById('quick-note-rich-editor').style.display = type === 'rich' ? 'block' : 'none';
                    const qlContainer = document.querySelector('#quick-note-editor-container .ql-container');
                    const qlToolbar = document.querySelector('#quick-note-editor-container .ql-toolbar');
                    if (qlContainer) qlContainer.style.display = type === 'rich' ? 'block' : 'none';
                    if (qlToolbar) qlToolbar.style.display = type === 'rich' ? 'flex' : 'none';

                    document.getElementById('quick-note-code-editor').style.display = type === 'code' ? 'block' : 'none';
                    document.getElementById('lang-group').style.display = type === 'code' ? 'block' : 'none';

                    if (type === 'code') {
                        const content = quill.getText().trim();
                        if (!cm) {
                            cm = CodeMirror(document.getElementById('quick-note-code-editor'), {
                                value: content,
                                mode: 'javascript',
                                theme: 'material-darker',
                                lineNumbers: true,
                                tabSize: 4,
                                indentUnit: 4
                            });
                        } else {
                            cm.setValue(content);
                        }
                        setTimeout(() => cm.refresh(), 10);
                    } else if (type === 'rich' && cm) {
                        quill.setText(cm.getValue());
                    }
                };
            });
            document.getElementById('add-note-form').addEventListener('submit', async e => {
                e.preventDefault();
                const isCode = currentEditorType === 'code';
                const content = isCode ? cm.getValue() : quill.root.innerHTML;
                const noteData = {
                    content: content,
                    category: e.target.category.value || 'General',
                    show_as_widget: e.target.show_as_widget.checked,
                    is_code: isCode,
                    code_language: isCode ? e.target.code_language.value : null,
                    title: isCode ? 'Code Block' : 'Untitled Note'
                };

                await api.createNote(noteData);
                this.allNotes = await api.getNotes(); // Refresh local state
                this.closeModal();
                this.showToast('Note added');

                if (this.currentPage === 'notes') this.renderNotesPage();
                else {
                    this.loadDashboard();
                    this.refreshRecentWidgets('notes');
                }
            });
            input.value = ''; // clear input
        }
    }
    startInlineTitleEdit(element, type, id) {
        if (event) event.stopPropagation();

        // Prevent multiple simultaneous edits
        if (this._activeTitleEdit) {
            this.cancelInlineTitleEdit();
        }

        const originalTitle = element.textContent.trim();
        const originalParent = element.parentElement;

        element.style.display = 'none';

        const container = document.createElement('div');
        container.className = 'inline-title-edit-container';
        container.innerHTML = `
            <input type="text" class="inline-title-input" value="${originalTitle}">
            <div class="inline-title-actions">
                <button class="inline-title-btn save" title="Save (Enter)">✓</button>
                <button class="inline-title-btn cancel" title="Cancel (Esc)">×</button>
            </div>
        `;

        originalParent.insertBefore(container, element);
        const input = container.querySelector('.inline-title-input');
        input.focus();
        input.select();

        this._activeTitleEdit = {
            element,
            container,
            type,
            id,
            originalTitle
        };

        const save = () => this.saveInlineTitleEdit();
        const cancel = () => this.cancelInlineTitleEdit();

        container.querySelector('.save').onclick = (e) => { e.stopPropagation(); save(); };
        container.querySelector('.cancel').onclick = (e) => { e.stopPropagation(); cancel(); };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                save();
            }
            if (e.key === 'Escape') cancel();
            e.stopPropagation();
        };

        // Don't auto-cancel on blur if we are clicking the buttons
        input.onblur = (e) => {
            setTimeout(() => {
                if (this._activeTitleEdit && this._activeTitleEdit.container === container) {
                    if (!document.activeElement || !container.contains(document.activeElement)) {
                        cancel();
                    }
                }
            }, 200);
        };
    }

    async saveInlineTitleEdit() {
        if (!this._activeTitleEdit) return;
        const { element, container, type, id, originalTitle } = this._activeTitleEdit;
        const input = container.querySelector('.inline-title-input');
        const newTitle = input.value.trim();

        if (!newTitle || newTitle === originalTitle) {
            this.cancelInlineTitleEdit();
            return;
        }

        try {
            if (type === 'widget') {
                await api.updateWidget(id, { title: newTitle });
                this.showToast('Widget title updated');
            } else if (type === 'note') {
                await api.updateNote(id, { title: newTitle });
                this.allNotes = await api.getNotes();
                this.showToast('Note title updated');
            } else if (type === 'link') {
                await api.updateLink(id, { title: newTitle });
                this.allLinks = await api.getLinks();
                this.showToast('Link title updated');
            }

            element.textContent = newTitle;
            this.cancelInlineTitleEdit();

            // Refresh widget logic to ensure everything is in sync
            if (type === 'widget') {
                this.refreshWidget(id);
            }
        } catch (err) {
            this.showToast('Failed to update title: ' + err.message, 'error');
            this.cancelInlineTitleEdit();
        }
    }

    cancelInlineTitleEdit() {
        if (!this._activeTitleEdit) return;
        const { element, container } = this._activeTitleEdit;
        if (container && container.parentNode) {
            container.remove();
        }
        if (element) {
            element.style.display = '';
        }
        this._activeTitleEdit = null;
    }


    async refreshWidget(id) {
        const widgets = await api.getDashboardWidgets(this.dashboard.id);
        const widget = widgets.find(w => w.id === id);
        if (widget) {
            const el = document.querySelector(`.grid-stack-item[gs-id="${id}"]`);
            if (el && this.grid) {
                // Completely re-render the widget shell to apply new classes/structure
                this.grid.update(el, { content: this.renderWidgetContent(widget) });
                this.initWidgetLogic(widget);
            } else {
                // Fallback: update title and logic only
                const titleEl = document.querySelector(`[data-id="${id}"] .widget-title span`);
                if (titleEl) titleEl.textContent = widget.title;
                const widgetEl = document.querySelector(`.widget[data-id="${id}"]`);
                if (widgetEl && widget.config) {
                    widgetEl.classList.toggle('hide-title-bar', !!widget.config.hide_title);
                    widgetEl.classList.toggle('icons-only', !!widget.config.icons_only);
                }
                this.initWidgetLogic(widget);
            }
        }
    }

    updateLinkDraggability() {
        document.querySelectorAll('.link-icon-item, .link-item-wrapper').forEach(item => {
            item.setAttribute('draggable', this.editMode);
        });

        // Ensure reorder logic is initialized for each widget if entering edit mode
        if (this.editMode) {
            document.querySelectorAll('.links-widget').forEach(el => {
                const widgetId = parseInt(el.dataset.id);
                const body = el.querySelector('.widget-body');
                if (body && widgetId) {
                    this.initLinkDragReorder(body, widgetId);
                }
            });
        }
    }

    refreshLinksWidgets() {
        document.querySelectorAll('.links-widget').forEach(el => {
            const id = el.dataset.id;
            if (id) this.refreshWidget(parseInt(id));
        });
    }

    async refreshRecentWidgets(type) {
        // Find all widgets of type links/notes with mode='recent'
        // We can check local widgets state or iterate DOM. DOM is safer for now.
        const selector = type === 'links' ? '.links-widget' : '.notes-widget';
        const widgets = document.querySelectorAll(selector);

        // We need to check config. Fetching all widgets config might be heavy but accurate.
        // Optimization: refresh all of that type, the refresh logic checks config anyway.
        // Actually refreshWidget re-fetches data based on config.
        const allWidgets = await api.getDashboardWidgets(this.dashboard.id);

        widgets.forEach(el => {
            const id = parseInt(el.dataset.id);
            const widgetDef = allWidgets.find(w => w.id === id);
            if (widgetDef && widgetDef.config?.mode === 'recent') {
                this.refreshWidget(id);
            }
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
        else if (this.currentPage === 'dashboard') await this.initDashboard();

        this.closeModal(true); // Force close after delete
        this.showToast('Link deleted');
    }

    async clickLink(id) {
        // optimistically track click without waiting
        api.clickLink(id).then(() => this.refreshRecentWidgets('links')).catch(e => console.error('Failed to track click', e));
        return true; // Allow default navigation
    }

    openWidgetDrawer() {
        const types = [
            { id: 'links', label: 'Links', icon: this.getWidgetIcon('links') },
            { id: 'notes', label: 'Notes', icon: this.getWidgetIcon('notes') },
            // Add distinct "Recent" options
            { id: 'recent-links', label: 'Recent Links', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
            { id: 'recent-notes', label: 'Recent Notes', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/><circle cx="12" cy="12" r="10" transform="scale(0.4) translate(20,20)" fill="currentColor" opacity="0.2"/></svg>' },
            { id: 'weather', label: 'Weather', icon: this.getWidgetIcon('weather') },
            { id: 'docker', label: 'Docker', icon: this.getWidgetIcon('docker') },
            { id: 'proxmox', label: 'Proxmox', icon: this.getWidgetIcon('proxmox') },
            { id: 'clock', label: 'Clock', icon: this.getWidgetIcon('clock') },
            { id: 'todo', label: 'To-Do List', icon: this.getWidgetIcon('todo') }
        ];
        this.showModal('Add Widget', `<div class="widget-toolbar" style="flex-wrap: wrap;">
            ${types.map(t => `<button class="widget-toolbar-item" onclick="app.createWidget('${t.id}')">${t.icon}<span class="widget-toolbar-label">${t.label}</span></button>`).join('')}
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

        // Find the bottom-most position using robust server data
        const w = 4; // Default width
        const h = 3; // Default height
        const { x, y } = await this.getSmartBottomPosition(w, h); // Async wait

        let widgetType = type;
        let widgetTitle = type.charAt(0).toUpperCase() + type.slice(1);
        let widgetConfig = {};

        // Handle composite types
        if (type === 'recent-links') {
            widgetType = 'links';
            widgetTitle = 'Recent Links';
            widgetConfig = { mode: 'recent', limit: 10 };
        } else if (type === 'recent-notes') {
            widgetType = 'notes';
            widgetTitle = 'Recent Notes';
            widgetConfig = { mode: 'recent', limit: 5 };
        } else if (type === 'todo') {
            widgetTitle = 'To-Do List';
            widgetConfig = { items: [] };
        }

        const widget = await api.createWidget({
            dashboard_id: this.dashboard.id,
            widget_type: widgetType,
            title: widgetTitle,
            grid_x: x,
            grid_y: y,
            grid_w: w,
            grid_h: h,
            config: widgetConfig
        });
        if (this.grid) {
            this.addWidget(widget);
        }
        this.closeModal(true); // Force close after adding widget
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

    /**
     * Async calculation of the next available position at the bottom.
     * Fetches fresh state from DB to ensure 100% accuracy and avoid client-side state drift.
     */
    async getSmartBottomPosition(w = 4, h = 3) {
        let maxY = 0;
        const occupied = [];

        try {
            // Fetch fresh data from source of truth
            const [widgets, notes] = await Promise.all([
                api.getDashboardWidgets(this.dashboard.id),
                api.getNotes()
            ]);

            // Map all standard widgets
            widgets.forEach(wd => {
                const wx = wd.grid_x || 0;
                const wy = wd.grid_y || 0;
                const ww = wd.grid_w || 4;
                const wh = wd.grid_h || 3;
                occupied.push({ x: wx, y: wy, w: ww, h: wh });
                if (wy + wh > maxY) maxY = wy + wh;
            });

            // Map all note widgets
            notes.forEach(n => {
                if (n.show_as_widget) {
                    const nx = n.widget_grid_x || 0;
                    const ny = n.widget_grid_y || 0;
                    const nw = n.widget_grid_w || 3;
                    const nh = n.widget_grid_h || 2;
                    occupied.push({ x: nx, y: ny, w: nw, h: nh });
                    if (ny + nh > maxY) maxY = ny + nh;
                }
            });

        } catch (e) {
            console.error("Error calculating position from DB, falling back to empty:", e);
        }

        // If dashboard is empty
        if (maxY === 0) return { x: 0, y: 0 };

        // Helper to check collision
        const isAreaFree = (ax, ay, aw, ah) => {
            for (const o of occupied) {
                // Check intersection
                if (ax < o.x + o.w && ax + aw > o.x && ay < o.y + o.h && ay + ah > o.y) {
                    return false;
                }
            }
            return true;
        };

        // Search for space.
        // We iterate Y from 0.
        // Constraint: The widget must be "at the bottom".
        // Definition: It fills a gap in the bottom-most occupied rows OR starts a new row.
        // Heuristic: The widget's bottom edge (y+h) must be >= maxY.
        // This allows filling a hole at y=maxY-h, but prevents filling a hole at y=0 (if maxY=10).

        // Scan up to maxY (new row)
        for (let y = 0; y <= maxY; y++) {
            // Check constraint first to skip early rows
            if (y + h < maxY) continue;

            for (let x = 0; x <= 12 - w; x++) {
                if (isAreaFree(x, y, w, h)) {
                    return { x, y };
                }
            }
        }

        // Fallback: This should technically be unreachable if the loop covers y=maxY, 
        // but just in case, append to absolute bottom.
        return { x: 0, y: maxY };
    }

    async createWeatherWidget(location) {
        // Find the bottom-most position to add new widget there
        const w = 4; // Default width
        const h = 2; // Default height for weather
        const { x, y } = await this.getSmartBottomPosition(w, h);

        try {
            const widget = await api.createWidget({
                dashboard_id: this.dashboard.id,
                widget_type: 'weather',
                title: 'Weather',
                grid_x: x,
                grid_y: y,
                grid_w: w,
                grid_h: h,
                config: { location: location }
            });

            if (this.grid) {
                this.addWidget(widget);
            }
            this.closeModal(true); // Force close after adding widget
            this.showToast('Weather widget added');
        } catch (error) {
            console.error('Failed to create weather widget:', error);
            this.showToast('Failed to add widget', 'error');
        }
    }

    showModal(title, content, headerActions = '') {
        this._isDirty = false; // Reset dirty state for new modal
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

    closeModal(force = false) {
        if (!force && this._isDirty) {
            if (!confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                return;
            }
        }
        const overlay = document.getElementById('modal-overlay');
        overlay.classList.remove('active');
        this._isDirty = false;
    }

    async showLinksPage() {
        this.currentPage = 'links';
        window.location.hash = '#links';
        this.updateNavigationState();

        // Load links and widgets
        if (!this.allLinks || !this.allLinks.length) this.allLinks = await api.getLinks();
        const allWidgets = await api.getDashboardWidgets(this.dashboard.id);
        this.linkWidgets = allWidgets.filter(w => w.widget_type === 'links');

        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="links-page-container fade-in">
                <div class="page-header">
                    <h2>Links Library</h2>
                    <div class="page-controls">
                        <select class="sort-select" onchange="app.setSortMode(this.value)">
                                <option value="updated_desc" ${this.sortMode === 'updated_desc' ? 'selected' : ''}>Newest</option>
                                <option value="updated_asc" ${this.sortMode === 'updated_asc' ? 'selected' : ''}>Oldest</option>
                                <option value="recent" ${this.sortMode === 'recent' ? 'selected' : ''}>Most Recent</option>
                                <option value="popular" ${this.sortMode === 'popular' ? 'selected' : ''}>Most Popular</option>
                                <option value="title_asc" ${this.sortMode === 'title_asc' ? 'selected' : ''}>Title A-Z</option>
                                <option value="title_desc" ${this.sortMode === 'title_desc' ? 'selected' : ''}>Title Z-A</option>
                        </select>
                        <select class="sort-select" onchange="app.setWidgetFilter(this.value)" style="min-width: 140px;">
                                <option value="all" ${this.linkWidgetFilter === 'all' ? 'selected' : ''}>All Widgets</option>
                                <option value="none" ${this.linkWidgetFilter === 'none' ? 'selected' : ''}>Unassigned</option>
                                ${(this.linkWidgets || []).map(w => `<option value="${w.id}" ${this.linkWidgetFilter == w.id ? 'selected' : ''}>${w.title}</option>`).join('')}
                        </select>
                        <div class="view-toggle">
                            <button class="view-toggle-btn ${this.viewMode === 'grid' ? 'active' : ''}" onclick="app.toggleViewMode('grid')" title="Grid View">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                            </button>
                            <button class="view-toggle-btn ${this.viewMode === 'list' ? 'active' : ''}" onclick="app.toggleViewMode('list')" title="List View">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                            </button>
                        </div>
                        <div class="dropdown-container">
                            <button class="btn btn-ghost" onclick="this.nextElementSibling.classList.toggle('show'); event.stopPropagation();" title="View Settings">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                            </button>
                            <div class="dropdown-menu" style="min-width: 200px;">
                                <div class="dropdown-header" style="padding: 8px 12px; font-weight: bold; border-bottom: 1px solid var(--color-border); font-size: 0.8rem;">Display Attributes</div>
                                <label class="dropdown-item" style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="event.stopPropagation()">
                                    <input type="checkbox" ${this.linkLibraryPrefs.showDescription ? 'checked' : ''} onchange="app.toggleLinkLibraryPref('showDescription')" style="margin:0;">
                                    <span>Description</span>
                                </label>
                                <label class="dropdown-item" style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="event.stopPropagation()">
                                    <input type="checkbox" ${this.linkLibraryPrefs.showStats ? 'checked' : ''} onchange="app.toggleLinkLibraryPref('showStats')" style="margin:0;">
                                    <span>Stats (Clicks/Time)</span>
                                </label>
                                <label class="dropdown-item" style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="event.stopPropagation()">
                                    <input type="checkbox" ${this.linkLibraryPrefs.showAssignedWidget ? 'checked' : ''} onchange="app.toggleLinkLibraryPref('showAssignedWidget')" style="margin:0;">
                                    <span>Widget Assignment</span>
                                </label>
                            </div>
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

    renderTagCloud(container, items, type) {
        container.innerHTML = ''; // Clear previous content logic
        // Collect tags
        const tags = {};
        items.forEach(item => {
            const itemTags = type === 'links' ? (item.custom_tags || []) : (item.tags || []);
            if (Array.isArray(itemTags)) {
                itemTags.forEach(t => tags[t] = (tags[t] || 0) + 1);
            }
        });

        const sortedTags = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 15);
        if (sortedTags.length === 0) return;

        const currentFilter = type === 'links' ? this.activeLinkTag : this.activeNoteTag;

        const cloud = document.createElement('div');
        cloud.className = 'tag-cloud';
        cloud.style.padding = '0 0 var(--spacing-sm) 0';
        cloud.style.display = 'flex';
        cloud.style.gap = 'var(--spacing-xs)';
        cloud.style.flexWrap = 'wrap';

        cloud.innerHTML = sortedTags.map(([tag, count]) =>
            `<span class="tag-pill ${currentFilter === tag ? 'active' : ''}"
                   onclick="app.filterByTag('${tag}', '${type}')"
                   style="cursor: pointer; padding: 2px 8px; border-radius: 12px; background: var(--bg-secondary); font-size: 0.85em; ${currentFilter === tag ? 'background: var(--primary); color: white;' : ''}">
                #${tag} <small>(${count})</small>
            </span>`
        ).join('');

        // Use insertBefore to place at top of container, or append if empty?
        // Container usually has list content.
        // I should probably return the element and let caller place it.
        // But caller code is simple render.
        // Let's prepend.
        if (container.firstChild) {
            container.insertBefore(cloud, container.firstChild);
        } else {
            container.appendChild(cloud);
        }
    }

    filterByTag(tag, type) {
        if (type === 'links') {
            this.activeLinkTag = this.activeLinkTag === tag ? null : tag;
            this.renderLinksPage();
        } else {
            this.activeNoteTag = this.activeNoteTag === tag ? null : tag;
            this.renderNotesPage();
        }
    }

    renderLinksPage(query = '') {
        if (!query) {
            const input = document.getElementById('links-search');
            if (input) query = input.value;
        }

        const grid = document.getElementById('links-page-grid');
        if (!grid) return;

        // Render Tag Cloud
        // Insert a container for tags if not exists
        let tagContainer = document.getElementById('links-tag-cloud');
        if (!tagContainer) {
            tagContainer = document.createElement('div');
            tagContainer.id = 'links-tag-cloud';
            tagContainer.style.width = '100%';
            tagContainer.style.marginBottom = 'var(--spacing-sm)';
            if (grid.parentNode) grid.parentNode.insertBefore(tagContainer, grid);
        }
        this.renderTagCloud(tagContainer, this.allLinks, 'links');

        const term = query.toLowerCase();
        let filtered = this.allLinks.filter(l => {
            const matchesSearch = l.title.toLowerCase().includes(term) ||
                l.url.toLowerCase().includes(term) ||
                (l.custom_tags && l.custom_tags.some(t => t.toLowerCase().includes(term))) ||
                (l.category && l.category.toLowerCase().includes(term));
            const matchesTag = this.activeLinkTag ? (l.custom_tags && l.custom_tags.includes(this.activeLinkTag)) : true;

            let matchesWidget = true;
            if (this.linkWidgetFilter === 'none') {
                matchesWidget = !l.widget_id;
            } else if (this.linkWidgetFilter !== 'all') {
                matchesWidget = l.widget_id == this.linkWidgetFilter;
            }

            return matchesSearch && matchesTag && matchesWidget;
        });

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

    toggleLinkLibraryPref(key) {
        this.linkLibraryPrefs[key] = !this.linkLibraryPrefs[key];
        localStorage.setItem('linkLibraryPrefs', JSON.stringify(this.linkLibraryPrefs));
        this.renderLinksPage();
    }

    async assignLinkToWidget(linkId, widgetId) {
        try {
            await api.updateLink(linkId, { widget_id: widgetId });
            this.allLinks = await api.getLinks();
            this.showToast('Widget assigned');
            this.renderLinksPage();
        } catch (err) {
            this.showToast('Failed to assign widget', 'error');
        }
    }

    renderLinkCardInternal(l) {
        let tagsHtml = '';
        if (l.custom_tags && l.custom_tags.length) {
            tagsHtml = `<div class="link-card-tags">${l.custom_tags.map(t => `<span class="tag-pill-sm">${t}</span>`).join('')}</div>`;
        }

        const prefs = this.linkLibraryPrefs;
        const widget = l.widget_id ? (this.linkWidgets || []).find(w => w.id === l.widget_id) : null;

        const widgetChoices = (this.linkWidgets || [])
            .filter(w => w.config?.mode !== 'recent')
            .map(w =>
                `<div class="dropdown-item ${l.widget_id === w.id ? 'active' : ''}" onclick="event.stopPropagation(); app.assignLinkToWidget(${l.id}, ${w.id})">${w.title}</div>`
            ).join('');
        const unassignOption = l.widget_id ? `<div class="dropdown-item" style="color:var(--color-error); border-top:1px solid var(--color-border); margin-top:4px;" onclick="event.stopPropagation(); app.assignLinkToWidget(${l.id}, null)">❌ Unassign</div>` : '';
        const fullMenu = widgetChoices + unassignOption;

        return `
            <div class="link-card ${l.widget_id ? '' : 'unassigned'}" data-id="${l.id}" onclick="app.clickLink(${l.id}); window.open('${l.url}', '_blank')">
                <div class="link-card-header">
                    <div class="link-card-icon">
                        ${l.custom_icon ?
                (l.custom_icon.match(/^(http|www)/) ? `<img src="${l.custom_icon}" class="link-icon-img" onerror="this.style.display='none'">` : `<span>${l.custom_icon}</span>`)
                : `<img src="${l.favicon_url || this.getFaviconUrl(l.url)}" class="link-icon-img" onerror="this.outerHTML='<span class=link-favicon-placeholder>${l.title.charAt(0).toUpperCase()}</span>'">`
            }
                    </div>
                    <div class="link-card-actions">
                         <button onclick="event.stopPropagation(); app.editLink(${l.id})" class="btn-icon" title="Edit">✎</button>
                         <button onclick="event.stopPropagation(); window.open('${l.url}', '_blank')" class="btn-icon" title="Open">↗</button>
                    </div>
                </div>
                <div class="link-card-body">
                    <div class="link-card-title" title="${l.title}">${l.title}</div>
                    <div class="link-card-url" title="${l.url}">${l.url.replace(/^https?:\/\//, '')}</div>
                    
                    ${prefs.showDescription && l.description ? `<div class="link-card-description">${this.sanitizeContent(l.description)}</div>` : ''}
                    
                    ${tagsHtml}

                    <div class="link-card-footer">
                        ${prefs.showStats ? `
                            <div class="link-card-stats">
                                <span title="Clicks">🖱️ ${l.click_count || 0}</span>
                                <span title="Last Clicked">${l.last_clicked ? this.timeAgo(l.last_clicked) : 'Never'}</span>
                            </div>
                        ` : ''}

                        ${prefs.showAssignedWidget ? `
                            <div class="link-card-assignment">
                                <div class="dropdown-container">
                                    ${widget ?
                    `<button class="badge-widget clickable" onclick="app.toggleDropdown(this)" title="Change Widget">📦 ${widget.title}</button>` :
                    `<button class="btn btn-sm btn-ghost" onclick="app.toggleDropdown(this)">➕ Add to Widget</button>`
                }
                                    <div class="dropdown-menu">${fullMenu}</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>`;
    }

    renderLinkListItem(l) {
        let tagsHtml = '';
        if (l.custom_tags && l.custom_tags.length) {
            tagsHtml = `<div style="display:flex; gap:4px;">${l.custom_tags.map(t => `<span class="tag-pill-sm">${t}</span>`).join('')}</div>`;
        }

        const prefs = this.linkLibraryPrefs;
        const widget = l.widget_id ? (this.linkWidgets || []).find(w => w.id === l.widget_id) : null;
        const widgetChoices = (this.linkWidgets || [])
            .filter(w => w.config?.mode !== 'recent')
            .map(w =>
                `<div class="dropdown-item ${l.widget_id === w.id ? 'active' : ''}" onclick="event.stopPropagation(); app.assignLinkToWidget(${l.id}, ${w.id})">${w.title}</div>`
            ).join('');
        const unassignOption = l.widget_id ? `<div class="dropdown-item" style="color:var(--color-error); border-top:1px solid var(--color-border); margin-top:4px;" onclick="event.stopPropagation(); app.assignLinkToWidget(${l.id}, null)">❌ Unassign</div>` : '';
        const fullMenu = widgetChoices + unassignOption;

        const iconHtml = l.custom_icon ?
            (l.custom_icon.match(/^(http|www)/) ? `<img src="${l.custom_icon}" onerror="this.style.display='none'">` : `<span>${l.custom_icon}</span>`)
            : `<img src="${l.favicon_url || this.getFaviconUrl(l.url)}" onerror="this.outerHTML='<span class=link-favicon-placeholder>${l.title.charAt(0).toUpperCase()}</span>'">`;

        return `
        <div class="list-item" data-id="${l.id}">
            <div class="list-item-icon">${iconHtml}</div>
            <div class="list-item-content">
                <div class="list-item-title"><a href="${l.url}" target="_blank" style="color:inherit; text-decoration:none;">${l.title}</a></div>
                <div class="list-item-meta" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                   ${tagsHtml}
                   <span class="link-url-dull">${l.url.replace(/^https?:\/\//, '').substring(0, 30)}...</span>
                   
                   ${prefs.showStats ? `
                       <span style="color:var(--color-text-tertiary); font-size:0.7rem; border-left:1px solid var(--color-border); padding-left:8px;" title="Clicks">🖱️ ${l.click_count || 0}</span>
                       <span style="color:var(--color-text-tertiary); font-size:0.7rem;" title="Last Clicked">Last: ${l.last_clicked ? this.timeAgo(l.last_clicked) : 'Never'}</span>
                   ` : ''}

                   ${prefs.showAssignedWidget && widget ? `
                       <div class="dropdown-container">
                           <span class="badge-widget-sm clickable" onclick="app.toggleDropdown(this)" title="Change Widget">📦 ${widget.title}</span>
                           <div class="dropdown-menu">${fullMenu}</div>
                       </div>
                   ` : ''}
                </div>
                ${prefs.showDescription && l.description ? `<div style="font-size:0.8rem; color:var(--color-text-secondary); margin-top:4px; line-clamp:1; -webkit-line-clamp:1; display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden;">${this.sanitizeContent(l.description)}</div>` : ''}
            </div>
            <div class="list-item-actions">
                ${prefs.showAssignedWidget && !widget ? `
                    <div class="dropdown-container">
                        <button class="btn btn-icon" onclick="app.toggleDropdown(this)" title="Add to Widget">➕</button>
                        <div class="dropdown-menu dropdown-menu-right">${fullMenu}</div>
                    </div>
                ` : ''}
                <button class="btn-icon" onclick="app.editLink(${l.id})">✎</button>
                <button class="btn-icon" onclick="window.open('${l.url}', '_blank')">↗</button>
            </div>
        </div>`;
    }

    updateNavigationState() {
        // 1. Sidebar Items
        document.querySelectorAll('.sidebar-item').forEach(item => {
            const text = item.querySelector('.sidebar-item-text')?.textContent.trim().toLowerCase();

            // Handle main pages
            if (['dashboard', 'links', 'notes'].includes(text)) {
                if (text === this.currentPage) item.classList.add('active');
                else item.classList.remove('active');
            }

            // Handle Edit Mode separately (it has its own specific entry in the sidebar)
            if (item.getAttribute('onclick')?.includes('toggleEditMode')) {
                if (this.editMode) {
                    item.classList.add('active');
                    item.querySelector('.sidebar-item-text').textContent = '✓ Editing';
                } else {
                    item.classList.remove('active');
                    item.querySelector('.sidebar-item-text').textContent = 'Edit Mode';
                }
            }
        });

        // 2. Legacy Nav Buttons (for backward compatibility if any remain in mobile/modals)
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('btn-primary', 'btn-ghost');
            if (btn.textContent.trim().toLowerCase() === this.currentPage) {
                btn.classList.add('btn-primary');
            } else {
                btn.classList.add('btn-ghost');
            }
        });

        // 3. Header Actions Nav Buttons (specific layout)
        document.querySelectorAll('.header-actions .nav-btn').forEach((b, i) => {
            if (this.currentPage === 'dashboard') b.className = `btn nav-btn ${i === 0 ? 'btn-primary' : 'btn-ghost'}`;
            else if (this.currentPage === 'notes') b.className = `btn nav-btn ${i === 1 ? 'btn-primary' : 'btn-ghost'}`;
        });
    }

    // Aliases for compatibility
    updateNavButtons() { this.updateNavigationState(); }
    updateHeaderButtons() { this.updateNavigationState(); }

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
            <div class="form-group"><label class="form-label">Title</label><input class="input" name="title" id="link-title-input" placeholder="Optional - Auto-fetched"></div>
            <div class="form-group"><label class="form-label">Description</label><textarea class="input" name="description" id="link-desc-input" rows="2" placeholder="Optional - Auto-fetched preview text"></textarea></div>
            <input type="hidden" name="image_url" id="link-image-input">
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

        this.closeAddMenu(); // Close add menu when modal opens

        // Auto-focus URL
        const urlInput = document.querySelector('#add-link-form [name="url"]');
        setTimeout(() => urlInput.focus(), 100);

        // Auto-fetch metadata as user types URL
        urlInput.addEventListener('blur', async (e) => {
            const url = e.target.value.trim();
            if (!url || !url.startsWith('http')) return;

            const titleInput = document.getElementById('link-title-input');
            const descInput = document.getElementById('link-desc-input');
            const imgInput = document.getElementById('link-image-input');
            const iconInput = document.querySelector('#add-link-form [name="custom_icon"]');

            // Show loading state in inputs if they are empty
            if (titleInput && !titleInput.value) titleInput.placeholder = 'Fetching title...';
            if (descInput && !descInput.value) descInput.placeholder = 'Fetching description...';

            try {
                const preview = await api.getLinkPreview(url);
                if (preview.title && titleInput && !titleInput.value) {
                    titleInput.value = preview.title;
                }
                if (preview.description && descInput && !descInput.value) {
                    descInput.value = preview.description;
                }
                if (preview.image && imgInput && !imgInput.value) {
                    imgInput.value = preview.image;
                }
                const siteFavicon = preview.favicon || this.getFaviconUrl(url);
                if (siteFavicon && iconInput && !iconInput.value) {
                    iconInput.value = siteFavicon;
                }
            } catch (err) {
                console.warn('Metadata fetch failed', err);
            } finally {
                if (titleInput) titleInput.placeholder = 'Optional - Auto-fetched';
                if (descInput) descInput.placeholder = 'Optional - Auto-fetched preview text';
            }
        });

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
            this._isDirty = true;
        });

        // Init Tag Input
        const tagContainer = document.getElementById('tag-input-container');
        const tagInput = new TagInput(tagContainer, []);
        tagInput.onchange = () => { this._isDirty = true; };

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
                    this._isDirty = true;
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
                    description: form.description.value.trim() || null,
                    image_url: form.image_url.value || null,
                    widget_id: widgetId,
                    custom_icon,
                    custom_tags: tags,
                    category
                });

                this.allLinks = await api.getLinks();
                this._isDirty = false; // Clear before closing
                this.closeModal(true); // Force close after successful save
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

        document.getElementById('add-link-form').addEventListener('input', () => {
            this._isDirty = true;
        });
    }

    async editLink(id) {
        const link = this.allLinks.find(l => l.id === id);
        if (!link) return;

        this.showModal('Edit Link', `<form id="edit-link-form">
            <div class="form-group"><label class="form-label">URL</label><input class="input" name="url" value="${link.url}" required></div>
            <div class="form-group"><label class="form-label">Title</label><input class="input" name="title" value="${link.title}"></div>
            <div class="form-group"><label class="form-label">Description</label><textarea class="input" name="description" rows="2">${link.description || ''}</textarea></div>
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
        tagInput.onchange = () => { this._isDirty = true; };

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
            this._isDirty = true;
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
                    this._isDirty = true;
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

        // Add Refresh Metadata button logic for Edit Modal
        const refreshMetaBtn = document.createElement('button');
        refreshMetaBtn.type = 'button';
        refreshMetaBtn.className = 'btn btn-sm btn-ghost';
        refreshMetaBtn.style.fontSize = '0.8rem';
        refreshMetaBtn.innerHTML = '🔄 Refresh Meta';
        let fetchedFavicon = link.favicon_url;
        refreshMetaBtn.onclick = async () => {
            const url = urlInput.value.trim();
            if (!url) return;
            refreshMetaBtn.textContent = 'Fetching...';
            try {
                const preview = await api.getLinkPreview(url);
                if (preview.title) titleInput.value = preview.title;
                const descInput = document.querySelector('#edit-link-form [name="description"]');
                if (preview.description && descInput) descInput.value = preview.description;
                const siteFavicon = preview.favicon || this.getFaviconUrl(url);
                const iconInput = document.querySelector('#edit-link-form [name="custom_icon"]');
                if (siteFavicon && iconInput) {
                    iconInput.value = siteFavicon;
                    fetchedFavicon = siteFavicon;
                }
                this.showToast('Metadata refreshed');
                this._isDirty = true;
            } catch (err) {
                this.showToast('Failed to fetch metadata', 'error');
            } finally {
                refreshMetaBtn.innerHTML = '🔄 Refresh Meta';
            }
        };
        // Insert near title label
        const titleLabel = titleInput.parentElement.querySelector('label');
        titleLabel.style.display = 'flex';
        titleLabel.style.justifyContent = 'space-between';
        titleLabel.style.alignItems = 'center';
        titleLabel.appendChild(refreshMetaBtn);

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
                url: url,
                title: form.title.value,
                description: form.description.value.trim() || null,
                custom_icon: form.custom_icon.value.trim() || null,
                favicon_url: fetchedFavicon,
                custom_tags: tags,
                category
            });

            this.allLinks = await api.getLinks();
            this._isDirty = false; // Clear before closing
            this.closeModal(true); // Force close after successful save
            this.showToast('Link updated');

            if (this.currentPage === 'links') this.renderLinksPage();
            else if (this.currentPage === 'dashboard') await this.initDashboard();
            else this.refreshLinksWidgets();
        });

        document.getElementById('edit-link-form').addEventListener('input', () => {
            this._isDirty = true;
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
                <div class="note-content-preview">
                    ${note.is_code ? `<pre class="note-code-preview language-${note.code_language || 'plaintext'}"><code>${safeContent}</code></pre>` : safeContent}
                </div>
            </div>
            <div class="note-card-meta">
                <span class="note-age" title="Updated ${new Date(note.updated_at).toLocaleString()}">${age}</span>
            </div>
        </div>`;
    }

    // Modal for adding/editing notes with Rich Editor (Quill) and Tags
    // Now redirects to fullpage generic workflow
    openAddNoteModal() {
        this.closeAddMenu();
        this.openAddNoteFullpage();
    }

    // New workflow for fullpage creation
    openAddNoteFullpage(initialType = 'rich') {
        this._isDirty = false;
        this._currentFullpageNoteId = null; // New note
        const dateStr = new Date().toLocaleString();

        const overlay = document.getElementById('note-fullpage-overlay');
        overlay.innerHTML = `
            <div class="note-fullpage-header">
                <div class="note-fullpage-header-left">
                    <button class="note-fullpage-back" onclick="app.closeNoteFullpage()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                        Cancel
                    </button>
                    <input type="text" class="note-fullpage-title-input" id="fullpage-note-title" placeholder="Note title...">
                </div>
                <div class="note-fullpage-header-right">
                    <div class="editor-type-switch" id="fullpage-note-type-switch">
                        <button type="button" class="editor-type-btn ${initialType === 'rich' ? 'active' : ''}" data-type="rich">Standard</button>
                        <button type="button" class="editor-type-btn ${initialType === 'code' ? 'active' : ''}" data-type="code">Code Block</button>
                    </div>
                    <button class="btn btn-primary" id="fullpage-save-btn" onclick="app.saveNoteFullpage(null)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Create
                    </button>
                </div>
            </div>
            <div class="note-fullpage-content">
                <div class="note-fullpage-content-inner note-fullpage-editor">
                    <div id="fullpage-rich-editor-container" style="height: 100%; ${initialType === 'code' ? 'display:none;' : ''}">
                        <div id="fullpage-note-editor" style="min-height: 300px;"></div>
                    </div>
                    <div id="fullpage-code-editor-container" style="height: 100%; ${initialType === 'rich' ? 'display:none;' : ''}">
                        <div id="fullpage-code-editor" style="height:100%;"></div>
                        <div class="form-group" style="position: absolute; bottom: 80px; right: 20px; z-index: 10; width: 150px;">
                            <select class="input input-sm" id="fullpage-code-lang">
                                <option value="javascript">JavaScript</option>
                                <option value="python">Python</option>
                                <option value="htmlmixed">HTML/XML</option>
                                <option value="css">CSS</option>
                                <option value="clike">C/C++/Java</option>
                                <option value="shell">Bash/Shell</option>
                                <option value="markdown">Markdown</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <div class="note-fullpage-footer">
                <div class="note-fullpage-footer-left">
                    <label class="checkbox">
                        <input type="checkbox" id="fullpage-note-widget">
                        Show on dashboard
                    </label>
                </div>
                <div class="note-fullpage-footer-right">
                    <div style="display:flex;flex-direction:column;gap:var(--spacing-xs);">
                        <label style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">Tags</label>
                        <div id="fullpage-note-tags"></div>
                    </div>
                </div>
            </div>
        `;

        if (!overlay.classList.contains('active')) {
            requestAnimationFrame(() => overlay.classList.add('active'));
        }

        const quill = new Quill('#fullpage-note-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
                    ['link'],
                    ['clean']
                ]
            }
        });
        this._fullpageQuill = quill;

        let cm = null;
        this._fullpageCM = null;
        let currentEditorType = initialType;

        const initCM = () => {
            if (cm) return;
            cm = CodeMirror(document.getElementById('fullpage-code-editor'), {
                value: quill.getText().trim() || "",
                mode: document.getElementById('fullpage-code-lang').value,
                theme: 'material-darker',
                lineNumbers: true,
                tabSize: 4,
                indentUnit: 4
            });
            this._fullpageCM = cm;
            cm.on('change', () => { this._isDirty = true; });
            setTimeout(() => cm.refresh(), 10);
        };

        if (initialType === 'code') initCM();

        const switchBtns = document.querySelectorAll('#fullpage-note-type-switch .editor-type-btn');
        switchBtns.forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.type;
                if (type === currentEditorType) return;
                currentEditorType = type;
                this._isDirty = true;
                switchBtns.forEach(b => b.classList.toggle('active', b === btn));
                document.getElementById('fullpage-rich-editor-container').style.display = type === 'rich' ? 'block' : 'none';
                document.getElementById('fullpage-code-editor-container').style.display = type === 'code' ? 'block' : 'none';

                if (type === 'code') {
                    const content = quill.getText().trim();
                    initCM();
                    if (cm) {
                        cm.setValue(content);
                        cm.refresh();
                    }
                } else if (type === 'rich' && cm) {
                    quill.setText(cm.getValue());
                }
            };
        });

        document.getElementById('fullpage-code-lang').onchange = (e) => {
            if (cm) cm.setOption('mode', e.target.value);
            this._isDirty = true;
        };

        // Dirty tracking
        quill.on('text-change', () => { this._isDirty = true; });
        document.querySelector('.note-fullpage-header')?.addEventListener('input', () => { this._isDirty = true; });

        // Init Tag Input
        const tagInput = new TagInput(document.getElementById('fullpage-note-tags'), []);
        this._fullpageTagInput = tagInput;

        // Focus
        if (currentEditorType === 'rich') quill.focus();
        else if (cm) cm.focus();
    }

    // Helper for direct code block creation
    openAddCodeModal() {
        this.closeAddMenu();
        this.openAddNoteFullpage('code');
    }

    async editNote(id) {
        // Use fullpage editor for desktop
        this.editNoteFullpage(id);
    }

    async viewNote(id) {
        // optimistically track view
        try {
            await api.viewNote(id);
            this.refreshRecentWidgets('notes'); // Refresh recent notes on view
        } catch (e) { console.error("Failed to track view", e); }

        // Use fullpage view for desktop
        this.openNoteFullpage(id);
    }

    // Full-page note viewing
    openNoteFullpage(id) {
        const note = this.allNotes.find(n => n.id === id);
        if (!note) return;

        const safeContent = this.sanitizeContent(note.content);
        const tagsHtml = (note.tags && note.tags.length)
            ? note.tags.map(t => `<span class="tag-pill">${t}</span>`).join('')
            : '<span style="color: var(--color-text-tertiary)">No tags</span>';

        const updatedDate = note.updated_at ? new Date(note.updated_at).toLocaleString() : 'Unknown';

        const overlay = document.getElementById('note-fullpage-overlay');
        overlay.innerHTML = `
            <div class="note-fullpage-header">
                <div class="note-fullpage-header-left">
                    <button class="note-fullpage-back" onclick="app.closeNoteFullpage()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                        Back
                    </button>
                    <h1 class="note-fullpage-title">${note.title}</h1>
                </div>
                <div class="note-fullpage-header-right">
                    <span class="note-fullpage-meta">Last updated: ${updatedDate}</span>
                    <button class="btn btn-primary" onclick="app.editNoteFullpage(${id})">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                    </button>
                    <button class="btn btn-ghost" onclick="app.confirmDeleteNoteFullpage(${id})" title="Delete Note">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
            <div class="note-fullpage-content">
                <div class="note-fullpage-content-inner">
                    <div class="note-fullpage-view ql-editor">
                        ${note.is_code ? `<pre class="note-code language-${note.code_language || 'plaintext'}"><code>${safeContent}</code></pre>` : safeContent}
                    </div>
                    <div class="note-fullpage-tags">
                        <div class="note-fullpage-tags-label">Tags</div>
                        <div class="note-fullpage-tags-list">${tagsHtml}</div>
                    </div>
                </div>
            </div>
        `;

        // Highlight if code
        if (note.is_code && window.hljs) {
            setTimeout(() => hljs.highlightAll(), 0);
        }

        // Show the overlay with animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // Add Keyboard handlers (ESC to close, E to edit)
        this._noteFullpageKeyHandler = (e) => {
            const activeElement = document.activeElement;
            const isTyping = activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                activeElement.isContentEditable ||
                activeElement.classList.contains('ql-editor') ||
                activeElement.closest('.CodeMirror') ||
                activeElement.closest('.cm-editor');

            if (e.key === 'Escape') {
                this.closeNoteFullpage();
            } else if (!isTyping && (e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey) {
                this.editNoteFullpage(id);
            }
        };
        document.addEventListener('keydown', this._noteFullpageKeyHandler);
    }

    // Full-page note editing
    async editNoteFullpage(id) {
        // Remove view mode key handler if transition from view mode
        if (this._noteFullpageKeyHandler) {
            document.removeEventListener('keydown', this._noteFullpageKeyHandler);
            this._noteFullpageKeyHandler = null;
        }

        this._isDirty = false; // Reset for new edit
        this._currentFullpageNoteId = id;
        const note = this.allNotes.find(n => n.id === id);
        if (!note) return;

        const content = this.sanitizeContent(note.content);
        const createdDate = note.created_at ? new Date(note.created_at).toLocaleString() : 'Unknown';
        const updatedDate = note.updated_at ? new Date(note.updated_at).toLocaleString() : 'Unknown';

        const overlay = document.getElementById('note-fullpage-overlay');
        overlay.innerHTML = `
            <div class="note-fullpage-header">
                <div class="note-fullpage-header-left">
                    <button class="note-fullpage-back" onclick="app.closeNoteFullpage()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                        Cancel
                    </button>
                    <input type="text" class="note-fullpage-title-input" id="fullpage-note-title" value="${note.title}" placeholder="Note title...">
                </div>
                <div class="note-fullpage-header-right">
                    <div class="editor-type-switch" id="fullpage-note-type-switch">
                        <button type="button" class="editor-type-btn ${!note.is_code ? 'active' : ''}" data-type="rich">Standard</button>
                        <button type="button" class="editor-type-btn ${note.is_code ? 'active' : ''}" data-type="code">Code Block</button>
                    </div>
                    <button class="btn btn-primary" id="fullpage-save-btn" onclick="app.saveNoteFullpage(${id})">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Save
                    </button>
                </div>
            </div>
            <div class="note-fullpage-content">
                <div class="note-fullpage-content-inner note-fullpage-editor">
                    <div id="fullpage-rich-editor-container" style="height: 100%; ${note.is_code ? 'display:none;' : ''}">
                        <div id="fullpage-note-editor">${content}</div>
                    </div>
                    <div id="fullpage-code-editor-container" style="height: 100%; ${!note.is_code ? 'display:none;' : ''}">
                        <div id="fullpage-code-editor" style="height:100%;"></div>
                        <div class="form-group" style="position: absolute; bottom: 80px; right: 20px; z-index: 10; width: 150px;">
                            <select class="input input-sm" id="fullpage-code-lang">
                                <option value="javascript" ${note.code_language === 'javascript' ? 'selected' : ''}>JavaScript</option>
                                <option value="python" ${note.code_language === 'python' ? 'selected' : ''}>Python</option>
                                <option value="htmlmixed" ${note.code_language === 'htmlmixed' ? 'selected' : ''}>HTML/XML</option>
                                <option value="css" ${note.code_language === 'css' ? 'selected' : ''}>CSS</option>
                                <option value="clike" ${note.code_language === 'clike' ? 'selected' : ''}>C/C++/Java</option>
                                <option value="shell" ${note.code_language === 'shell' ? 'selected' : ''}>Bash/Shell</option>
                                <option value="markdown" ${note.code_language === 'markdown' ? 'selected' : ''}>Markdown</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
            <div class="note-fullpage-footer">
                <div class="note-fullpage-footer-left">
                    <label class="checkbox">
                        <input type="checkbox" id="fullpage-note-widget" ${note.show_as_widget ? 'checked' : ''}>
                        Show on dashboard
                    </label>
                </div>
                <div class="note-fullpage-footer-right">
                    <div style="display:flex;flex-direction:column;gap:var(--spacing-xs);">
                        <label style="font-size:var(--font-size-sm);color:var(--color-text-secondary);">Tags</label>
                        <div id="fullpage-note-tags"></div>
                    </div>
                </div>
            </div>
        `;

        // Show the overlay with animation if not already active
        if (!overlay.classList.contains('active')) {
            requestAnimationFrame(() => {
                overlay.classList.add('active');
            });
        }

        // Initialize Quill editor
        const quill = new Quill('#fullpage-note-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'list': 'check' }],
                    ['link'],
                    ['clean']
                ]
            }
        });

        this._fullpageQuill = quill;
        let cm = null;
        this._fullpageCM = null;
        let currentEditorType = note.is_code ? 'code' : 'rich';

        const initCM = () => {
            if (cm) return;
            cm = CodeMirror(document.getElementById('fullpage-code-editor'), {
                value: note.is_code ? note.content : (quill.getText().trim() || ""),
                mode: document.getElementById('fullpage-code-lang').value,
                theme: 'material-darker',
                lineNumbers: true,
                tabSize: 4,
                indentUnit: 4
            });
            this._fullpageCM = cm;
            cm.on('change', () => { this._isDirty = true; });
            setTimeout(() => cm.refresh(), 10);
        };

        if (note.is_code) initCM();

        const switchBtns = document.querySelectorAll('#fullpage-note-type-switch .editor-type-btn');
        switchBtns.forEach(btn => {
            btn.onclick = () => {
                const type = btn.dataset.type;
                if (type === currentEditorType) return;
                currentEditorType = type;
                this._isDirty = true;
                switchBtns.forEach(b => b.classList.toggle('active', b === btn));
                document.getElementById('fullpage-rich-editor-container').style.display = type === 'rich' ? 'block' : 'none';
                document.getElementById('fullpage-code-editor-container').style.display = type === 'code' ? 'block' : 'none';

                if (type === 'code') {
                    const content = quill.getText().trim();
                    initCM();
                    if (cm) {
                        cm.setValue(content);
                        cm.refresh();
                    }
                } else if (type === 'rich' && cm) {
                    quill.setText(cm.getValue());
                }
            };
        });

        document.getElementById('fullpage-code-lang').onchange = (e) => {
            if (cm) cm.setOption('mode', e.target.value);
            this._isDirty = true;
        };

        // Track changes for dirty check
        quill.on('text-change', () => {
            this._isDirty = true;
        });

        const header = document.querySelector('.note-fullpage-header');
        header?.addEventListener('input', () => {
            this._isDirty = true;
        });

        // Initialize Tag Input
        const tagInput = new TagInput(document.getElementById('fullpage-note-tags'), note.tags || []);
        this._fullpageTagInput = tagInput;

        // Focus title input
        document.getElementById('fullpage-note-title').focus();

        // Add ESC key handler if not already added
        if (!this._noteFullpageEscHandler) {
            this._noteFullpageEscHandler = (e) => {
                if (e.key === 'Escape') {
                    this.closeNoteFullpage();
                }
            };
            document.addEventListener('keydown', this._noteFullpageEscHandler);
        }

        // Keyboard shortcut for save (now handled globally in initKeyboardShortcuts)
        // Leaving this here as it doesn't hurt, but the global one is now the primary
        this._noteFullpageSaveHandler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                this.saveNoteFullpage(id);
            }
        };
        document.addEventListener('keydown', this._noteFullpageSaveHandler);
    }

    // Save note from fullpage edit
    async saveNoteFullpage(id) {
        const title = document.getElementById('fullpage-note-title')?.value || 'Untitled';
        const typeBtn = document.querySelector('#fullpage-note-type-switch .editor-type-btn.active');
        const isCode = typeBtn?.dataset.type === 'code';
        const content = isCode ? this._fullpageCM?.getValue() : (this._fullpageQuill?.root.innerHTML || '');
        const codeLang = isCode ? document.getElementById('fullpage-code-lang')?.value : null;
        const tags = this._fullpageTagInput?.getTags() || [];
        const showAsWidget = document.getElementById('fullpage-note-widget')?.checked || false;

        const saveBtn = document.getElementById('fullpage-save-btn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner"></span> Saving...';
        }

        try {
            if (id) {
                // UPDATE existing
                await api.updateNote(id, {
                    title: title,
                    content: content,
                    show_as_widget: showAsWidget,
                    is_code: isCode,
                    code_language: codeLang,
                    tags: tags
                });
                this.showToast('Note updated');
            } else {
                // CREATE new
                let displayTitle = title;
                if (!displayTitle || displayTitle === 'Untitled') {
                    const text = this._fullpageQuill.getText().trim();
                    displayTitle = text.substring(0, 30) + (text.length > 30 ? '...' : '');
                    if (!displayTitle) displayTitle = 'Untitled Note';
                }

                // If widget enabled, calculate position
                let wx = 0, wy = 0;
                if (showAsWidget) {
                    const { x, y } = await this.getSmartBottomPosition(3, 2);
                    wx = x; wy = y;
                }

                await api.createNote({
                    title: displayTitle,
                    content: content,
                    show_as_widget: showAsWidget,
                    is_code: isCode,
                    code_language: codeLang,
                    tags: tags,
                    widget_grid_x: wx,
                    widget_grid_y: wy,
                    widget_grid_w: 3,
                    widget_grid_h: 2
                });
                this.showToast('Note created');
            }
            this._isDirty = false; // Clear before closing
            this.allNotes = await api.getNotes(); // Refresh local cache
            this.closeNoteFullpage(true); // Force close

            if (this.currentPage === 'notes') this.renderNotesPage();
            else if (this.currentPage === 'dashboard') await this.initDashboard();
            else this.refreshRecentWidgets('notes');
        } catch (err) {
            this.showToast('Failed to save note: ' + err.message, 'error');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save';
            }
        }
    }

    // Close fullpage note view
    closeNoteFullpage(force = false) {
        if (!force && this._isDirty) {
            if (!confirm('You have unsaved changes. Are you sure you want to discard them?')) {
                return;
            }
        }
        const overlay = document.getElementById('note-fullpage-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
        this._isDirty = false;

        // Remove event handlers
        if (this._noteFullpageKeyHandler) {
            document.removeEventListener('keydown', this._noteFullpageKeyHandler);
            this._noteFullpageKeyHandler = null;
        }
        if (this._noteFullpageSaveHandler) {
            document.removeEventListener('keydown', this._noteFullpageSaveHandler);
            this._noteFullpageSaveHandler = null;
        }
        if (this._noteFullpageEscHandler) {
            document.removeEventListener('keydown', this._noteFullpageEscHandler);
            this._noteFullpageEscHandler = null;
        }

        // Clear references
        this._fullpageQuill = null;
        this._fullpageTagInput = null;
        this._currentFullpageNoteId = null;
    }

    // Delete note from fullpage view
    async confirmDeleteNoteFullpage(id) {
        if (confirm('Delete this note?')) {
            await api.deleteNote(id);
            this.allNotes = await api.getNotes();
            this.closeNoteFullpage();
            this.showToast('Note deleted');
            if (this.currentPage === 'notes') this.renderNotesPage();
            else await this.initDashboard();
        }
    }

    // Alias for backward compatibility - now uses fullpage
    openNoteModal(id) { this.viewNote(id); }

    async confirmDeleteNote(id) {
        if (confirm('Delete this note?')) {
            await api.deleteNote(id);
            this.allNotes = await api.getNotes();
            this.closeModal();
            this.closeNoteFullpage();
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
            // ... existing weather config ...
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

                <div class="dropdown-header" style="padding: 12px 0 8px; font-weight: bold; border-top: 1px solid var(--color-border); margin-top: 8px; font-size: 0.8rem;">General Display Settings</div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="hide_title" ${config.hide_title ? 'checked' : ''}> Hide Title Bar (Show on hover)</label></div>

                <button type="submit" class="btn btn-primary" style="width:100%">Save</button>
            </form>`);
            document.getElementById('widget-config-form').addEventListener('submit', async e => {
                e.preventDefault();
                const form = e.target;
                const newConfig = {
                    ...config,
                    location: form.location.value,
                    dateFormat: form.dateFormat.value,
                    timeFormat: form.timeFormat.value,
                    showCurrentTemp: form.showCurrentTemp.checked,
                    showCurrentDate: form.showCurrentDate.checked,
                    showCurrentTime: form.showCurrentTime.checked,
                    showForecast: form.showForecast.checked,
                    hide_title: form.hide_title.checked
                };
                await api.updateWidget(widgetId, { title: form.title.value, config: newConfig });
                this.closeModal();
                this.refreshWidget(widgetId);
            });
            return;
        }

        if (widget.widget_type === 'links' || widget.widget_type === 'notes') {
            const isLinks = widget.widget_type === 'links';
            this.showModal(`Configure ${isLinks ? 'Links' : 'Notes'} Widget`, `<form id="widget-config-form">
                <div class="form-group"><label class="form-label">Title</label><input class="input" name="title" value="${widget.title}"></div>
                
                <div class="form-group">
                    <label class="form-label">Mode</label>
                    <select class="input" name="mode" onchange="document.getElementById('limit-group').style.display = this.value === 'recent' ? 'block' : 'none'">
                        <option value="standard" ${config.mode !== 'recent' ? 'selected' : ''}>Standard</option>
                        <option value="recent" ${config.mode === 'recent' ? 'selected' : ''}>Recent</option>
                    </select>
                </div>

                <script>
                    // Add interactivity to the config modal without global scope if possible
                    // However, our modals are simple innerHTML. We'll use a direct change listener.
                </script>
                
                <div class="form-group" id="limit-group" style="${config.mode === 'recent' ? '' : 'display:none'}">
                    <label class="form-label">Item Count</label>
                    <input class="input" type="number" name="limit" value="${config.limit || 10}" min="1" max="50">
                </div>

                ${isLinks ? `
                    <div class="form-group"><label class="form-label">Filter Category (Standard Mode)</label><input class="input" name="filterCategory" value="${config.filterCategory || ''}" placeholder="Optional"></div>
                    <div class="form-group"><label class="checkbox"><input type="checkbox" name="showIcon" ${config.showIcon !== false ? 'checked' : ''}> Show Icons</label></div>
                    <div class="form-group"><label class="checkbox"><input type="checkbox" name="showTitle" ${config.showTitle !== false ? 'checked' : ''}> Show Titles</label></div>
                    <div class="form-group"><label class="checkbox"><input type="checkbox" name="showTags" ${config.showTags === true ? 'checked' : ''}> Show Tags</label></div>
                    <div class="form-group"><label class="checkbox"><input type="checkbox" name="icons_only" ${config.icons_only ? 'checked' : ''} onchange="const g = document.getElementById('icon-size-group'); if(g) g.style.display = this.checked ? 'block' : 'none'"> Icons Only Mode (Grid)</label></div>
                    
                    <div class="form-group" id="icon-size-group" style="${config.icons_only ? '' : 'display:none'}">
                        <label class="form-label">Icon Size</label>
                        <select class="input" name="icon_size">
                            <option value="sm" ${config.icon_size === 'sm' ? 'selected' : ''}>Small (32px)</option>
                            <option value="md" ${config.icon_size === 'md' || !config.icon_size ? 'selected' : ''}>Medium (48px)</option>
                            <option value="lg" ${config.icon_size === 'lg' ? 'selected' : ''}>Large (72px)</option>
                        </select>
                    </div>
                ` : ''}

                <div class="dropdown-header" style="padding: 12px 0 8px; font-weight: bold; border-top: 1px solid var(--color-border); margin-top: 8px; font-size: 0.8rem;">General Display Settings</div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="hide_title" ${config.hide_title ? 'checked' : ''}> Hide Title Bar (Show on hover)</label></div>

                <button type="submit" class="btn btn-primary" style="width:100%">Save</button>
            </form>`);

            document.getElementById('widget-config-form').addEventListener('submit', async e => {
                e.preventDefault();
                const form = e.target;
                const newConfig = {
                    ...config,
                    mode: form.mode.value,
                    limit: parseInt(form.limit.value) || 10,
                    hide_title: form.hide_title.checked
                };

                if (isLinks) {
                    newConfig.filterCategory = form.filterCategory.value;
                    newConfig.showIcon = form.showIcon.checked;
                    newConfig.showTitle = form.showTitle.checked;
                    newConfig.showTags = form.showTags.checked;
                    newConfig.icons_only = form.icons_only.checked;
                    newConfig.icon_size = form.icon_size ? form.icon_size.value : 'md';
                }

                await api.updateWidget(widgetId, { title: form.title.value, config: newConfig });
                this.closeModal();
                this.refreshWidget(widgetId);
            });
            return;
        }

        if (widget.widget_type === 'todo') {
            this.showModal('Configure To-Do List', `<form id="widget-config-form">
                <div class="form-group"><label class="form-label">List Title</label><input class="input" name="title" value="${widget.title}"></div>
                
                <div class="form-group">
                    <label class="form-label">Display Mode</label>
                    <select class="input" name="displayMode">
                        <option value="compact" ${config.displayMode !== 'cozy' ? 'selected' : ''}>Compact (minimal spacing)</option>
                        <option value="cozy" ${config.displayMode === 'cozy' ? 'selected' : ''}>Cozy (more breathing room)</option>
                    </select>
                </div>
                
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="showCompleted" ${config.showCompleted !== false ? 'checked' : ''}> Show completed tasks</label></div>
                
                <div class="dropdown-header" style="padding: 12px 0 8px; font-weight: bold; border-top: 1px solid var(--color-border); margin-top: 8px; font-size: 0.8rem;">General Display Settings</div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="hide_title" ${config.hide_title ? 'checked' : ''}> Hide Title Bar (Show on hover)</label></div>

                <p class="help-text" style="margin-bottom: var(--spacing-md);">Tip: Drag items to reorder. Use arrow buttons to nest sub-tasks.</p>

                <button type="submit" class="btn btn-primary" style="width:100%">Save</button>
            </form>`);

            document.getElementById('widget-config-form').addEventListener('submit', async e => {
                e.preventDefault();
                const form = e.target;
                const newConfig = {
                    ...config,
                    displayMode: form.displayMode.value,
                    showCompleted: form.showCompleted.checked,
                    hide_title: form.hide_title.checked
                };
                await api.updateWidget(widgetId, { title: form.title.value, config: newConfig });
                this.closeModal();
                this.refreshWidget(widgetId);
            });
            return;
        }

        if (widget.widget_type === 'clock') {
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

                <div class="dropdown-header" style="padding: 12px 0 8px; font-weight: bold; border-top: 1px solid var(--color-border); margin-top: 8px; font-size: 0.8rem;">General Display Settings</div>
                <div class="form-group"><label class="checkbox"><input type="checkbox" name="hide_title" ${config.hide_title ? 'checked' : ''}> Hide Title Bar (Show on hover)</label></div>

                <button type="submit" class="btn btn-primary" style="width:100%">Save</button>
            </form>`);
            document.getElementById('widget-config-form').addEventListener('submit', async e => {
                e.preventDefault();
                const form = e.target;
                const newConfig = {
                    ...config,
                    dateFormat: form.dateFormat.value,
                    timeFormat: form.timeFormat.value,
                    showTime: form.showTime.checked,
                    showDate: form.showDate.checked,
                    showCalendar: form.showCalendar.checked,
                    hide_title: form.hide_title.checked
                };
                await api.updateWidget(widgetId, { title: form.title.value, config: newConfig });
                this.closeModal();
                this.showToast('Widget configured');
                this.refreshWidget(widgetId);
            });
            return;
        }

        // Default handler for widgets without specialized config
        this.showModal(`Configure ${widget.widget_type.charAt(0).toUpperCase() + widget.widget_type.slice(1)} Widget`, `<form id="widget-config-form">
            <div class="form-group"><label class="form-label">Widget Title</label><input class="input" name="title" value="${widget.title}"></div>
            
            <div class="dropdown-header" style="padding: 12px 0 8px; font-weight: bold; border-top: 1px solid var(--color-border); margin-top: 8px; font-size: 0.8rem;">General Display Settings</div>
            <div class="form-group"><label class="checkbox"><input type="checkbox" name="hide_title" ${config.hide_title ? 'checked' : ''}> Hide Title Bar (Show on hover)</label></div>

            <button type="submit" class="btn btn-primary" style="width:100%">Save</button>
        </form>`);

        document.getElementById('widget-config-form').addEventListener('submit', async e => {
            e.preventDefault();
            const form = e.target;
            const newConfig = {
                ...config,
                hide_title: form.hide_title.checked
            };
            await api.updateWidget(widgetId, { title: form.title.value, config: newConfig });
            this.closeModal();
            this.showToast('Widget configured');
            this.refreshWidget(widgetId);
        });
    }

    openSettings() {
        this.showModal('User Settings', `
            <div class="settings-section">
                <div class="sidebar-section-title" style="margin-top: 0;">General</div>
                <div class="settings-row">
                    <div>
                        <div class="settings-label">Theme</div>
                        <div class="settings-description">Choose your preferred color scheme</div>
                    </div>
                    <select class="input" style="width:auto" onchange="app.setTheme(this.value)">
                        <option value="system" ${localStorage.getItem('theme') === 'system' ? 'selected' : ''}>System</option>
                        <option value="light" ${localStorage.getItem('theme') === 'light' ? 'selected' : ''}>Light</option>
                        <option value="dark" ${localStorage.getItem('theme') === 'dark' ? 'selected' : ''}>Dark</option>
                    </select>
                </div>
                <div class="settings-row">
                    <div>
                        <div class="settings-label">Weather Location</div>
                        <div class="settings-description">Default location for weather widgets</div>
                    </div>
                    <input class="input" style="width:200px" value="${this.user?.default_weather_location || ''}" onchange="app.updateUserSetting('default_weather_location', this.value)">
                </div>
            </div>
            
            <div class="sidebar-divider" style="margin: 24px 0;"></div>
            
            <div class="settings-section">
                <div class="sidebar-section-title">Account Security</div>
                <p class="settings-description" style="margin-bottom: 20px;">Update your password regularly to keep your account secure.</p>
                <form id="change-password-form">
                    <div class="auth-error" id="change-pw-error" style="display: none; margin-bottom: 16px;"></div>
                    <div class="form-group">
                        <label class="form-label">Current Password</label>
                        <input type="password" class="input" name="current_password" required autocomplete="current-password">
                    </div>
                    <div class="form-group">
                        <label class="form-label">New Password</label>
                        <input type="password" class="input" name="new_password" required minlength="6" autocomplete="new-password">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Confirm New Password</label>
                        <input type="password" class="input" name="confirm_password" required minlength="6" autocomplete="new-password">
                    </div>
                    <button type="submit" class="btn btn-primary" id="change-pw-btn" style="width: 100%; margin-top: 8px;">Update Password</button>
                </form>
            </div>
        `);

        const form = document.getElementById('change-password-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handleChangePassword(e));
        }
    }

    async handleChangePassword(e) {
        e.preventDefault();
        const form = e.target;
        const currentPassword = form.current_password.value;
        const newPassword = form.new_password.value;
        const confirmPassword = form.confirm_password.value;
        const errorDiv = document.getElementById('change-pw-error');
        const btn = document.getElementById('change-pw-btn');

        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'New passwords do not match.';
            errorDiv.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-small"></span> Updating...';
        errorDiv.style.display = 'none';

        try {
            await api.changePassword(currentPassword, newPassword);
            this.showToast('Password updated successfully');
            this.closeModal();
        } catch (err) {
            btn.disabled = false;
            btn.textContent = 'Update Password';
            errorDiv.textContent = err.message || 'Failed to update password.';
            errorDiv.style.display = 'block';
        }
    }

    async updateUserSetting(key, value) {
        await api.updateMe({ [key]: value });
        this.user[key] = value;
        this.showToast('Setting saved');
    }

    // ============================================
    // To-Do Widget Logic
    // ============================================

    loadTodoWidget(container, widget) {
        const items = widget.config.items || [];
        const displayMode = widget.config.displayMode || 'compact'; // compact or cozy
        const showCompleted = widget.config.showCompleted !== false;

        // Separate active and completed items
        const activeItems = items.filter(item => !item.completed);
        const completedItems = items.filter(item => item.completed);
        const completedCount = completedItems.length;
        const totalCount = items.length;
        const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        const renderItem = (item, index) => `
            <div class="todo-item ${item.completed ? 'completed' : ''}" 
                 data-level="${item.level || 0}"
                 draggable="true"
                 data-index="${index}"
                 data-widget-id="${widget.id}"
                 onclick="app.toggleTodoItem(${widget.id}, ${index}, ${!item.completed})">
                
                <div class="todo-drag-handle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="15" cy="19" r="2"/></svg>
                </div>

                <div class="todo-checkbox"></div>
                
                <span class="todo-text">${item.text}</span>
                
                <div class="todo-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); app.indentTodoItem(${widget.id}, ${index}, true)" title="Nest under previous">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8L7 12L3 16"/><line x1="21" y1="12" x2="7" y2="12"/></svg>
                    </button>
                    <button class="btn-icon" onclick="event.stopPropagation(); app.indentTodoItem(${widget.id}, ${index}, false)" title="Move to top level">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8L17 12L21 16"/><line x1="3" y1="12" x2="17" y2="12"/></svg>
                    </button>
                    <button class="btn-icon delete" onclick="event.stopPropagation(); app.deleteTodoItem(${widget.id}, ${index})" title="Remove task">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = `
            <div class="todo-wrapper">
                ${totalCount > 0 ? `
                    <div class="todo-progress">
                        <div class="todo-progress-bar">
                            <div class="todo-progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <span class="todo-progress-text">${completedCount}/${totalCount}</span>
                    </div>
                ` : ''}

                <form class="todo-add-form" onsubmit="event.preventDefault(); app.addTodoItem(${widget.id}, this.querySelector('input').value); this.querySelector('input').value='';">
                    <input class="todo-add-input" placeholder="Add task..." required>
                    <button type="submit" class="todo-add-btn" title="Add">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                </form>

                <div class="todo-list ${displayMode}" id="todo-list-${widget.id}">
                    ${items.length === 0 ? `
                        <div class="todo-empty-state">
                            <svg class="todo-empty-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                            <span>No tasks yet</span>
                        </div>
                    ` : ''}
                    ${items.map((item, index) => renderItem(item, index)).join('')}
                </div>
            </div>
        `;

        this.initTodoDragAndDrop(widget.id);
    }

    initTodoDragAndDrop(widgetId) {
        const list = document.getElementById(`todo-list-${widgetId}`);
        if (!list) return;

        let draggedItemIndex = null;

        list.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.todo-item');
            if (!item) return;
            draggedItemIndex = parseInt(item.dataset.index);
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        list.addEventListener('dragend', (e) => {
            const item = e.target.closest('.todo-item');
            if (item) item.classList.remove('dragging');

            const allItems = list.querySelectorAll('.todo-item');
            allItems.forEach(i => i.classList.remove('drag-over'));
        });

        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            const item = e.target.closest('.todo-item');
            if (item) {
                item.classList.add('drag-over');
            }
        });

        list.addEventListener('dragleave', (e) => {
            const item = e.target.closest('.todo-item');
            if (item) {
                item.classList.remove('drag-over');
            }
        });

        list.addEventListener('drop', async (e) => {
            e.preventDefault();
            const targetItem = e.target.closest('.todo-item');
            if (!targetItem) return;

            const targetIndex = parseInt(targetItem.dataset.index);
            if (draggedItemIndex === targetIndex) return;

            const widgets = await api.getDashboardWidgets(this.dashboard.id);
            const widget = widgets.find(w => w.id === widgetId);
            if (!widget) return;

            const items = widget.config.items;
            const movingItem = items.splice(draggedItemIndex, 1)[0];
            items.splice(targetIndex, 0, movingItem);

            // Save and re-render
            this.loadTodoWidget(document.getElementById(`widget-body-${widgetId}`), widget);
            await api.updateWidget(widgetId, { config: widget.config });
        });
    }

    async indentTodoItem(widgetId, index, indent) {
        const widgets = await api.getDashboardWidgets(this.dashboard.id);
        const widget = widgets.find(w => w.id === widgetId);
        if (!widget) return;

        const items = widget.config.items;
        const currentLevel = items[index].level || 0;

        if (indent) {
            // Max 2 levels of nesting (0, 1, 2)
            items[index].level = Math.min(currentLevel + 1, 2);
        } else {
            items[index].level = Math.max(currentLevel - 1, 0);
        }

        this.loadTodoWidget(document.getElementById(`widget-body-${widgetId}`), widget);
        await api.updateWidget(widgetId, { config: widget.config });
    }

    async toggleTodoItem(widgetId, index, completed) {
        const widgets = await api.getDashboardWidgets(this.dashboard.id);
        const widget = widgets.find(w => w.id === widgetId);
        if (!widget) return;

        if (!widget.config.items) widget.config.items = [];
        widget.config.items[index].completed = completed;

        // Optimistic UI update
        const body = document.getElementById(`widget-body-${widgetId}`);
        if (body) this.loadTodoWidget(body, widget);

        await api.updateWidget(widgetId, { config: widget.config });
    }

    async addTodoItem(widgetId, text) {
        if (!text.trim()) return;
        const widgets = await api.getDashboardWidgets(this.dashboard.id);
        const widget = widgets.find(w => w.id === widgetId);
        if (!widget) return;

        if (!widget.config.items) widget.config.items = [];
        widget.config.items.push({ text: text.trim(), completed: false });

        const body = document.getElementById(`widget-body-${widgetId}`);
        if (body) this.loadTodoWidget(body, widget);

        await api.updateWidget(widgetId, { config: widget.config });
    }

    async deleteTodoItem(widgetId, index) {
        const widgets = await api.getDashboardWidgets(this.dashboard.id);
        const widget = widgets.find(w => w.id === widgetId);
        if (!widget) return;

        // Store deleted item for undo
        const deletedItem = widget.config.items[index];
        widget.config.items.splice(index, 1);

        const body = document.getElementById(`widget-body-${widgetId}`);
        if (body) this.loadTodoWidget(body, widget);

        // Save immediately
        await api.updateWidget(widgetId, { config: widget.config });

        // Show undo toast
        this.showUndoToast('Task deleted', async () => {
            // Restore the item
            const freshWidgets = await api.getDashboardWidgets(this.dashboard.id);
            const freshWidget = freshWidgets.find(w => w.id === widgetId);
            if (!freshWidget) return;

            freshWidget.config.items.splice(index, 0, deletedItem);
            await api.updateWidget(widgetId, { config: freshWidget.config });

            const freshBody = document.getElementById(`widget-body-${widgetId}`);
            if (freshBody) this.loadTodoWidget(freshBody, freshWidget);

            this.showToast('Task restored');
        });
    }

    showUndoToast(message, undoCallback) {
        // Remove any existing undo toast
        const existingToast = document.querySelector('.toast.undo-toast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.className = 'toast undo-toast';
        toast.innerHTML = `
            <span>${message}</span>
            <button class="toast-undo-btn">Undo</button>
        `;

        document.body.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => toast.classList.add('show'));

        let undone = false;
        const undoBtn = toast.querySelector('.toast-undo-btn');
        undoBtn.onclick = () => {
            undone = true;
            undoCallback();
            toast.remove();
        };

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (!undone) {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }
        }, 5000);
    }
}

const app = new App();
document.addEventListener('DOMContentLoaded', () => app.init());
