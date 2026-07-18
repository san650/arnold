require 'date'

# Day view: history fixtures --------------------------------------------------

def date_ago(n)
  (Date.today - n).strftime('%Y-%m-%d')
end

# Squats (day2) on two past days: 80 kg ×8 ×3 nine days ago, 85 kg ×8 ×3 two
# days ago → the later day is a PR (85 > 80) with a +6% volume delta
# (2040 vs 1920), and the gap exercises the rest-day-skipping navigation.
Given('a recorded squat history') do
  d9 = date_ago(9)
  d2 = date_ago(2)
  inject_doc(<<~JS)
    (doc) => {
      const snap = (w) => ({
        name: 'Sentadilla con barra', kind: 'reps', unit: 'kg',
        series: [{ weight: w, reps: 8 }, { weight: w, reps: 8 }, { weight: w, reps: 8 }],
        category: 'piernas', routineId: 'day2',
      });
      doc.sessions['#{d9}'] = { d2e1: { sets: [true, true, true], snapshot: snap(80) } };
      doc.sessions['#{d2}'] = { d2e1: { sets: [true, true, true], snapshot: snap(85) } };
    }
  JS
end

# A pre-normalization session frozen in pounds (100 lb ×5, one set done):
# 45.4 kg ×5 → the day must sum it as 227 kg.
Given('a legacy history recorded in pounds') do
  d4 = date_ago(4)
  inject_doc(<<~JS)
    (doc) => {
      doc.sessions['#{d4}'] = { d4e5: { sets: [true], snapshot: {
        name: 'Curl de bíceps alterno con mancuernas', kind: 'reps', unit: 'lb',
        series: [{ weight: 100, reps: 5 }], routineId: 'day4',
      } } };
    }
  JS
end

Given('my routine measures the first exercise in pounds') do
  inject_doc(<<~JS)
    (doc) => {
      doc.catalog.find((c) => c.id === 'cat-deadlift').unit = 'lb';
      const inst = doc.routines.find((r) => r.id === 'day4').exercises[0];
      inst.series = inst.series.map(() => ({ weight: 100, reps: 5 }));
    }
  JS
end

# Day view: navigation --------------------------------------------------------

When('I open today in the activity calendar') do
  click(%(button.heatmap-cell[data-date="#{date_ago(0)}"]))
end

When('I open yesterday in the activity calendar') do
  click(%(button.heatmap-cell[data-date="#{date_ago(1)}"]))
end

When('I open the day from {int} days ago') do |n|
  open_app("#/dashboard/day/#{date_ago(n)}")
end

When('I open an invalid day link') do
  open_app('#/dashboard/day/not-a-date')
end

When('I go to the previous training day') do
  click(data_test('day-prev'))
end

Then('tomorrow is not tappable in the activity calendar') do
  tomorrow = (Date.today + 1).strftime('%Y-%m-%d')
  # Future cells render as inert <div>s (or not at all late in the week) —
  # either way there must be no button for the date.
  expect(count(%(button.heatmap-cell[data-date="#{tomorrow}"]))).to eq(0)
end

# Hash navigation renders on the next task, so poll instead of reading the
# possibly pre-navigation DOM.
def eventually
  ok = false
  20.times do
    ok = yield
    break if ok
    sleep 0.1
  end
  ok
end

Then('the next training day control should be disabled') do
  ok = eventually { @page.eval_on_selector(data_test('day-next'), '(el) => !!el.disabled') }
  expect(ok).to be(true), 'expected the next-day control to be disabled'
end

Then('the previous training day control should be disabled') do
  ok = eventually { @page.eval_on_selector(data_test('day-prev'), '(el) => !!el.disabled') }
  expect(ok).to be(true), 'expected the previous-day control to be disabled'
end

# Day view: content -----------------------------------------------------------

Then('the day view should list {string}') do |name|
  wait_for(data_test('day-exercise'))
  rows = @page.locator(%(#{data_test('day-exercise')}:has-text("#{name}")))
  expect(rows.count).to be > 0
end

Then('the day view should show a rest day') do
  wait_for(data_test('day-rest'))
end

Then('the day metrics should include {string}') do |text|
  wait_for(data_test('day-metrics'))
  ok = eventually { @page.locator(data_test('day-metrics')).inner_text.include?(text) }
  expect(ok).to be(true), %(expected the day metrics to include "#{text}")
end

Then('the day view should show the muscle group {string}') do |label|
  wait_for('.day-cats')
  expect(@page.locator('.day-cats').inner_text.downcase).to include(label.downcase)
end

Then('the exercise {string} should be marked as a personal record') do |name|
  row = %(#{data_test('day-exercise')}:has-text("#{name}"))
  wait_for(row)
  expect(@page.locator(%(#{row} #{data_test('pr-badge')})).count).to eq(1)
end

Then('the routine comparison should show {string}') do |text|
  wait_for(data_test('day-delta'))
  expect(@page.locator(data_test('day-delta')).inner_text).to include(text)
end

Then('the stored session should record the weight in kilograms') do
  doc = wait_doc do |d|
    entry = (d['sessions'] || {}).values.map { |day| day['d4e1'] }.compact.first
    snap = entry && entry['snapshot']
    snap && snap['unit'] == 'kg' && snap['series'][0]['weight'] == 45.4
  end
  expect(doc).not_to be_nil
end
