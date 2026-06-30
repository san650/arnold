# Workout logging -------------------------------------------------------------

When('I mark the first set complete') do
  @page.locator('[data-test-id="set-toggle"]').first.click
end

Then('the day progress should be {string}') do |progress|
  ok = false
  20.times { (ok = has_text?(progress)) ? break : sleep(0.1) }
  expect(ok).to be(true), %(expected progress "#{progress}")
end

Then('the workout should have {int} completed set in storage') do |n|
  doc = wait_doc do |d|
    (d['sessions'] || {}).values.sum { |day| day.values.sum { |e| (e['sets'] || []).count { |s| s } } } == n
  end
  total = (doc['sessions'] || {}).values.sum { |day| day.values.sum { |e| (e['sets'] || []).count { |s| s } } }
  expect(total).to eq(n)
end

# Routines editor -------------------------------------------------------------

When('I rename the routine {string} to {string}') do |routine_id, new_name|
  set_field("[data-rename-routine][data-routine=\"#{routine_id}\"]", new_name)
end

When('I add a routine named {string}') do |name|
  click('[data-add-routine]')
  wait_for('#new-routine-form')
  @page.fill('#new-routine-name', name)
  click('#new-routine-form button[type="submit"]')
  wait_for('[data-test-id="routines-editor"]')
end

When('I delete the routine {string}') do |routine_id|
  click("[data-remove-routine][data-routine=\"#{routine_id}\"]")
end

# Routine exercise editing ----------------------------------------------------

When('I remove the first exercise') do
  @page.locator('[data-remove-exercise]').first.click
end

# Storage assertions ----------------------------------------------------------

Then('there should be {int} routines in storage') do |n|
  doc = wait_doc { |d| d['routines'].length == n }
  expect(doc['routines'].length).to eq(n)
end

Then('routine {string} should be named {string}') do |routine_id, name|
  doc = wait_doc { |d| routine(d, routine_id) && routine(d, routine_id)['name'] == name }
  expect(routine(doc, routine_id)['name']).to eq(name)
end

Then('routine {string} should have {int} exercises in storage') do |routine_id, n|
  doc = wait_doc { |d| routine(d, routine_id) && routine(d, routine_id)['exercises'].length == n }
  expect(routine(doc, routine_id)['exercises'].length).to eq(n)
end

Then('routine {string} should reference {string} in storage') do |routine_id, name|
  doc = wait_doc { |d| routine_references?(d, routine_id, name) }
  expect(routine_references?(doc, routine_id, name)).to be(true)
end

Then('routine {string} should not reference {string} in storage') do |routine_id, name|
  doc = wait_doc { |d| !routine_references?(d, routine_id, name) }
  expect(routine_references?(doc, routine_id, name)).to be(false)
end
