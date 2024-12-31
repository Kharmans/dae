import { ArrayField, BooleanField, MODULE_ID, NumberField, StringField, debug, debugEnabled, error, i18n, warn } from "../../dae";
import { DAEActiveEffectConfig } from "../apps/DAEActiveEffectConfig";
import { applyDaeEffects, daeSystemClass, libWrapper, getToken, DAESetupComplete, DAEReadyComplete, enumerateBaseValues, geti18nOptions } from "../dae";

export let wildcardEffects: RegExp[] = [];
export let _characterSpec: { data: any, flags: any } = { data: {}, flags: {} }


//@ts-expect-error
export type FieldType = foundry.data.fields.DataField | "number" | "string" | "boolean" | "object" | "Array" | "Set";
export class ValidSpec {
  //  static specs: {allSpecs: ValidSpec[], allSpecsObj: {}, baseSpecs: ValidSpec[], baseSpecsObj: {}, derivedSpecsObj: {}, derivedSpecs: ValidSpec[]}; 
  static actorSpecs: {};
  static itemSpecs: {};

  _fieldSpec: string;
  get fieldSpec(): string { return this._fieldSpec };
  set fieldSpec(spec: string) { this._fieldSpec = spec }

  _fieldType: FieldType;
  get fieldType(): FieldType { return this._fieldType }
  set fieldType(value: FieldType) { this._fieldType = value }

  _label: string;
  get label(): string { return this._label }
  set label(label: string) { this._label = label }

  _forcedMode: number;
  get forcedMode(): number { return this._forcedMode }
  set forcedMode(mode: number) { this._forcedMode = mode }

  _options: any;
  get options(): any { return this._options }
  set options(options: any) { this._options = options }

  constructor(fs: string, sv: FieldType, forcedMode = -1, label = undefined, options: any = undefined) {
    this._fieldSpec = fs;
    this._fieldType = sv;
    this._label = label ?? fs;
    this._forcedMode = forcedMode;
    this._options = options;
  }

