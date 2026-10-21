const Status = {
  PASS: "PASS",
  WARNING: "WARNING",
  BLOCKED: "BLOCKED"
};

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isNullOrEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

function inferValueType(value) {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null || value === undefined) {
    return "null";
  }

  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return type;
  }

  return "object";
}

function normalizeExpectedType(type) {
  const normalized = String(type || "string").trim().toLowerCase();
  if (["string", "number", "boolean", "array"].includes(normalized)) {
    return normalized;
  }

  return "string";
}

function indexDataByNormalizedKey(data) {
  const indexed = new Map();
  const source = data && typeof data === "object" ? data : {};

  for (const [key, value] of Object.entries(source)) {
    indexed.set(normalizeKey(key), { key, value });
  }

  return indexed;
}

function validateSingleInput(input, dataEntry) {
  const inputName = String(input && input.name ? input.name : "").trim();
  const required = input && input.required !== false;
  const expectedType = normalizeExpectedType(input && input.type ? input.type : "string");
  const expectsMultiple = Boolean(input && input.multiple === true) || expectedType === "array";

  if (!dataEntry) {
    if (required) {
      return {
        status: Status.BLOCKED,
        message: `Required key '${inputName}' is missing.`,
        missingKey: inputName
      };
    }

    return {
      status: Status.WARNING,
      message: `Optional key '${inputName}' is missing.`
    };
  }

  const value = dataEntry.value;

  if (required && isNullOrEmpty(value)) {
    return {
      status: Status.BLOCKED,
      message: `Required key '${inputName}' is null or empty.`
    };
  }

  const actualType = inferValueType(value);

  if (expectsMultiple) {
    if (!Array.isArray(value)) {
      return {
        status: Status.BLOCKED,
        message: `Key '${inputName}' expects array/list but received scalar.`
      };
    }
  } else if (Array.isArray(value)) {
    if (value.length > 1) {
      return {
        status: Status.BLOCKED,
        message: `Key '${inputName}' expects scalar but received multiple values.`
      };
    }

    return {
      status: Status.BLOCKED,
      message: `Key '${inputName}' expects scalar but received array.`
    };
  }

  if (!expectsMultiple && expectedType !== "array") {
    if (expectedType === "number" && actualType === "string") {
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        return {
          status: Status.PASS,
          message: `Key '${inputName}' type matched by numeric coercion.`
        };
      }
    }

    if (expectedType !== actualType) {
      return {
        status: Status.BLOCKED,
        message: `Key '${inputName}' type mismatch. Expected ${expectedType}, got ${actualType}.`,
        typeError: {
          key: inputName,
          expected: expectedType,
          actual: actualType
        }
      };
    }
  }

  return {
    status: Status.PASS,
    message: `Key '${inputName}' is valid.`
  };
}

function aggregateStatus(results) {
  if (results.some((x) => x.status === Status.BLOCKED)) {
    return Status.BLOCKED;
  }

  if (results.some((x) => x.status === Status.WARNING)) {
    return Status.WARNING;
  }

  return Status.PASS;
}

function validateDataContract(contract, data) {
  const inputs = Array.isArray(contract && contract.inputs) ? contract.inputs : [];
  const indexedData = indexDataByNormalizedKey(data);
  const results = [];
  const missingKeys = [];
  const typeErrors = [];
  const warnings = [];
  const mappedNormalizedKeys = new Set();

  for (const input of inputs) {
    const normalizedName = normalizeKey(input && input.name ? input.name : "");
    const matched = indexedData.get(normalizedName);
    const validation = validateSingleInput(input || {}, matched);

    if (matched) {
      mappedNormalizedKeys.add(normalizedName);
    }

    if (validation.missingKey) {
      missingKeys.push(validation.missingKey);
    }

    if (validation.typeError) {
      typeErrors.push(validation.typeError);
    }

    if (validation.status === Status.WARNING || validation.status === Status.BLOCKED) {
      warnings.push(validation.message);
    }

    results.push({
      input: input && input.name ? input.name : "",
      status: validation.status,
      message: validation.message
    });
  }

  for (const [normalizedKey, entry] of indexedData.entries()) {
    if (!mappedNormalizedKeys.has(normalizedKey)) {
      const warning = `Extra/unmapped key '${entry.key}' found in data source.`;
      results.push({
        input: entry.key,
        status: Status.WARNING,
        message: warning
      });
      warnings.push(warning);
    }
  }

  const status = aggregateStatus(results);
  const blocking = status === Status.BLOCKED;

  return {
    dataContract: {
      scenario: contract && contract.scenario ? contract.scenario : "",
      inputs: inputs.map((input) => ({
        name: String(input && input.name ? input.name : ""),
        required: input && input.required !== false,
        type: normalizeExpectedType(input && input.type ? input.type : "string"),
        multiple: Boolean(input && input.multiple === true)
      })),
      status,
      blocking,
      missingKeys,
      typeErrors,
      warnings,
      results
    }
  };
}

module.exports = {
  Status,
  validateDataContract
};
