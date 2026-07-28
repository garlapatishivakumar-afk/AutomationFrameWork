Feature: View Deal

Scenario: View deal details from deals completion status
    Given user navigates to deals page
    When user clicks on Deals Completion Status
    And user enters deal TID "1155aofa"
    And user presses Enter to search
    And user clicks on deal "1155AOFA"
    And user checks report action checkboxes
    And user clicks view report link
    Then user verifies deal report is displayed
    And user clicks complete action
    And user closes the screen
