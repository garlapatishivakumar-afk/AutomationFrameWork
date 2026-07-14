using Microsoft.Playwright;

namespace PlaywrightUtilities
{
    public class BrokenImagesValidator
    {
        private readonly IPage _page;
        private readonly List<ImageNetworkInfo> _imageResponses = new();
        private readonly HashSet<string> _processedUrls = new();

        private readonly string[] _imageExtensions =
        {
            ".png", ".jpg", ".jpeg", ".svg",
            ".gif", ".webp", ".bmp", ".ico", ".tiff"
        };

        public BrokenImagesValidator(IPage page)
        {
            _page = page;
        }

        public void StartTracking()
        {
            _page.Response += async (_, response) =>
            {
                try
                {
                    var url = response.Url;
                    var status = response.Status;

                    if (_processedUrls.Contains(url))
                        return;

                    bool isImage = IsImageResponse(response);

                    if (!isImage)
                        return;

                    _processedUrls.Add(url);

                    long size = 0;

                    if (response.Headers.TryGetValue("content-length", out var contentLength))
                        long.TryParse(contentLength, out size);

                    if (size == 0)
                    {
                        var body = await response.BodyAsync();
                        size = body?.Length ?? 0;
                    }

                    _imageResponses.Add(new ImageNetworkInfo
                    {
                        Url = url,
                        Status = status,
                        Size = size,
                        IsSuccess = status >= 200 && status < 300 && size > 0
                    });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error capturing image response: {ex.Message}");
                }
            };
        }

        private bool IsImageResponse(IResponse response)
        {
            
            if (response.Headers.TryGetValue("content-type", out var contentType))
            {
                if (!string.IsNullOrEmpty(contentType) &&
                    contentType.Contains("image", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            try
            {
                var uri = new Uri(response.Url);
                var path = uri.AbsolutePath.ToLower();

                return _imageExtensions.Any(ext => path.EndsWith(ext));
            }
            catch
            {
                return false;
            }
        }

        public async Task ScrollToLoadAllImagesAsync()
        {
            await _page.EvaluateAsync(@"async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 500;
                    const timer = setInterval(() => {
                        window.scrollBy(0, distance);
                        totalHeight += distance;

                        if (totalHeight >= document.body.scrollHeight){
                            clearInterval(timer);
                            resolve();
                        }
                    }, 300);
                });
            }");
        }

        public List<ImageNetworkInfo> GetAllImages() => _imageResponses;

        public List<ImageNetworkInfo> GetBrokenImages() =>
            _imageResponses
                .Where(x => !x.IsSuccess || x.Status >= 400)
                .ToList();

        public void PrintReport()
        {
            Console.WriteLine("===== IMAGE VALIDATION REPORT =====");

            foreach (var img in _imageResponses)
            {
                Console.WriteLine($"URL: {img.Url}");
                Console.WriteLine($"Status: {img.Status}");
                Console.WriteLine($"Size: {img.Size} bytes");
                Console.WriteLine($"Success: {img.IsSuccess}");
                Console.WriteLine("----------------------------------");
            }

            var brokenImages = GetBrokenImages();

            if (brokenImages.Any())
            {
                Console.WriteLine("* Broken Images Found:");

                foreach (var broken in brokenImages)
                {
                    Console.WriteLine(
                        $"URL: {broken.Url} | Status: {broken.Status} | Size: {broken.Size}");
                }
            }
            else
            {
                Console.WriteLine("* All images loaded successfully.");
            }

            Console.WriteLine("----------------------------------");
        }
    }

    public class ImageNetworkInfo
    {
        public string Url { get; set; }
        public int Status { get; set; }
        public long Size { get; set; }
        public bool IsSuccess { get; set; }
    }

}