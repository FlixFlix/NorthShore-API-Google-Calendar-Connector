// Client ID and API key from the Developer Console
var CLIENT_ID = '709980319583-sd4omri8vnouh0jti1u6fh4tudl28hmv.apps.googleusercontent.com';
var API_KEY = 'AIzaSyA8GmS2x8a1HZ6Dp0YWHPU0tgaTQaKYONs';

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = "https://www.googleapis.com/auth/calendar";

// Enable verbose logging for debug purposes
var DEBUG_ON = true;

// Enable verbose logging for debug purposes
var STYLES_ON = false;

var originalLog = console.log;
console.log = function( lineNumber, message ) {
	if ( DEBUG_ON ) originalLog( 'Line ' + lineNumber + ': ' + message );
}

var $authorizeButton, $signoutButton, $resyncButton, $scheduleTable, $sidebar, $navbar;

function getScript( source, callback ) {
	var script = document.createElement( 'script' );
	var prior = document.getElementsByTagName( 'script' )[0];
	script.async = 1;

	script.onload = script.onreadystatechange = function( _, isAbort ) {
		if ( isAbort || !script.readyState || /loaded|complete/.test( script.readyState ) ) {
			script.onload = script.onreadystatechange = null;
			script = undefined;

			if ( !isAbort ) {
				if ( callback ) callback();
			}
		}
	};

	script.src = source;
	prior.parentNode.insertBefore( script, prior );
}

