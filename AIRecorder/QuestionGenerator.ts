import fs from "fs";
import readline from "readline";
import { PlanningResult } from "./PlanningEngine";

export type PlanningSession = {

	useHelpers:string[];

	retries:any[];

	captures:any[];

	validations:any[];

};

function ask(question:string){

	const rl=readline.createInterface({

		input:process.stdin,

		output:process.stdout

	});

	return new Promise<string>(resolve=>{

		rl.question(question+"\n",answer=>{

			rl.close();

			resolve(answer);

		});

	});

}

export async function buildPlanningSession(
	plan:PlanningResult
){

	const session:PlanningSession={

		useHelpers:[],

		retries:[],

		captures:[],

		validations:[]
	};

	for(const helper of plan.helpers){

		const answer=await ask(

`Use helper ${helper} ? (Y/N)`

		);

		if(answer.toLowerCase()=="y")

			session.useHelpers.push(helper);
	}

	for(const line of plan.retryLines){

		const retry=await ask(

`Retry required for line ${line} ? (Y/N)`

		);

		if(retry.toLowerCase()!="y")
			continue;

		const status=await ask(

"Expected Status:"

		);

		const seconds=await ask(

"Retry every how many seconds?"

		);

		session.retries.push({

			line,

			status,

			seconds
		});
	}

	for(const line of plan.captureLines){

		const capture=await ask(

`Capture InnerText for line ${line}? (Y/N)`

		);

		if(capture.toLowerCase()!="y")
			continue;

		const variable=await ask(

"Variable Name:"

		);

		const reuse=await ask(

"Where should it be reused?"

		);

		session.captures.push({

			line,

			variable,

			reuse
		});

	}

	for(const line of plan.validationLines){

		const validation=await ask(

`Validation required for line ${line}? (Y/N)`

		);

		if(validation.toLowerCase()!="y")
			continue;

		const success=await ask(

"Success validation:"

		);

		const failure=await ask(

"Failure validation:"

		);

		session.validations.push({

			line,

			success,

			failure
		});

	}

	return session;

}

function saveSession(
	session:PlanningSession
){

	fs.writeFileSync(

		"AIRecorder/PlanningSession.json",

		JSON.stringify(session,null,4)

	);

}

if(require.main===module){

	const plan:PlanningResult=

	JSON.parse(

		fs.readFileSync(

			"AIRecorder/PlanningResult.json",

			"utf8"

		)

	);

	buildPlanningSession(plan)

	.then(session=>{

		saveSession(session);

		console.log(session);

	});

}
