import { AnyMutableObject, AnyObject } from "fvtt-types/utils";
import { MODULE_ID, debug, debugEnabled, error, i18n, warn } from "../../dae.js";
import { daeApplyActiveEffects, daeSystemClass, libWrapper, getToken, DAEReadyComplete, DoEffectsOptions, ceInterface, BaseValuesInner, actionQueue, daeMacro, daeInitMacroActors, pendingInitMacroEffects } from "../dae.js";

const { ArrayField, BooleanField, NumberField, StringField } = foundry.data.fields;

export let wildcardEffects: RegExp[] = [];
// TODO (Michael): Can this be removed entirely?
export let _characterSpec: { data: unknown, flags: unknown } = { data: {}, flags: {} }


export type DataFieldClass = new (...args: any[]) => foundry.data.fields.DataField;
export type FieldType = foundry.data.fields.DataField | DataFieldClass | "number" | "string" | "boolean" | "object" | "Array" | "Set" | 0;
export type SpecPhase = "initial" | "final" | "daePostDerived" | "none";

export type Specs = {
  allSpecs: ValidSpec[];
  allSpecsObj: Record<string, ValidSpec>;
}
export class ValidSpec {
  // Flat spec maps per actor type and "union" across all types
  static actorSpecs: Record<string, Specs>;
  static itemSpecs: Record<string, Specs>;

  _fieldSpec: string;
  get fieldSpec(): string { return this._fieldSpec };
  set fieldSpec(spec: string) { this._fieldSpec = spec }

  _fieldType: FieldType;
  get fieldType(): FieldType { return this._fieldType }
  set fieldType(value: FieldType) { this._fieldType = value }

  _label: string;
  get label(): string { return this._label }
  set label(label: string) { this._label = label }

  _description: string;
  get description(): string { return this._description }
  set description(description: string) { this._description = description }

  _forcedMode: number;
  get forcedMode(): number { return this._forcedMode }
  set forcedMode(mode: number) { this._forcedMode = mode }

  _options: Record<string, string> | undefined;
  get options(): Record<string, string> | undefined { return this._options }
  set options(options: Record<string, string> | undefined) { this._options = options }

  _phase: SpecPhase;
  get phase(): SpecPhase { return this._phase }
  set phase(phase: SpecPhase) { this._phase = phase }

  constructor(fs: string, sv: FieldType, forcedMode = -1, label?: string, description?: string, phase: SpecPhase = "initial", options?: Record<string, string>) {
    this._fieldSpec = fs;
    this._fieldType = sv;
    this._label = label ?? fs;
    this._description = description ?? "";
    this._forcedMode = forcedMode;
    this._options = options;
    this._phase = phase;
  }

