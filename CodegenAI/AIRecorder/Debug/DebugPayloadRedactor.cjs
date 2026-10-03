function redactString(value) {
  return String(value || "")
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, "Bearer [REDACTED]")
    .replace(/(api[_-]?key\s*[=:]\s*)([^\s,;]+)/gi, "$1[REDACTED]")
    .replace(/(password\s*[=:]\s*)([^\s,;]+)/gi, "$1[REDACTED]")
    .replace(/(authorization\s*[=:]\s*)([^\s,;]+)/gi, "$1[REDACTED]")
    .replace(/(cookie\s*[=:]\s*)([^\n]+)/gi, "$1[REDACTED]")
    .replace(/(access[_-]?token\s*[=:]\s*)([^\s,;]+)/gi, "$1[REDACTED]")
    .replace(/(client[_-]?secret\s*[=:]\s*)([^\s,;]+)/gi, "$1[REDACTED]");
}

function shouldRedactKey(key) {
  return /(password|secret|token|authorization|cookie|api.?key|connection.?string|session|storage.?state)/i.test(String(key || ""));
}

function sanitize(value, keyHint) {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return shouldRedactKey(keyHint) ? "[REDACTED]" : redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, keyHint));
  }

  if (typeof value === "object") {
    const output = {};
    for (const [key, innerValue] of Object.entries(value)) {
      output[key] = shouldRedactKey(key) ? "[REDACTED]" : sanitize(innerValue, key);
    }
    return output;
  }

  return value;
}

module.exports = {
  sanitize
};