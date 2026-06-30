@catalog
Feature: Managing the catalog
  As a lifter
  I want to create, rename, and delete exercises in the catalog

  Background:
    Given I am managing the catalog

  Scenario: Creating a new exercise
    When I create the exercise "Dominadas"
    Then the catalog should list 19 exercises
    And the catalog should contain "Dominadas" in storage

  Scenario: Renaming an exercise propagates to its routines
    When I rename the exercise "Press de banca con barra" to "Press de banca"
    Then routine "day1" should reference "Press de banca" in storage

  Scenario: Deleting an in-use exercise cascades and can be undone
    When I delete the exercise "Sentadilla con barra"
    Then the dialog should mention "Día 02, Día 05"
    When I confirm the dialog
    Then the catalog should list 17 exercises
    And routine "day2" should not reference "Sentadilla con barra" in storage
    When I undo
    Then the catalog should list 18 exercises
    And routine "day2" should reference "Sentadilla con barra" in storage
