/* Admin account management. Express enforces the same role restrictions. */
'use strict';

const Users = {
  title: 'User Management',
  adminOnly: true, // read by app.js to hide the nav link and block direct access

  render(container) {
    container.innerHTML = `
      ${UI.pageHeader({
        title: 'User Management',
        subtitle: 'Staff accounts and roles',
        actionsHtml: `<button type="button" class="btn btn-primary" data-action="add">${icon('plus')} Add Staff Account</button>`,
      })}
      <section class="card" aria-label="Staff accounts"><div id="user-table"></div></section>`;
  },

  refresh() {
    const holder = $('#user-table');
    if (!holder) return;
    holder.innerHTML = UI.table({
      caption: 'Staff accounts',
      rows: [...DB.data.users].sort((a, b) => a.fullName.localeCompare(b.fullName)),
      empty: { title: 'No staff accounts' },
      columns: [
        { label: 'Full name', render: (u) => `<strong>${esc(u.fullName)}</strong>${u.id === App.user.id ? ' <span class="muted">(you)</span>' : ''}` },
        { label: 'Username', render: (u) => esc(u.username) },
        { label: 'Role', render: (u) => UI.badge(u.role) },
        { label: 'Account status', render: (u) => UI.badge(u.active ? 'active' : 'deactivated') },
        {
          label: 'Actions',
          render: (u) => `<span class="row-actions">
            ${UI.iconButton({ name: 'edit', label: `Edit ${u.fullName}`, action: 'edit', data: { id: u.id } })}
            ${u.active
              ? UI.iconButton({ name: 'power', label: `Deactivate ${u.fullName}`, action: 'deactivate', data: { id: u.id }, tone: 'danger' })
              : UI.iconButton({ name: 'check', label: `Activate ${u.fullName}`, action: 'activate', data: { id: u.id } })}
          </span>`,
        },
      ],
    });
  },

  /** WHY: the café must never end up with zero active administrators. */
  activeAdminCount() {
    return DB.data.users.filter((u) => u.role === 'admin' && u.active).length;
  },

  openForm(userId = null) {
    const user = userId ? Rules.getUser(userId) : null;
    const isEdit = Boolean(user);

    UI.modal({
      title: isEdit ? `Edit ${user.fullName}` : 'Add staff account',
      subtitle: isEdit ? user.id : 'The new person can sign in right away.',
      submitLabel: isEdit ? 'Save changes' : 'Add account',
      body: [
        UI.field({ label: 'Full name', name: 'fullName', required: true, value: user?.fullName || '', attrs: 'maxlength="60" autocomplete="off"' }),
        UI.field({ label: 'Username', name: 'username', required: true, value: user?.username || '', hint: '3–20 characters: letters, numbers, dot, dash or underscore.', attrs: 'maxlength="20" autocomplete="off"' }),
        UI.field({ label: 'Role', name: 'role', required: true, value: user?.role || 'staff', options: [{ value: 'staff', label: 'Staff' }, { value: 'admin', label: 'Administrator' }] }),
        UI.field({
          label: isEdit ? 'New password' : 'Password', name: 'password', type: 'password', required: !isEdit,
          hint: isEdit ? 'Leave blank to keep the current password.' : 'At least 6 characters.', attrs: 'autocomplete="new-password"',
        }),
      ].join(''),
      onSubmit: async (v) => {
        const errors = {};
        const fullName = v.fullName.trim().replace(/\s+/g, ' ');
        const username = v.username.trim();

        if (fullName.length < 2) errors.fullName = 'Enter the staff member’s full name.';
        if (!/^[A-Za-z0-9._-]{3,20}$/.test(username)) errors.username = 'Use 3–20 letters, numbers, dots, dashes or underscores.';
        else if (DB.data.users.some((u) => u.id !== user?.id && u.username.toLowerCase() === username.toLowerCase())) {
          errors.username = `The username "${username}" is already taken.`;
        }
        if (!['admin', 'staff'].includes(v.role)) errors.role = 'Choose a role.';
        if ((!isEdit || v.password) && v.password.length < 6) errors.password = 'The password needs at least 6 characters.';
        if (isEdit && user.role === 'admin' && v.role !== 'admin' && user.active && Users.activeAdminCount() <= 1) {
          errors.role = 'This is the only active administrator. Promote someone else first.';
        }
        if (Object.keys(errors).length) return UI.fail('Please fix the highlighted fields.', errors);

        await API.request('/users' + (isEdit ? '/' + user.id : ''), isEdit ? 'PATCH' : 'POST', { fullName, username, role: v.role, password: v.password });
        await App.commit(); UI.toast('Account saved.');
      },
    });
  },

  actions: {
    add() { Users.openForm(); },
    edit(data) { Users.openForm(data.id); },

    async deactivate(data) {
      const user = Rules.getUser(data.id);
      if (user.id === App.user.id) { UI.toast('You can’t deactivate the account you are signed in with.', 'error'); return; }
      if (user.role === 'admin' && Users.activeAdminCount() <= 1) { UI.toast('At least one administrator account must stay active.', 'error'); return; }
      const confirmed = await UI.confirm({
        title: `Deactivate ${user.fullName}?`,
        message: 'They will no longer be able to sign in. You can activate the account again at any time.',
        confirmLabel: 'Deactivate', danger: true,
      });
      if (!confirmed) return;
      await API.request('/users/' + user.id, 'PATCH', { active: false });
      await App.commit(); UI.toast('Account deactivated.');
    },

    async activate(data) {
      await API.request('/users/' + data.id, 'PATCH', { active: true });
      await App.commit(); UI.toast('Account activated.');
    },
  },
};