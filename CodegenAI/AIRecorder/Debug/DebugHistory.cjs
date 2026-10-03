const fs = require("fs");
const path = require("path");

function appendHistory(historyFilePath, record) {
  const resolvedPath = historyFilePath || path.join(process.cwd(), "GeneratedOutput", "Debug", "DebugHistory.json");
  const existing = fs.existsSync(resolvedPath)
    ? JSON.parse(fs.readFileSync(resolvedPath, "utf8") || "[]")
    : [];

  existing.push(record);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, JSON.stringify(existing, null, 2), "utf8");
}

module.exports = {
  appendHistory
};