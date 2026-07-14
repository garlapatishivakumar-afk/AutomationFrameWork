using ClosedXML.Excel;

namespace AutomationFrameWork.Utilities
{
    public class FileDataWriters
    {
        public void AppendSinlgeLineDataToExcel(string filePath, string sheetName, List<string> rowData)
        {
            using (var workbook = File.Exists(filePath)
                ? new XLWorkbook(filePath)
                : new XLWorkbook())
            {
                IXLWorksheet worksheet;

                if (workbook.Worksheets.Any(ws => ws.Name == sheetName))
                {
                    worksheet = workbook.Worksheet(sheetName);
                }
                else
                {
                    worksheet = workbook.AddWorksheet(sheetName);
                }

                int nextRow = worksheet.LastRowUsed()?.RowNumber() + 1 ?? 1;

                for (int col = 0; col < rowData.Count; col++)
                {
                    worksheet.Cell(nextRow, col + 1).Value = rowData[col];
                }

                workbook.SaveAs(filePath);
            }
        }

        public void AppendMultipleRowsToExcel(string filePath, string sheetName, List<List<string>> data)
        {
            using (var workbook = File.Exists(filePath)
                ? new XLWorkbook(filePath)
                : new XLWorkbook())
            {

                IXLWorksheet worksheet;

                if (workbook.Worksheets.Any(ws => ws.Name == sheetName))
                {
                    worksheet = workbook.Worksheet(sheetName);
                }
                else
                {
                    worksheet = workbook.AddWorksheet(sheetName);
                }

                int nextRow = worksheet.LastRowUsed()?.RowNumber() + 1 ?? 1;

                worksheet.Cell(nextRow, 1).InsertData(data);

                workbook.SaveAs(filePath);
            }
        }

        public void ReplaceDataInExcel(string filePath, List<string> rowData)
        {
            using (var workbook = File.Exists(filePath)
                ? new XLWorkbook(filePath)
                : new XLWorkbook())
            {
                string sheetName = "Sheet1";
                IXLWorksheet worksheet;

                if (workbook.Worksheets.Any(ws => ws.Name == sheetName))
                {
                    worksheet = workbook.Worksheet(sheetName);
                }
                else
                {
                    worksheet = workbook.AddWorksheet(sheetName);
                }

                if (worksheet.LastRowUsed() != null)
                {
                    worksheet.Clear();
                }

                worksheet.Cell(1, 1).InsertData(rowData);

                workbook.SaveAs(filePath);
            }

        }

    }
}
