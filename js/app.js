/* ==========================================================================
   app.js — application shell
   --------------------------------------------------------------------------
   Responsibilities (and WHY each lives here):
     - Login / logout ........ decides who is using the app
     - Router ................ swaps the visible page without reloading
     - Event delegation ...... ONE listener serves every button in every page
     - App.commit() .......... the single "data changed" hook
     - Notifications ......... derived from data, so they can never go stale
   Loaded LAST, after every page module, because it references them all.
   ========================================================================== */
'use strict';

/* Page registry: the URL hash (#stations) maps to a page module. */
const PAGES = {
  dashboard: Dashboard,
  stations: Stations,
  customers: Customers,
  sessions: Sessions,
  reservations: Reservations,
  payments: Payments,
  'food-availability': FoodAvailability,
  'food-orders': FoodOrders,
  reports: Reports,
  users: Users,
  settings: Settings,
  categories: Categories,
};

const REMEMBER_KEY = 'cafenyte_remembered_username'; // localStorage: username prefill only, never the password

const App = {
  user: null,
  currentPage: null,

  /* =============================== Startup =============================== */
  async init() {
    UI.hydrateIcons();
    this.initLogo();
    this.bindLogin();
    this.bindShell();
    this.showLogin();
    try {
      const user = await API.request('/auth/me');
      await DB.load();
      this.applyPreferences();
      this.startSession(user);
    } catch (error) { if (error.status !== 401) this.loginError(error.message); }
    setInterval(async () => {
      if (!this.user || document.querySelector('dialog[open]')) return;
      try { await this.commit(); }
      catch (error) { UI.toast(error.message, 'error'); }
    }, 30000);
  },
  loginError(message) {
    const banner = $('#login-error');
    banner.textContent = message;
    banner.hidden = false;
  },

  /**
   * Logo fallback logic.
   * WHY: the real logo file (assets/cafenyte-logo.png) doesn't exist yet. The <img> stays
   * hidden and the controller icon shows until the file loads successfully.
   * (JS listeners are used instead of an inline onerror="" attribute to keep the HTML clean.)
   */
  initLogo() {
    $$('[data-logo]').forEach((img) => {
      const holder = img.closest('.brand-logo');
      const showImage = () => { img.hidden = false; holder.classList.add('has-image'); };
      img.addEventListener('load', showImage);
      img.addEventListener('error', () => { img.hidden = true; holder.classList.remove('has-image'); });
      if (img.complete && img.naturalWidth > 0) showImage(); // image was already cached before this ran
    });
  },

  applyPreferences() {
    const prefs = DB.data.settings.prefs;
    document.body.classList.toggle('compact', Boolean(prefs.compactTables));
    document.body.classList.toggle('reduce-motion', Boolean(prefs.reduceMotion));
  },

  /* ============================ Login / logout ============================ */
  bindLogin() {
    const form = $('#login-form');
    const usernameInput = $('#login-username');
    const passwordInput = $('#login-password');
    const toggle = $('#toggle-password');

    usernameInput.value = localStorage.getItem(REMEMBER_KEY) || '';
    $('#login-remember').checked = Boolean(usernameInput.value);

    // Show/hide password. aria-pressed tells screen readers the current state.
    toggle.addEventListener('click', () => {
      const show = passwordInput.type === 'password';
      passwordInput.type = show ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      toggle.innerHTML = icon(show ? 'eyeOff' : 'eye');
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      UI.clearErrors(form);
      const username = usernameInput.value.trim(), password = passwordInput.value;
      if (!username || !password) { this.loginError('Enter your username and password.'); return; }
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const user = await API.request('/auth/login', 'POST', { username, password });
        await DB.load();
        if ($('#login-remember').checked) localStorage.setItem(REMEMBER_KEY, user.username);
        else localStorage.removeItem(REMEMBER_KEY);
        passwordInput.value = '';
        this.applyPreferences();
        this.startSession(user);
        UI.toast('Signed in successfully.');
      } catch (error) { this.loginError(error.message); }
      finally { submit.disabled = false; }
    });
  },

  showLogin() {
    this.user = null;
    this.currentPage = null;
    FoodData.clearCart();
    UI.closeModal();
    $('#app-view').hidden = true;
    $('#login-view').hidden = false;
    $('#login-password').value = '';
    $('#login-error').hidden = true;
    ['#login-username-error', '#login-password-error'].forEach((sel) => { $(sel).textContent = ''; });
    ($('#login-username').value ? $('#login-password') : $('#login-username')).focus();
  },

  startSession(user) {
    this.user = user;
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    this.showUserInfo();
    this.route();
  },

  /** Fills the name/role areas and hides admin-only navigation for staff accounts. */
  showUserInfo() {
    const user = this.user;
    const initials = user.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    $$('[data-user-name]').forEach((el) => { el.textContent = user.fullName; });
    $$('[data-user-role]').forEach((el) => { el.textContent = STATUS_META[user.role].label; });
    $$('[data-user-initials]').forEach((el) => { el.textContent = initials; });
    // UI convenience only — see the security note in users.js.
    $$('[data-admin-only]').forEach((el) => { el.hidden = user.role !== 'admin'; });
  },

  logout() {
    UI.confirm({
      title: 'Log out of CyberNyte?',
      message: 'You will return to the login screen.',
      confirmLabel: 'Log out', cancelLabel: 'Stay signed in',
    }).then(async (ok) => {
      if (!ok) return;
      await API.request('/auth/logout', 'POST');
      FoodData.clearCart();
      this.closeSidebar();
      history.replaceState(null, '', location.pathname);
      this.currentPage = null;
      this.showLogin();
    }).catch(error => UI.toast(error.message, 'error'));
  },

  /* ================================ Router ================================ */
  /** Reads the URL hash and shows the matching page. Runs on login and on every hash change. */
  route() {
    if (!this.user) return;
    let page = location.hash.replace('#', '') || 'dashboard';
    if (!PAGES[page]) page = 'dashboard';
    if (PAGES[page].adminOnly && this.user.role !== 'admin') {
      UI.toast('Only administrators can open that page.', 'error');
      location.hash = '#dashboard';
      return;
    }
    this.showPage(page);
  },

  showPage(page) {
    const module = PAGES[page];
    this.currentPage = page;
    const container = $('#page-content');
    container.innerHTML = '';
    module.render(container);
    UI.hydrateIcons(container);
    module.refresh();

    $('#breadcrumb-page').textContent = module.title;
    document.title = `${module.title} · CyberNyte`;
    $$('.nav-link').forEach((link) => {
      const active = link.dataset.page === page;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    this.closeSidebar();
    this.updateNotifications();
    window.scrollTo(0, 0);
    container.focus({ preventScroll: true }); // moves keyboard/screen-reader focus to the new page
  },

  /* ============================ Data-change hook ============================ */
  /**
   * Call after ANY change to DB.data. One function = no screen can forget to update.
   * Re-fetch committed database records, then update the existing UI.
   */
  async commit() {
    await DB.load();
    this.user = await API.request('/auth/me');
    this.showUserInfo();
    this.applyPreferences();
    if (PAGES[this.currentPage]?.adminOnly && this.user.role !== 'admin') {
      location.hash = '#dashboard'; return;
    }
    this.refresh();
  },

  refresh() {
    if (!this.user || !this.currentPage) return;
    PAGES[this.currentPage].refresh();
    this.updateNotifications();
  },

  /* ============================ Shell interactions ============================ */
  bindShell() {
    const content = $('#page-content');

    // Event delegation: ONE click listener handles every [data-action] button on any page.
    // WHY: pages are redrawn constantly; per-button listeners would be lost each time.
    content.addEventListener('click', (event) => {
      const el = event.target.closest('[data-action]');
      if (!el) return;
      const page = PAGES[this.currentPage];
      const handler = page.actions && page.actions[el.dataset.action];
      if (handler) {
        if (el.disabled) return;
        el.disabled = true;
        Promise.resolve().then(() => handler.call(page, el.dataset, el))
          .catch(error => UI.toast(error.message, 'error'))
          .finally(() => { el.disabled = false; });
      }
    });

    // Search boxes / selects marked data-filter just ask the page to redraw its list.
    ['input', 'change'].forEach((type) => {
      content.addEventListener(type, (event) => {
        // Text/date inputs already emitted input; rerendering on blur can swallow a row-button click.
        if (type === 'change' && event.target.tagName !== 'SELECT') return;
        if (event.target.matches('[data-filter]')) PAGES[this.currentPage].refresh();
      });
    });

    window.addEventListener('hashchange', () => this.route());
    $('#logout-btn').addEventListener('click', () => this.logout());

    // --- Sidebar: collapsible on desktop, slide-in drawer on small screens ---
    const body = document.body;
    $('#menu-toggle').addEventListener('click', () => {
      const open = !body.classList.contains('sidebar-open');
      body.classList.toggle('sidebar-open', open);
      $('#menu-toggle').setAttribute('aria-expanded', String(open));
    });
    $('#sidebar-overlay').addEventListener('click', () => this.closeSidebar());
    $('#sidebar-collapse').addEventListener('click', (event) => {
      const collapsed = body.classList.toggle('sidebar-collapsed');
      event.currentTarget.setAttribute('aria-pressed', String(collapsed));
      event.currentTarget.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    });

    // --- Notifications dropdown ---
    const bell = $('#notif-btn');
    const panel = $('#notif-panel');
    const setPanel = (open) => { panel.hidden = !open; bell.setAttribute('aria-expanded', String(open)); };
    bell.addEventListener('click', () => { this.updateNotifications(); setPanel(panel.hidden); });
    document.addEventListener('click', (event) => {
      if (!panel.hidden && !event.target.closest('.notif-wrap')) setPanel(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!panel.hidden) { setPanel(false); bell.focus(); }
      this.closeSidebar();
    });
    panel.addEventListener('click', (event) => { if (event.target.closest('a')) setPanel(false); });

    $('#topbar-date').textContent = Fmt.date(new Date());
  },

  closeSidebar() {
    document.body.classList.remove('sidebar-open');
    const toggle = $('#menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  },

  /* ============================== Notifications ==============================
     WHY computed from data instead of stored: an alert like "PC-04 reservation in
     20 minutes" is only true right now, so it is rebuilt every time. */
  buildNotifications() {
    const now = new Date();
    const items = [];

    Rules.pendingReservations(now).forEach((r) => {
      const minutes = (Rules.reservationWindow(r).start - now) / 60000;
      if (minutes > 0 && minutes <= 60) {
        items.push({ icon: 'calendar', href: '#reservations', text: `${Rules.customerName(r.customerId)} has ${Rules.stationName(r.stationId)} reserved at ${Fmt.timeOfDay(r.startTime)} (in ${Math.ceil(minutes)} min).` });
      }
    });
    Rules.activeSessions().forEach((s) => {
      const minutes = Rules.elapsedMinutes(s.startTime);
      if (minutes >= Rules.CONFIG.longSessionWarningMinutes) {
        items.push({ icon: 'clock', href: '#sessions', text: `${Rules.stationName(s.stationId)} has been running for ${Fmt.duration(minutes)} (${Rules.customerName(s.customerId)}).` });
      }
    });
    const completed = DB.data.sessions.filter((s) => s.status === 'completed');
    const unpaid = completed.filter((s) => Rules.billing(s).balance > 0);
    if (unpaid.length) {
      items.push({ icon: 'peso', href: '#payments', text: `${unpaid.length} session${unpaid.length > 1 ? 's have' : ' has'} an unpaid balance totalling ${Fmt.currency(Rules.outstandingFor(completed))}.` });
    }
    const down = DB.data.stations.filter((s) => s.active && s.status === 'maintenance');
    if (down.length) {
      items.push({ icon: 'wrench', href: '#stations', text: `${down.map((s) => s.name).join(', ')} ${down.length > 1 ? 'are' : 'is'} under maintenance.` });
    }
    return items;
  },

  updateNotifications() {
    if (!this.user) return;
    const items = this.buildNotifications();
    const badge = $('#notif-count');
    badge.hidden = items.length === 0;
    badge.textContent = items.length;
    $('#notif-btn').setAttribute('aria-label', items.length ? `Notifications, ${items.length} item${items.length > 1 ? 's' : ''}` : 'Notifications, none');
    $('#notif-list').innerHTML = items.length
      ? items.map((i) => `<li><a href="${i.href}">${icon(i.icon)}<span>${esc(i.text)}</span></a></li>`).join('')
      : `<li class="notif-empty">You’re all caught up.</li>`;
  },
};

App.init().catch(error => App.loginError(error.message));
