'use strict';

const Categories = {
  title: 'Categories',
  render(container) {
    container.innerHTML = `${UI.pageHeader({ title: 'Food Categories', subtitle: 'Organize the menu. Inactive categories cannot receive new orders.', actionsHtml: '<button class="btn btn-primary" type="button" data-action="add">Add Category</button>' })}
      <div class="toolbar card"><div class="search-box">${icon('search')}<label class="sr-only" for="category-search">Search categories</label><input id="category-search" type="search" placeholder="Search categories" data-filter></div></div>
      <section class="card"><div id="category-table"></div></section>`;
  },
  refresh() {
    if (!$('#category-table')) return;
    const query = $('#category-search').value.trim().toLowerCase();
    $('#category-table').innerHTML = UI.table({
      caption: 'Categories', rows: DB.data.categories.filter(c => c.name.toLowerCase().includes(query)),
      empty: { title: 'No categories found', text: 'Add a category before adding food.' },
      columns: [
        { label: 'Name', render: c => esc(c.name) },
        { label: 'Status', render: c => UI.badge(c.active ? 'active' : 'deactivated') },
        { label: 'Actions', render: c => `<span class="row-actions"><button type="button" class="btn btn-sm btn-secondary" data-action="edit" data-id="${esc(c.id)}">Edit</button><button type="button" class="btn btn-sm btn-secondary" data-action="toggle" data-id="${esc(c.id)}">${c.active ? 'Deactivate' : 'Activate'}</button><button type="button" class="btn btn-sm btn-danger" data-action="delete" data-id="${esc(c.id)}">Delete</button></span>` }
      ]
    });
  },
  openForm(categoryId = null) {
    const category = DB.data.categories.find(c => c.id === categoryId);
    UI.modal({ title: category ? 'Edit category' : 'Add category',
      body: UI.field({ name: 'name', label: 'Category name', required: true, value: category?.name || '', attrs: 'maxlength="100"' }),
      onSubmit: async values => {
        if (!values.name.trim()) return UI.fail('Enter a category name.', { name: 'Required.' });
        await API.request('/categories' + (category ? '/' + category.id : ''), category ? 'PATCH' : 'POST', { name: values.name });
        await App.commit(); UI.toast('Category saved.');
      }
    });
  },
  actions: {
    add() { Categories.openForm(); },
    edit(data) { Categories.openForm(data.id); },
    async toggle(data) {
      const category = DB.data.categories.find(c => c.id === data.id);
      await API.request('/categories/' + category.id, 'PATCH', { active: !category.active });
      await App.commit(); UI.toast('Category updated.');
    },
    async delete(data) {
      if (!await UI.confirm({ title: 'Delete category?', message: 'Only empty categories can be deleted. Deactivate categories that contain food.', confirmLabel: 'Delete', danger: true })) return;
      await API.request('/categories/' + data.id, 'DELETE');
      await App.commit(); UI.toast('Category deleted.');
    }
  }
};
