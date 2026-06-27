# Catalog screen --------------------------------------------------------------

When('I enter catalog edit mode') do
  click('[data-go="#/catalog/edit"]')
  wait_for('.catalog-manage-row')
end

When('I search the catalog for {string}') do |query|
  @page.fill('#catalog-filter', query) # filter listens on `input`
end

When('I open the exercise {string}') do |name|
  @page.get_by_text(name, exact: true).first.click
  wait_for('.session-list, .detail-chart-wrap, .detail-chart-empty')
end

When('I tap the edit button') do
  @page.get_by_role('button', name: 'Editar ejercicio').first.click
  wait_for('.drawer')
end

When('I create a catalog exercise named {string}') do |name|
  click('.fab[data-add-catalog-exercise]')
  wait_for('#catalog-form')
  @page.fill('#cat-form-name', name)
  click('[data-catalog-form-submit="close"]')
  wait_for('.catalog-list')
end

When('I rename the catalog exercise {string} to {string}') do |old_name, new_name|
  # In edit mode the row navigates to the exercise's edit drawer.
  @page.get_by_role('button', name: old_name, exact: false).first.click
  wait_for('[data-cat-update][name="name"]')
  set_field('[data-cat-update][name="name"]', new_name)
end

When('I delete the catalog exercise {string}') do |name|
  click("[data-delete-catalog][data-name=\"#{name}\"]")
end

# Pick mode (from a routine editor) ------------------------------------------

When('I tap the add-exercise button') do
  click('[data-add-exercise]')
  wait_for('[data-pick-catalog]')
end

When('I pick {string} from the catalog') do |name|
  click("[data-pick-catalog][data-name=\"#{name}\"]")
  wait_for('.drawer')
end

# Assertions ------------------------------------------------------------------

Then('the catalog should list {int} exercises') do |n|
  ok = false
  20.times { (ok = count('.catalog-list > li') == n) ? break : sleep(0.1) }
  expect(count('.catalog-list > li')).to eq(n)
end

Then('the catalog should contain {string} in storage') do |name|
  doc = wait_doc { |d| !catalog_entry(d, name).nil? }
  expect(catalog_entry(doc, name)).not_to be_nil
end

Then('the catalog should not contain {string} in storage') do |name|
  doc = wait_doc { |d| catalog_entry(d, name).nil? }
  expect(catalog_entry(doc, name)).to be_nil
end
