# Guided week builder ---------------------------------------------------------
#
# The builder walks the user day by day. Feature files speak in days and
# exercises; the sheet/drawer mechanics stay here.

Given('I start building my week') do
  # The builder has its own chrome (no bottom bar), so navigate directly and
  # wait on a builder-specific element rather than open_app's default.
  @page.goto("#{APP_BASE}/index.html#/build/0")
  wait_for('.build-day')
end

When('I rename the day to {string}') do |name|
  set_field('.build-day-name', name)
end

When('I add the exercise {string} in the builder') do |name|
  click('[data-action="build-add"]')
  wait_for('.build-pick-drawer')
  @page.locator(%([data-action="build-pick-toggle"]:has-text("#{name}"))).first.click
  click('[data-action="build-pick-commit"]')
  wait_for('.build-day') # sheet closed, back on the day
end

When('I go to the next day') do
  tap_button('Siguiente')
end

When('I finish building') do
  @page.locator('[data-action="build-finish"]').first.click
end
