using System.Net;
using System.Net.Mail;

namespace AutomationFrameWork.Utilities
{
    public class MailHelper : ExtentReportManager
    {
        /// <summary>
        /// This method helps to send an email with an attachment.
        /// </summary>
        /// <param name="toAddress">list of email addresses of the reciepients to whom we want to send the mail</param>
        /// <param name="fromAddress">from which email we have to send the mail</param>
        /// <param name="cc">list of email addresses of the reciepients to whom a Carbon Copy should be sent</param>
        /// <param name="userName">email address from which you want to send the mail</param>
        /// <param name="password">app password of email address from which you want to send the mail</param>

        public void SendEmailReport(List<string> toAddress, string fromAddress, List<string> cc, string userName, string password)
        {
            using (var message = new MailMessage())
            {
                string reportPath = Path.Combine(
                    Directory.GetCurrentDirectory(),
                    ReportsDirectory,
                    ExtentReportName);

                Console.WriteLine("Printing report name from MailHelperClass : " + ExtentReportName);

                if (!File.Exists(reportPath))
                {
                    Console.WriteLine("Extent Report not found!");
                    return;
                }

                Attachment attachment = new Attachment(reportPath);

                message.From = new MailAddress(fromAddress);

                foreach(string email in toAddress) {
                    message.To.Add(email);
                }

                foreach(string email in cc)
                {
                    message.CC.Add(email);
                }

                string date = DateTime.Now.ToString();

                message.Subject = "Automation Execution Report";
                message.Body = "Hi,\n\nPlease find attached the latest automation execution report ran on "+date+".\n\nThanks,\nAutomation Team";

                message.Attachments.Add(attachment);

                using (var smtpClient = new SmtpClient())
                {
                    smtpClient.Host = "smtp.gmail.com";
                    smtpClient.Port = 587;
                    smtpClient.EnableSsl = true;
                    smtpClient.UseDefaultCredentials = false;
                    smtpClient.Credentials = new NetworkCredential(userName, password); // Use 'App Password'
                    smtpClient.DeliveryMethod = SmtpDeliveryMethod.Network;

                    smtpClient.Send(message);
                }
            }
        }

    }
}