# Mobile build

This folder holds artifacts for an optional native mobile package of Space Mini.

To make an Android APK available for download within the web app:

1. Install a packaging tool such as [Capacitor](https://capacitorjs.com) or [Cordova](https://cordova.apache.org).
2. Initialize the wrapper and copy the web assets from this project.
3. Use the Android SDK to build a signed APK and place the output in this folder as `space_mini.apk`.

iOS builds can be produced with the respective platform tools in a similar way.
