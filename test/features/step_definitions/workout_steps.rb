# Workout logging -------------------------------------------------------------

When('I mark the first set complete') do
  @page.locator(data_test('set-toggle')).first.click
end

Then('the day progress should be {string}') do |progress|
  ok = false
  20.times { (ok = has_text?(progress)) ? break : sleep(0.1) }
  expect(ok).to be(true), %(expected progress "#{progress}")
end

Then('the workout should have {int} completed set in storage') do |n|
  doc = wait_doc { |d| completed_sets(d) == n }
  expect(completed_sets(doc)).to eq(n)
end

# Routines editor -------------------------------------------------------------

When('I rename the routine {string} to {string}') do |routine_id, new_name|
  set_field(%([data-rename-routine][data-routine="#{routine_id}"]), new_name)
end

When('I add a routine named {string}') do |name|
  click('[data-action="add-routine"]')
  wait_for('#new-routine-form')
  @page.fill('#new-routine-name', name)
  click('#new-routine-form button[type="submit"]')
  wait_for(data_test('routines-editor'))
end

When('I delete the routine {string}') do |routine_id|
  click(%([data-action="remove-routine"][data-routine="#{routine_id}"]))
end

# Routine exercise editing ----------------------------------------------------

When('I add the exercise {string} to the routine') do |name|
  click('[data-action="add-exercise"]')
  wait_for('[data-action="pick-catalog"]')
  click(%([data-action="pick-catalog"][data-name="#{name}"]))
  wait_for(data_test('editor-drawer'))
end

When('I remove the first exercise') do
  @page.locator('[data-action="remove-exercise"]').first.click
end

When('I move the first exercise below the second') do
  reorder('[data-reorder-kind="exercise"]', 0, 1)
end

When('I open the editor for the first exercise') do
  @page.locator('[data-action="edit-exercise"]').first.click
  wait_for(data_test('editor-drawer'))
end

When('I set the first series to {string} by {string}') do |weight, reps|
  set_field('[data-update][name="series-weight"][data-set-index="0"]', weight)
  set_field('[data-update][name="series-reps"][data-set-index="0"]', reps)
end

When('I change the series count by {int}') do |delta|
  step = delta.negative? ? '-1' : '1'
  delta.abs.times { click(%([data-action="series-step"][data-series-step="#{step}"])) }
end

When('I change the exercise type to {string}') do |kind|
  @page.select_option('[data-update][name="kind"]', value: kind)
end

# Storage assertions ----------------------------------------------------------

Then('there should be {int} routines in storage') do |n|
  doc = wait_doc { |d| d && d['routines'].length == n }
  expect(doc['routines'].length).to eq(n)
end

# UI count — for no-op cases (e.g. a cancelled delete) where nothing is written
# to storage, so the on-screen list is the source of truth.
Then('the routines editor should list {int} routines') do |n|
  expect(count(%(#{data_test('routines-editor')} [data-routine-id]))).to eq(n)
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

Then('exercise {int} of routine {string} should be {string} in storage') do |pos, routine_id, name|
  doc = wait_doc { |d| exercise_name_at(d, routine_id, pos - 1) == name }
  expect(exercise_name_at(doc, routine_id, pos - 1)).to eq(name)
end

Then('exercise {int} of routine {string} should have {int} series in storage') do |pos, routine_id, n|
  doc = wait_doc { |d| (series_at(d, routine_id, pos - 1) || []).length == n }
  expect(series_at(doc, routine_id, pos - 1).length).to eq(n)
end

Then('the first series of routine {string} should be {string} by {string} in storage') do |routine_id, weight, reps|
  doc = wait_doc do |d|
    s = (series_at(d, routine_id, 0) || [])[0]
    s && s['weight'].to_f == weight.to_f && s['reps'].to_i == reps.to_i
  end
  s = series_at(doc, routine_id, 0)[0]
  expect(s['weight'].to_f).to eq(weight.to_f)
  expect(s['reps'].to_i).to eq(reps.to_i)
end

Then('the first series of routine {string} should have a duration in storage') do |routine_id|
  doc = wait_doc do |d|
    s = (series_at(d, routine_id, 0) || [])[0]
    s && s.key?('duration')
  end
  expect(series_at(doc, routine_id, 0)[0]).to have_key('duration')
end
