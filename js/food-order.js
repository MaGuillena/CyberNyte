/* Database-backed food availability, cart, and order workflow. */
'use strict';

let FOOD_CATEGORIES = {};

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

  // Refresh labels from the category records loaded from MySQL.
  ensure() {
    FOOD_CATEGORIES = Object.fromEntries(DB.data.categories.map(category => [category.id, category.name]));
  },

  getItem(id) { return DB.data.foodItems.find((item) => item.id === id) || null; },

  /** An item is orderable only when it exists and staff have not marked it Out of Stock. */
  isAvailable(item) { return Boolean(item) && item.available !== false && DB.data.categories.some(category => category.id === item.categoryId && category.active); },

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
  async placeOrder() {
    const lines = this.cartLines();
    if (!lines.length) return { error: 'Add at least one item.' };
    if (lines.some(line => !line.available)) return { error: 'Remove unavailable items first.' };
    const saved = await API.request('/food-orders', 'POST', { items: this.cart.map(line => ({ foodId: line.foodId, quantity: line.quantity })) });
    this.clearCart();
    await App.commit();
    return { order: DB.data.foodOrders.find(order => order.id === saved.id) };
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
    FoodData.ensure();
    return [{ value: 'all', label: 'All categories' },
      ...DB.data.categories.map(category => ({ value: category.id, label: category.name + (category.active ? '' : ' (inactive)') }))];
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
        actionsHtml: `<button type="button" class="btn btn-primary" data-action="add-food">${icon('plus')} Add Food</button> <a class="btn btn-secondary" href="#categories">Categories</a> <a class="btn btn-secondary" href="#food-orders">${icon('peso')} View order <span id="avail-cart-count">(0)</span></a>`,
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
        <!-- Placeholder until the saved local image loads. -->
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
        <button type="button" class="btn btn-sm btn-secondary" data-action="edit-food" data-id="${id}">Edit</button>
        <button type="button" class="btn btn-sm btn-danger" data-action="delete-food" data-id="${id}">Delete</button>
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
    async toggle(data) {
      const item = FoodData.getItem(data.id);
      if (!item) return;
      await API.request('/food-items/' + item.id, 'PATCH', { available: !item.available });
      await App.commit(); UI.toast('Availability updated.');
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
  async changeStatus(orderId, nextStatus) {
    const order = DB.data.foodOrders.find((o) => o.id === orderId);
    if (!order) return;
    if (!FoodData.canMove(order.status, nextStatus)) {
      UI.toast(`${order.id} is ${FOOD_STATUS[order.status].label} and cannot change to ${FOOD_STATUS[nextStatus].label}.`, 'error');
      return;
    }
    await API.request('/food-orders/' + orderId + '/status', 'PATCH', { status: nextStatus });
    await App.commit(); UI.toast('Order status updated.');
  },

  /** Confirmation shown after an order is placed. */
  showConfirmation(order) {
    const count = order.items.reduce((sum, i) => sum + i.quantity, 0);
    UI.modal({
      title: 'Order placed',
      subtitle: 'Order saved. Payment is handled separately.',
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
    async place() {
      const result = await FoodData.placeOrder();
      if (result.error) {
        UI.toast(result.error, 'error');
        App.refresh();
        return;
      }
      UI.toast(`Order ${result.order.id} placed.`);
      FoodOrders.showConfirmation(result.order);
    },
    view(data) { FoodOrders.showDetails(data.id); },
    prepare(data) { return FoodOrders.changeStatus(data.id, 'preparing'); },
    complete(data) { return FoodOrders.changeStatus(data.id, 'completed'); },
    cancel(data) {
      return UI.confirm({
        title: `Cancel ${data.id}?`,
        message: 'The order will be marked Cancelled. Completed orders cannot be cancelled.',
        confirmLabel: 'Cancel order', cancelLabel: 'Keep order', danger: true,
      }).then((ok) => { if (ok) return FoodOrders.changeStatus(data.id, 'cancelled'); });
    },
  },
};