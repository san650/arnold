@builder
Feature: Building the week
  As a lifter
  I want a guided flow to set up each day of my week

  Background:
    Given I start building my week

  Scenario: Renaming a day
    When I rename the day to "Lunes de Empuje"
    Then routine "day1" should be named "Lunes de Empuje"

  Scenario: Adding an exercise to a day
    When I add the exercise "Peso muerto con barra" in the builder
    Then routine "day1" should reference "Peso muerto con barra" in storage
    And routine "day1" should have 6 exercises in storage

  Scenario: Moving to the next day and finishing
    When I go to the next day
    Then I should see "Paso 2 de 7"
    When I finish building
    Then I should see "Rutinas"
