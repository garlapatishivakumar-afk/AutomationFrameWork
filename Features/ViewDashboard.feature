Feature: View Dashboard

Scenario: View dashboard and reassign package
    Given user navigates to document administration page
    When user clicks on Administration link
    And user clicks on Reassign Packages link
    And user selects search user "T11542"
    And user clicks Search Queue button
    And user selects first package from queue
    And user selects assign user "T11542"
    And user clicks Assign to Selected User button
    And user clicks Dashboard link
    And user navigates to default dashboard page
    And user selects package source "569"
    Then user re-navigates to default dashboard page