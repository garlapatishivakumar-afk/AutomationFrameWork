Feature: Inspections Create Order
  Scenario: Open CMBS create order entry point
    Given user navigates to inspections application
    When user opens CMBS module
    And user opens create order page
    Then create order entry point should be visible
