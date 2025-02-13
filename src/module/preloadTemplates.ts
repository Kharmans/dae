export const preloadTemplates = async function() {
	const templatePathsV12 = [
		// Add paths to "modules/dae/templates"
		`./modules/dae/templates/ActiveEffects.hbs`,
		`./modules/dae/templates/DAEActiveSheetConfig.html`,
		"./modules/dae/templates/DIMEditor.hbs",
	];

	const templatePaths = [
		"./modules/dae/templates/ActiveEffects.hbs",
		"./modules/dae/templates/DIMEditor.hbs",
		"./modules/dae/templates/DAESheetConfig/Details.hbs",
		"./modules/dae/templates/DAESheetConfig/Duration.hbs",
		"./modules/dae/templates/DAESheetConfig/Changes.hbs",
	];

	const v13 = foundry.utils.isNewerVersion(game.version ?? "", "13");

	return loadTemplates(v13 ? templatePaths : templatePathsV12);
}