  static createValidMods() {
    //@ts-ignore
    this.actorSpecs = {};
    //@ts-ignore
    const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
    //@ts-ignore
    const system = globalThis.CONFIG.DAE.systemClass;

    // for (let specKey of Object.keys(game.system.model.Actor)) {
    //@ts-expect-error dataModels
    for (let specKey of Object.keys(CONFIG.Actor.dataModels)) {
      this.actorSpecs[specKey] = { allSpecs: [], allSpecsObj: {}, baseSpecs: [], baseSpecsObj: {}, derivedSpecsObj: {}, derivedSpecs: [] };
      _characterSpec["system"] = game.system.model ? foundry.utils.duplicate(game.system.model.Actor[specKey] ?? {}) : {};
      let baseValues = foundry.utils.flattenObject(_characterSpec);
      for (let prop in baseValues) {
        baseValues[prop] = [baseValues[prop], -1];
      }
      daeSystemClass.modifyBaseValues(specKey, baseValues, _characterSpec);
      Hooks.callAll("dae.modifyBaseValues", specKey, baseValues, _characterSpec);
      for (let key of Object.keys(baseValues)) {
        const baseValue = baseValues[key];
        if (typeof baseValue[0] === "string") {
          console.warn("wrong baseValue", key, baseValue[0]);
          baseValue[0] = new StringField({ initial: baseValues[0] });
        }
        if (typeof baseValue[0] === "number") {
          console.warn("wrong baseValue", key, baseValue[0]);
          baseValue[0] = new NumberField({ initial: baseValues[0] });
        }
        if (typeof baseValue[0] === "boolean") {
          console.warn("wrong baseValue", key, baseValue[0]);
          baseValue[0] = new BooleanField({ initial: baseValues[0] });
        }
        if (baseValue[0] instanceof Array) {
          console.warn("wrong baseValue", key, baseValue[0]);
          baseValue[0] = new ArrayField({ initial: baseValues[0] });
        }
      }

      // baseValues["items"] = ""; // TODO one day work this out.
      if (game.modules.get("gm-notes")?.active) {
        baseValues["flags.gm-notes.notes"] = [new StringField(), -1];
        baseValues["system.att"]
      }

      var specials: any = {};
      //@ts-ignore
      specials["macro.CUB"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      specials["macro.CLT"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      specials["macro.CE"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      specials["macro.StatusEffect"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      // disabled since too many oddities in v12 - specials["StatusEffect"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      //specials["StatusEffectLabel"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      //specials["StatusEffectName"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      daeSystemClass.modifySpecials(specKey, specials, _characterSpec);
      Hooks.callAll("dae.modifySpecials", specKey, specials, _characterSpec)
      for (let key of Object.keys(specials)) {
        const special = specials[key];
        if (typeof special[0] === "string") {
          console.warn("wrong special", key, special[0]);
          special[0] = new StringField({ initial: specials[0] });
        }
        if (typeof special[0] === "number") {
          console.warn("wrong special", key, special[0]);
          special[0] = new NumberField({ initial: specials[0] });
        }
        if (typeof special[0] === "boolean") {
          console.warn("wrong special", key, special[0]);
          special[0] = new BooleanField({ initial: specials[0] });
        }
        if (special[0] instanceof Array) {
          console.warn("wrong special", key, special[0]);
          special[0] = new ArrayField({ initial: specials[0] });
        }
      }

      // TODO reactivate when cond vis is v10 ready
      // specials["macro.ConditionalVisibility"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      // specials["macro.ConditionalVisibilityVision"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      specials["flags.dae.onUpdateTarget"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      specials["flags.dae.onUpdateSource"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];

      Object.keys(specials).forEach(key => {
        if (baseValues[key]) console.log(`DAE | specials ${key} is already defined in baseValues - removing from baseValues`)
        if (debugEnabled > 0 && baseValues[key]) warn(`DAE | specials ${key} is already defined in baseValues - removing`)
        delete baseValues[key]
      })

      // baseSpecs are all those fields defined in template.json game.system.model and are things the user can directly change
      this.actorSpecs[specKey].baseSpecs = Object.keys(baseValues).map(spec => {
        let validSpec = new ValidSpec(spec, baseValues[spec][0] ?? baseValues[spec], baseValues[spec][1], baseValues[spec][2], baseValues[spec][3]);
        validSpec = daeSystemClass.modifyValidSpec(spec, validSpec); // System specific modifations
        this.actorSpecs[specKey].baseSpecsObj[spec] = validSpec;
        return validSpec;
      });
      //@ts-ignore
      if (game.modules.get("tokenmagic")?.active) {
        specials["macro.tokenMagic"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
      }

      daeSystemClass.modifyDerivedSpecs(specKey, this.actorSpecs[specKey].derivedSpecs, _characterSpec)
      Hooks.callAll("dae.modifyDerivedSpecs", specKey, this.actorSpecs[specKey].derivedSpecs, _characterSpec);
      Object.entries(specials).forEach(special => {
        //@ts-expect-error
        let validSpec = new ValidSpec(special[0], special[1][0], special[1][1], special[1][2], special[1][3]);
        this.actorSpecs[specKey].derivedSpecs.push(validSpec);
      })
      this.actorSpecs[specKey].allSpecs = this.actorSpecs[specKey].baseSpecs.concat(this.actorSpecs[specKey].derivedSpecs);

      // TDO come back and clean this up
      if (["dnd5e", "sw5e"].includes(game.system.id)) {
        // Special case for armor/hp which can depend on derived attributes - like dexterity mod or constituion mod
        // and initiative bonus depends on advantage on initiative
        this.actorSpecs[specKey].allSpecs.forEach(m => {
          if (["attributes.hp", "attributes.ac"].includes(m._fieldSpec)) {
            m._fieldType = 0;
          }
        });
      }
      this.actorSpecs[specKey].allSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 });
      this.actorSpecs[specKey].baseSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 });
      this.actorSpecs[specKey].derivedSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 });
      this.actorSpecs[specKey].allSpecs.forEach(ms => this.actorSpecs[specKey].allSpecsObj[ms._fieldSpec] = ms);
      this.actorSpecs[specKey].baseSpecs.forEach(ms => this.actorSpecs[specKey].baseSpecsObj[ms._fieldSpec] = ms);
      this.actorSpecs[specKey].derivedSpecs.forEach(ms => this.actorSpecs[specKey].derivedSpecsObj[ms._fieldSpec] = ms);
    }
    let allSpecsObj = {};
    let baseSpecsObj = {}
    let derivedSpecsObj = {};
    //@ts-expect-error
    for (let specKey of Object.keys(CONFIG.Actor.dataModels)) {
      Object.keys(this.actorSpecs[specKey].allSpecsObj).forEach(key => allSpecsObj[key] = this.actorSpecs[specKey].allSpecsObj[key]);
      Object.keys(this.actorSpecs[specKey].baseSpecsObj).forEach(key => baseSpecsObj[key] = this.actorSpecs[specKey].baseSpecsObj[key]);
      Object.keys(this.actorSpecs[specKey].derivedSpecsObj).forEach(key => derivedSpecsObj[key] = this.actorSpecs[specKey].derivedSpecsObj[key]);
    }
    this.actorSpecs["union"] = { allSpecs: [], allSpecsObj: {}, baseSpecs: [], baseSpecsObj: {}, derivedSpecsObj: {}, derivedSpecs: [] };
    this.actorSpecs["union"].allSpecsObj = allSpecsObj
    this.actorSpecs["union"].baseSpecsObj = baseSpecsObj;
    this.actorSpecs["union"].derivedSpecsObj = derivedSpecsObj;
    this.actorSpecs["union"].allSpecs = Object.keys(this.actorSpecs["union"].allSpecsObj).map(k => this.actorSpecs["union"].allSpecsObj[k])
    this.actorSpecs["union"].baseSpecs = Object.keys(this.actorSpecs["union"].baseSpecsObj).map(k => this.actorSpecs["union"].baseSpecsObj[k])
    this.actorSpecs["union"].derivedSpecs = Object.keys(this.actorSpecs["union"].derivedSpecsObj).map(k => this.actorSpecs["union"].derivedSpecsObj[k])
    this.actorSpecs["union"].allSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 });
    this.actorSpecs["union"].baseSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 });
    this.actorSpecs["union"].derivedSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 });
    this.itemSpecs = daeSystemClass?.getItemSpecs() ?? {};
  }


  static localizeSpecs() {
    if (!ValidSpec.actorSpecs) {
      ValidSpec.createValidMods();
    };
    if (!ValidSpec.actorSpecs) {
      ui.notifications.error("DAE | Initialisation failed - no specs defined");
      return;
    }
    //@ts-expect-error dataModels
    for (let specKey of Object.keys(CONFIG.Actor.dataModels)) {
      if (!this.actorSpecs[specKey]) continue; // not all of the actor types are defined in the system
      const fieldStart = `flags.${game.system.id}.`;
      this.actorSpecs[specKey].allSpecs = this.actorSpecs[specKey].allSpecs.map(m => {
        // Turns out the dnd5e field labels are not all that good.
        if (false && (m.fieldType?.label ?? "") !== "") m._label = i18n(m.fieldType.label);
        else {
          m._label = m._label.replace("data.", "").replace("system.", "").replace(`{game.system.id}.`, "").replace(".value", "").split(".").map(str => game.i18n.localize(`dae.${str}`).replaceAll("dae.", "")).join(" ");

          if (m.fieldSpec.includes(`flags.${game.system.id}`)) {
            const fieldId = m.fieldSpec.replace(fieldStart, "");
            //@ts-expect-error
            const characterFlags = game.system.config?.characterFlags ?? {};
            const localizedString = i18n(characterFlags[fieldId]?.name) ?? i18n(`dae.${fieldId}`)
            m._label = `Flags ${localizedString}`;
          }
        }
        const saveBonus = m._fieldSpec.match(/system.abilities.(\w\w\w).save/);
        const checkBonus = m._fieldSpec.match(/system.abilities.(\w\w\w).mod/);
        const skillMod = m._fieldSpec.match(/system.skills.(\w\w\w).mod/);
        const skillPassive = m._fieldSpec.match(/system.skills.(\w\w\w).passive/);
        if (saveBonus) m._label = `${m._label} (Deprecated)`;
        else if (checkBonus) m._label = `${m._label} (Deprecated)`;
        else if (skillMod) m._label = `${m._label} (Deprecated)`;
        else if (skillPassive) m._label = `${m._label} (Deprecated)`;
        else if (m._fieldSpec === "StatusEffectLabel") m._label = `${m._label} (Deprecated)`;
        else if (m._fieldSpec === "system.attributes.ac.value") m._label = `${m._label} (Deprecated)`;
        else if (this.actorSpecs[specKey].derivedSpecsObj[m._fieldSpec]) m._label = `${m._label} (*)`;
        return m;
      });
    }
    for (let specKey of Object.keys(this.itemSpecs)) {
      for (let m of this.itemSpecs[specKey].allSpecs) {
        const fieldStart = `flags.${game.system.id}.`;
        // Turns out the dnd5e field labels are not all that good.
        if ((m.fieldType?.label ?? "") !== "") m.label = i18n(m.fieldType.label);
        else {
          m.label = m.label.replace("data.", "").replace("system.", "").replace(`{game.system.id}.`, "").replace(".value", "").split(".").map(str => game.i18n.localize(`dae.${str}`).replaceAll("dae.", "")).join(" ");

          if (m.fieldSpec.includes(`flags.${game.system.id}`)) {
            const fieldId = m.fieldSpec.replace(fieldStart, "");
            //@ts-expect-error
            const characterFlags = game.system.config?.characterFlags ?? {};
            const localizedString = i18n(characterFlags[fieldId]?.name) ?? i18n(`dae.${fieldId}`)
            m.label = `Flags ${localizedString}`;
          }
        }
        const saveBonus = m.fieldSpec.match(/system.abilities.(\w\w\w).save/);
        const checkBonus = m.fieldSpec.match(/system.abilities.(\w\w\w).mod/);
        const skillMod = m.fieldSpec.match(/system.skills.(\w\w\w).mod/);
        const skillPassive = m.fieldSpec.match(/system.skills.(\w\w\w).passive/);
        if (saveBonus) m.label = `${m.label} (Deprecated)`;
        else if (checkBonus) m.label = `${m.label} (Deprecated)`;
        else if (skillMod) m.label = `${m.label} (Deprecated)`;
        else if (skillPassive) m.label = `${m.label} (Deprecated)`;
        else if (m.fieldSpec === "StatusEffectLabel") m.label = `${m.label} (Deprecated)`;
        else if (m.fieldSpec === "system.attributes.ac.value") m.label = `${m.label} (Deprecated)`;
        else if (this.itemSpecs[specKey].derivedSpecsObj[m.fieldSpec]) m.label = `${m.label} (*)`;
        let newOptions = m.options;
        if (typeof m.options === "string") newOptions = geti18nOptions(m.options, MODULE_ID);
        if (!newOptions && typeof m.options === "string") newOptions = i18n(m.options);
        m.options = newOptions;
        m.label = i18n(m.label ?? "");
      }
    }
  }
}

