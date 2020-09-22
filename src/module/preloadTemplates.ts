export const preloadTemplates = async function() {
	const templatePaths = [
		// Add paths to "modules/dae/templates"
		`./modules/dae/templates/dae-tab.html`,
		`./modules/dae/templates/dae-selector.html`,
		`./modules/dae/templates/activeItem-selector.html`

	];

	return loadTemplates(templatePaths);
}
