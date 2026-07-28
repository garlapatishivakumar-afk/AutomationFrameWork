import fs from "fs";
import { BusinessStep } from "./BusinessFlowBuilder";

export type PlanningResult = {

	helpers: string[];

	retryLines: number[];

	captureLines: number[];

	validationLines: number[];

	questions: string[];
};

export function buildPlan(
	flow: BusinessStep[]
): PlanningResult {

	const result: PlanningResult = {

		helpers: [],

		retryLines: [],

		captureLines: [],

		validationLines: [],

		questions: []
	};

	for (const step of flow) {

		switch (step.type) {

			case "Textbox":

				if (!result.helpers.includes("FillTextboxAsync"))
					result.helpers.push("FillTextboxAsync");

				result.questions.push(
					`Line ${step.line}: Use reusable FillTextboxAsync()?`
				);

				break;

			case "Dropdown":

				if (!result.helpers.includes("SelectDropdownAsync"))
					result.helpers.push("SelectDropdownAsync");

				result.questions.push(
					`Line ${step.line}: Use reusable SelectDropdownAsync()?`
				);

				break;

			case "Validation":

				result.validationLines.push(step.line);

				result.questions.push(
					`Line ${step.line}: What validation should be performed?`
				);

				break;

			case "Status":

				result.retryLines.push(step.line);

				result.questions.push(
					`Line ${step.line}: Does this status require retry logic?`
				);

				break;

			case "TextCapture":

				result.captureLines.push(step.line);

				result.questions.push(
					`Line ${step.line}: Store InnerText? If yes, variable name and reuse location?`
				);

				break;
		}
	}

	return result;
}

export function savePlanning(
	plan: PlanningResult
) {

	fs.writeFileSync(

		"AIRecorder/PlanningResult.json",

		JSON.stringify(plan, null, 4)

	);

}

if (require.main === module) {

	const flow: BusinessStep[] = JSON.parse(

		fs.readFileSync(

			"AIRecorder/BusinessFlow.json",

			"utf8"

		)

	);

	const plan = buildPlan(flow);

	savePlanning(plan);

	console.log(plan);

}
