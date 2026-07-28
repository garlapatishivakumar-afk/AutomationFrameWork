using System;
using System.Collections.Generic;
using System.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace AIAutomationGenerator.Models
{
    public class ValidationReport
        {
            public bool Passed { get; set; }
            public List<string> Errors { get; set; } = [];
            public DateTime GeneratedOn { get; set; }
        }
}