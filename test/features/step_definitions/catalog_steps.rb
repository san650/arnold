# Catalog screen --------------------------------------------------------------
#
# Selectors prefer stable `[data-test-id=...]` hooks over structural CSS so the
# tests don't break when the markup is restyled or reorganized. Feature files
# stay declarative — the UI mechanics (edit mode, drawers) live only here.

Given('I am managing the catalog') do
  open_app('#/catalog/edit')
  wait_for(data_test('catalog-delete'))
end

When('I search the catalog for {string}') do |query|
  @page.fill(data_test('catalog-search'), query) # filter listens on `input`
end

When('I open the exercise {string}') do |name|
  # Scope to the entry's card rather than navigating by free text — a catalog
  # row or, on the progress screen, a latest-exercise card.
  row = %(#{data_test('catalog-item')}:has-text("#{name}"), #{data_test('latest-card')}:has-text("#{name}"))
  @page.locator(row).first.click
  wait_for(data_test('exercise-detail'))
end

When('I start editing the exercise') do
  @page.get_by_role('button', name: 'Editar ejercicio').first.click
  wait_for('.drawer')
end

# Create / rename / delete (catalog edit mode) --------------------------------

When('I create the exercise {string}') do |name|
  click(data_test('catalog-create'))
  wait_for(data_test('catalog-form'))
  @page.fill('#cat-form-name', name)
  click('[data-catalog-form-submit="close"]')
  wait_for(data_test('catalog-item'))
end

When('I rename the exercise {string} to {string}') do |old_name, new_name|
  # In edit mode the row navigates to the exercise's edit drawer. Scope to the
  # catalog row — its accessible name also carries the usage chips, so an
  # exact role lookup can't match and substring lookups are banned.
  @page.locator(%(#{data_test('catalog-item')}:has-text("#{old_name}") .catalog-row)).first.click
  wait_for('[data-cat-update][name="name"]')
  set_field('[data-cat-update][name="name"]', new_name)
end

When('I delete the exercise {string}') do |name|
  click(%([data-action="delete-catalog"][data-name="#{name}"]))
end

# Assertions ------------------------------------------------------------------

Then('the catalog should list {int} exercises') do |n|
  ok = false
  20.times { (ok = count(data_test('catalog-item')) == n) ? break : sleep(0.1) }
  expect(count(data_test('catalog-item'))).to eq(n)
end

Then('the catalog should contain {string} in storage') do |name|
  doc = wait_doc { |d| !catalog_entry(d, name).nil? }
  expect(catalog_entry(doc, name)).not_to be_nil
end

Then('the catalog should not contain {string} in storage') do |name|
  doc = wait_doc { |d| catalog_entry(d, name).nil? }
  expect(catalog_entry(doc, name)).to be_nil
end
