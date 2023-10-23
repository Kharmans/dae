import { debug, error, i18n, warn } from "../../dae";
import { addAutoFields, DAEActiveEffectConfig } from "../apps/DAEActiveEffectConfig";
import { applyDaeEffects, atlActive, actorFromUuid, daeSystemClass, getSelfTarget, libWrapper } from "../dae";
import { setupSocket } from "../GMAction";

export let wildcardEffects: RegExp[] = [];
export let _characterSpec: { data: any, flags: any } = { data: {}, flags: {} }

export class ValidSpec {
  //  static specs: {allSpecs: ValidSpec[], allSpecsObj: {}, baseSpecs: ValidSpec[], baseSpecsObj: {}, derivedSpecsObj: {}, derivedSpecs: ValidSpec[]}; 
  static specs: {};

  _fieldSpec: string;
  get fieldSpec(): string { return this._fieldSpec };
  set fieldSpec(spec: string) { this._fieldSpec = spec }

  _sampleValue: string | number | boolean | any[];
  get sampleValue(): string | number | boolean | any[] { return this._sampleValue }
  set sampleValue(value: string | number | boolean | any[]) { this._sampleValue = value }

  _label: string;
  get label(): string { return this._label }
  set label(label: string) { this._label = label }

  _forcedMode: number;
  get forcedMode(): number { return this._forcedMode }
  set forcedMode(mode: number) { this._forcedMode = mode }

  _options: any;
  get options(): any { return this._options }
  set options(options: any) { this._options = options }

  constructor(fs: string, sv: string | number | boolean | any[], forcedMode = -1, label = undefined, options: any = undefined) {
    this._fieldSpec = fs;
    this._sampleValue = sv;
    this._label = label ?? fs;
    this._forcedMode = forcedMode;
    this._options = options;
  }

