using ClosedXML.Excel;
using System.Text.Json;

namespace AutomationFrameWork.Utilities
{
    public class TaxShortfallRequestData
    {
        public string LoanNumber { get; set; } = string.Empty;
        public string ExpectedFileNamePart { get; set; } = string.Empty;
        public string ExpectedExtension { get; set; } = string.Empty;
    }

    public class FileDataReaders
    {
        public void ReadDetailsFromExcel(String excelFilePathToRead)
        {
            string filePath = excelFilePathToRead;

            using (XLWorkbook workbook = new XLWorkbook(filePath))
            {
                IXLWorksheet worksheet = workbook.Worksheet(1); // First sheet

                int rowCount = worksheet.LastRowUsed().RowNumber();

                for (int row = 2; row <= rowCount; row++) // Skip header
                {
                    string username = worksheet.Cell(row, 1).GetString();
                    string password = worksheet.Cell(row, 2).GetString();
                    string role = worksheet.Cell(row, 3).GetString();

                    Console.WriteLine($"Username: {username}");
                    Console.WriteLine($"Password: {password}");
                    Console.WriteLine($"Role: {role}");
                    Console.WriteLine("-----------------------");

                    // You can now use these variables in Playwright login
                }
            }
        }

        public void ReadDataFromJson(string jsonFilePath)
        {
            Console.WriteLine(jsonFilePath);

            string jsonString = File.ReadAllText(jsonFilePath);

            JsonObjects jsonObjects = JsonSerializer.Deserialize<JsonObjects>(jsonString);

            Console.WriteLine($"Name: {jsonObjects.Name}");
            Console.WriteLine($"Age: {jsonObjects.Age}");
            Console.WriteLine($"City: {jsonObjects.City}");

            Console.WriteLine("Skills:");
            foreach (var skill in jsonObjects.Skills)
            {
                Console.WriteLine($"- {skill}");
            }
        }

        public TaxShortfallRequestData ReadTaxShortfallRequestDataFromExcel(
            string excelFilePath,
            string sheetName = "TaxShortfallRequest",
            int dataRow = 2)
        {
            EnsureTaxShortfallRequestWorkbookExists(excelFilePath, sheetName);

            using var workbook = new XLWorkbook(excelFilePath);
            var worksheet = workbook.Worksheet(sheetName);

            var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;
            if (dataRow > lastRow)
                throw new InvalidOperationException($"Requested data row {dataRow} not found in '{excelFilePath}' sheet '{sheetName}'.");

            var loanNumber = worksheet.Cell(dataRow, 1).GetString().Trim();
            var expectedFileNamePart = worksheet.Cell(dataRow, 2).GetString().Trim();
            var expectedExtension = worksheet.Cell(dataRow, 3).GetString().Trim();

            if (string.IsNullOrWhiteSpace(loanNumber))
                throw new InvalidOperationException("LoanNumber is required in TaxShortfallRequest Excel data.");

            if (string.IsNullOrWhiteSpace(expectedFileNamePart))
                throw new InvalidOperationException("ExpectedFileNamePart is required in TaxShortfallRequest Excel data.");

            if (string.IsNullOrWhiteSpace(expectedExtension))
                throw new InvalidOperationException("ExpectedExtension is required in TaxShortfallRequest Excel data.");

            return new TaxShortfallRequestData
            {
                LoanNumber = loanNumber,
                ExpectedFileNamePart = expectedFileNamePart,
                ExpectedExtension = expectedExtension
            };
        }

        private static void EnsureTaxShortfallRequestWorkbookExists(string excelFilePath, string sheetName)
        {
            var directory = Path.GetDirectoryName(excelFilePath);
            if (!string.IsNullOrWhiteSpace(directory))
            {
                Directory.CreateDirectory(directory);
            }

            if (File.Exists(excelFilePath))
                return;

            using var workbook = new XLWorkbook();
            var worksheet = workbook.AddWorksheet(sheetName);

            worksheet.Cell(1, 1).Value = "LoanNumber";
            worksheet.Cell(1, 2).Value = "ExpectedFileNamePart";
            worksheet.Cell(1, 3).Value = "ExpectedExtension";

            worksheet.Cell(2, 1).Value = "407000117";
            worksheet.Cell(2, 2).Value = "TaxShortfallRequest";
            worksheet.Cell(2, 3).Value = ".pdf";

            workbook.SaveAs(excelFilePath);
        }

    }

}
