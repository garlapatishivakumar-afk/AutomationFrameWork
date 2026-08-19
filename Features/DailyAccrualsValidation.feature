Feature: Daily Accruals Interest Validation
  As a QA analyst
  I want to validate that daily accrual calculations in the ideal file are correct
  Based on the actual transactions recorded in the source file

  Scenario Outline: Validate daily accruals match source transactions for the loan
    Given the source file "<sourceFile>" and ideal accruals file "<idealFile>" are loaded
    When the daily accruals are calculated from source transactions using business rules
    Then all principal balances should match the ideal file
    And all daily accrual interest amounts should match the ideal file
    And all accumulated interest values should match the ideal file
    And all compound interest values should match the ideal file
    And all total balances should match the ideal file
    And all advance and repayment amounts should match the ideal file
    And all overpayment balances should match the ideal file

  Examples:
    | sourceFile                             | idealFile                                                       | 
    |UAT Import All Adv_14July2026 (2).xlsx  | daily-accruals-detail_2025-03-01_to_2026-08-19_20540_10005.xlsx |
