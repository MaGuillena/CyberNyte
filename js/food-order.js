/* ==========================================================================
   food-orders.js — Food Availability and Food Orders (frontend demonstration)
   --------------------------------------------------------------------------
   WHAT THIS FILE DOES
     - FoodAvailability page: staff see every menu item and mark it Available
       or Out of Stock. The item is never deleted; only its flag changes.
     - FoodOrders page: staff build a customer order (add, change quantity,
       remove), place it as a simulated transaction, and move it through
       Pending -> Preparing -> Completed (or Cancelled).
     - Both pages share ONE data source: DB.data.foodItems. Availability set on
       the Availability page is what the Orders page reads.

   WHY ONE FILE, TWO MODULES
     The pages are tightly linked (shared menu, availability flag and cart), so
     keeping them together avoids passing data between files. Each page is still
     its own module object, which app.js routes to by URL hash.

   WHAT IS SAVED
     Availability and placed orders go through App.commit(), the app's
     "data changed" hook, so they survive a refresh like every other feature.
     The order being built (the cart) lives in memory only: a half-finished
     order should not survive a page reload.

   DEMO ONLY: no payment is processed. Placing an order only records it.
   ========================================================================== */
'use strict';

/* ==========================================================================
   1. FOOD MENU DATA — EDIT THIS ARRAY ONLY
   --------------------------------------------------------------------------
   Each line is one menu item. To change something:
     - name, description, price ..... edit the text or number inside the quotes
     - image ........................ replace the path with your own photo.
         Save photos in assets/images/food/ and keep the file name, or edit the
         path to match your file. Recommended: JPG or PNG, about 800 x 600 px.
         If the file is missing, a grey placeholder box is shown instead.
     - featured: true ............... shows a "Featured" badge on the card
     - To ADD an item: copy a line and give it a NEW id (FD-029, FD-030 ...).
     - To REMOVE an item: delete its line. Past orders keep their saved name
       and price, so old receipts never change.
   WHY ids matter: availability and orders refer to items by id. Never change
   an existing id.
   ========================================================================== */