function getRollData(wrapped, ...args): any {
  // need to be careful - default foundry getRollData() returns the "live" actor.system
  return wrapped(args);
}

export class DAESystem {
  static spellAttacks: string[];
  static weaponAttacks: string[];
  static attackTypes: string[];
  static bonusSelectors: any;
  static daeActionTypeKeys: string[];
  static detectionModeList: any;
  public static fieldMappings: any = {};

  public static get systemConfig() {
    //@ts-expect-error
    return game.system.config;
  }

  public static getActorDataModelFields(actorType: string): any {
    //@ts-expect-error
    return CONFIG.Actor.dataModels[actorType]?.schema?.fields;
    /*
    const dataModels: any = game.system.dataModels;
    const actorModel: any = dataModels.actor;
    let actorModels = { "character": actorModel.CharacterData.schema.fields, "npc": actorModel.NPCData.schema.fields, "group": actorModel.GroupData.schema.fields, "vehicle": actorModel.VehicleData.schema.fields }
    return actorModels[actorType];
    */
  }

  public static getRollDataFunc() {
    return getRollData;
  }
  /**
   * accepts a string field specificaiton, e.g. system.traits.languages.value. Used extensively in ConfigPanel.ts
   * return an object or false.
   * Keys are valid options for the field specificaiton and the value is the user facing text for that option 
   * e.g. {common: "Common"}
   * */
  public static getOptionsForSpec(specification): any {
    if (!specification.key) return undefined;
    if (specification?.key === "ATE.detectionMode") {
      return this.detectionModeList;
    }
    return undefined;
  }
  // Configure any lookp lists that might be required by getOptionsForSpec.
  public static configureLists(daeConfig: DAEActiveEffectConfig) {
    this.detectionModeList = {};
    //@ts-expect-error detectionModes
    Object.values(CONFIG.Canvas.detectionModes).forEach(dm => {
      //@ts-expect-error .id .label
      this.detectionModeList[dm.id] = i18n(`${dm.label}`);
    })
  }

