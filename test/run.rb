#!/usr/bin/env ruby
# frozen_string_literal: true

# Run the Arnold e2e suite end-to-end: start a Playwright browser server, run
# Cucumber against it, then tear the server down. Extra arguments pass through
# to cucumber (e.g. `ruby run.rb features/catalog.feature`).
#
#   ruby run.rb
#   ruby run.rb features/catalog.feature
#
# Requires (once):  bundle install  &&  npx playwright install chromium
#
# Note: playwright-ruby-client >= 1.54 connects to a *browser* server
# (`launch-server`), which replaced the older `run-server` endpoint.

require 'open3'

PW_VERSION = ENV.fetch('PLAYWRIGHT_VERSION', '1.60.0') # match playwright-ruby-client
HERE = __dir__

puts "▶ starting Playwright #{PW_VERSION} browser server…"
# The config pins the server to IPv4 127.0.0.1 (the Ruby client can't resolve a
# bracketed IPv6 `[::1]` endpoint).
config = File.join(HERE, 'launch-server.json')
stdin, stdout, wait_thr = Open3.popen2e(
  'npx', '-y', "playwright@#{PW_VERSION}", 'launch-server', '--browser', 'chromium', '--config', config
)
stdin.close

at_exit do
  Process.kill('TERM', wait_thr.pid) rescue nil
  wait_thr.join rescue nil
end

# launch-server prints its ws endpoint (ws://host:port/<guid>) on the first line.
endpoint = nil
deadline = Time.now + 30
while Time.now < deadline
  line = stdout.gets
  break if line.nil?
  if line =~ %r{(ws://\S+)}
    endpoint = Regexp.last_match(1).strip
    break
  end
end
abort('✗ Playwright server did not print a ws endpoint') unless endpoint

# Drain remaining server output in the background so it never blocks.
Thread.new { stdout.each_line { |_l| } }

puts "▶ server ready at #{endpoint}"
puts '▶ running cucumber…'

ok = system({ 'PLAYWRIGHT_WS' => endpoint }, 'bundle', 'exec', 'cucumber', *ARGV, chdir: HERE)
exit(ok ? 0 : 1)