const FOOD_MENU = [
  // ---- Instant Noodles and Pancit ----
  { id: 'FD-001', category: 'pancit', name: 'Classic Pancit Canton', price: 35, featured: true, description: 'Stir-fried canton noodles with vegetables and a savory sauce.', image: 'assets/images/food/pancit-canton.jpg' },
  { id: 'FD-002', category: 'pancit', name: 'Extra Hot Pancit Canton', price: 35, description: 'Classic canton with extra chili for spice lovers.', image: 'assets/images/food/pancit-canton-extra-hot.jpg' },
  { id: 'FD-003', category: 'pancit', name: 'Sweet and Spicy Pancit Canton', price: 35, description: 'Balanced sweet and spicy flavor, served hot.', image: 'assets/images/food/pancit-canton-sweet-spicy.jpg' },
  { id: 'FD-004', category: 'pancit', name: 'Pancit Canton with Egg', price: 45, description: 'Canton topped with a fried egg.', image: 'assets/images/food/pancit-canton-egg.jpg' },
  { id: 'FD-005', category: 'pancit', name: 'Lucky Me! Instant Noodles (Beef)', price: 30, description: 'Ready-to-cook beef flavor instant noodles.', image: 'assets/images/food/lucky-me-beef.jpg' },
  { id: 'FD-006', category: 'pancit', name: 'Lucky Me! Instant Noodles (Chicken)', price: 30, description: 'Ready-to-cook chicken flavor instant noodles.', image: 'assets/images/food/lucky-me-chicken.jpg' },

  // ---- Rice Meals ----
  { id: 'FD-007', category: 'rice', name: 'Siomai Rice', price: 55, description: 'Steamed siomai with garlic rice and sauce.', image: 'assets/images/food/siomai-rice.jpg' },
  { id: 'FD-008', category: 'rice', name: 'Shanghai Rice', price: 60, description: 'Crispy lumpia shanghai served with rice.', image: 'assets/images/food/shanghai-rice.jpg' },
  { id: 'FD-009', category: 'rice', name: 'Hotdog Rice', price: 55, description: 'Pan-fried hotdog with garlic rice and egg.', image: 'assets/images/food/hotdog-rice.jpg' },
  { id: 'FD-010', category: 'rice', name: 'Egg Fried Rice', price: 45, description: 'Fried rice with egg and garlic.', image: 'assets/images/food/egg-fried-rice.jpg' },
  { id: 'FD-011', category: 'rice', name: 'Hotdog Silog', price: 65, description: 'Hotdog, fried egg and garlic rice.', image: 'assets/images/food/hotdog-silog.jpg' },

  // ---- Snacks ----
  { id: 'FD-012', category: 'snacks', name: 'French Fries', price: 50, description: 'Crispy golden fries, lightly salted.', image: 'assets/images/food/french-fries.jpg' },
  { id: 'FD-013', category: 'snacks', name: 'Cheese Sticks', price: 55, description: 'Breaded cheese sticks with a gooey center.', image: 'assets/images/food/cheese-sticks.jpg' },
  { id: 'FD-014', category: 'snacks', name: 'Lumpiang Shanghai', price: 50, description: 'Five pieces of crispy meat rolls.', image: 'assets/images/food/lumpiang-shanghai.jpg' },
  { id: 'FD-015', category: 'snacks', name: 'Siomai', price: 40, description: 'Four pieces of steamed siomai.', image: 'assets/images/food/siomai.jpg' },
  { id: 'FD-016', category: 'snacks', name: 'Hotdog Sandwich', price: 45, description: 'Hotdog in a soft bun with sauce.', image: 'assets/images/food/hotdog-sandwich.jpg' },
  { id: 'FD-017', category: 'snacks', name: 'Chicken Nuggets', price: 70, description: 'Six pieces of crispy chicken nuggets.', image: 'assets/images/food/chicken-nuggets.jpg' },
  { id: 'FD-018', category: 'snacks', name: 'Nachos', price: 80, description: 'Tortilla chips with cheese sauce.', image: 'assets/images/food/nachos.jpg' },

  // ---- Burgers and Sandwiches ----
  { id: 'FD-019', category: 'burgers', name: 'Classic Burger', price: 75, description: 'Beef patty with lettuce, tomato and sauce.', image: 'assets/images/food/classic-burger.jpg' },
  { id: 'FD-020', category: 'burgers', name: 'Cheeseburger', price: 90, description: 'Classic burger with a slice of cheese.', image: 'assets/images/food/cheeseburger.jpg' },
  { id: 'FD-021', category: 'burgers', name: 'Chicken Sandwich', price: 85, description: 'Breaded chicken fillet in a toasted bun.', image: 'assets/images/food/chicken-sandwich.jpg' },

  // ---- Drinks ----
  { id: 'FD-022', category: 'drinks', name: 'Bottled Water', price: 20, description: 'Chilled 500 ml bottled water.', image: 'assets/images/food/bottled-water.jpg' },
  { id: 'FD-023', category: 'drinks', name: 'Canned Soft Drinks', price: 35, description: 'Chilled can of soft drink.', image: 'assets/images/food/soft-drinks.jpg' },
  { id: 'FD-024', category: 'drinks', name: 'Iced Tea', price: 35, description: 'Sweet iced tea over ice.', image: 'assets/images/food/iced-tea.jpg' },
  { id: 'FD-025', category: 'drinks', name: 'Iced Coffee', price: 60, description: 'Cold brewed coffee with milk and ice.', image: 'assets/images/food/iced-coffee.jpg' },
  { id: 'FD-026', category: 'drinks', name: '3-in-1 Coffee', price: 25, description: 'Instant coffee, creamer and sugar in one sachet.', image: 'assets/images/food/3-in-1-coffee.jpg' },
  { id: 'FD-027', category: 'drinks', name: 'Milk Tea', price: 55, description: 'Creamy milk tea, served cold.', image: 'assets/images/food/milk-tea.jpg' },
  { id: 'FD-028', category: 'drinks', name: 'Energy Drinks', price: 50, description: 'Chilled energy drink for long gaming sessions.', image: 'assets/images/food/energy-drinks.jpg' },
];

/* Category labels shown in the filters and on cards. Keys must match `category` above. */
const FOOD_CATEGORIES = {
  pancit: 'Instant Noodles and Pancit',
  rice: 'Rice Meals',
  snacks: 'Snacks',
  burgers: 'Burgers and Sandwiches',
  drinks: 'Drinks',
};

/* Ordering rules. Edit these numbers to change how orders are calculated. */
const FOOD_CONFIG = {
  maxQuantity: 20,          // most of one item a single order can hold
  serviceChargePercent: 0,  // e.g. 10 adds a 10% service charge. 0 = total equals subtotal
};

