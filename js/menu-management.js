/* Add/edit menu and local image uploads, using the existing modal UI. */
'use strict';

FoodAvailability.openForm = function(foodId = null) {
  const item = DB.data.foodItems.find(food => food.id === foodId);
  const categories = DB.data.categories.filter(category => category.active || category.id === item?.categoryId);
  if (!categories.length) { UI.toast('Add a category first.', 'info'); location.hash = '#categories'; return; }
  UI.modal({
    title: item ? 'Edit food item' : 'Add food item',
    body: [
      UI.field({ label: 'Name', name: 'name', required: true, value: item?.name || '', attrs: 'maxlength="100"' }),
      UI.field({ label: 'Category', name: 'categoryId', required: true, value: item?.categoryId || categories[0].id,
        options: categories.map(category => ({ value: category.id, label: category.name })) }),
      UI.field({ label: 'Description', name: 'description', value: item?.description || '', attrs: 'maxlength="500"' }),
      UI.field({ label: 'Price (PHP)', name: 'price', type: 'number', required: true, value: item?.price || '', attrs: 'min="0.01" step="0.01"' }),
      UI.field({ label: 'Photo', name: 'image', type: 'file', hint: 'JPG, PNG or WebP, maximum 3 MB. Leave blank to keep the current image.', attrs: 'accept="image/jpeg,image/png,image/webp"' }),
      item?.image ? `<p><img src="${esc(item.image)}" alt="Current food photo" width="140"></p><label class="checkbox"><input type="checkbox" name="removeImage"> Remove current image</label>` : '',
      `<label class="checkbox"><input type="checkbox" name="featured" ${item?.featured ? 'checked' : ''}> Featured</label>`,
      `<label class="checkbox"><input type="checkbox" name="available" ${!item || item.available ? 'checked' : ''}> Available</label>`
    ].join(''),
    onSubmit: async (values, form) => {
      const errors = {};
      if (!values.name.trim()) errors.name = 'Enter an item name.';
      if (!Number.isFinite(Number(values.price)) || Number(values.price) <= 0) errors.price = 'Enter a positive price.';
      const file = form.elements.image.files[0];
      if (file && file.size > 3 * 1024 * 1024) errors.image = 'Maximum image size is 3 MB.';
      if (Object.keys(errors).length) return UI.fail('Check the highlighted fields.', errors);
      const body = new FormData();
      for (const key of ['name','categoryId','description','price']) body.append(key, values[key]);
      body.append('featured', String(form.elements.featured.checked));
      body.append('available', String(form.elements.available.checked));
      body.append('removeImage', String(Boolean(form.elements.removeImage?.checked)));
      if (file) body.append('image', file);
      await API.request('/food-items' + (item ? '/' + item.id : ''), item ? 'PATCH' : 'POST', body);
      await App.commit(); UI.toast('Food item saved.');
    }
  });
};

FoodAvailability.actions['add-food'] = () => FoodAvailability.openForm();
FoodAvailability.actions['edit-food'] = data => FoodAvailability.openForm(data.id);
FoodAvailability.actions['delete-food'] = async data => {
  if (!await UI.confirm({ title: 'Delete food item?', message: 'Items with order history cannot be deleted. Mark those items out of stock instead.', confirmLabel: 'Delete', danger: true })) return;
  await API.request('/food-items/' + data.id, 'DELETE');
  await App.commit(); UI.toast('Food item deleted.');
};
