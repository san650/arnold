# Navigation -----------------------------------------------------------------

Given('I open the app') { open_app('') }
Given('I am on the home screen') { open_app('') }
Given('I open the catalog') { open_app('#/catalog') }
Given('I open the progress screen') { open_app('#/dashboard') }
Given('I open the routines editor') do
  open_app('#/edit')
  wait_for('.edit-list')
end
Given('I open the routine editor for {string}') do |routine_id|
  open_app("#/workout/#{routine_id}/edit")
  wait_for('.exercise, .empty-state')
end
Given('I open the routine {string}') do |name|
  open_app('')
  @page.get_by_text(name, exact: false).first.click
  wait_for('.exercise, .rest-card')
end

# Generic interaction ---------------------------------------------------------

When('I tap {string}') { |label| tap_button(label) }
When('I tap the title') { click('[data-tap-title]') }
When('I tap to return') { click('.motivation') }
When('I undo') { click('[data-undo]') }
When('I redo') { click('[data-redo]') }

When('I confirm the dialog') do
  wait_for('.modal-wrap')
  click('.modal-wrap [data-modal-action="confirm"]')
end
When('I cancel the dialog') do
  wait_for('.modal-wrap')
  click('.modal-wrap [data-modal-action="cancel"]')
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
  expect(count('.routine-card')).to eq(n)
end
