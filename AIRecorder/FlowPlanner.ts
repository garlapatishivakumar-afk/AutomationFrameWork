export type PlannedStep = {

    line:number;

    action:string;

    description:string;

    locator?:string;

    value?:string;

};

export type PlannedFlow = {

    steps:PlannedStep[];

};