/* Order status labels, icons and colors (tone matches the app's badge classes). */
const FOOD_STATUS = {
  pending:   { label: 'Pending',   tone: 'warning', icon: 'clock' },
  preparing: { label: 'Preparing', tone: 'info',    icon: 'play' },
  completed: { label: 'Completed', tone: 'success', icon: 'check' },
  cancelled: { label: 'Cancelled', tone: 'muted',   icon: 'x' },
};

/* ==========================================================================
   2. FoodData — shared logic used by BOTH pages
   WHY here: availability, cart math and order placement are needed by both the
   Availability and Orders pages. Keeping them in one object means the two
   pages can never calculate prices or check stock differently.
   ========================================================================== */
const FoodData = {
  /** The order being built. Each line: { foodId, quantity }. Memory only (see file header). */
  cart: [],

  /** Allowed status moves. Anything not listed is blocked (a Completed order cannot be cancelled). */
  NEXT_STATUS: {
    pending: ['preparing', 'cancelled'],
    preparing: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
  },

  /**
   * Makes sure DB.data has the food collections and applies menu edits.
   * WHY: data.js (seed data) knows nothing about food, so the first run creates
   * the collections here. Every run re-reads FOOD_MENU so a name, price or image
   * you edit shows up on the next page load. The staff's saved Available/Out of
   * Stock choice is kept during that merge.
   * Rules.foodAndDrinkAvailability() already reads DB.data.foodItems, so the
   * rest of the app sees these items too.
   */
  ensure() {
    const data = DB.data;
    if (!data.counters) data.counters = {};
    const savedItems = Array.isArray(data.foodItems) ? data.foodItems : [];

    data.foodItems = FOOD_MENU.map((entry) => {
      const saved = savedItems.find((item) => item.id === entry.id);
      return {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        description: entry.description,
        price: entry.price,
        featured: Boolean(entry.featured),
        image: entry.image,
        // New items start Available. Existing items keep the staff's choice.
        available: saved ? saved.available !== false : true,
      };
    });

    if (!Array.isArray(data.foodOrders)) data.foodOrders = [];
    // counters.foodOrder is undefined only before the first run, so seed once.
    if (data.counters.foodOrder === undefined) this.seedSampleOrders();
  },

  /** Two example orders so the history table is not empty on first open. */
  seedSampleOrders() {
    const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
    const line = (foodId, quantity) => {
      const entry = FOOD_MENU.find((e) => e.id === foodId);
      return { foodId, name: entry.name, unitPrice: entry.price, quantity, lineTotal: Rules.round2(entry.price * quantity) };
    };
    const order = (id, minutes, status, lines) => ({
      id,
      createdAt: minutesAgo(minutes),
      createdBy: 'U-002',
      status,
      items: lines,
      ...this.totals(lines),
    });

    DB.data.foodOrders = [
      order('FO-0001', 95, 'completed', [line('FD-001', 2), line('FD-025', 1)]),
      order('FO-0002', 20, 'preparing', [line('FD-012', 1), line('FD-028', 2)]),
    ];
    // nextId() continues from here, so the next order becomes FO-0003.
    DB.data.counters.foodOrder = DB.data.foodOrders.length;
  },

  getItem(id) { return DB.data.foodItems.find((item) => item.id === id) || null; },

  /** An item is orderable only when it exists and staff have not marked it Out of Stock. */
  isAvailable(item) { return Boolean(item) && item.available !== false; },

  /**
   * Filters menu items. Used by both pages so the search and filter behave the same.
   * status: 'all' | 'available' | 'out'
   */
  filterItems({ query = '', category = 'all', status = 'all' } = {}) {
    const text = query.trim().toLowerCase();
    return DB.data.foodItems.filter((item) => {
      const matchesText = !text || item.name.toLowerCase().includes(text);
      const matchesCategory = category === 'all' || item.category === category;
      const available = this.isAvailable(item);
      const matchesStatus = status === 'all' || (status === 'available' ? available : !available);
      return matchesText && matchesCategory && matchesStatus;
    });
  },

  /* ------------------------------ Cart ------------------------------ */

  cartCount() { return this.cart.reduce((sum, line) => sum + line.quantity, 0); },

  /**
   * Cart lines with price and stock info added. Prices come from the menu NOW,
   * and are saved into the order when it is placed.
   */
  cartLines() {
    return this.cart.map((line) => {
      const item = this.getItem(line.foodId);
      const unitPrice = item ? item.price : 0;
      return {
        foodId: line.foodId,
        quantity: line.quantity,
        name: item ? item.name : 'Unknown item',
        unitPrice,
        lineTotal: Rules.round2(unitPrice * line.quantity),
        available: this.isAvailable(item),
      };
    });
  },

  /** Subtotal, service charge and total. Used for the cart and for saved orders. */
  totals(lines) {
    const subtotal = Rules.round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
    const serviceCharge = Rules.round2(subtotal * FOOD_CONFIG.serviceChargePercent / 100);
    return { subtotal, serviceCharge, total: Rules.round2(subtotal + serviceCharge) };
  },

  /** Adds one of an item. Out-of-stock items are refused here, not just hidden in the UI. */
  addToCart(foodId) {
    const item = this.getItem(foodId);
    if (!item) return false;
    if (!this.isAvailable(item)) {
      UI.toast(`${item.name} is out of stock and cannot be added.`, 'error');
      return false;
    }
    const line = this.cart.find((l) => l.foodId === foodId);
    if (line) {
      if (line.quantity >= FOOD_CONFIG.maxQuantity) {
        UI.toast(`Maximum ${FOOD_CONFIG.maxQuantity} of one item per order.`, 'error');
        return false;
      }
      line.quantity += 1;
    } else {
      this.cart.push({ foodId, quantity: 1 });
    }
    return true;
  },

  /** Changes quantity by +1 or -1. Quantity never goes below 1; use Remove to delete a line. */
  changeQty(foodId, delta) {
    const line = this.cart.find((l) => l.foodId === foodId);
    if (!line) return;
    const next = line.quantity + delta;
    if (next < 1) return;
    if (next > FOOD_CONFIG.maxQuantity) {
      UI.toast(`Maximum ${FOOD_CONFIG.maxQuantity} of one item per order.`, 'error');
      return;
    }
    line.quantity = next;
  },

  removeFromCart(foodId) { this.cart = this.cart.filter((l) => l.foodId !== foodId); },
  clearCart() { this.cart = []; },

  /**
   * Turns the cart into a saved order. Returns { order } or { error }.
   * WHY it re-checks stock: staff may have marked an item Out of Stock while the
   * order was still open. The check here is the final guard.
   */
  placeOrder() {
    const lines = this.cartLines();
    if (!lines.length) return { error: 'Add at least one item before placing an order.' };

    const blocked = lines.filter((l) => !l.available).map((l) => l.name);
    if (blocked.length) {
      return { error: `Remove out-of-stock items first: ${blocked.join(', ')}.` };
    }

    const order = {
      id: DB.nextId('foodOrder', 'FO', 4), // e.g. FO-0003
      createdAt: new Date().toISOString(),
      createdBy: App.user ? App.user.id : null,
      items: lines.map((l) => ({ foodId: l.foodId, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal })),
      ...this.totals(lines),
      status: 'pending',
    };
    DB.data.foodOrders.push(order);
    this.clearCart();
    return { order };
  },

  canMove(from, to) { return (this.NEXT_STATUS[from] || []).includes(to); },
};