  public static async editConfig() {
    return;
  }

  public static modifyBaseValues(actorType: string, baseValues: {}, characterSpec: any): void {

  };
  public static modifySpecials(actorType: string, specials: {}, characterSpec: any): void {
    //@ts-ignore
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

  public static effectDisabled(actor, effect, itemData = null) {
    return effect.disabled;
  }

  public static modifyValidSpec(spec, validSpec: ValidSpec): ValidSpec {
    return validSpec;
  }

  public static doCustomValue(actor, current, change, validValues) {
    if ((current || []).includes(change.value)) return true;
    if (!validValues.includes(change.value)) return true;
    foundry.utils.setProperty(actor, change.key, current.concat([change.value]))
    return true;
  }

  public static doCustomArrayValue(actor, current, change, validValues: string[] | undefined) {
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
  public static addDAEMetaData(activeEffectData, item, options) {
    //@ts-expect-error
    if (!fromUuidSync(item.uuid))
      foundry.utils.setProperty(activeEffectData, "flags.dae.itemData", item.toObject(false));
    foundry.utils.setProperty(activeEffectData, "flags.dae.transfer", false);
    if (options.metaData) foundry.utils.mergeObject(activeEffectData, options.metaData);

  }
  public static getAttributeValue(documentRef: string, attribute: string) {
    let actor;
    let value = "";
    if (typeof (documentRef) == 'string') {
      function getActor(doc, nesting = 0, maxDepth = 3) {
        nesting++;
        if(nesting > maxDepth) return undefined;

        if(doc instanceof Actor) return doc;
        else if(doc.actor && (doc instanceof Token || doc instanceof Item)) return doc.actor;
        else if(doc.parent && doc instanceof ActiveEffect) return getActor(doc.parent, nesting)
        else return undefined;
      }
      //@ts-expect-error
      const doc = fromUuidSync(documentRef);
      actor = getActor(doc);
      if (actor) value = foundry.utils.getProperty(actor, `${attribute}`) ?? null;
    }
    return value;
}
  public static safeEval(expression: string, sandbox: any, onErrorReturn: any | undefined = undefined) {
    let result;
    const preSetupError = "MidiQOL or fromUuidSync used before setup complete";
    try {
      const src = 'with (sandbox) { return ' + expression + '}';
      const evl = new Function('sandbox', src);
      sandbox = foundry.utils.mergeObject(sandbox, { Roll });
      //@ts-expect-error
      sandbox = foundry.utils.mergeObject(sandbox, { fromUuidSync, getToken, getAttributeValue: this.getAttributeValue, MidiQOL: globalThis.MidiDAEEval ?? {} })
      if (!DAEReadyComplete && typeof expression === "string" && (expression.includes("fromUuidSync") || expression.includes("MidiQOL"))) {
        throw new Error(preSetupError)
      }
      const sandboxProxy = new Proxy(sandbox, {
        has: () => true, // Include everything
        get: (t, k) => k === Symbol.unscopables ? undefined : (t[k] ?? Math[k]),
        //@ts-expect-error
        set: () => console.error("You may not set properties of the sandbox environment") // No-op
      });
      result = evl(sandboxProxy);
    } catch (err) {
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

  public static safeEvalExpression(input: string, context: any, depth = 0) {
    if (typeof input !== "string") return input;
    input = Roll.replaceFormulaData(input, context);
    let validFunctionName = /^[a-zA-Z_$][0-9a-zA-Z_$.]*$/; // regex for valid JS function name
    if (depth > 20) {
      console.error("It's turtles all the way down....")
      return input;
    }
    let stack: any[] = [];
    let output = '';
    let temp;
    let functionStack: any[] = []; // additional stack for function name

    for (let char of input) {
      if (char === '(') {

        let funcName = '';
        while (stack.length > 0 && /[a-zA-Z_$0-9.]/.test(stack[stack.length - 1])) {
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
        let poppedChar;

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
            //@ts-expect-error
            if (game.release.generation > 11) {
              error(`%c dae.roll in ${input} is not supported in expression ${input} in foundry version 12 and has been discarded`, "color: red", context.name, context.actorUuid)
              stack.push(this.safeEval("0", context)); // v12 does not support synchronous dice rolling)
            } else {
              console.warn(`%c dae.roll in ${input} is not supported in foundry version 12 and will be discarded`, "color: red", context.name, context.actorUuid)
              const rollExpression = `new Roll(${temp}).evaluate({async: false}).total`;
              stack.push(this.safeEval(rollExpression, context));

            }
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

  public static daeCustomEffect(actor, change): any {
    if (typeof change.value === "string" && (change.value?.includes("dae.eval(") || change.value?.includes("dae.roll("))) {
      const context = actor.getRollData();
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
      let flagValue = foundry.utils.getProperty(actor, "flags.dae.onUpdateTarget") ?? [];
      flagValue.push({ flagName, macroName, origin, sourceTokenUuid, args, targetTokenUuid, filter, sourceActorUuid })
      foundry.utils.setProperty(actor, "flags.dae.onUpdateTarget", flagValue);
    }
    return true;
  }

  /*
  * replace the default actor prepareData
  * call applyDaeEffects
  * add an additional pass after derivfed data
  */
  public static initActions() {
    Hooks.callAll("dae.addFieldMappings", this.fieldMappings);
    // We will call this in prepareData
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.applyActiveEffects", applyBaseActiveEffects, "OVERRIDE");
    // Might have to be tailored to other systems.
    libWrapper.register("dae", "CONFIG.Actor.documentClass.prototype.prepareData", prepareData, "WRAPPER");
    // This supplies DAE custom effects
    Hooks.on("applyActiveEffect", daeSystemClass.daeCustomEffect.bind(daeSystemClass));

  }

  public static readyActions(): void {
  }

  public static setupActions(): void {
  }

  static get applyBaseEffects() {
    return applyBaseActiveEffects;
  }
}

/*
* replace the default actor prepareData
* call applyDaeEffects
* add an additional pass after derivfed data
*/
function prepareData(wrapped) {
  if (!ValidSpec.actorSpecs) {
    ValidSpec.createValidMods();
  }
  this.statuses ??= new Set();
  // Identify which special statuses had been active
  const specialStatuses = new Map();
  if (foundry.utils.isNewerVersion(game.version, "11.293")) {
    //@ts-expect-error specialStatusEffects
    for (const statusId of Object.values(CONFIG.specialStatusEffects)) {
      specialStatuses.set(statusId, this.statuses.has(statusId));
    }
    this.statuses.clear(); // need to do this here since core foundry does this in applyActiveEffects, but we do multiple calls to applyEffects
  }
  foundry.utils.setProperty(this, "flags.dae.onUpdateTarget", foundry.utils.getProperty(this._source, "flags.dae.onUpdateTarget"));
  debug("prepare data: before passes", this.name, this._source);
  this.overrides = {};
  wrapped();
  // Add an extra pass after prepareData has completed for "specials" to be applied
  applyDaeEffects.bind(this)({ specList: ValidSpec.actorSpecs[this.type].derivedSpecsObj, completedSpecs: ValidSpec.actorSpecs[this.type].baseSpecsObj, allowAllSpecs: true, wildCardsInclude: [], wildCardsExclude: wildcardEffects, doStatusEffects: true });
  if (foundry.utils.isNewerVersion(game.version, "11.293")) {
    // Apply special statuses that changed to active tokens
    let tokens;
    for (const [statusId, wasActive] of specialStatuses) {
      const isActive = this.statuses.has(statusId);
      if (isActive === wasActive) continue;
      if (!tokens) tokens = this.getActiveTokens();
      for (const token of tokens) token._onApplyStatusEffect(statusId, isActive);
    }
  }
  //TODO find another way to tdo this
  // this._prepareOwnedItems(this.items)
  debug("prepare data: after passes", this);
}

// this function replaces applyActiveEffects in Actor
function applyBaseActiveEffects() {
  applyDaeEffects.bind(this)({ specList: ValidSpec.actorSpecs[this.type].baseSpecsObj, completedSpecs: {}, allowAllSpecs: false, wildCardsInclude: wildcardEffects, wildCardsExclude: [], doStatusEffects: true });
}

foundry.utils.setProperty(globalThis, "CONFIG.DAE.systemClass", DAESystem);

Hooks.on("dae.modifySpecials", (specKey, specials, characterSpec) => {
  // Prelim support for ATE v10 - need some more detail.

  //@ts-ignore
  const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
  if (game.modules.get("ATL")?.active) {
    for (let label of ["dimSight", "brightSight"]) {
      specials[`ATL.${label}`] = [new NumberField(), -1];
    }
    specials["ATL.alpha"] = [new NumberField(), -1];
    specials["ATL.elevation"] = [new NumberField(), -1];
    specials["ATL.height"] = [new NumberField(), -1];
    specials["ATL.width"] = [new NumberField(), -1];
    specials["ATL.hidden"] = [new BooleanField(), -1];
    specials["ATL.rotation"] = [new NumberField(), -1];

    specials["ATL.light.animation"] = [new StringField(), -1]; //{intensity: 1:10, reverse: true/false, speed: 1:10, type: "X"}	Light Animation settings, see below for Animation Types
    specials["ATL.light.alpha"] = [new NumberField(), -1];
    specials["ATL.light.angle"] = [new NumberField(), -1];
    specials["ATL.light.attenuation"] = [new NumberField(), -1];
    specials["ATL.light.bright"] = [new NumberField(), -1];
    specials["ATL.light.color"] = [new NumberField(), -1];
    specials["ATL.light.coloration"] = [new NumberField(), -1];
    specials["ATL.light.contrast"] = [new NumberField(), -1];
    specials["ATL.light.dim"] = [new NumberField(), -1];
    specials["ATL.light.luminosity"] = [new NumberField(), -1];
    specials["ATL.light.saturation"] = [new NumberField(), -1];
    specials["ATL.light.shadows"] = [new NumberField(), -1];
    specials["ATL.light.darkness.max"] = [new NumberField(), -1];
    specials["ATL.light.darkness.min"] = [new NumberField(), -1];
    // specials["ATL.detectionModes.basicSight.range"] = [new NumberField(), -1];
    // specials["ATL.detectionModes.seeInvisibility.range"] = [new NumberField(), -1];
    // specials["ATL.detectionModes.senseInvisibility.range"] = [new NumberField(), -1];
    // specials["ATL.detectionModes.feelTremor.range"] = [new NumberField(), -1];
    // specials["ATL.detectionModes.seeAll.range"] = [new NumberField(), -1];
    // specials["ATL.detectionModes.senseAll.range"] = [new NumberField(), -1];
    specials["ATL.sight.visionMode"] = [new StringField(), 0]; // selection list
    specials["ATL.light.animation"] = [new StringField(), -1]; // json string
    specials["ATL.preset"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
    specials["ATL.sight.angle"] = [new NumberField(), -1];
    specials["ATL.sight.attenuation"] = [new NumberField(), -1];
    specials["ATL.sight.brightness"] = [new NumberField(), -1];
    specials["ATL.sight.contrast"] = [new NumberField(), -1];
    specials["ATL.sight.enabled"] = [new NumberField(), -1];
    specials["ATL.sight.range"] = [new NumberField(), -1];
    specials["ATL.sight.saturation"] = [new NumberField(), -1];
    specials["ATL.sight.color"] = [new StringField(), 0 - 1];

  } else if (game.modules.get("ATL")?.active) {
    // support new version of ATL
    //@ts-expect-error .version
    if (foundry.utils.isNewerVersion("0.3.04", game.modules.get("ATL")?.version)) {
      for (let label of ["dimLight", "brightLight", "dimSight", "brightSight", "sightAngle", "lightColor", "lightAnimation", "lightAlpha", "lightAngle"]) {
        specials[`ATL.${label}`] = [new NumberField(), -1];
      }
    } else {
      for (let label of ["light.dim", "light.bright", "dimSight", "brightSight", "sightAngle", "light.color", "light.animation", "light.alpha", "light.angle"]) {
        specials[`ATL.${label}`] = [new NumberField(), -1];
      }
    }
    specials["ATL.preset"] = [new StringField(), ACTIVE_EFFECT_MODES.CUSTOM];
  }
});