  static createValidMods() {
    //@ts-ignore
    this.specs = {};
    //@ts-ignore
    const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
    //@ts-ignore
    const system = globalThis.CONFIG.DAE.systemClass;

    for (let specKey of Object.keys(game.system.model.Actor)) {
      this.specs[specKey] = { allSpecs: [], allSpecsObj: {}, baseSpecs: [], baseSpecsObj: {}, derivedSpecsObj: {}, derivedSpecs: [] };
      _characterSpec["system"] = duplicate(game.system.model.Actor[specKey]);
      let baseValues = flattenObject(_characterSpec);
      for (let prop in baseValues) {
        baseValues[prop] = [baseValues[prop], -1];
      }
      daeSystemClass.modifyBaseValues(specKey, baseValues, _characterSpec);
      Hooks.callAll("dae.modifyBaseValues", specKey, baseValues, _characterSpec);

      // baseValues["items"] = ""; // TODO one day work this out.
      if (game.modules.get("gm-notes")?.active) {
        baseValues["flags.gm-notes.notes"] = ["", -1];
        baseValues["system.att"]
      }

      var specials: any = {};
      //@ts-ignore
      specials["macro.CUB"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials["macro.CLT"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials["macro.CE"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials["StatusEffect"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials["StatusEffectLabel"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials["StatusEffectName"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      daeSystemClass.modifySpecials(specKey, specials, _characterSpec);
      Hooks.callAll("dae.modifySpecials", specKey, specials, _characterSpec)

      // TODO reactivate when cond vis is v10 ready
      // specials["macro.ConditionalVisibility"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      // specials["macro.ConditionalVisibilityVision"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials["flags.dae.onUpdateTarget"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      specials["flags.dae.onUpdateSource"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];

      Object.keys(specials).forEach(key => {
        delete baseValues[key]
      })

      // baseSpecs are all those fields defined in template.json game.system.model and are things the user can directly change
      this.specs[specKey].baseSpecs = Object.keys(baseValues).map(spec => {
        let validSpec = new ValidSpec(spec, baseValues[spec][0], baseValues[spec][1], baseValues[spec][2], baseValues[spec][3]);  

        if (spec.includes(`flags.${game.system.id}`))
          validSpec.forcedMode = ACTIVE_EFFECT_MODES.CUSTOM;
        validSpec = daeSystemClass.modifyValidSpec(spec, validSpec); // System specific modifations
        this.specs[specKey].baseSpecsObj[spec] = validSpec;
        return validSpec;
      });
      //@ts-ignore
      if (game.modules.get("tokenmagic")?.active) {
        specials["macro.tokenMagic"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
      }

      daeSystemClass.modifyDerivedSpecs(specKey, this.specs[specKey].derivedSpecs, _characterSpec)
      Hooks.callAll("dae.modifyDerivedSpecs", specKey, this.specs[specKey].derivedSpecs, _characterSpec);
      Object.entries(specials).forEach(special => {
        //@ts-expect-error
        let validSpec = new ValidSpec(special[0], special[1][0], special[1][1], special[1][2], special[1][3]);
        this.specs[specKey].derivedSpecs.push(validSpec);
      })
      this.specs[specKey].allSpecs = this.specs[specKey].baseSpecs.concat(this.specs[specKey].derivedSpecs);

      // TDO come back and clean this up
      if (["dnd5e", "sw5e"].includes(game.system.id)) {
        // Special case for armor/hp which can depend on derived attributes - like dexterity mod or constituion mod
        // and initiative bonus depends on advantage on initiative
        this.specs[specKey].allSpecs.forEach(m => {
          if (["attributes.hp", "attributes.ac"].includes(m._fieldSpec)) {
            m._sampleValue = 0;
          }
        });
      }
      this.specs[specKey].allSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 });
      this.specs[specKey].baseSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 });
      this.specs[specKey].derivedSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 });
      this.specs[specKey].allSpecs.forEach(ms => this.specs[specKey].allSpecsObj[ms._fieldSpec] = ms);
      this.specs[specKey].baseSpecs.forEach(ms => this.specs[specKey].baseSpecsObj[ms._fieldSpec] = ms);
      this.specs[specKey].derivedSpecs.forEach(ms => this.specs[specKey].derivedSpecsObj[ms._fieldSpec] = ms);
    }
    let allSpecsObj = {};
    let baseSpecsObj = {}
    let derivedSpecsObj = {};
    for (let specKey of Object.keys(game.system.model.Actor)) {
      Object.keys(this.specs[specKey].allSpecsObj).forEach(key => allSpecsObj[key] = this.specs[specKey].allSpecsObj[key]);
      Object.keys(this.specs[specKey].baseSpecsObj).forEach(key => baseSpecsObj[key] = this.specs[specKey].baseSpecsObj[key]);
      Object.keys(this.specs[specKey].derivedSpecsObj).forEach(key => derivedSpecsObj[key] = this.specs[specKey].derivedSpecsObj[key]);
    }
    this.specs["union"] = { allSpecs: [], allSpecsObj: {}, baseSpecs: [], baseSpecsObj: {}, derivedSpecsObj: {}, derivedSpecs: [] };
    this.specs["union"].allSpecsObj = allSpecsObj
    this.specs["union"].baseSpecsObj = baseSpecsObj;
    this.specs["union"].derivedSpecsObj = derivedSpecsObj;
    this.specs["union"].allSpecs = Object.keys(this.specs["union"].allSpecsObj).map(k => this.specs["union"].allSpecsObj[k])
    this.specs["union"].baseSpecs = Object.keys(this.specs["union"].baseSpecsObj).map(k => this.specs["union"].baseSpecsObj[k])
    this.specs["union"].derivedSpecs = Object.keys(this.specs["union"].derivedSpecsObj).map(k => this.specs["union"].derivedSpecsObj[k])
    this.specs["union"].allSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 });
    this.specs["union"].baseSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 });
    this.specs["union"].derivedSpecs.sort((a, b) => { return a._fieldSpec.toLocaleLowerCase() < b._fieldSpec.toLocaleLowerCase() ? -1 : 1 });
  }

  static localizeSpecs() {
    for (let specKey of Object.keys(game.system.model.Actor)) {
      const fieldStart = `flags.${game.system.id}.`;
      this.specs[specKey].allSpecs = this.specs[specKey].allSpecs.map(m => {
        //@ts-ignore replaceAll
        m._label = m._label.replace("data.", "").replace(`{game.system.id}.`, "").replace(".value", "").split(".").map(str => game.i18n.localize(`dae.${str}`).replaceAll("dae.", "")).join(" ");
        if (m.fieldSpec.includes(`flags.${game.system.id}`)) {
          const fieldId = m.fieldSpec.replace(fieldStart, "");
          const characterFlags =
            //@ts-expect-error .DND5E
            (game.system.id === "dnd5e") ? CONFIG.DND5E.characterFlags
              //@ts-expect-error .SW5E
              : (game.system.id === "sw5e") ? CONFIG.SW5E.characterFlags
                : {};
          const localizedString = i18n(characterFlags[fieldId]?.name) ?? i18n(`dae.${fieldId}`)
          m._label = `Flags ${localizedString}`;
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
        else if (this.specs[specKey].derivedSpecsObj[m._fieldSpec]) m._label = `${m._label} (*)`;
        return m;
      });
    }
  }
}

