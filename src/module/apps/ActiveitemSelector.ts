/*import { getItemPassiveEffects, doEffects} from "../dae"

export class ActiveItemSelector extends FormApplication {
    static get defaultOptions() {
    const options = super.defaultOptions;
        options.id = "active-item-selector";
        options.classes = ["dnd5e"];
        options.title = game.i18n.localize("dae.ActiveItemSelect");
        options.template = "./modules/dae/templates/activeItem-selector.html";
        options.height = 275;
        options.width = 275;
        return options;
    }

    static initActions() {}
    static setupActions() {}

    getData() {
        // created with an actor
        let data = super.getData();
        data.itemList = {};
        this.object.items
            .filter(item=> getItemPassiveEffects(item.data).length > 0)
            .sort((i1, i2) => i1.name > i2.name ? 1 : -1)
            .forEach(item => {data.itemList[item.id] = ({type: item.data.type, name: item.name});
        })
        data.itemId = "";
        data.submit = "";
        return data;
    }


    activateListeners(html) {
        super.activateListeners(html);
        html.find(".activatebutton").click(this.process)
    }

    activate = true;
    process = (event) => {
        this.activate = event.target.id === "active";
    }

    async _updateObject(event, formData) {
        let item = this.object.items.find(i=> i.id === formData.itemId);
        if (item) {
            doEffects({item, actor: this.object, activate: this.activate})
        }
    }
}


*/