#!/usr/bin/env node
module.exports = function(context) {

	var q = context.requireCordovaModule('q');
	var fs = context.requireCordovaModule('fs');
	var path = context.requireCordovaModule('path');
	var cordovaCommon = context.requireCordovaModule('cordova-common');
	var xml = cordovaCommon.xmlHelpers;
	var PluginInfo = cordovaCommon.PluginInfo;

	var cordovaLib = context.requireCordovaModule('cordova-lib');
	var cordovaPlatforms = cordovaLib.cordova_platforms;

	var inquirer = require('inquirer');

	/**
	 * scan plugin.xml for permissions and return a pluginInfo data structure
	 * @param String pluginName
	 *
	 * @return pluginInfo custom plugin information object
	 * {
	 *   permissions: [{
	 *     name: permissionName,
	 *     parentElem: XMLNode,
	 *     platform: platform
	 *   }],
	 *   pluginXml: parsedPluginXml
	 *   pluginXmlFilePath: pathToPluginXml,
	 *   originalInfo: CordovaCommon.PluginInfo
 	 * }
	 */
	function lookForPermissions(pluginName) {

		var pluginXmlFilePath = path.join(
			context.opts.projectRoot,
			'plugins',
			pluginName,
			'plugin.xml'
		);

		var pluginXml = xml.parseElementtreeSync(pluginXmlFilePath);
		var root = pluginXml.getroot();

		var permissions = [];
		var platforms = root.findall('.//platform');
		platforms.forEach(function(platform) {

			var permissionParentElems = platform.findall('.//config-file[@target="AndroidManifest.xml"][uses-permission]');
			permissionParentElems.map(function(element) {

				var permissionsInParent = element.findall('.//uses-permission');
				permissionsInParent.forEach(function(permissionElem) {

					var permission = permissionElem.attrib['android:name'];
					permissions.push({
						name: permission,
						parentElem: element,
						platform: platform.attrib.name,
					});
				});
			});
		});

		var pluginInfo = {
			permissions: permissions,
			pluginXml: pluginXml,
			pluginXmlFilePath: pluginXmlFilePath,
			name: pluginName,
			originalInfo: new PluginInfo(path.dirname(pluginXmlFilePath))
		};

		return pluginInfo;
	}

	/**
	 * create the command line prompt based on the retrieved permissions
	 * @param {Object} pluginInfo
	 *
	 * @return Promise Either empty Promise or Iquirer prompt
	 */
	function offerChoices(pluginInfo) {

		if(pluginInfo.permissions.length === 0) {

			return q();
		}

		var permissionChoices = pluginInfo.permissions.map(function(permission) {

			return permission.name + ' (' + permission.platform + ')';
		});

		var question = {
			type: 'checkbox',
			name: 'permissionsToRemove',
			message: 'Select the permissions that you would like to REMOVE from this plugin (' + pluginInfo.name + ')',
			choices: permissionChoices,
		};

		return inquirer.prompt([question]).then(function(answers) {

			// filter the permissions based on the answers to keep only the ones which should be removed
			pluginInfo.permissions = pluginInfo.permissions.filter(function(permission) {

				return answers.permissionsToRemove.indexOf(permission.name + ' (' + permission.platform + ')') !== -1 ? true : false;
			});

			return pluginInfo;
		});
	}

	/**
	 * remove the selected permissions from plugin.xml of the plugin
	 * @param {Object}|undefined pluginInfo
	 *
	 * @return Promise Either empty promise or File writer promise
	 */
	function removePermissions(pluginInfo) {

		if(!pluginInfo || pluginInfo.permissions.length === 0) {

			return q();
		}

		// remove previously selected permissions from plugin.xml
		pluginInfo.permissions.forEach(function(permission) {

			var selector = '@android:name="' + permission.name + '"';

			var element = permission.parentElem.find('uses-permission[' + selector + ']');
			permission.parentElem.remove(element);
		});

		var xml = pluginInfo.pluginXml.write({indent: 4});

		return q.nfcall(fs.writeFile, pluginInfo.pluginXmlFilePath, xml).then(function() {

			return pluginInfo;
		});
	}

	/**
	 * update the platform configuration (i.e. android.json in platforms/android)
	 * @param {Object}|undefined pluginInfo
	 *
	 * @return Promise
	 */
	function updatePlatformConfig(pluginInfo) {

		if(!pluginInfo || pluginInfo.permissions.length === 0) {

			return q();
		}

		var pluginDir = path.dirname(pluginInfo.pluginXmlFilePath);
		// determine which platform configs have to be updated
		var platforms = pluginInfo.permissions.map(function(permission) {

			return permission.platform;
		}).filter(function(platform, index, self) {

			return self.indexOf(platform) === index;
		});

		var installedPlatforms = context.opts.cordova.platforms;

		// update all platforms in sequence
		return platforms.reduce(function(soFar, platform) {

			var platformDir = path.join(context.opts.projectRoot, 'platforms', platform);

			// check if platform is installed
			if(installedPlatforms.indexOf(platform) === -1) {

				return soFar;
			}

			// if platform is installed remove the plugin and install it with the updated PluginInfo
			var platformApi = cordovaPlatforms.getPlatformApi(platform, platformDir);
			var newInfo = new PluginInfo(path.dirname(pluginInfo.pluginXmlFilePath));
			var options = {
				 usePlatformWww: true
			};

			return soFar.then(function() {

				return platformApi
					.removePlugin(pluginInfo.originalInfo, options)
					.then(function() {

						return platformApi.addPlugin(newInfo, options);
					})
				;
			});
		}, q());
	}

	/**
	 * initialize the whole permission control function chain
	 * @param Promise
	 *
	 * @return Promise
	 */
	function permissionControl(previousValue, currentValue) {

		return previousValue.then(function() {

				return lookForPermissions(currentValue);
			})
			.then(offerChoices)
			.then(removePermissions)
			.then(updatePlatformConfig)
		;
	}

	// find out which plugins where installed just now
	var oldPlugins = require(path.join(context.opts.plugin.dir, 'pluginNames.json'));
	var newPlugins = context.opts.cordova.plugins.filter(function(pluginName) {

		return oldPlugins.indexOf(pluginName) === -1;
	});

	/**
	 * run tasks in sequence for each platformApi
	 * @see https://github.com/kriskowal/q#sequences
	 */
	return newPlugins.reduce(permissionControl, q());
};
