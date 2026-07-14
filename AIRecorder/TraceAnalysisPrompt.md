Read:

1. AIRecorder/Code.ts
2. Latest Playwright Trace

Analyze:

1. Network requests triggered by user actions
2. Page navigations
3. Loading indicators and AJAX panels
4. Dynamic content refreshes
5. Success messages
6. Error messages
7. Validation messages
8. Grid refreshes
9. Popup openings and closings

Generate:

1. Required waits
2. Required assertions
3. Validation points
4. Missing framework improvements

Rules:

* Never use Thread.Sleep.
* Never use Task.Delay.
* Prefer WaitForAsync.
* Prefer WaitForResponseAsync.
* Prefer Expect assertions.
* Explain why each wait is needed.
* Explain why each assertion is needed.
* Highlight business validations.
* Output improved framework code snippets.
