using ClosedXML.Excel;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;

namespace AutomationFrameWork.Helpers
{
    public class ExcelUtility
    {
        private readonly string _filePath;

        public ExcelUtility(string filePath)
        {
            if (string.IsNullOrWhiteSpace(filePath))
                throw new ArgumentException("File path cannot be empty.");

            if (!File.Exists(filePath))
                throw new FileNotFoundException($"Excel file not found: {filePath}");

            _filePath = filePath;
        }

        public List<T> ReadAsList<T>(string sheetName) where T : new()
        {
            using var workbook = new XLWorkbook(_filePath);
            var worksheet = workbook.Worksheet(sheetName);

            if (worksheet == null)
                throw new Exception($"Worksheet '{sheetName}' not found.");

            var rows = worksheet.RowsUsed().ToList();
            if (!rows.Any())
                return new List<T>();

            var headerRow = rows.First();
            var properties = typeof(T).GetProperties(BindingFlags.Public | BindingFlags.Instance);

            var result = new List<T>();

            foreach (var row in rows.Skip(1))
            {
                var obj = new T();

                foreach (var prop in properties)
                {
                    var column = headerRow.Cells()
                        .FirstOrDefault(c =>
                            string.Equals(
                                c.GetString().Trim(),
                                prop.Name,
                                StringComparison.OrdinalIgnoreCase));

                    if (column == null)
                        continue;

                    var cellValue = row.Cell(column.Address.ColumnNumber).GetString().Trim();

                    if (string.IsNullOrEmpty(cellValue))
                        continue;

                    try
                    {
                        var convertedValue = Convert.ChangeType(cellValue, prop.PropertyType);
                        prop.SetValue(obj, convertedValue);
                    }
                    catch
                    {
                        continue;
                    }
                }

                result.Add(obj);
            }

            return result;
        }

        public Dictionary<string, string> ReadByTestCaseId(string sheetName, string testCaseId)
        {
            if (string.IsNullOrWhiteSpace(sheetName))
                throw new ArgumentException("Worksheet name cannot be empty.", nameof(sheetName));

            if (string.IsNullOrWhiteSpace(testCaseId))
                throw new ArgumentException("Test case ID cannot be empty.", nameof(testCaseId));

            using var workbook = new XLWorkbook(_filePath);
            if (!workbook.TryGetWorksheet(sheetName, out var worksheet))
                throw new InvalidOperationException($"Worksheet '{sheetName}' not found in '{_filePath}'.");

            var rows = worksheet.RowsUsed().ToList();
            if (!rows.Any())
                throw new InvalidOperationException($"Worksheet '{sheetName}' is empty; a TestCaseId column is required.");

            var columns = rows.First().CellsUsed()
                .Where(cell => !string.IsNullOrWhiteSpace(cell.GetString()))
                .Select(cell => new { Name = cell.GetString().Trim(), Index = cell.Address.ColumnNumber })
                .ToList();

            var duplicateColumn = columns.GroupBy(column => column.Name, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault(group => group.Count() > 1);
            if (duplicateColumn != null)
                throw new InvalidOperationException($"Worksheet '{sheetName}' has duplicate column '{duplicateColumn.Key}'.");

            var idColumn = columns.FirstOrDefault(column =>
                string.Equals(column.Name, "TestCaseId", StringComparison.OrdinalIgnoreCase));
            if (idColumn == null)
                throw new InvalidOperationException($"Worksheet '{sheetName}' has no TestCaseId column.");

            var matches = rows.Skip(1).Where(row => string.Equals(
                row.Cell(idColumn.Index).GetString().Trim(), testCaseId.Trim(),
                StringComparison.OrdinalIgnoreCase)).ToList();

            if (matches.Count == 0)
                throw new InvalidOperationException($"No row for TestCaseId '{testCaseId}' in worksheet '{sheetName}'.");

            if (matches.Count > 1)
                throw new InvalidOperationException($"More than one row for TestCaseId '{testCaseId}' in worksheet '{sheetName}'.");

            return columns.ToDictionary(column => column.Name,
                column => matches[0].Cell(column.Index).GetString().Trim(),
                StringComparer.OrdinalIgnoreCase);
        }

        public List<string> ReadFirstColumn(string filePath, string sheetName = null)
        {
            if (string.IsNullOrWhiteSpace(filePath))
                throw new ArgumentException("File path cannot be empty.");

            if (!File.Exists(filePath))
                throw new FileNotFoundException($"Downloaded Excel not found: {filePath}");

            using var workbook = new XLWorkbook(filePath);

            var worksheet = string.IsNullOrEmpty(sheetName)
                ? workbook.Worksheet(1)
                : workbook.Worksheet(sheetName);

            if (worksheet == null)
                throw new Exception($"Worksheet '{sheetName}' not found.");

            var rows = worksheet.RowsUsed().ToList();

            var data = new List<string>();

            foreach (var row in rows.Skip(1))
            {
                var cellValue = row.Cell(1).GetString().Trim();

                if (!string.IsNullOrEmpty(cellValue))
                    data.Add(cellValue);
            }

            return data;
        }
    }
}