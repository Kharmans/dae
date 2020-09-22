
function rollAbilitySave(abilityId, options={}) {
  const label = CONFIG.DND5E.abilities[abilityId];
  const abl = this.data.data.abilities[abilityId];
  const parts = ["@save"];
  const data = {save: abl.save};


  // Include a global actor ability save bonus - if it is numberic it has already been included
  const actorBonus = getProperty(this.data.data.bonuses, "abilities.save");
  //@ts-ignore
  if ( !!actorBonus && !Number.isNumeric(actorBonus)) {
    parts.push("@saveBonus");
    //@ts-ignore
    data.saveBonus = actorBonus;
  }

  // Roll and return
  //@ts-ignore
  return game.dnd5e.dice.d20Roll(mergeObject(options, {
    parts: parts,
    data: data,
    //@ts-ignore
    title: game.i18n.format("DND5E.SavePromptTitle", {ability: label}),
    speaker: ChatMessage.getSpeaker({actor: this}),
    halflingLucky: this.getFlag("dnd5e", "halflingLucky")
  }));
}

function getSpellDC(ability) {
  const actorData = this.data.data;
  const bonus = parseInt(
		new Roll(`${getProperty(actorData, "bonuses.spell.dc")}` || "0", this.getRollData()).roll().total.toString()
  );
  ability = actorData.abilities[ability];
  const prof = actorData.attributes.prof;
  return 8 + (ability ? ability.mod : 0) + prof + bonus;
}


function Roll_replaceData(replaced, formula) {
  let dataRgx = new RegExp(/@([a-z.\-_0-9]+)/gi);
  return formula.replace(dataRgx, (match, term) => {
    const currentBranch = new Set(replaced);
    if (currentBranch.has(term)) {
      console.error(`infinite loop on term ${term}`);
      throw Error(`infinite loop on term ${term}`);
    }
    currentBranch.add(term);
    let value = getProperty(this.data, term);
    if (typeof(value) === "string" && value.indexOf("@") !== -1) {
      // has more replacements
      // new set to allow replace same term on different branches
      value = Roll_replaceData.bind(this)(new Set(currentBranch), value);
    }
    return value ? String(value).trim() : "0";
  });
}

Hooks.once("init", () => {
 
});
Hooks.once("ready", () => {
/*
    if (["0.7.0"].includes(game.data.version)) {
      console.log("dae | Patching Roll._replaceFormulaData v0.7.0");
      //@ts-ignore
      Roll.prototype._replaceFormulaData = new Proxy(Roll.prototype._replaceFormulaData, {
      //@ts-ignore
        apply: (target, thisvalue, args) => Roll_replaceData.bind(thisvalue)(new Set(), ...args)
      });
    } else {
      console.log("dae | Patching Roll._replaceData v0.6.5 and earlier");
      //@ts-ignore protected _replaceData
      Roll.prototype._replaceData = new Proxy(Roll.prototype._replaceData, {
      //@ts-ignore
        apply: (target, thisvalue, args) => Roll_replaceData.bind(thisvalue)(new Set(), ...args)
      });
    }
    */
});
