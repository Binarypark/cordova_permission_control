#!/usr/bin/env node
module.exports = function(context) {

	var q = context.requireCordovaModule('q');
	var fs = context.requireCordovaModule('fs');
	var path = context.requireCordovaModule('path');
	var xml = context.requireCordovaModule('cordova-common').xmlHelpers;
	var cordovaCommon = context.requireCordovaModule('cordova-common');
	var PlatformMunger = cordovaCommon.ConfigChanges.PlatformMunger;
	var PluginInfo = cordovaCommon.PluginInfo;
	var PlatformJson = cordovaCommon.PlatformJson;
	var cordovaLib = context.requireCordovaModule('cordova-lib');

	var cordovaPlatforms = cordovaLib.cordova_platforms;

	var inquirer = require('inquirer');

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

	function offerChoices(pluginInfo) {

		if(pluginInfo.permissions.length === 0) {

			return pluginInfo;
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

			pluginInfo.permissions = pluginInfo.permissions.filter(function(permission) {

				return answers.permissionsToRemove.indexOf(permission.name + ' (' + permission.platform + ')') !== -1 ? true : false;
			});

			return pluginInfo;
		});
	}

	function removePermissions(pluginInfo) {

		if(!pluginInfo || pluginInfo.permissions.length === 0) {

			return q(pluginInfo);
		}

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

	function updatePlatformConfig(pluginInfo) {

		if(!pluginInfo || pluginInfo.permissions.length === 0) {

			return q();
		}

		var pluginDir = path.dirname(pluginInfo.pluginXmlFilePath);
		var platforms = pluginInfo.permissions.map(function(permission) {

			return permission.platform;
		}).filter(function(platform, index, self) {

			return self.indexOf(platform) === index;
		});

		var installedPlatforms = context.opts.cordova.platforms;

		return platforms.reduce(function(soFar, platform) {

			var platformDir = path.join(context.opts.projectRoot, 'platforms', platform);

			if(installedPlatforms.indexOf(platform) === -1) {

				return soFar;
			}

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

	function permissionControl(previousValue, currentValue) {

		return previousValue.then(function() {

				return lookForPermissions(currentValue);
			})
			.then(offerChoices)
			.then(removePermissions)
			.then(updatePlatformConfig)
		;
	}

	var oldPlugins = require(path.join(context.opts.plugin.dir, 'pluginNames.json'));
	var newPlugins = context.opts.cordova.plugins.filter(function(pluginName) {

		return oldPlugins.indexOf(pluginName) === -1;
	});

	return newPlugins.reduce(permissionControl, q());
};