/* ==========================================================================
   3. FoodUI — small display helpers shared by both pages
   ========================================================================== */
const FoodUI = {
  /** Status badge for an order. Text + icon + color, so meaning is not color-only. */
  statusBadge(status) {
    const meta = FOOD_STATUS[status] || { label: status, tone: 'muted', icon: 'minus' };
    return `<span class="badge badge-${meta.tone}">${icon(meta.icon)}${esc(meta.label)}</span>`;
  },

  /** Availability badge for a menu item. */
  availabilityBadge(available) {
    return available
      ? `<span class="badge badge-success">${icon('check')}Available</span>`
      : `<span class="badge badge-danger">${icon('alert')}Out of Stock</span>`;
  },

  categoryOptions() {
    return [{ value: 'all', label: 'All categories' },
      ...Object.entries(FOOD_CATEGORIES).map(([value, label]) => ({ value, label }))];
  },

  statusOptions() {
    return [{ value: 'all', label: 'All statuses' },
      ...Object.entries(FOOD_STATUS).map(([value, meta]) => ({ value, label: meta.label }))];
  },

  /**
   * Makes food photos appear only when the file loads. The <img> starts hidden and
   * the placeholder shows. If a photo is missing, the placeholder stays.
   * WHY JS listeners instead of onerror="": this matches the logo code in app.js.
   * Call it after the cards are written into the page.
   */
  bindImages(root) {
    $$('[data-food-img]', root).forEach((img) => {
      const holder = img.closest('.food-image');
      const show = () => { img.hidden = false; holder.classList.add('has-photo'); };
      img.addEventListener('load', show);
      img.addEventListener('error', () => { img.hidden = true; holder.classList.remove('has-photo'); });
      if (img.complete && img.naturalWidth > 0) show(); // image was cached before this ran
    });
  },
};

