# Navigation -----------------------------------------------------------------

Given('I open the app') { open_app('') }
Given('I am on the home screen') { open_app('') }
Given('I open the catalog') { open_app('#/catalog') }
Given('I open the progress screen') { open_app('#/dashboard') }
Given('I open the routines editor') do
  open_app('#/edit')
  wait_for(data_test('routines-editor'))
end
Given('I open the routine editor for {string}') do |routine_id|
  open_app("#/workout/#{routine_id}/edit")
  wait_for("#{data_test('exercise-card')}, .empty-state")
end
Given('I open the routine {string}') do |name|
  open_app('')
  # Scope to the routine card so the click targets the card, not stray text.
  @page.locator(%(#{data_test('routine-card')}:has-text("#{name}"))).first.click
  wait_for('.exercise, .rest-card')
end
Given('I open the log') do
  open_app('#/log')
end

# Generic interaction ---------------------------------------------------------

When('I tap {string}') { |label| tap_button(label) }
When('I tap the title') { click('[data-tap-title]') }
When('I tap to return') { click('.motivation') }
When('I undo') { click('[data-action="undo"]') }
When('I redo') { click('[data-action="redo"]') }

Then('I cannot redo') do
  disabled = @page.eval_on_selector('[data-action="redo"]', '(el) => !!el.disabled')
  expect(disabled).to be(true)
end

When('I confirm the dialog') do
  wait_for('.modal-wrap')
  click('.modal-wrap button[data-modal-action="confirm"]')
end
When('I cancel the dialog') do
  wait_for('.modal-wrap')
  # Scope to the button — the backdrop also carries data-modal-action="cancel".
  click('.modal-wrap button[data-modal-action="cancel"]')
end

# Assertions ------------------------------------------------------------------

Then('I should see {string}') do |text|
  ok = false
  20.times { (ok = has_text?(text)) ? break : sleep(0.1) }
  expect(ok).to be(true), %(expected the page to show "#{text}")
end

Then('I should not see {string}') do |text|
  expect(has_text?(text)).to be(false), %(expected the page NOT to show "#{text}")
end

Then('the dialog should mention {string}') do |text|
  wait_for('.modal-wrap')
  expect(body_text).to include(text)
end

Then('I should see {int} routines') do |n|
  expect(count(data_test('routine-card'))).to eq(n)
end

Then('the routine {string} is shown as a rest day') do |name|
  card = %(#{data_test('routine-card')}:has-text("#{name}"))
  wait_for(card)
  expect(@page.locator(card).first.inner_text.downcase).to include('día de descanso')
end

# Reordering (routines editor) ------------------------------------------------

When('I move the routine {string} below the routine {string}') do |from_id, to_id|
  list = data_test('routines-editor')
  ids = @page.eval_on_selector_all(
    %(#{list} [data-reorder-index]),
    '(els) => els.map((e) => e.getAttribute("data-routine-id"))',
  )
  reorder(list, ids.index(from_id), ids.index(to_id))
end

Then('routine number {int} should be {string} in storage') do |pos, id|
  doc = wait_doc { |d| d['routines'][pos - 1] && d['routines'][pos - 1]['id'] == id }
  expect(doc['routines'][pos - 1]['id']).to eq(id)
end