  static createValidMods() {
    this.actorSpecs = {};
    const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;

    function coerceBaseValueField(map: Record<string, any>, label: string) {
      for (let key of Object.keys(map)) {
        const entry = map[key];
        if (typeof entry[0] === "string") {
          console.warn(`wrong ${label}`, key, entry[0]);
          entry[0] = new StringField({ initial: entry[0] });
        }
        if (typeof entry[0] === "number") {
          console.warn(`wrong ${label}`, key, entry[0]);
          entry[0] = new NumberField({ initial: entry[0] });
        }
        if (typeof entry[0] === "boolean") {
          console.warn(`wrong ${label}`, key, entry[0]);
          entry[0] = new BooleanField({ initial: entry[0] });
        }
      }
    }

    for (let specKey of Object.keys(CONFIG.Actor.dataModels)) {
      this.actorSpecs[specKey] = { allSpecs: [], allSpecsObj: {} };
      _characterSpec["system"] = game.model ? foundry.utils.duplicate(game.model.Actor[specKey] ?? {}) : {};
      let baseValues = foundry.utils.flattenObject(_characterSpec) as Record<string, any>;
      for (let prop in baseValues) {
        baseValues[prop] = [baseValues[prop], -1];
      }
      daeSystemClass.modifyBaseValues(specKey, baseValues, _characterSpec);
      Hooks.callAll("dae.modifyBaseValues", specKey, baseValues, _characterSpec);
      coerceBaseValueField(baseValues, "baseValue");

      if (game.modules.get("gm-notes")?.active) {
        baseValues["flags.gm-notes.notes"] = [new StringField(), -1];
        baseValues["name"] = [new StringField(), -1];
      }

      let specials: BaseValuesInner = {};
      if (ceInterface) specials["macro.CE"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      specials["macro.StatusEffect"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      specials["StatusEffect"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      daeSystemClass.modifySpecials(specKey, specials, _characterSpec);
      Hooks.callAll("dae.modifySpecials", specKey, specials, _characterSpec)
      coerceBaseValueField(specials, "special");

      specials["flags.dae.onUpdateTarget"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      specials["flags.dae.onUpdateSource"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];

      Object.keys(specials).forEach(key => {
        if (debugEnabled > 0 && baseValues[key]) console.log(`DAE | specials ${key} is already defined in baseValues - removing from baseValues`)
        delete baseValues[key]
      })

      // Build flat spec list from baseValues (phase: "initial")
      const allSpecsObj: Record<string, ValidSpec> = {};
      for (const spec of Object.keys(baseValues)) {
        if (spec === "system") continue;
        let validSpec = new ValidSpec(spec, baseValues[spec][0] ?? baseValues[spec], baseValues[spec][1], baseValues[spec][0]?.label, baseValues[spec][0]?.hint, "initial");
        validSpec = daeSystemClass.modifyValidSpec(spec, validSpec);
        allSpecsObj[spec] = validSpec;
      }

      if (game.modules.get("tokenmagic")?.active) {
        specials["macro.tokenMagic"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      }

      // Specials and derived specs get phase "daePostDerived"
      const derivedSpecsList: ValidSpec[] = [];
      daeSystemClass.modifyDerivedSpecs(specKey, derivedSpecsList, _characterSpec)
      Hooks.callAll("dae.modifyDerivedSpecs", specKey, derivedSpecsList, _characterSpec);
      for (const vs of derivedSpecsList) {
        vs._phase = "daePostDerived";
        allSpecsObj[vs._fieldSpec] = vs;
      }
      for (const [key, value] of Object.entries(specials)) {
        const validSpec = new ValidSpec(key, value[0], value[1], value[0].label, value[0].hint, "daePostDerived");
        allSpecsObj[key] = validSpec;
      }

      // Fire new unified hook
      Hooks.callAll("dae.modifySpecs", specKey, allSpecsObj);

      // Special case for armor/hp which can depend on derived attributes
      if (["dnd5e"].includes(game.system.id ?? "")) {
        for (const m of Object.values(allSpecsObj)) {
          if (["attributes.hp", "attributes.ac"].includes(m._fieldSpec)) {
            m._fieldType = 0;
          }
        }
      }

      const allSpecs = Object.values(allSpecsObj);
      allSpecs.sort((a, b) => a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1);
      this.actorSpecs[specKey].allSpecs = allSpecs;
      this.actorSpecs[specKey].allSpecsObj = allSpecsObj;
      if (this.actorSpecs[specKey].allSpecsObj.system) delete this.actorSpecs[specKey].allSpecsObj.system;
    }

    // Build the "union" type from all actor types
    let unionSpecsObj: Record<string, ValidSpec> = {};
    for (let specKey of Object.keys(CONFIG.Actor.dataModels)) {
      Object.assign(unionSpecsObj, this.actorSpecs[specKey].allSpecsObj);
    }
    this.actorSpecs["union"] = { allSpecs: [], allSpecsObj: {} };
    this.actorSpecs["union"].allSpecsObj = unionSpecsObj;
    this.actorSpecs["union"].allSpecs = Object.values(unionSpecsObj);
    this.actorSpecs["union"].allSpecs.sort((a, b) => a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1);

    this.itemSpecs = "getItemSpecs" in daeSystemClass ? daeSystemClass?.getItemSpecs() : {};
  }


  static localizeSpecs() {
    if (!ValidSpec.actorSpecs) {
      ValidSpec.createValidMods();
    };
    if (!ValidSpec.actorSpecs) {
      ui.notifications?.error("DAE | Initialisation failed - no specs defined");
      return;
    }
    for (let specKey of Object.keys(CONFIG.Actor.dataModels)) {
      if (!this.actorSpecs[specKey]) continue; // not all of the actor types are defined in the system
      const fieldStart = `flags.${game.system.id}.`;
      this.actorSpecs[specKey].allSpecs = this.actorSpecs[specKey].allSpecs.map(m => {
        // Turns out the dnd5e field labels are not all that good.
        // if (false && (m.fieldType?.label ?? "") !== "") m._label = i18n(m.fieldType.label);
        // else {
        m._label = m._label.replace("data.", "").replace("system.", "").replace(`{game.system.id}.`, "").replace(".value", "").split(".").map(str => i18n(`dae.${str}`).replaceAll("dae.", "")).join(" ");

        if (m.fieldSpec.includes(`flags.${game.system.id}`)) {
          const fieldId = m.fieldSpec.replace(fieldStart, "");
          //@ts-expect-error no dnd5e-types
          const characterFlags = game.system.config?.characterFlags ?? {};
          const localizedString = i18n(characterFlags[fieldId]?.name) ?? i18n(`dae.${fieldId}`)
          m._label = `Flags ${localizedString}`;
        }
        // }

        const saveBonus = m._fieldSpec.match(/^system.abilities.(\w\w\w).save$/);
        const checkBonus = m._fieldSpec.match(/^system.abilities.(\w\w\w).mod$/);
        const skillMod = m._fieldSpec.match(/^system.skills.(\w\w\w).mod$/);
        const skillPassive = m._fieldSpec.match(/^system.skills.(\w\w\w).passive$/);
        if (saveBonus) m._label = `${m._label} (Deprecated)`;
        else if (checkBonus) m._label = `${m._label} (Deprecated)`;
        else if (skillMod) m._label = `${m._label} (Deprecated)`;
        else if (skillPassive) m._label = `${m._label} (Deprecated)`;
        else if (m._fieldSpec === "StatusEffectLabel") m._label = `${m._label} (Deprecated)`;
        else if (m._fieldSpec === "system.attributes.ac.value") m._label = `${m._label} (Deprecated)`;
        else if (m._phase === "daePostDerived") m._label = `${m._label ? m._label : m._fieldSpec} (*)`;
        else if (m._phase === "none") m._label = `${m._label ? m._label : m._fieldSpec} (ui)`;
        return m;
      });
    }
    for (let specKey of Object.keys(this.itemSpecs)) {
      for (let m of this.itemSpecs[specKey].allSpecs) {
        const fieldStart = `flags.${game.system.id}.`;
        // Turns out the dnd5e field labels are not all that good.
        if (m.fieldType instanceof foundry.data.fields.DataField && (m.fieldType?.label ?? "") !== "") m.label = i18n(m.fieldType.label);
        else {
          m.label = m.label.replace("data.", "").replace("system.", "").replace(`{game.system.id}.`, "").replace(".value", "").split(".").map(str => i18n(`dae.${str}`).replaceAll("dae.", "")).join(" ");

          if (m.fieldSpec.includes(`flags.${game.system.id}`)) {
            const fieldId = m.fieldSpec.replace(fieldStart, "");
            // @ts-expect-error no dnd5e-types
            const characterFlags = game.system.config?.characterFlags ?? {};
            const localizedString = i18n(characterFlags[fieldId]?.name) ?? i18n(`dae.${fieldId}`)
            m.label = `Flags ${localizedString}`;
          }
        }
        const saveBonus = m.fieldSpec.match(/^system.abilities.(\w\w\w).save$/);
        const checkBonus = m.fieldSpec.match(/^system.abilities.(\w\w\w).mod$/);
        const skillMod = m.fieldSpec.match(/^system.skills.(\w\w\w).mod$/);
        const skillPassive = m.fieldSpec.match(/^system.skills.(\w\w\w).passive$/);
        if (saveBonus) m.label = `${m.label} (Deprecated)`;
        else if (checkBonus) m.label = `${m.label} (Deprecated)`;
        else if (skillMod) m.label = `${m.label} (Deprecated)`;
        else if (skillPassive) m.label = `${m.label} (Deprecated)`;
        else if (m.fieldSpec === "StatusEffectLabel") m.label = `${m.label} (Deprecated)`;
        else if (m.fieldSpec === "system.attributes.ac.value") m.label = `${m.label} (Deprecated)`;
        else if (m._phase === "daePostDerived") m.label = `${m.label} (*)`;
        else if (m._phase === "none") m.label = `${m.label} (ui)`;
        let newOptions = m.options;
        // @ts-expect-error TODO (Michael): is this actually possible?
        if (!newOptions && typeof m.options === "string") newOptions = i18n(m.options);
        m.options = newOptions;
        m.label = i18n(m.label ?? "");
      }
    }
  }
}

function getRollData(wrapped, ...args): AnyMutableObject {
  // need to be careful - default foundry getRollData() returns the "live" actor.system
  return wrapped(...args);
}

export class DAESystem {
  static spellAttacks: string[];
  static weaponAttacks: string[];
  static attackTypes: string[];
  static bonusSelectors: Record<string, {
    attacks: string[];
    selector: string;
    replaceList?: string[];
  }>;
  static daeActionTypeKeys: string[];
  static detectionModeList: Record<string, string>;
  public static fieldMappings: Record<string, string | { key: string, value?: string, mode?: number }> = {};

  public static get systemConfig() {
    //@ts-expect-error no dnd5e-types
    return game.system.config;
  }

  public static getActorDataModelFields(actorType: string): Record<string, foundry.data.fields.DataField<any>> {
    return CONFIG.Actor.dataModels[actorType]?.schema?.fields;
  }

  public static getRollDataFunc() {
    return getRollData;
  }
  /**
   * accepts a string field specification, e.g. system.traits.languages.value. Used extensively in ConfigPanel.ts
   * return an object or false.
   * Keys are valid options for the field specification and the value is the user facing text for that option 
   * e.g. {common: "Common"}
   * */
  public static getOptionsForSpec(specification?: ActiveEffect.ChangeData): Record<string, string> | undefined {
    if (!specification?.key) return undefined;
    if (specification?.key === "ATE.detectionMode") {
      return this.detectionModeList;
    }
    return undefined;
  }
  // Configure any lookup lists that might be required by getOptionsForSpec.
  public static configureLists() {
    this.detectionModeList = {};
    Object.values(CONFIG.Canvas.detectionModes).forEach(dm => {
      this.detectionModeList[dm.id as string] = i18n(`${dm.label}`);
    })
  }

  public static async editConfig() {
    return;
  }

  public static modifyBaseValues(actorType: string, baseValues: {}, characterSpec: any): void {

  };
  public static modifySpecials(actorType: string, specials: BaseValuesInner, characterSpec: any): void {
    const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
    specials["macro.execute"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.execute.local"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.execute.GM"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.itemMacro"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.itemMacro.local"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.itemMacro.GM"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.actorUpdate"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.createItem"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.createItemRunMacro"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    // specials["macro.createToken"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
  };
  public static modifyDerivedSpecs(actorType: string, derivedSpecs: ValidSpec[], characterSpec: any): void {
  }

  public static effectDisabled(actor: Actor.Implementation, effect: ActiveEffect.Implementation, itemData = null) {
    return effect.disabled as boolean;
  }

  public static modifyValidSpec(spec: string, validSpec: ValidSpec): ValidSpec {
    return validSpec;
  }

  // TODO (Michael): Is this used anywhere?
  public static doCustomValue(actor: Actor.Implementation, current: any[], change: ActiveEffect.ChangeData, validValues: any[]) {
    if ((current || []).includes(change.value)) return true;
    if (!validValues.includes(change.value)) return true;
    foundry.utils.setProperty(actor, change.key, current.concat([change.value]))
    return true;
  }

  public static doCustomArrayValue(actor: Actor.Implementation, current: any, change: ActiveEffect.ChangeData, validValues: string[] | undefined) {
    if (current instanceof Array) {
      if (foundry.utils.getType(change.value) === "string" && change.value[0] === "-") {
        const checkValue = change.value.slice(1);
        const currentIndex = (current ?? []).indexOf(checkValue)
        if (currentIndex === -1) return true;
        if (!validValues?.includes(checkValue)) return true;
        const returnValue = foundry.utils.duplicate(current);
        returnValue.splice(currentIndex, 1)
        foundry.utils.setProperty(actor, change.key, returnValue);
      } else {
        if ((current ?? []).includes(change.value)) return true;
        if (!validValues?.includes(change.value)) return true;
        foundry.utils.setProperty(actor, change.key, current.concat([change.value]))
      }
    } else if (current instanceof Set) {
      if (foundry.utils.getType(change.value) === "string" && change.value[0] === "-") {
        const checkValue = change.value.slice(1);
        if (!current.has(checkValue)) return true;
        if (validValues && !validValues.includes(checkValue)) return true;
        const returnValue = foundry.utils.deepClone(current);
        returnValue.delete(checkValue);
        foundry.utils.setProperty(actor, change.key, returnValue);
      } else {
        // if ((current ?? new Set()).has(change.value)) return true;
        let returnValue = new Set(current ?? [])
        // Avoid problem with current custom changes setting return value to undefined if no changes made
        // if (validValues && !validValues.includes(change.value)) return true;
        returnValue.add(change.value);
        foundry.utils.setProperty(actor, change.key, returnValue);
      }
    }
    return true;
  }

  public static initSystemData(): void {
    this.spellAttacks = []
    this.weaponAttacks = [];
    this.attackTypes = [];
    this.bonusSelectors = {};
    this.daeActionTypeKeys = [];
  }
  public static addDAEMetaData(activeEffectData: ActiveEffect.Source, item: Item.Implementation, options: DoEffectsOptions) {
    if (!fromUuidSync(item.uuid))
      foundry.utils.setProperty(activeEffectData, "flags.dae.itemData", item.toObject(false));
    foundry.utils.setProperty(activeEffectData, "flags.dae.transfer", false);
    if (options.metaData) foundry.utils.mergeObject(activeEffectData, options.metaData);
  }
  public static getAttributeValue(documentRef: string, attribute: string) {
    let actor: Actor.Implementation | undefined;
    // TODO: Type this better
    let value: any = "";
    if (typeof (documentRef) == 'string') {
      function getActor(doc: GetActorType, nesting = 0, maxDepth = 3) {
        nesting++;
        if (nesting > maxDepth) return undefined;

        if (doc instanceof Actor) return doc;
        else if ((doc instanceof foundry.canvas.placeables.Token || doc instanceof Item) && doc.actor) return doc.actor;
        else if ((doc instanceof ActiveEffect) && doc.parent) return getActor(doc.parent, nesting)
        else return undefined;
      }
      const doc = fromUuidSync(documentRef) as GetActorType;
      actor = getActor(doc);
      if (actor) value = foundry.utils.getProperty(actor, `${attribute}`) ?? null;
    }
    return value;
  }
  public static safeEval(expression: string, sandbox: any, onErrorReturn: any | undefined = undefined) {
    let result: any;
    const preSetupError = "MidiQOL or fromUuidSync used before setup complete";
    try {
      const src = 'with (sandbox) { return ' + expression + '}';
      const evl = new Function('sandbox', src);
      sandbox = foundry.utils.mergeObject(sandbox, { Roll });
      sandbox = foundry.utils.mergeObject(sandbox, { fromUuidSync, getToken, getAttributeValue: this.getAttributeValue, MidiQOL: globalThis.MidiDAEEval ?? {} })
      if (!DAEReadyComplete && typeof expression === "string" && (expression.includes("fromUuidSync") || expression.includes("MidiQOL"))) {
        throw new Error(preSetupError)
      }
      const sandboxProxy = new Proxy(sandbox, {
        has: () => true, // Include everything
        get: (t, k) => k === Symbol.unscopables ? undefined : (t[k] ?? Math[k]),
        set: () => false && console.error("You may not set properties of the sandbox environment") // No-op
      });
      result = evl(sandboxProxy);
    } catch (err: any) {
      const message = `dae | safeEval | expression evaluation failed ${expression}`;
      if (err.message === preSetupError) {
        console.warn(message, err)
        warn(message, preSetupError);
      } else {
        console.warn(message, err)
        console.warn(`Actor: ${sandbox.name} ${sandbox.actorUuid}`);
        if (sandbox.item) console.warn(`Item: ${sandbox.item.name} ${sandbox.item.itemUuid}`);

      }
      result = onErrorReturn;
    }
    if (Number.isNumeric(result)) return Number(result);
    if (Number.isNaN(result)) result = onErrorReturn;
    return result;
  }

  public static safeEvalExpression(input: string, context: AnyObject, depth = 0) {
    if (typeof input !== "string") return input;
    input = Roll.replaceFormulaData(input, context);
    let validFunctionName = /^[a-zA-Z_$][0-9a-zA-Z_$.?]*$/; // regex for valid JS function name
    if (depth > 20) {
      console.error("It's turtles all the way down....")
      return input;
    }
    let stack: any[] = [];
    let output = '';
    let temp: string;
    let functionStack: any[] = []; // additional stack for function name

    for (let char of input) {
      if (char === '(') {

        let funcName = '';
        while (stack.length > 0 && /[a-zA-Z_$0-9.?]/.test(stack[stack.length - 1])) {
          funcName = stack.pop() + funcName;
        }
        // if (Math[funcName]) funcName = funcName = `Math.${funcName}`; - the proxy will look in Math if not found elsewhere
        if (!validFunctionName.test(funcName) && funcName.length > 0) {
          throw new Error(`Invalid function name: ${funcName}`);
        }

        functionStack.push(funcName);
        stack.push('(');
      } else if (char === ')') {
        temp = '';
        let poppedChar: string;

        // Pop elements from the stack until we find the matching opening parenthesis
        while ((poppedChar = stack.pop()) !== '(') {
          temp = poppedChar + temp;
        }

        // Pop the function name
        let funcName = functionStack.pop();

        // Evaluate the function call
        if (funcName === "dae.eval")
          stack.push(`${this.safeEval(this.safeEvalExpression(temp, context, depth + 1), context)}`);
        else if (funcName === "dae.roll") {
          try {
            error(`%c dae.roll in ${input} is not supported in expression ${input} in foundry version 12 and has been discarded`, "color: red", context.name, context.actorUuid)
            stack.push(this.safeEval("0", context)); // v12 does not support synchronous dice rolling)
          } catch (err) {
            console.warn(`dae | dae.roll bad dice expression ${temp}`, err)
            stack.push(0);
          }
        } else if (depth) {
          const expression = `${funcName}(${this.safeEvalExpression(temp, context, depth + 1)})`;
          stack.push(`${this.safeEval(expression, context)}`)
        } else stack.push(`${funcName}(${temp})`);
      } else {
        stack.push(char);
      }
    }

    output = stack.join('');
    return output; // depth ? this.safeEval(output, context) : output;
  }

  public static daeCustomEffect(
    actor: Actor.Implementation,
    change: DAEChangeData,
    _current?: never,
    _delta?: never,
    _changes?: never
  ): any {
    if (typeof change.value === "string" && (change.value?.includes("dae.eval(") || change.value?.includes("dae.roll("))) {
      const context = actor.getRollData() as AnyMutableObject;
      context.actor = actor;
      change.value = this.safeEvalExpression(change.value, context, 0);
      foundry.utils.setProperty(actor, change.key, change.value);
    }
    if (change.key === "flags.dae.onUpdateTarget" && change.value?.includes(",")) {
      const values = change.value.split(",").map(str => str.trim());
      if (values.length < 5) {
        error("custom effect flags.dae.onUpdateTarget details incomplete", values);
        return;
      }
      const origin = values[0];
      const targetTokenUuid = values[1];
      const sourceTokenUuid = values[2];
      const sourceActorUuid = values[3];
      const flagName = values[4];
      const macroName = ["none", ""].includes(values[5] ?? "") ? "" : values[5];
      const filter = ["none", ""].includes(values[6] ?? "") ? "system" : values[6];;
      const args = values.slice(7);
      let flagValue = actor.flags?.dae?.onUpdateTarget ?? [];
      flagValue.push({ flagName, macroName, origin, sourceTokenUuid, args, targetTokenUuid, filter, sourceActorUuid })
      foundry.utils.setProperty(actor, "flags.dae.onUpdateTarget", flagValue);
    }
    return true;
  }

  /*
  * replace the default actor prepareData
  * call daeApplyActiveEffects (phase-based v14 OVERRIDE)
  * add a daePostDerived pass after derived data
  */
  public static initActions() {
    Hooks.callAll("dae.addFieldMappings", this.fieldMappings);

    // Register custom DAE phase for post-derived data application
    // @ts-expect-error v14 CONFIG.ActiveEffect.phases
    CONFIG.ActiveEffect.phases ??= {};
    // @ts-expect-error v14 CONFIG.ActiveEffect.phases
    CONFIG.ActiveEffect.phases.daePostDerived = {
      label: "DAE Post-Derived",
      hint: "Applied after all derived data preparation"
    };

    // OVERRIDE applyActiveEffects with phase-aware DAE version
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.applyActiveEffects", daeApplyActiveEffects, "OVERRIDE");
    // WRAPPER on prepareData to add post-derived phase call
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.prepareData", prepareData, "WRAPPER");
    // This supplies DAE custom effects via the applyActiveEffect hook
    // @ts-expect-error our custom stuff in the change data makes types angry
    Hooks.on("applyActiveEffect", daeSystemClass.daeCustomEffect.bind(daeSystemClass));

  }

  public static readyActions(): void {
  }

  public static setupActions(): void {
  }


}

/*
* replace the default actor prepareData
* v14: wrapped() triggers core's initial + final phases via the OVERRIDE
* Then call daePostDerived phase for DAE-specific post-derived application
*/
function prepareData(this: Actor.Implementation, wrapped) {
  const initMacrosOnLoad = game.settings.get("dae", "initMacrosOnLoad");
  if (!ValidSpec.actorSpecs) {
    ValidSpec.createValidMods();
  }
  this.statuses ??= new Set();
  // Identify which special statuses had been active
  const specialStatuses = new Map();

  for (const statusId of Object.values(CONFIG.specialStatusEffects)) {
    specialStatuses.set(statusId, this.statuses.has(statusId));
  }
  this.statuses.clear(); // need to do this here since core foundry does this in applyActiveEffects, but we do multiple calls to applyEffects
  foundry.utils.setProperty(this, "flags.dae.onUpdateTarget", foundry.utils.getProperty(this._source, "flags.dae.onUpdateTarget"));
  debug("prepare data: before passes", this.name, this._source);
  this.overrides = {};
  // @ts-expect-error v14 _completedActiveEffectPhases
  if (this._completedActiveEffectPhases) this._completedActiveEffectPhases.clear();

  // Call the original prepareData — v14 core calls applyActiveEffects("initial") in prepareEmbeddedDocuments
  // and applyActiveEffects("final") after prepareDerivedData. Both use the DAE OVERRIDE.
  wrapped();

  // Run the DAE post-derived phase for effects that need derived data
  // @ts-expect-error v14 phase parameter
  this.applyActiveEffects("daePostDerived");

  // Apply special statuses that changed to active tokens
  let tokens: foundry.canvas.placeables.Token[] | undefined;
  for (const [statusId, wasActive] of specialStatuses) {
    const isActive = this.statuses.has(statusId);
    if (isActive === wasActive) continue;
    if (!tokens) tokens = this.getActiveTokens();
    // @ts-expect-error protected - do we need this?
    for (const token of tokens) token._onApplyStatusEffect(statusId, isActive);
  }
  // On first prepareData for each actor, fire "init" for
  // macro.itemMacro/macro.activityMacro so macros that register hooks can re-initialize after world load
  if (initMacrosOnLoad && !daeInitMacroActors.has(this.uuid)) {
    daeInitMacroActors.add(this.uuid);
    const initEffects: ActiveEffect.Implementation[] = [];
    for (const ef of this.allApplicableEffects()) {
      if (ef.disabled || ef.isSuppressed) continue;
      if (ef.changes.some(c => c.key.startsWith("macro.itemMacro") || c.key.startsWith("macro.activityMacro"))) {
        initEffects.push(ef);
      }
    }
    for (const effect of initEffects) {
      if (game.ready)
        actionQueue.add(daeMacro, "init", this, effect, { effectUuid: effect.uuid });
      else
        pendingInitMacroEffects.push({ effectUuid: effect.uuid, actorUuid: this.uuid });
    }
  }
  debug("prepare data: after passes", this);
}

foundry.utils.setProperty(globalThis, "CONFIG.DAE.systemClass", DAESystem);

Hooks.on("dae.modifySpecs", (specKey, allSpecsObj) => {
  const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
  if (game.modules.get("ATL")?.active) {
    for (let label of ["dimSight", "brightSight"]) {
      allSpecsObj[`ATL.${label}`] = new ValidSpec(`ATL.${label}`, new NumberField(), -1, undefined, undefined, "daePostDerived");
    }
    allSpecsObj["ATL.alpha"] = new ValidSpec("ATL.alpha", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.elevation"] = new ValidSpec("ATL.elevation", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.height"] = new ValidSpec("ATL.height", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.width"] = new ValidSpec("ATL.width", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.hidden"] = new ValidSpec("ATL.hidden", new BooleanField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.rotation"] = new ValidSpec("ATL.rotation", new NumberField(), -1, undefined, undefined, "daePostDerived");

    allSpecsObj["ATL.light.animation"] = new ValidSpec("ATL.light.animation", new StringField(), -1, undefined, undefined, "daePostDerived"); // json string
    allSpecsObj["ATL.light.alpha"] = new ValidSpec("ATL.light.alpha", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.light.angle"] = new ValidSpec("ATL.light.angle", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.light.attenuation"] = new ValidSpec("ATL.light.attenuation", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.light.bright"] = new ValidSpec("ATL.light.bright", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.light.color"] = new ValidSpec("ATL.light.color", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.light.coloration"] = new ValidSpec("ATL.light.coloration", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.light.contrast"] = new ValidSpec("ATL.light.contrast", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.light.dim"] = new ValidSpec("ATL.light.dim", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.light.luminosity"] = new ValidSpec("ATL.light.luminosity", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.light.saturation"] = new ValidSpec("ATL.light.saturation", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.light.shadows"] = new ValidSpec("ATL.light.shadows", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.light.darkness.max"] = new ValidSpec("ATL.light.darkness.max", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.light.darkness.min"] = new ValidSpec("ATL.light.darkness.min", new NumberField(), -1, undefined, undefined, "daePostDerived");
    // detection modes are set in "ready" hook to allow for detection mode configuration
    allSpecsObj["ATL.sight.visionMode"] = new ValidSpec("ATL.sight.visionMode", new StringField(), 0, undefined, undefined, "daePostDerived"); // selection list
    allSpecsObj["ATL.preset"] = new ValidSpec("ATL.preset", new StringField(), ACTIVE_EFFECT_MODES.CUSTOM, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.sight.angle"] = new ValidSpec("ATL.sight.angle", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.sight.attenuation"] = new ValidSpec("ATL.sight.attenuation", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.sight.brightness"] = new ValidSpec("ATL.sight.brightness", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.sight.contrast"] = new ValidSpec("ATL.sight.contrast", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.sight.enabled"] = new ValidSpec("ATL.sight.enabled", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.sight.range"] = new ValidSpec("ATL.sight.range", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.sight.saturation"] = new ValidSpec("ATL.sight.saturation", new NumberField(), -1, undefined, undefined, "daePostDerived");
    allSpecsObj["ATL.sight.color"] = new ValidSpec("ATL.sight.color", new StringField(), -1, undefined, undefined, "daePostDerived");
  }
});

type GetActorType = Actor.Implementation | foundry.canvas.placeables.Token.Implementation | ActiveEffect.Implementation | Item.Implementation;
export type DAEChangeData = ActiveEffect.ChangeData & {
  count?: number;
  effect?: ActiveEffect.Implementation;
  // v14 properties
  phase?: string;
  type?: string;
}
