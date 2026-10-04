Feature: Deals Completion Status
  Scenario Outline: Update override details from deal report popup
    Given user navigates to investor reporting application
    When user opens deals completion status page
    And user opens the selected deal report
    And user opens override popup for selected amount
    And user updates override details with value <OverrideValue> and explanation <OverrideExplanation>
    Then user saves override changes

    Examples:
      | OverrideValue | OverrideExplanation |
      | 1324          | test                |
