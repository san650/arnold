# Dashboard: activity calendar -------------------------------------------------

Then('the activity calendar should show the days of the week') do
  wait_for('.heatmap')
  # innerText reflects the CSS uppercase transform, so compare case-insensitively.
  labels = @page.locator('.heatmap-dow').all_inner_texts.map(&:downcase)
  expect(labels).to eq(%w[lu ma mi ju vi sa do])
end

Then('today should be marked in the activity calendar') do
  today = Time.now.strftime('%Y-%m-%d')
  expect(count(%(.heatmap-cell.today[data-date="#{today}"]))).to eq(1)
end
