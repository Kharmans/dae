import { FormBuilder } from "../../libs/FormBuilder.js";

export class AutoEffects {
  static async showForm() {
    const formBuilder = new FormBuilder();
    // Play code tp test Portal.formBuilder
    formBuilder.title("RPG Character Creation Form")
      // Character Info Tab
      .tab({ id: "character-info", icon: "fa-solid fa-user", label: "Character Info", })
      .text({ name: "character-name", label: "Character Name", hint: "Enter the character's name", value: "" })
      .select({
        name: "character-race", label: "Race", hint: "Select the character's race", value: "", options: {
          "human": "Human",
          "elf": "Elf",
          "dwarf": "Dwarf",
          "orc": "Orc"
        }
      })
      .select({
        name: "character-class", label: "Class", hint: "Select the character's class", value: "", options: {
          "warrior": "Warrior",
          "mage": "Mage",
          "rogue": "Rogue",
          "cleric": "Cleric"
        }
      })
      .number({ name: "character-age", label: "Age", hint: "Enter the character's age", value: 18, min: 0, max: 100, step: 1 })
      .color({ name: "character-color", label: "Favorite Color", hint: "Select the character's favorite color", value: "#000000" })
      .file({ name: "character-portrait", label: "Portrait", hint: "Upload the character's portrait", value: "" })

      // Abilities Tab
      .tab({ id: "abilities", icon: "fa-solid fa-dumbbell", label: "Abilities" })
      .fieldset({ legend: "Physical Abilities" })
      .number({ name: "strength", label: "Strength", hint: "Enter the strength value", value: 10, min: 0, max: 20, step: 1 })
      .number({ name: "dexterity", label: "Dexterity", hint: "Enter the dexterity value", value: 10, min: 0, max: 20, step: 1 })
      .fieldset()
      .fieldset({ legend: "Mental Abilities" })
      .number({ name: "intelligence", label: "Intelligence", hint: "Enter the intelligence value", value: 10, min: 0, max: 20, step: 1 })
      .number({ name: "wisdom", label: "Wisdom", hint: "Enter the wisdom value", value: 10, min: 0, max: 20, step: 1 })
      .fieldset()
      .fieldset({ legend: "Other Abilities" })
      .number({ name: "charisma", label: "Charisma", hint: "Enter the charisma value", value: 10, min: 0, max: 20, step: 1 })
      .number({ name: "luck", label: "Luck", hint: "Enter the luck value", value: 10, min: 0, max: 20, step: 1 })
      .fieldset()

      // Equipment Tab
      .tab({ id: "equipment", icon: "fa-solid fa-sword", label: "Equipment" })
      .multiSelect({
        name: "weapons", label: "Weapons", hint: "Select the character's weapons", value: [], options: {
          "sword": "Sword",
          "bow": "Bow",
          "dagger": "Dagger",
          "staff": "Staff"
        }
      })
      .multiSelect({
        name: "armor", label: "Armor", hint: "Select the character's armor", value: [], options: {
          "leather": "Leather Armor",
          "chainmail": "Chainmail Armor",
          "plate": "Plate Armor",
          "robe": "Robe"
        }
      })
      .multiSelect({
        name: "potions", label: "Potions", hint: "Select the character's potions", value: [], options: {
          "healing": "Healing Potion",
          "mana": "Mana Potion",
          "strength": "Strength Potion",
          "speed": "Speed Potion"
        }
      })

      // Randomize Button
      .button({ label: "Randomize", icon: "fas fa-d6", callback: function (e) { console.log(this, e); } });

    const data = await formBuilder.render();
    console.error(data);

      return formBuilder;
  }
}
