const assert = require("assert");
const { validateDataContract } = require("./TestDataContract.cjs");

function buildLoginContract() {
  return {
    scenario: "Login",
    inputs: [
      { name: "Username", required: true, type: "string" },
      { name: "Password", required: true, type: "string" }
    ]
  };
}

function testPassWhenRequiredKeysAndTypesMatch() {
  const contract = buildLoginContract();
  const data = {
    Username: "testuser",
    Password: "Password123"
  };

  const result = validateDataContract(contract, data);
  assert.strictEqual(result.dataContract.status, "PASS");
  assert.strictEqual(result.dataContract.blocking, false);
  assert.deepStrictEqual(result.dataContract.missingKeys, []);
  assert.deepStrictEqual(result.dataContract.typeErrors, []);
}

function testBlockedWhenRequiredKeyMissing() {
  const contract = buildLoginContract();
  const data = {
    Username: "testuser"
  };

  const result = validateDataContract(contract, data);
  assert.strictEqual(result.dataContract.status, "BLOCKED");
  assert.strictEqual(result.dataContract.blocking, true);
  assert.deepStrictEqual(result.dataContract.missingKeys, ["Password"]);
}

function testBlockedWhenTypeMismatch() {
  const contract = {
    scenario: "CreateOrder",
    inputs: [
      { name: "LoanCount", required: true, type: "number" }
    ]
  };

  const data = {
    LoanCount: true
  };

  const result = validateDataContract(contract, data);
  assert.strictEqual(result.dataContract.status, "BLOCKED");
  assert.strictEqual(result.dataContract.typeErrors.length, 1);
  assert.strictEqual(result.dataContract.typeErrors[0].key, "LoanCount");
}

function testBlockedWhenRequiredValueEmpty() {
  const contract = buildLoginContract();
  const data = {
    Username: "testuser",
    Password: ""
  };

  const result = validateDataContract(contract, data);
  assert.strictEqual(result.dataContract.status, "BLOCKED");
  assert.strictEqual(result.dataContract.blocking, true);
}

function testWarningWhenOptionalKeyMissing() {
  const contract = {
    scenario: "Search",
    inputs: [
      { name: "SearchText", required: false, type: "string" }
    ]
  };

  const result = validateDataContract(contract, {});
  assert.strictEqual(result.dataContract.status, "WARNING");
  assert.strictEqual(result.dataContract.blocking, false);
}

function testWarningForExtraUnmappedKey() {
  const contract = buildLoginContract();
  const data = {
    Username: "testuser",
    Password: "Password123",
    Region: "US"
  };

  const result = validateDataContract(contract, data);
  assert.strictEqual(result.dataContract.status, "WARNING");
  assert.ok(result.dataContract.warnings.some((x) => x.includes("Extra/unmapped key 'Region'")));
}

function testBlockedWhenArrayExpectedButScalarProvided() {
  const contract = {
    scenario: "BulkAssign",
    inputs: [
      { name: "DealIds", required: true, type: "array" }
    ]
  };

  const data = {
    DealIds: "20386"
  };

  const result = validateDataContract(contract, data);
  assert.strictEqual(result.dataContract.status, "BLOCKED");
  assert.strictEqual(result.dataContract.blocking, true);
}

function testBlockedWhenScalarExpectedButMultipleProvided() {
  const contract = {
    scenario: "Login",
    inputs: [
      { name: "Username", required: true, type: "string" }
    ]
  };

  const data = {
    Username: ["user1", "user2"]
  };

  const result = validateDataContract(contract, data);
  assert.strictEqual(result.dataContract.status, "BLOCKED");
  assert.strictEqual(result.dataContract.blocking, true);
}

function runAllTests() {
  testPassWhenRequiredKeysAndTypesMatch();
  testBlockedWhenRequiredKeyMissing();
  testBlockedWhenTypeMismatch();
  testBlockedWhenRequiredValueEmpty();
  testWarningWhenOptionalKeyMissing();
  testWarningForExtraUnmappedKey();
  testBlockedWhenArrayExpectedButScalarProvided();
  testBlockedWhenScalarExpectedButMultipleProvided();
  console.log("TestDataContract tests passed");
}

if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests
};
