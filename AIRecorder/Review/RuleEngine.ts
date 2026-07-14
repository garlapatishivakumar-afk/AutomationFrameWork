import { ReviewRule } from "./ReviewRule";
import { ReviewRules } from "./ReviewRules";

export class RuleEngine {

    public getEnabledRules(): ReviewRule[] {

        return ReviewRules.filter(rule => rule.enabled);

    }

}
