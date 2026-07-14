using AutomationFrameWork.Drivers;

namespace AutomationFrameWork.Utilities
{
    public abstract class BaseSteps
    {
        protected readonly PlaywrightDriver _driver;
        protected readonly ScenarioContext _scenarioContext;

        private TestContext _context;

        protected TestContext Context
        {
            get
            {
                if (_context == null)
                    _context = new TestContext(_driver.Page, _scenarioContext);
                return _context;
            }
        }

        protected BaseSteps(PlaywrightDriver playwrightDriver, ScenarioContext scenarioContext)
        {
            _driver = playwrightDriver;
            _scenarioContext = scenarioContext;
        }
    }
}