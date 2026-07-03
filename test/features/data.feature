@data
Feature: Backing up and restoring data
  As a lifter
  I want to export, import, and reset my configuration

  Scenario: Resetting to the starter routines
    Given I open the routines editor
    And I delete the routine "day7"
    And I confirm the dialog
    Then there should be 6 routines in storage
    When I reset to the starter routines
    Then there should be 7 routines in storage

  Scenario: Importing replaces all routines
    Given I open the app
    When I import the file "two_routines.json"
    And I confirm the dialog
    Then there should be 2 routines in storage

  Scenario: Exporting downloads a backup file
    Given I open the app
    When I export the configuration
    Then a file named like "arnold-" should download

  Scenario: Exporting includes every routine
    Given I open the app
    When I export the configuration
    Then the exported file should contain 7 routines

  Scenario Outline: Importing a bad file shows an error and changes nothing
    Given I open the app
    When I import the file "<file>"
    Then the dialog should mention "Archivo inválido"

    Examples:
      | file         |
      | broken.json  |
      | invalid.json |

  Scenario: Importing clears the undo history
    Given I open the routine "Tren Superior (Empuje)"
    And I mark the first set complete
    When I import the file "two_routines.json"
    And I confirm the dialog
    Then there should be 2 routines in storage
    And I cannot undo
