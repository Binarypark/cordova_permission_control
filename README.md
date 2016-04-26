cordova_permission_control
==========================

This plugin lets you control the permissions that other plugins ask for. Currently
it is only designed for the `Android` platform, but it can be extended to other
platforms as well, just drop me a pull request or start an issue.

__Be aware that this might potentially break the functionality of the other plugins. Make
sure that everything still works as expected.__

## Installation
### Cordova CLI
```
cordova plugin add cordova_permission_control
```

## Usage
This plugin acts when you add a new plugin. If you have plugins where you would
like to remove some permissions you have to re-install them.

### Example
```
$ cordova plugin add cordova-plugin-geolocation
Fetching plugin "cordova-plugin-geolocation@~2.1.0" via npm
Installing "cordova-plugin-geolocation" for android
? Select the permissions that you would like to REMOVE from this plugin (cordov
a-plugin-geolocation) (Press <space> to select)
>( ) android.permission.ACCESS_COARSE_LOCATION (android)
 ( ) android.permission.ACCESS_FINE_LOCATION (android)
 ( ) android.permission.ACCESS_COARSE_LOCATION (amazon-fireos)
 ( ) android.permission.ACCESS_FINE_LOCATION (amazon-fireos)
 ```
Select the permissions you would like to remove and hit `enter`:
```
? Select the permissions that you would like to REMOVE from this plugin (cordov
a-plugin-geolocation)
 ( ) android.permission.ACCESS_COARSE_LOCATION (android)
 (*) android.permission.ACCESS_FINE_LOCATION (android)
 ( ) android.permission.ACCESS_COARSE_LOCATION (amazon-fireos)
>(*) android.permission.ACCESS_FINE_LOCATION (amazon-fireos)
```
That's it. Also works when adding multiple plugins at once.
