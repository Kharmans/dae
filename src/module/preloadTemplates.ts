export const preloadTemplates = async function() {
	const templatePaths = [
		// Add paths to "modules/dae/templates"
    `./modules/dae/templates/ActorEffects.html`,
    `./modules/dae/templates/ItemEffects.html`,
    `./modules/dae/templates/DAEActiveSheetConfig.html`
	];

	return loadTemplates(templatePaths);
}
