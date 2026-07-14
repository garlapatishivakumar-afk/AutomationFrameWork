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