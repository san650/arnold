# Backup / restore (kebab menu) -----------------------------------------------
#
# Export, import, and reset all hang off the "Más opciones" menu. The menu
# mechanics and the browser file/download plumbing stay here.

require 'json'
require 'tmpdir'

def open_menu
  click('[data-action="menu"]')
  wait_for('.drawer-menu')
end

When('I reset to the starter routines') do
  open_menu
  click('[data-action="reset"]')
  wait_for('.modal-wrap')
  click('.modal-wrap [data-modal-action="confirm"]')
end

When('I import the file {string}') do |name|
  path = File.expand_path("../../support/fixtures/#{name}", __FILE__)
  chooser = @page.expect_file_chooser do
    open_menu
    click('[data-action="import"]')
  end
  chooser.set_files(path)
end

When('I export the configuration') do
  @download = @page.expect_download do
    open_menu
    click('[data-action="export"]')
  end
end

Then('a file named like {string} should download') do |prefix|
  expect(@download.suggested_filename).to start_with(prefix)
end

# Round-trip check: the export's *content* is what a later import relies on.
# (save_as: Download#path is unavailable over a browser-server connection.)
Then('the exported file should contain {int} routines') do |n|
  path = File.join(Dir.mktmpdir, @download.suggested_filename)
  @download.save_as(path)
  doc = JSON.parse(File.read(path))
  expect(doc['routines'].length).to eq(n)
end
