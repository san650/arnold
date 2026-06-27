# Cucumber + Playwright support for the Arnold e2e suite.
#
# Browser automation talks to a standalone Playwright server. Before running:
#
#   npx playwright install
#   npx playwright run-server --port 8080 --path /ws
#
# Then:  bundle exec cucumber
#
# The endpoint is overridable with PLAYWRIGHT_WS.

require 'rspec/expectations'
require 'playwright'
require 'webrick'
require 'socket'

# ---------------------------------------------------------------------------
# Static server over docs/ (the deployable app), on a free port.
# ---------------------------------------------------------------------------

DOCS_DIR = File.expand_path('../../../../docs', __FILE__)

def free_port
  s = TCPServer.new('127.0.0.1', 0)
  port = s.addr[1]
  s.close
  port
end

APP_PORT = free_port
APP_BASE = "http://127.0.0.1:#{APP_PORT}"

mime = WEBrick::HTTPUtils::DefaultMimeTypes.dup
mime['js'] = 'text/javascript'
mime['mjs'] = 'text/javascript'
mime['json'] = 'application/json'
mime['svg'] = 'image/svg+xml'
mime['webmanifest'] = 'application/manifest+json'

WEBRICK = WEBrick::HTTPServer.new(
  BindAddress: '127.0.0.1',
  Port: APP_PORT,
  DocumentRoot: DOCS_DIR,
  MimeTypes: mime,
  Logger: WEBrick::Log.new(File::NULL),
  AccessLog: [],
)
Thread.new { WEBRICK.start }
at_exit { WEBRICK.shutdown }

# ---------------------------------------------------------------------------
# Playwright connection (kept alive across scenarios). `connect_to_browser_server`
# is block-scoped, so a worker thread holds the block open until the suite ends.
# The endpoint is printed by `npx playwright launch-server` and passed in via
# PLAYWRIGHT_WS (run.rb wires this up automatically).
# ---------------------------------------------------------------------------

WS_ENDPOINT = ENV.fetch('PLAYWRIGHT_WS') do
  abort('PLAYWRIGHT_WS is not set. Run via `ruby run.rb`, or start ' \
        '`npx playwright launch-server --browser chromium` and export its ws endpoint.')
end

_ready = Queue.new
$_pw_shutdown = Queue.new

Thread.new do
  begin
    Playwright.connect_to_browser_server(WS_ENDPOINT) do |browser|
      _ready << browser
      $_pw_shutdown.pop # block until the suite finishes
    end
  rescue => e
    _ready << e
  end
end

BROWSER = _ready.pop
if BROWSER.is_a?(Exception)
  warn <<~MSG
    Could not connect to the Playwright browser server at #{WS_ENDPOINT}.
    Start it with:  npx playwright install && npx playwright launch-server --browser chromium
    (#{BROWSER.class}: #{BROWSER.message})
  MSG
  exit 2
end

at_exit { $_pw_shutdown << :stop }

# ---------------------------------------------------------------------------
# World: per-scenario page + app-driving helpers.
# ---------------------------------------------------------------------------

module AppWorld
  attr_reader :page

  # Load the app at a hash route and wait until it has rendered.
  def open_app(hash = '')
    @page.goto("#{APP_BASE}/index.html#{hash}")
    @page.wait_for_selector('.bottom-bar, .motivation', timeout: 10_000)
    @page
  end

  def wait_for(selector, timeout: 8_000)
    @page.wait_for_selector(selector, timeout: timeout)
  end

  def click(selector)
    @page.click(selector)
  end

  # Tap a button by its accessible name (visible text or aria-label).
  def tap_button(name, exact: true)
    @page.get_by_role('button', name: name, exact: exact).first.click
  end

  # Set a field's value and fire `change` (the app commits on change, not input).
  def set_field(selector, value)
    @page.eval_on_selector(selector, <<~JS, arg: value)
      (el, value) => { el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); }
    JS
  end

  def count(selector)
    @page.query_selector_all(selector).length
  end

  def visible?(selector)
    !@page.query_selector(selector).nil?
  end

  def body_text
    @page.evaluate('() => document.body.innerText')
  end

  # Case-insensitive: some UI text is uppercased via CSS `text-transform`, which
  # `innerText` reflects, so we compare case-folded.
  def has_text?(str)
    body_text.downcase.include?(str.downcase)
  end

  # The persisted document, read straight from IndexedDB.
  def app_doc
    @page.evaluate(<<~JS)
      () => new Promise((resolve) => {
        const req = indexedDB.open('arnold');
        req.onsuccess = () => {
          const tx = req.result.transaction('state', 'readonly').objectStore('state').get('app');
          tx.onsuccess = () => resolve(tx.result && tx.result.state ? tx.result.state.doc : null);
          tx.onerror = () => resolve(null);
        };
        req.onerror = () => resolve(null);
      })
    JS
  end

  def routine(doc, id)
    doc['routines'].find { |r| r['id'] == id }
  end

  def catalog_entry(doc, name)
    doc['catalog'].find { |c| c['name'] == name }
  end

  # True when a routine holds a reference to a catalog entry of the given name.
  def routine_references?(doc, routine_id, exercise_name)
    r = routine(doc, routine_id)
    return false unless r
    ids = doc['catalog'].select { |c| c['name'] == exercise_name }.map { |c| c['id'] }
    r['exercises'].any? { |e| ids.include?(e['catalogId']) }
  end

  # Persistence is async after a dispatch — poll the doc until `block` holds
  # (or timeout), returning the last-read doc for the assertion to inspect.
  def wait_doc(timeout: 5)
    deadline = Time.now + timeout
    last = app_doc
    until block_given? && yield(last)
      break if Time.now > deadline
      sleep 0.1
      last = app_doc
    end
    last
  end
end

World(RSpec::Matchers)
World(AppWorld)

# Fresh, isolated browser context per scenario → empty storage → app seeds.
Before do
  @context = BROWSER.new_context
  @page = @context.new_page
end

After do
  @context&.close
end
