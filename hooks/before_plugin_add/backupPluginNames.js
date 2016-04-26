#!/usr/bin/env node
module.exports = function(context) {

	var q = context.requireCordovaModule('q');
	var fs = context.requireCordovaModule('fs');
	var path = context.requireCordovaModule('path');

	var pluginDir = context.opts.plugin.dir;

	// backup names of the installed plugins to compare later which ones are new
	return q.nfcall(
		fs.writeFile,
		path.join(
			pluginDir,
			'pluginNames.json'
		),
		JSON.stringify(context.opts.cordova.plugins)
	);
};