function injectStyles() {
	var navSheet = '<link href="https://iredesigned.com/stuff/northshore/navbar.css?v=' + Math.floor( Math.random() * 10000 ) + '" type="text/css" rel="stylesheet">';
	$( 'iframe#Nav' ).contents().find( 'body' ).append( navSheet );
	if ( STYLES_ON ) {
		console.log( ln(), 'Injecting custom stylesheets' );
		var sheet = '<link href="https://iredesigned.com/stuff/northshore/style.css?v=' + Math.floor( Math.random() * 10000 ) + '" type="text/css" rel="stylesheet">';
		$( 'iframe#Nav' ).contents().find( 'body' ).append( sheet );
		$( 'iframe#Main' ).contents().find( 'body' ).append( sheet );
		$( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( 'body' ).append( sheet );
		$( 'body' ).append( sheet );
	} else {
		console.log( ln(), 'Not injecting stylesheets' );
	}
}

function syncEvents( workDates, existingWorkEvents ) {
	// console.log( ln(), 'Comparing existing events with schedule table' );
	// var crossCheckDates = [];
	var eventsToAdd = [];
	// Build date-only array
	/*
		existingWorkEvents.forEach( function( event ) {
			var when, eventDate;
			if ( event.start.date ) {
				when = event.start.date;
				eventDate = new Date( when );
				eventDate.setTime( eventDate.getTime() + eventDate.getTimezoneOffset() * 60 * 1000 );
			} else {
				when = event.start.dateTime;
				eventDate = new Date( when );
			}
			crossCheckDates.push( eventDate.toLocaleDateString( "en-US" ) );
			}
		);
	*/
	// log( crossCheckDates.length + " days already in calendar", crossCheckDates );
	for ( var i = 0; i < workDates.length; i++ ) {
		let date = workDates[i];
		let startTime = new Date( date.year, date.month - 1, date.day );
		startTime.setHours( 7 );
		startTime.setMinutes( 0 );
		let endTime = new Date( date.year, date.month - 1, date.day );
		endTime.setHours( 19 );
		endTime.setMinutes( 30 );
		// Check for consecutive days and merge calendar entries
		var consecutive = false;
		let dateNext = workDates[i + 1];
		if ( dateNext ) {
			function dateDiffInDays( a, b ) {
				const _MS_PER_DAY = 1000 * 60 * 60 * 24;
				const utc1 = Date.UTC( a.getFullYear(), a.getMonth(), a.getDate() );
				const utc2 = Date.UTC( b.getFullYear(), b.getMonth(), b.getDate() );
				return Math.floor( (utc2 - utc1) / _MS_PER_DAY );
			}

			let date1 = new Date( date.year, date.month - 1, date.day );
			let date2 = new Date( dateNext.year, dateNext.month - 1, dateNext.day );
			if ( dateDiffInDays( date1, date2 ) == 1 ) {
				consecutive = true;
				endTime = new Date( dateNext.year, dateNext.month - 1, dateNext.day + 1 ); // GCal needs an extra day for some reason
				endTime.setHours( 19 );
				endTime.setMinutes( 30 );
				i++;
			}
		}

		if ( true ) {
			let colorId;
			/*
			0 = Calendar color (green)
			1 = Lavender
			2 = Sage
			3 = Grape
			4 = Flamingo
			5 = Banana
			6 = Tangerine
			7 = Peacock
			8 = Graphite
			9 = Blueberry
			10 = Basil
			11 = Tomato
			>12 = Invalid; event will not be created
			*/
			if ( date.note === 'WORK' ) {
				colorId = 7;
			} else { // Holiday, vacation etc.
				colorId = 8;
			}
			var newEventObject = {
				'summary': date.note,
				'location': '777 Park Avenue West, Highland Park, IL',
				'description': 'Save lives in the ICU',
				'start': {
					'date': $.format.date( startTime, 'yyyy-MM-dd' ),
					'timeZone': 'America/Chicago'
				},
				'end': {
					'date': $.format.date( endTime, 'yyyy-MM-dd' ),
					'timeZone': 'America/Chicago'
				},
				'reminders': {
					'useDefault': false,
					'overrides': []
				},
				'colorId': colorId
			};
			eventsToAdd.push( newEventObject );
		}

	}
	workDates.forEach( function( date, index, dates ) {
	} );

	if ( eventsToAdd.length ) {
		sendBatchToCalendar( eventsToAdd );
	} else {
		console.log( ln(), 'No updates needed, calendar is in sync' );
		log( "Calendar synced, no changes" );
	}
	// TODO True syncing; i.e. remove events that are in GCal but not in NorthShore. Quite rare; not very important. Also relatively complex due to the possibility of user changing periods and past events in particular.
}

function sendBatchToCalendar( events ) {
	console.log( ln(), 'Sending ' + events.length + ' events to calendar' );
	var batch = gapi.client.newBatch();
	var title = '';
	events.forEach( function( event ) {
		title += event.start.date + ', ';
		batch.add( gapi.client.calendar.events.insert( {
			'calendarId': 'primary',
			'resource': event
		} ) );
	} );
	batch.then( function() {
		console.log( ln(), events.length + ' events sent' );
		log( events.length + " events synced", title );
	} );
}

function sendSingleEventToCalendar( event ) {
	console.log( ln(), event );
	var request = gapi.client.calendar.events.insert( {
		'calendarId': 'primary',
		'resource': event
	} );
	request.execute( function( event ) {
	} );
}

function getCurrentRange() {
	var currentPeriodText = $( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( '#ctl00_formContentPlaceHolder_dateRangeLabel' ).text();
	var shortenedCurrentPeriodText = currentPeriodText.replace( /\/20/g, '/' );
	var rangeStartText = shortenedCurrentPeriodText.substr( 7, 8 );
	var rangeEndText = shortenedCurrentPeriodText.substr( 18, 8 );
	$( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( '#ctl00_formContentPlaceHolder_dateRangeLabel' ).html( shortenedCurrentPeriodText );
	var result = [];
	result['start'] = new Date( rangeStartText );
	result['end'] = new Date( rangeEndText );
	return result;
}
function parseScheduleTable() {
	var $dates = $( $scheduleTable.find( 'tbody > tr' ).eq( 1 ).find( '.cellContents' ) );
	var $hours = $( $scheduleTable.find( 'tbody > tr' ).eq( 2 ).find( '.cellContents' ) );
	var workdays = [];
	var lastMonthInSet = 1;
	var year = getCurrentRange()['start'].getFullYear();
	$dates.each( function( index, e ) {
		let dateText = $( e ).text(); // Format is MM/DD
		let tableDate = new Object();
		tableDate.day = parseInt( dateText.substr( 3, 2 ) );
		tableDate.month = parseInt( dateText.substr( 0, 2 ) );
		// Check for transition at end of the year
		if ( tableDate.month < lastMonthInSet ) {
			year = year + 1;
		}
		lastMonthInSet = tableDate.month;
		tableDate.year = year;

		// Check if working that day
		let cellContents = $hours.eq( index ).text();
		if ( cellContents ) {
			let cellNumbersCount = cellContents.replace( /[^0-9]/g, '' ).length;
			if ( cellNumbersCount >= 4 ) { // Check if this isn't some holiday or vacation or whatever
				// var tableDateDate = new Date( tableDate.year, tableDate.month - 1, tableDate.day );
				tableDate.note = 'WORK';
			} else {
				tableDate.note = cellContents;
			}
			workdays.push( tableDate );
		}
	} );
	return workdays;
}

function handleClientLoad() {
	gapi.load( 'client:auth2', initClient );
}

// Initializes the API client library and sets up sign-in state listeners.
function initClient( el ) {
	console.log( ln(), 'Initializing API client' );
	gapi.client.init( {
		apiKey: API_KEY,
		clientId: CLIENT_ID,
		discoveryDocs: DISCOVERY_DOCS,
		scope: SCOPES
	} ).then( function() {
		console.log( ln(), 'API client initialized' );
		// Listen for sign-in state changes.
		gapi.auth2.getAuthInstance().isSignedIn.listen( updateSigninStatus );
		// Handle the initial sign-in state.
		updateSigninStatus( gapi.auth2.getAuthInstance().isSignedIn.get() );
		$authorizeButton.on( 'click', handleAuthClick );
		$signoutButton.on( 'click', handleSignoutClick );
	} );
}

// Called when the signed in status changes, to update the UI appropriately. After a sign-in, the API is called.
function updateSigninStatus( isSignedIn ) {
	console.log( ln(), 'Checking authorization status' );
	if ( isSignedIn ) {
		console.log( ln(), 'Client is authorized' )
		$authorizeButton.hide();
		$signoutButton.show();
		getExistingWorkdays();
	} else {
		console.log( ln(), 'Requesting authorization' );
		$authorizeButton.show();
		$signoutButton.hide();
	}
}

function handleAuthClick( event ) {
	gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick( event ) {
	gapi.auth2.getAuthInstance().signOut();
}

function log( message, title ) {
	var $pre = $( 'iframe#Nav' ).contents().find( '#status_content' );
	var $text = $( '<div class="bounceIn">'+message + '</div>' );
	$pre.append( $text );
	if ( title !== undefined ) $pre.find( 'div:last-child' ).attr( 'title', title );
}

function deleteEvent( event ) {
	gapi.client.load( 'calendar', 'v3', function() {
		var request = gapi.client.calendar.events.delete( {
			'calendarId': 'primary',
			'eventId': event.id
		} );
		request.execute( function( response ) {
			if ( response.error || response == false ) {
				console.log( ln(), 'Error' );
			}
			else {
				console.log( ln(), 'Successfully deleted ' + event.start.date + ' (including any immediately following days)' );
			}
		} );
	} );
}

function getExistingWorkdays() {
	console.log( ln(), 'Retrieving existing calendar entries' );
	var timeMin = new Date();
	timeMin.setDate( timeMin.getDate() - 100 ); // TODO Don't (?) go too far back so that old events are deleted but never replaced. Or re-do existing checking.
	gapi.client.calendar.events.list( {
		'calendarId': 'primary',
		'timeMin': timeMin.toISOString(),
		'showDeleted': false,
		'singleEvents': true,
		'maxResults': 100,
		'orderBy': 'startTime'
	} ).then( function( response ) {
		console.log( ln(), 'Existing calendar entries retrieved' );
		var events = response.result.items;
		var existingWorkdays = [];
		if ( events.length > 0 ) {
			for ( i = 0; i < events.length; i++ ) {
				var event = events[i];
				if ( event.description === "Save lives in the ICU" ) {
					var eventDate = new Date( event.start.date );
					var currentRange = getCurrentRange();
					var currentRangeStart = currentRange['start'];
					var currentRangeEnd = currentRange['end'];
					if ( (eventDate >= currentRangeStart) && (eventDate <= currentRangeEnd) ) deleteEvent( event );
					existingWorkdays.push( event );
				}
			}
		}

		syncEvents( parseScheduleTable(), existingWorkdays );
	} );
}

function handleClientLoad() {
	console.log( ln(), 'Loading Google Calendar API' );
	gapi.load( 'client:auth2', initClient );
}

function createSidebarControls() {
	console.log( ln(), 'Creating sidebar controls' );
	$sidebar = $( '<div id="api_navbar"></div>' );
	$( 'iframe#Nav' ).contents().find( '#ctl00_formContentPlaceHolder_logoutAI' ).after( $sidebar );
	console.log( $sidebar );
	if ( $( '#authorize_button' ).length ) {
		$authorizeButton = $( "#authorize_button" );
	} else {
		$authorizeButton = $( '<button class="material-button-raised" id="authorize_button" style="display: none;">Authorize<br>Google Calendar</button>' );
		$sidebar.prepend( $authorizeButton );
	}
	if ( $( '#status_content' ).length ) {
		$statusContent = $( "#status_content" );
	} else {
		$statusContent = $( '<pre id="status_content" style="font-family: sans-serif; font-size: 14px; color: #6200ee; font-weight: normal; font-size: 13px; line-height: 1.5;"></pre>' );
		$sidebar.append( $statusContent );
	}
	if ( $( '#resync_button' ).length ) {
		$resyncButton = $( "#resync_button" );
	} else {
		$resyncButton = $( '<button id="resync_button" style="width: 100%; display: none;">Resync with shown period</button>' );
		$sidebar.append( $resyncButton );
	}
	if ( $( '#signout_button' ).length ) {
		$signoutButton = $( "#signout_button" );
	} else {
		$signoutButton = $( '<button class="material-button-raised" id="signout_button" style="margin-top: 1px; display: none;">Deauthorize</button>' );
		$sidebar.append( $signoutButton );
	}
	if ( $( '#signout_button' ).length ) {
		$signoutButton = $( "#signout_button" );
	} else {
		$signoutButton = $( '<button class="material-button-raised" id="signout_button" style="margin-top: 1px; display: none;">Deauthorize</button>' );
		$sidebar.append( $signoutButton );
	}
}

function getScript( source, callback ) {
	var script = document.createElement( 'script' );
	var prior = document.getElementsByTagName( 'script' )[0];
	script.async = 1;

	script.onload = script.onreadystatechange = function( _, isAbort ) {
		if ( isAbort || !script.readyState || /loaded|complete/.test( script.readyState ) ) {
			script.onload = script.onreadystatechange = null;
			script = undefined;

			if ( !isAbort ) {
				if ( callback ) callback();
			}
		}
	};

	script.src = source;
	prior.parentNode.insertBefore( script, prior );
}

function runConnector() {
	var navInterval = setInterval( function() {
		if ( $( 'iframe#Nav' ).length && $( 'iframe#Nav' ).contents().find( '#ctl00_formContentPlaceHolder_employeeAI' ) ) {
			console.log( ln(), 'Navigation loaded' );
			clearInterval( navInterval );
			setTimeout( function() {
				$( 'iframe#Nav' ).contents().find( '#ctl00_formContentPlaceHolder_employeeAI' ).click();
			}, 750 );
		}
	}, 250 );
	var interval = setInterval( function() {
		console.log( ln(), 'Waiting for schedule page and all frames to load...' );
		if ( $( 'iframe#Main, #west_side_div' ).length > 1 ) {
			$sidebar = $( '#west_side_div' );
			$scheduleTable = $( 'iframe#Main' ).contents().find( 'table#ctl00_formContentPlaceHolder_myScheduleTable' );
			var $sidebarWidgets = $sidebar.find( '.rcard' );
			if ( ($scheduleTable.length > 0) && ($sidebarWidgets.length > 5) ) {
				clearInterval( interval );
				console.log( ln(), 'Schedule table loaded' );
				$( 'iframe#Main' ).contents().find( '#ctl00_formContentPlaceHolder_employeeScheduleHeaderSeparatorDiv' ).closest( 'tr' ).remove();
				injectStyles();
				createSidebarControls();
				handleClientLoad();
				$( 'div[id="Employee Sections"], div#Bookmarks, div[id="Report Favorites"]' ).appendTo( '#west_side_div' );
				$( '#ctl00_formContentPlaceHolder_employeeScheduleHeaderSeparatorDiv' ).remove();
				$( 'table#ctl00_formContentPlaceHolder_employeeScheduleOuterTable > tbody > tr:first-child ' ).remove();
			}
		}
	}, 2500 );
}

function ln() {
	var e = new Error();
	if ( !e.stack ) try {
		// IE requires the Error to actually be throw or else the Error's 'stack'
		// property is undefined.
		throw e;
	} catch ( e ) {
		if ( !e.stack ) {
			return 0; // IE < 10, likely
		}
	}
	var stack = e.stack.toString().split( /\r\n|\n/ );
	// We want our caller's frame. It's index into |stack| depends on the
	// browser and browser version, so we need to search for the second frame:
	var frameRE = /:(\d+):(?:\d+)[^\d]*$/;
	do {
		var frame = stack.shift();
	} while ( !frameRE.exec( frame ) && stack.length );
	return frameRE.exec( stack.shift() )[1];
}

getScript( 'https://apis.google.com/js/api.js', function() {
	console.log( ln(), 'jQuery loaded' );
	getScript( 'https://code.jquery.com/jquery-3.3.1.min.js', function() {
		getScript( 'https://iredesigned.com/stuff/northshore/jquery-dateformat.min.js', function() {
			runConnector();
		} );
	} );
} );

console.log( ln(), 'Google Calendar NorthShore API Connector v0.11 running' );