function getRollData(wrapped, ...args): any {
  const data = wrapped(...args);
  data.actorId = this.id;
  data.actorUuid = this.uuid;

  if (!data.token) Object.defineProperty(data, "token", {
    get() {
      if (!data._token) {
        const actor = actorFromUuid(data.actorUuid ?? "")
        data._token = getSelfTarget(actor);
      }
      return data._token;
    },
    set(token) { data._token = token; }
  });
  Object.defineProperty(data, "tokenUuid", {
    get() { // During initialisation getSelfTarget will return a token document not a token
      if (data._tokenUuid) return data._tokenUuid;
      if (data.token instanceof Token)
        return data.token?.document.uuid ?? "undefined";
      else return data.token.uuid ?? "undefined"
    },
    set(uuid) {
      data._tokenUuid = uuid;
    }
  });
  Object.defineProperty(data, "tokenId", {
    get() { return data._tokenId ?? data.token?.id ?? "undefined" },
    set(tokenId) { data._tokenId = tokenId }
  });
  return data;
}

export class DAESystem {
  static spellAttacks: string[];
  static weaponAttacks: string[];
  static attackTypes: string[];
  static bonusSelectors: any;
  static daeActionTypeKeys: string[];
  static detectionModeList: any;

  public static get systemConfig() {
    throw new Error("system class must implement getSystemConfig()")
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
    specials["macro.execute"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.execute.local"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.execute.GM"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.itemMacro"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.itemMacro.local"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.itemMacro.GM"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.actorUpdate"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.createItem"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["macro.createItemRunMacro"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    // specials["macro.createToken"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
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
    setProperty(actor, change.key, current.concat([change.value]))
    return true;
  }

  public static doCustomArrayValue(actor, current, change, validValues: string[] | undefined) {
    if (current instanceof Array) {
      if (getType(change.value) === "string" && change.value[0] === "-") {
        const checkValue = change.value.slice(1);
        const currentIndex = (current ?? []).indexOf(checkValue)
        if (currentIndex === -1) return true;
        if (!validValues?.includes(checkValue)) return true;
        const returnValue = duplicate(current);
        returnValue.splice(currentIndex, 1)
        setProperty(actor, change.key, returnValue);
      } else {
        if ((current ?? []).includes(change.value)) return true;
        if (!validValues?.includes(change.value)) return true;
        setProperty(actor, change.key, current.concat([change.value]))
      }
    } else if (current instanceof Set) {
      if (getType(change.value) === "string" && change.value[0] === "-") {
        const checkValue = change.value.slice(1);
        if (!current.has(checkValue)) return true;
        if (validValues && !validValues.includes(checkValue)) return true;
        const returnValue = deepClone(current);
        returnValue.delete(checkValue);
        setProperty(actor, change.key, returnValue);
      } else {
        if ((current ?? new Set()).has(change.value)) return true;
        if (validValues && !validValues.includes(change.value)) return true;
        let returnValue = deepClone(current);
        returnValue.add(change.value);
        setProperty(actor, change.key, returnValue);
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
    setProperty(activeEffectData, "flags.dae.itemData", item.toObject(false));
    setProperty(activeEffectData, "flags.dae.transfer", false);
    if (options.metaData) mergeObject(activeEffectData, options.metaData);

  }

  static MATH_PROXY = new Proxy(Math, {
    has: () => true, // Include everything
    get: (t, k) => k === Symbol.unscopables ? undefined : t[k],
    set: () => { console.error("You may not set properties of the Roll.MATH_PROXY environment"); return false } // No-op
  });

  public static safeEval(expression: string, sandbox: any = {}, onErrorReturn: any | undefined = undefined) {
    let result;
    try {
      const src = 'with (sandbox) { return ' + expression + '}';
      const evl = new Function('sandbox', src);
      sandbox = mergeObject(sandbox, this.MATH_PROXY);
      sandbox = mergeObject(sandbox, { Roll });
      result = evl(sandbox);
    } catch (err) {
      console.warn("midi-qol | expression evaluation failed ", expression, err);
      result = onErrorReturn;
    }
    if (Number.isNumeric(result)) return Number(result)
    return result;
  };
  public static safeEvalExpressionNew(input, context = {}, depth = 0) {
    let stack: any[] = [];
    let output = '';
    let temp;
    let functionStack: any[] = []; // additional stack for function name
    let newStack: any[] = []; // stack for new keyword
    let validFunctionName = /^([a-zA-Z_$][0-9a-zA-Z_$]*.)*[a-zA-Z_$][0-9a-zA-Z_$]*$/; // regex for valid JS function name

    for (let char of input) {
      if (char === " " && stack[stack.length - 1] === " ") continue;
      if (char === '(') {
        let funcName = '';
        let isNew = false;
        while (stack.length > 0 && /[a-zA-Z_$0-9.]/.test(stack[stack.length - 1])) {
          funcName = stack.pop() + funcName;
        }
        if (stack.slice(-4).join("") === "new ") {
          isNew = true;
          stack = stack.slice(0, -4);
        } else {
          if (Math[funcName]) funcName = `Math.${funcName}`;
        }

        if (!validFunctionName.test(funcName) && funcName.length > 0) {
          throw new Error(`Invalid function name: ${funcName}`);
        }

        functionStack.push(funcName);
        newStack.push(isNew);
        stack.push('(');
      } else if (char === ')') {
        temp = '';
        let poppedChar;

        // Pop elements from the stack until we find the matching opening parenthesis
        while ((poppedChar = stack.pop()) !== '(') {
          temp = poppedChar + temp;
        }

        // Pop the function name and the new flag
        let funcName = functionStack.pop();
        let isNew = newStack.pop();

        // Evaluate the function call
        if (funcName === "dae.eval") {
          stack.push(`${this.safeEval(this.safeEvalExpression(temp, context, depth + 1), context)}`);
        } if (funcName.length > 0) {
          const expression =
            `${isNew ? "new " : ""}${funcName}(${this.safeEvalExpression(temp, context, depth + 1)})`;
          if (depth) stack.push(this.safeEval(expression, context));
          else stack.push(expression);
        } else {
          stack.push('(');
          for (let t of temp) stack.push(t);
          stack.push(')');
        }
      } else stack.push(char);

    }

    // Evaluate any remaining alphanumeric sequences
    let value = '';
    while (stack.length > 0 && /[a-zA-Z_$0-9.]/.test(stack[stack.length - 1])) {
      value = stack.pop() + value;
    }
    if (value.length > 0) {
      stack.push(eval(value).toString());
    }

    output = stack.join('');
    return eval(output);
  }
  public static safeEvalExpression(input: string, context: any, depth = 0) {
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
        if (Math[funcName]) funcName = funcName = `Math.${funcName}`;

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
            const rollExpression = `new Roll(${temp}).evaluate({async: false}).total`;
            stack.push(this.safeEval(rollExpression, context));
            // stack.push(new Roll(temp, context).evaluate({async: false}).total);
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
      setProperty(actor, change.key, change.value);
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
      let flagValue = getProperty(actor, "flags.dae.onUpdateTarget") ?? [];
      flagValue.push({ flagName, macroName, origin, sourceTokenUuid, args, targetTokenUuid, filter, sourceActorUuid })
      setProperty(actor, "flags.dae.onUpdateTarget", flagValue);
    }
    return true;
  }

  /*
  * replace the default actor prepareData
  * call applyDaeEffects
  * add an additional pass after derivfed data
  */
  public static initActions() {
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
  if (!this.statuses) this.statuses = new Set();
  // Identify which special statuses had been active
  const specialStatuses = new Map();
  if (isNewerVersion(game.version, "11.293")) {
    //@ts-expect-error specialStatusEffects
    for (const statusId of Object.values(CONFIG.specialStatusEffects)) {
      specialStatuses.set(statusId, this.statuses.has(statusId));
    }
    this.statuses.clear();
  }
  setProperty(this, "flags.dae.onUpdateTarget", getProperty(this._source, "flags.dae.onUpdateTarget"));
  debug("prepare data: before passes", this.name, this._source);
  this.overrides = {};
  wrapped();
  // Add an extra pass after prepareData has completed for "specials" to be applied
  applyDaeEffects.bind(this)({ specList: ValidSpec.specs[this.type].derivedSpecsObj, completedSpecs: ValidSpec.specs[this.type].baseSpecsObj, allowAllSpecs: true, wildCardsInclude: [], wildCardsExclude: wildcardEffects, doStatusEffects: true });
  if (isNewerVersion(game.version, "11.293")) {
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
  applyDaeEffects.bind(this)({ specList: ValidSpec.specs[this.type].baseSpecsObj, completedSpecs: {}, allowAllSpecs: false, wildCardsInclude: wildcardEffects, wildCardsExclude: [], doStatusEffects: true });
}

setProperty(globalThis, "CONFIG.DAE.systemClass", DAESystem);

Hooks.on("dae.modifySpecials", (specKey, specials, characterSpec) => {
  // Prelim support for ATE v10 - need some more detail.

  //@ts-ignore
  const ACTIVE_EFFECT_MODES = CONST.ACTIVE_EFFECT_MODES;
  if (game.modules.get("ATL")?.active) {
    for (let label of ["dimSight", "brightSight"]) {
      specials[`ATL.${label}`] = [0, -1];
    }
    specials["ATL.alpha"] = [0, -1];
    specials["ATL.elevation"] = [0, -1];
    specials["ATL.height"] = [0, -1];
    specials["ATL.width"] = [0, -1];
    specials["ATL.hidden"] = [false, -1];
    specials["ATL.rotation"] = [0, -1];

    specials["ATL.light.animation"] = ["", -1]; //{intensity: 1:10, reverse: true/false, speed: 1:10, type: "X"}	Light Animation settings, see below for Animation Types
    specials["ATL.light.alpha"] = [0, -1];
    specials["ATL.light.angle"] = [0, -1];
    specials["ATL.light.attenuation"] = [0, -1];
    specials["ATL.light.bright"] = [0, -1];
    specials["ATL.light.color"] = [0, -1];
    specials["ATL.light.coloration"] = [0, -1];
    specials["ATL.light.contrast"] = [0, -1];
    specials["ATL.light.dim"] = [0, -1];
    specials["ATL.light.luminosity"] = [0, -1];
    specials["ATL.light.saturation"] = [0, -1];
    specials["ATL.light.shadows"] = [0, -1];
    specials["ATL.light.darkness.max"] = [0, -1];
    specials["ATL.light.darkness.min"] = [0, -1];
    // specials["ATL.detectionModes.basicSight.range"] = [0, -1];
    // specials["ATL.detectionModes.seeInvisibility.range"] = [0, -1];
    // specials["ATL.detectionModes.senseInvisibility.range"] = [0, -1];
    // specials["ATL.detectionModes.feelTremor.range"] = [0, -1];
    // specials["ATL.detectionModes.seeAll.range"] = [0, -1];
    // specials["ATL.detectionModes.senseAll.range"] = [0, -1];
    specials["ATL.sight.visionMode"] = ["", 0]; // selection list
    specials["ATL.light.animation"] = ["", -1]; // json string
    specials["ATL.preset"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
    specials["ATL.sight.angle"] = [0, -1];
    specials["ATL.sight.attenuation"] = [0, -1];
    specials["ATL.sight.brightness"] = [0, -1];
    specials["ATL.sight.contrast"] = [0, -1];
    specials["ATL.sight.enabled"] = [0, -1];
    specials["ATL.sight.range"] = [0, -1];
    specials["ATL.sight.saturation"] = [0, -1];
    specials["ATL.sight.color"] = ["", 0 - 1];

  } else if (game.modules.get("ATL")?.active) {
    // support new version of ATL
    //@ts-expect-error .version
    if (isNewerVersion("0.3.04", game.modules.get("ATL")?.version)) {
      for (let label of ["dimLight", "brightLight", "dimSight", "brightSight", "sightAngle", "lightColor", "lightAnimation", "lightAlpha", "lightAngle"]) {
        specials[`ATL.${label}`] = [0, -1];
      }
    } else {
      for (let label of ["light.dim", "light.bright", "dimSight", "brightSight", "sightAngle", "light.color", "light.animation", "light.alpha", "light.angle"]) {
        specials[`ATL.${label}`] = [0, -1];
      }
    }
    specials["ATL.preset"] = ["", ACTIVE_EFFECT_MODES.CUSTOM];
  }
});
