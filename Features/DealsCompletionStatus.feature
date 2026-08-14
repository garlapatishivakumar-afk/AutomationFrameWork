Feature: Deals Completion Status

  Scenario: Search returns no records for an invalid transaction ID
    Given the user is on the deals completion status page
    When the user searches for transaction ID "1Lin04c3"
    Then the system should display no records for transaction ID "1Lin04c3"

  Scenario: Search and open a valid transaction from the completion status page
    Given the user is on the deals completion status page
    When the user searches for transaction ID "01cmlb1"
    Then the system should show the deal result for transaction ID "01CMLB1"
    When the user opens the deal report for transaction ID "01CMLB1"
    Then the system should display the transaction report for "01CMLB1"
