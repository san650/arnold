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
# bracketed IPv6 `[::1]` endpoint). pgroup: the npx wrapper spawns the real
# node server, which spawns Chromium — teardown must signal the whole group or
# the grandchildren survive the run as orphans.
config = File.join(HERE, 'launch-server.json')
stdin, stdout, wait_thr = Open3.popen2e(
  'npx', '-y', "playwright@#{PW_VERSION}", 'launch-server', '--browser', 'chromium', '--config', config,
  pgroup: true
)
stdin.close

at_exit do
  pgid = begin
    Process.getpgid(wait_thr.pid)
  rescue Errno::ESRCH
    nil
  end
  if pgid
    Process.kill('-TERM', pgid) rescue nil
    unless wait_thr.join(5)
      Process.kill('-KILL', pgid) rescue nil
      wait_thr.join rescue nil
    end
  end
end

# launch-server prints its ws endpoint (ws://host:port/<guid>) on its first
# output line. Read with IO.select so a wedged npx (bad cache, stalled
# download) hits the 30s deadline instead of blocking in gets forever.
endpoint = nil
deadline = Time.now + 30
buf = +''
while Time.now < deadline && endpoint.nil?
  ready = IO.select([stdout], nil, nil, deadline - Time.now)
  break unless ready
  begin
    buf << stdout.read_nonblock(4096)
  rescue IO::WaitReadable
    next
  rescue EOFError
    break
  end
  endpoint = Regexp.last_match(1).strip if buf =~ %r{(ws://\S+)}
end
abort('✗ Playwright server did not print a ws endpoint within 30s') unless endpoint

# Drain remaining server output in the background so it never blocks.
Thread.new { stdout.each_line { |_l| } }

puts "▶ server ready at #{endpoint}"
puts '▶ running cucumber…'

ok = system({ 'PLAYWRIGHT_WS' => endpoint }, 'bundle', 'exec', 'cucumber', *ARGV, chdir: HERE)
exit(ok ? 0 : 1)
