/*
Use this for bookmarklet-friendly minification:
https://www.danstools.com/javascript-minify/
*/

javascript:(function() {
	if ( typeof apiConnectorLoaded === "undefined" ) {
		function callback() {
		}

		var s = document.createElement( "script" );
		s.src = "https://iredesigned.com/stuff/northshore/api.js?v=" + (new Date()).getTime();
		s.id = "northshoreapicalendar";
		if ( s.addEventListener ) s.addEventListener( "load", callback, false );
		else if ( s.readyState ) s.onreadystatechange = callback;
		document.body.appendChild( s );
	} else if ( allScriptsLoaded ) {
		console.log( "Already loaded" );
		if ( !connectorRunning ) runConnector();
		else {
			if ( typeof gapi === "object" ) {
				initClient();
			} else {
				toastr.error( "Please load the current schedule table first<br>Employee > Open Current Schedule" );
			}
		}
	}
})();