/* ==========================================================================
   4. FoodAvailability — Page: "Food Availability" (staff manage stock)
   ========================================================================== */
const FoodAvailability = {
  title: 'Food Availability',

  /** Draws the fixed parts of the page once. refresh() fills in the cards. */
  render(container) {
    container.innerHTML = `
      ${UI.pageHeader({
        title: 'Food Availability',
        subtitle: 'Mark items Available or Out of Stock. Changes show on the Food Orders page right away.',
        actionsHtml: `<a class="btn btn-secondary" href="#food-orders">${icon('peso')} View order <span id="avail-cart-count">(0)</span></a>`,
      })}
      <div class="toolbar card">
        <div class="search-box">
          ${icon('search')}
          <label class="sr-only" for="food-search">Search food by name</label>
          <input id="food-search" type="search" placeholder="Search food by name (e.g. Pancit)" data-filter autocomplete="off">
        </div>
        <div class="toolbar-field">
          <label for="food-category-filter">Category</label>
          <select id="food-category-filter" data-filter>${UI.options(FoodUI.categoryOptions())}</select>
        </div>
        <div class="toolbar-field">
          <label for="food-status-filter">Availability</label>
          <select id="food-status-filter" data-filter>${UI.options([
            { value: 'all', label: 'All items' },
            { value: 'available', label: 'Available' },
            { value: 'out', label: 'Out of Stock' },
          ])}</select>
        </div>
      </div>
      <div id="food-avail-grid" class="food-grid"></div>`;
  },

  /** Redraws the food cards using the current filters and data. */
  refresh() {
    const grid = $('#food-avail-grid');
    if (!grid) return; // page not drawn yet
    FoodData.ensure();

    const list = FoodData.filterItems({
      query: $('#food-search').value,
      category: $('#food-category-filter').value,
      status: $('#food-status-filter').value,
    });

    grid.innerHTML = list.length
      ? list.map((item) => this.cardHtml(item)).join('')
      : UI.empty({ title: 'No food matches', text: 'Try a different name, category or availability filter.' });
    FoodUI.bindImages(grid);
    $('#avail-cart-count').textContent = `(${FoodData.cartCount()})`;
  },

  /**
   * One food card: image container, name, description, price, availability,
   * "Add to Order" and the staff toggle.
   * EDIT TIP: the card layout is driven by the CSS in section 13 of style.css.
   */
  cardHtml(item) {
    const available = FoodData.isAvailable(item);
    const id = esc(item.id);
    return `<article class="food-card ${available ? 'is-available' : 'is-out'}">
      <div class="food-image">
        <!-- Shown until the real photo loads. Replace the photo path in FOOD_MENU. -->
        <span class="food-image-placeholder" aria-hidden="true">${icon('inbox')}<small>No photo yet</small></span>
        <img src="${esc(item.image)}" alt="${esc(item.name)}" data-food-img hidden>
      </div>
      <header class="food-card-head">
        <h2>${esc(item.name)}</h2>
        ${item.featured ? '<span class="badge badge-purple">Featured</span>' : ''}
      </header>
      <p class="muted food-desc">${esc(item.description)}</p>
      <small class="muted">${esc(FOOD_CATEGORIES[item.category] || '')}</small>
      <div class="food-card-meta">
        <span class="food-price">${Fmt.currency(item.price)}</span>
        ${FoodUI.availabilityBadge(available)}
      </div>
      <footer class="food-card-foot">
        <button type="button" class="btn btn-sm btn-primary" data-action="add-to-order" data-id="${id}" ${available ? '' : 'disabled'}>${icon('plus')} Add to Order</button>
        <button type="button" class="btn btn-sm btn-secondary" data-action="toggle" data-id="${id}">${available ? 'Mark Out of Stock' : 'Mark Available'}</button>
      </footer>
    </article>`;
  },

  actions: {
    /** Adds the item to the shared cart. The button is disabled when out of stock, and addToCart() re-checks. */
    'add-to-order'(data) {
      if (FoodData.addToCart(data.id)) UI.toast(`${FoodData.getItem(data.id).name} added to order.`);
      App.refresh();
    },

    /**
     * Flips Available <-> Out of Stock. The item stays in the menu; only its flag
     * changes. App.commit() saves and redraws, and the Orders page reads the same flag.
     */
    toggle(data) {
      const item = FoodData.getItem(data.id);
      if (!item) return;
      item.available = !item.available;
      UI.toast(`${item.name} is now ${item.available ? 'Available' : 'Out of Stock'}.`, item.available ? 'success' : 'info');
      App.commit();
    },
  },
};

