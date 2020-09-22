export class dynamicEffectsConditions {
}
dynamicEffectsConditions.flagName = "conditions";
let addconditionFields = (...args) => {
    console.log("addconditionfeilds", ...args);
};
export let dynamicEffectsConditionsSetupActions = () => {
    Hooks.on("preRendertActorSheet5e", addconditionFields);
};
