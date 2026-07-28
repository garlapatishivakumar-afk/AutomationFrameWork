Feature: View Loan Reconciliation

Scenario: View loan reconciliation from work queue
    Given user navigates to WhoIam page
    When user selects employee code "T10748"
    And user runs as selected user
    And user navigates to work queue page
    And user opens Loan Mgmt and searches cash management account "4113002786"
    And user opens View Recon popup
    Then user gets reconciliation from popup