/* ==========================================================================
   5. FoodOrders — Page: "Food Orders" (build, place and track orders)
   ========================================================================== */
const FoodOrders = {
  title: 'Food Orders',

  /** Draws the layout once: menu + current order on top, order history below. */
  render(container) {
    container.innerHTML = `
      ${UI.pageHeader({
        title: 'Food Orders',
        subtitle: 'Build a customer order, place it, and track its progress',
        actionsHtml: `<a class="btn btn-secondary" href="#food-availability">${icon('inbox')} Food Availability</a>`,
      })}
      <div class="food-layout">
        <section class="card" aria-labelledby="order-menu-heading">
          <div class="card-head"><h2 id="order-menu-heading">Menu</h2></div>
          <div class="toolbar">
            <div class="search-box">
              ${icon('search')}
              <label class="sr-only" for="order-search">Search menu</label>
              <input id="order-search" type="search" placeholder="Search food or drinks" data-filter autocomplete="off">
            </div>
            <div class="toolbar-field">
              <label for="order-category-filter">Category</label>
              <select id="order-category-filter" data-filter>${UI.options(FoodUI.categoryOptions())}</select>
            </div>
          </div>
          <div id="order-menu"></div>
        </section>

        <section class="card" aria-labelledby="cart-heading">
          <div class="card-head"><h2 id="cart-heading">Current order</h2></div>
          <div id="order-cart"></div>
        </section>
      </div>

      <section class="card food-history" aria-labelledby="history-heading">
        <div class="card-head">
          <h2 id="history-heading">Order history</h2>
          <div class="toolbar-field">
            <label for="order-status-filter">Status</label>
            <select id="order-status-filter" data-filter>${UI.options(FoodUI.statusOptions())}</select>
          </div>
        </div>
        <div id="order-history"></div>
      </section>`;
  },

  /** Redraws the menu, the current order and the history from the latest data. */
  refresh() {
    if (!$('#order-menu')) return; // page not drawn yet
    FoodData.ensure();
    this.renderMenu();
    $('#order-cart').innerHTML = this.cartHtml();
    this.renderHistory();
  },

  /** Menu list. Out-of-stock items are shown but cannot be added. */
  renderMenu() {
    const list = FoodData.filterItems({
      query: $('#order-search').value,
      category: $('#order-category-filter').value,
    });

    $('#order-menu').innerHTML = list.length
      ? `<ul class="list order-menu">${list.map((item) => {
          const available = FoodData.isAvailable(item);
          return `<li>
            <div class="order-row-info">
              <strong>${esc(item.name)}</strong>
              <small class="muted">${esc(FOOD_CATEGORIES[item.category] || '')}</small>
            </div>
            <div class="order-row-action">
              <span class="food-price">${Fmt.currency(item.price)}</span>
              <button type="button" class="btn btn-sm ${available ? 'btn-primary' : 'btn-secondary'}" data-action="add-to-order" data-id="${esc(item.id)}" ${available ? '' : 'disabled'}>${available ? `${icon('plus')} Add` : 'Out of Stock'}</button>
            </div>
          </li>`;
        }).join('')}</ul>`
      : UI.empty({ title: 'Nothing on the menu', text: 'Try a different search or category.' });
  },

  /**
   * Current order panel: lines with quantity controls, totals, and Place/Clear buttons.
   * Place is disabled while any line is out of stock, so the warning is always visible.
   */
  cartHtml() {
    const lines = FoodData.cartLines();
    if (!lines.length) {
      return UI.empty({ title: 'No items yet', text: 'Add food or drinks from the menu to start an order.' });
    }

    const totals = FoodData.totals(lines);
    const hasOutOfStock = lines.some((l) => !l.available);

    const lineHtml = lines.map((line) => {
      const name = esc(line.name);
      const id = esc(line.foodId);
      return `<li>
        <div class="order-row-info">
          <strong>${name}</strong>
          <small class="muted">${Fmt.currency(line.unitPrice)} each${line.available ? '' : ' · <span class="text-danger">Out of Stock</span>'}</small>
        </div>
        <div class="qty-control">
          <button type="button" class="icon-btn" data-action="dec" data-id="${id}" aria-label="Decrease quantity of ${name}" ${line.quantity <= 1 ? 'disabled' : ''}>${icon('minus')}</button>
          <span class="qty-value" aria-live="polite">${line.quantity}</span>
          <button type="button" class="icon-btn" data-action="inc" data-id="${id}" aria-label="Increase quantity of ${name}" ${line.quantity >= FOOD_CONFIG.maxQuantity ? 'disabled' : ''}>${icon('plus')}</button>
        </div>
        <span class="food-price">${Fmt.currency(line.lineTotal)}</span>
        ${UI.iconButton({ name: 'x', label: `Remove ${line.name} from order`, action: 'remove', data: { id: line.foodId }, tone: 'danger' })}
      </li>`;
    }).join('');

    const totalRows = [['Subtotal', Fmt.currency(totals.subtotal)]];
    if (FOOD_CONFIG.serviceChargePercent > 0) {
      totalRows.push([`Service charge (${FOOD_CONFIG.serviceChargePercent}%)`, Fmt.currency(totals.serviceCharge)]);
    }
    totalRows.push(['Total amount', `<strong class="food-price">${Fmt.currency(totals.total)}</strong>`]);

    return `
      ${hasOutOfStock ? `<div class="notice notice-warning">${icon('alert')}<span>Remove out-of-stock items before placing this order.</span></div>` : ''}
      <ul class="list order-lines">${lineHtml}</ul>
      ${UI.detailList(totalRows)}
      <div class="order-actions">
        <button type="button" class="btn btn-primary btn-block" data-action="place" ${hasOutOfStock ? 'disabled' : ''}>${icon('check')} Place order</button>
        <button type="button" class="btn btn-ghost btn-block" data-action="clear">Clear order</button>
      </div>`;
  },

  /** Order history table, newest first, with a status filter. */
  renderHistory() {
    const status = $('#order-status-filter').value;
    const orders = DB.data.foodOrders
      .filter((o) => status === 'all' || o.status === status)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    $('#order-history').innerHTML = UI.table({
      caption: 'Food orders',
      rows: orders,
      empty: { title: 'No orders yet', text: 'Orders you place will appear here.' },
      columns: [
        { label: 'Order ID', render: (o) => `<strong>${esc(o.id)}</strong>` },
        { label: 'Date and time', render: (o) => esc(Fmt.dateTime(o.createdAt)) },
        { label: 'Items', render: (o) => esc(o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')) },
        { label: 'Total', className: 'num', render: (o) => Fmt.currency(o.total) },
        { label: 'Status', render: (o) => FoodUI.statusBadge(o.status) },
        { label: 'Actions', render: (o) => this.orderActionsHtml(o) },
      ],
    });
  },

  /** Buttons offered depend on the current status (see FoodData.NEXT_STATUS). */
  orderActionsHtml(order) {
    const id = esc(order.id);
    const buttons = [];
    if (order.status === 'pending') {
      buttons.push(`<button type="button" class="btn btn-sm btn-primary" data-action="prepare" data-id="${id}">${icon('play')} Start</button>`);
    }
    if (order.status === 'preparing') {
      buttons.push(`<button type="button" class="btn btn-sm btn-primary" data-action="complete" data-id="${id}">${icon('check')} Complete</button>`);
    }
    if (order.status === 'pending' || order.status === 'preparing') {
      buttons.push(`<button type="button" class="btn btn-sm btn-danger" data-action="cancel" data-id="${id}">${icon('x')} Cancel</button>`);
    }
    buttons.push(`<button type="button" class="btn btn-sm btn-secondary" data-action="view" data-id="${id}">${icon('eye')} View</button>`);
    return `<span class="row-actions">${buttons.join('')}</span>`;
  },

  /** Moves an order to a new status, if the transition is allowed. */
  changeStatus(orderId, nextStatus) {
    const order = DB.data.foodOrders.find((o) => o.id === orderId);
    if (!order) return;
    if (!FoodData.canMove(order.status, nextStatus)) {
      UI.toast(`${order.id} is ${FOOD_STATUS[order.status].label} and cannot change to ${FOOD_STATUS[nextStatus].label}.`, 'error');
      return;
    }
    order.status = nextStatus;
    UI.toast(`${order.id} is now ${FOOD_STATUS[nextStatus].label}.`);
    App.commit();
  },

  /** Confirmation shown after an order is placed. */
  showConfirmation(order) {
    const count = order.items.reduce((sum, i) => sum + i.quantity, 0);
    UI.modal({
      title: 'Order placed',
      subtitle: 'This is a simulated order. No payment was processed.',
      submitLabel: null, // Close button only
      body: UI.detailList([
        ['Order ID', esc(order.id)],
        ['Date and time', esc(Fmt.dateTime(order.createdAt))],
        ['Items', `${count} item${count === 1 ? '' : 's'}`],
        ['Total', `<strong class="food-price">${Fmt.currency(order.total)}</strong>`],
        ['Status', FoodUI.statusBadge(order.status)],
      ]),
    });
  },

  /** Read-only details of one order: its items with saved prices. */
  showDetails(orderId) {
    const order = DB.data.foodOrders.find((o) => o.id === orderId);
    if (!order) return;
    UI.modal({
      title: `${order.id} details`,
      size: 'modal-wide',
      submitLabel: null,
      body: UI.detailList([
        ['Status', FoodUI.statusBadge(order.status)],
        ['Placed', esc(Fmt.dateTime(order.createdAt))],
        ['Total', Fmt.currency(order.total)],
      ]) + UI.table({
        caption: `Items in ${order.id}`,
        rows: order.items,
        empty: { title: 'No items', text: '' },
        columns: [
          { label: 'Item', render: (i) => esc(i.name) },
          { label: 'Price', className: 'num', render: (i) => Fmt.currency(i.unitPrice) },
          { label: 'Qty', className: 'num', render: (i) => String(i.quantity) },
          { label: 'Line total', className: 'num', render: (i) => Fmt.currency(i.lineTotal) },
        ],
      }),
    });
  },

  /* Actions are called by app.js through event delegation (data-action="name"). */
  actions: {
    /** Adds from the menu. Refused when out of stock. */
    'add-to-order'(data) {
      if (FoodData.addToCart(data.id)) UI.toast(`${FoodData.getItem(data.id).name} added to order.`);
      App.refresh();
    },
    inc(data) { FoodData.changeQty(data.id, 1); App.refresh(); },
    dec(data) { FoodData.changeQty(data.id, -1); App.refresh(); },
    remove(data) {
      FoodData.removeFromCart(data.id);
      UI.toast('Item removed from order.', 'info');
      App.refresh();
    },
    clear() {
      if (!FoodData.cart.length) return;
      UI.confirm({ title: 'Clear this order?', message: 'All items in the current order will be removed.', confirmLabel: 'Clear order', danger: true })
        .then((ok) => { if (ok) { FoodData.clearCart(); App.refresh(); } });
    },
    place() {
      const result = FoodData.placeOrder();
      if (result.error) {
        UI.toast(result.error, 'error');
        App.refresh();
        return;
      }
      App.commit(); // saves the new order and redraws the page
      UI.toast(`Order ${result.order.id} placed.`);
      FoodOrders.showConfirmation(result.order);
    },
    view(data) { FoodOrders.showDetails(data.id); },
    prepare(data) { FoodOrders.changeStatus(data.id, 'preparing'); },
    complete(data) { FoodOrders.changeStatus(data.id, 'completed'); },
    cancel(data) {
      UI.confirm({
        title: `Cancel ${data.id}?`,
        message: 'The order will be marked Cancelled. Completed orders cannot be cancelled.',
        confirmLabel: 'Cancel order', cancelLabel: 'Keep order', danger: true,
      }).then((ok) => { if (ok) FoodOrders.changeStatus(data.id, 'cancelled'); });
    },
  },
};