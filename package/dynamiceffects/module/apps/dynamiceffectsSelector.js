import { ModSpec } from "../dynamiceffects.js";
import { ItemEffect, tokenEffects, cubActive } from "../dynamiceffects.js";
import { EVALPASSES } from "../dynamiceffects.js";
export class ItemEffectSelector extends FormApplication {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.id = "effect-selector";
        options.classes = ["dnd5e"];
        options.title = game.i18n.localize("dynamiceffects.ItemEffectSelection");
        options.template = "/modules/dynamiceffects/templates/dynamiceffects-selector.html";
        options.height = 275;
        options.width = 275;
        return options;
    }
    static get validMods() {
        return ModSpec.allSpecs;
    }
    get validMods() {
        return ModSpec.allSpecs;
    }
    // static set validMods(validMods) {ItemEffectSelector._validMods = validMods}
    // set validMods(validMods) {this.validMods = validMods}
    /* -------------------------------------------- */
    activateListeners(html) {
        super.activateListeners(html);
        html.find(".effectType").change(ev => {
            this.options.selected = ev.target.selectedIndex;
            //@ts-ignore
            this.render(true, { selected: ev.target.selectedIndex });
            return true;
        });
        html.find(".effectCategory").change(ev => {
            this.options.category = ev.target.selectedIndex;
            //@ts-ignore
            this.render(true, { category: ev.target.selectedIndex });
            return true;
        });
    }
    filterEffects(filterString = "") {
        let mods = this.validMods
            .filter(e => e.field != "..." && e.field.includes(filterString) && e.pass !== EVALPASSES.IGNORE)
            .reduce((mods, em) => {
            mods[em.field] = em.label;
            return mods;
        }, {});
        return mods;
    }
    static initActions() { }
    static setupActions() {
        Object.keys(ItemEffectSelector.categories).forEach(name => (ItemEffectSelector.categories[name] = game.i18n.localize(ItemEffectSelector.categories[name])));
        Object.keys(ItemEffectSelector.advantages).forEach(name => (ItemEffectSelector.advantages[name] = game.i18n.localize(ItemEffectSelector.advantages[name])));
    }
    static readyActions() {
        this.validMods.sort((a, b) => (game.i18n.localize(a.field) < game.i18n.localize(b.field) ? -1 : 1));
    }
    getData() {
        if (tokenEffects)
            ItemEffectSelector.categories["token"] = "dynamiceffects.token";
        if (!this.options.allEffectList)
            this.options.allEffectList = this.filterEffects();
        // Return data
        var modSpecKey;
        var category;
        let effect = this.object.data.flags.dynamiceffects.effects.find(i => i.id === this.options.id);
        if (this.options.category) {
            category = Object.keys(ItemEffectSelector.categories)[this.options.category - 1];
            this.options.effectList = this.filterEffects(category); //this.options.category)
            // this.options.selected = undefined;
        }
        else
            this.options.effectList = this.options.allEffectList;
        if (!effect)
            effect = new ItemEffect(this.options.id);
        if (this.options.selected) {
            modSpecKey = Object.keys(this.options.effectList)[this.options.selected - 1];
            effect = new ItemEffect(0, "", modSpecKey, "+", 0, false);
        }
        else {
        }
        this.options.modeList = { "+": "+", "=": "=" };
        let data = {
            effect: effect,
            categories: ItemEffectSelector.categories,
            category: category,
            effects: this.options.effectList,
            modes: this.options.modeList,
        };
        if (cubActive) {
            //@ts-ignore
            if (game.cub.conditions) {
                var cubConditions = {};
                //@ts-ignore
                for (let condition of game.cub.conditions) {
                    cubConditions[condition.name] = condition.name;
                }
            }
            else
                var cubConditions = undefined;
        }
        if (game.system.id === "dnd5e") {
            mergeObject(data, {
                languages: CONFIG.DND5E.languages,
                cubConditions: cubActive && cubConditions ? cubConditions : CONFIG.DND5E.conditionTypes,
                conditions: CONFIG.DND5E.conditionTypes,
                damages: CONFIG.DND5E.damageTypes,
                toolProfs: CONFIG.DND5E.toolProficiencies,
                abilities: CONFIG.DND5E.abilities,
                armorProfs: CONFIG.DND5E.armorProficiencies,
                weaponProfs: CONFIG.DND5E.weaponProficiencies,
                advantages: ItemEffectSelector.advantages,
                isLanguage: effect.modSpecKey === "data.traits.languages.value",
                isCUBCondition: (effect.modSpecKey === "flags.dnd5e.conditions"),
                isCondition: (effect.modSpecKey === "data.traits.ci.value"),
                isToolProf: effect.modSpecKey === "data.traits.toolProf.value",
                isArmorProf: effect.modSpecKey === "data.traits.armorProf.value",
                isWeaponProf: effect.modSpecKey === "data.traits.weaponProf.value",
                isDamage: ["data.traits.di.value", "data.traits.dr.value", "data.traits.dv.value"].includes(effect.modSpecKey),
                proficiencies: { 0: "Not Proficient", 0.5: "Half Proficiency", 1: "Proficient", 2: "Expertise" },
                isProficiency: effect.modSpecKey.includes("data.skills") && effect.modSpecKey.includes("value"),
                isAbility: effect.modSpecKey.includes("data.skills") && effect.modSpecKey.includes("ability"),
                isAdvantage: effect.modSpecKey === "data.attributes.advantage",
            }, { inplace: true, overwrite: true, insertKeys: true, insertValues: true });
        }
        return data;
    }
    async _updateObject(event, formData) {
        let effects = getProperty(this.object.data.flags, "dynamiceffects.effects") || [];
        let mode = formData.mode === "+" ? "+" : "=";
        if (formData.modSpecKey.includes("data.skills") && formData.modSpecKey.includes("ability")) {
            mode = "=";
            if (formData.value === "")
                formData.value = "dex";
        }
        if (formData.modSpecKey === "data.traits.ci.value") { }
        if (formData.languages)
            formData.value = formData.languages;
        formData.value = formData.value.replace(/@data./g, "@");
        if (formData.modSpecKey.includes("token") || formData.modSpecKey.includes("macro") || formData.modSpecKey === "flags.dnd5e.conditions")
            formData.active = true;
        let newEffect = new ItemEffect(this.options.id, this.object.id, formData.modSpecKey, mode, formData.value, formData.active);
        let found = false;
        for (let i = 0; i < effects.length; i++) {
            if (effects[i].id === this.options.id) {
                effects[i] = newEffect;
                found = true;
                break;
            }
        }
        if (!found)
            effects.push(newEffect);
        return this.object.update({ "flags.dynamiceffects.effects": duplicate(effects) });
    }
}
// static categories = {abilities: "Abilities", attributes: "Attributes", skills: "Skills", flags: "Flags", currency: "Currency", details: "Details", spells: "Spells", traits: "Traits"};
ItemEffectSelector.categories = {
    abilities: "dynamiceffects.abilities",
    attributes: "dynamiceffects.attributes",
    bonuses: "dynamiceffects.bonuses",
    currency: "dynamiceffects.currency",
    details: "dynamiceffects.details",
    flags: "dynamiceffects.flags",
    resources: "dynamiceffects.resources",
    skills: "dynamiceffects.skills",
    spells: "dynamiceffects.spells",
    traits: "dynamiceffects.traits",
    macro: "macro"
};
ItemEffectSelector.advantages = {
    none: "dynamiceffects.none",
    adv: "dynamiceffects.advantage",
    disadv: "dynamiceffects.disadvantage"
};
