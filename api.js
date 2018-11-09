// Client ID and API key from the Developer Console
var CLIENT_ID = '709980319583-sd4omri8vnouh0jti1u6fh4tudl28hmv.apps.googleusercontent.com';
var API_KEY = 'AIzaSyA8GmS2x8a1HZ6Dp0YWHPU0tgaTQaKYONs';

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = "https://www.googleapis.com/auth/calendar";

// Enable verbose logging for debug purposes
var STYLES_ON = false;

var $authorizeButton, $signoutButton, $resyncButton, $scheduleTable, $controls, $statusContent;

function injectStyles() {
	var navSheet = '<link href="https://iredesigned.com/stuff/northshore/controls.css?v=' + Math.floor( Math.random() * 10000 ) + '" type="text/css" rel="stylesheet">';
	$( 'body' ).append( navSheet );
	if ( STYLES_ON ) {
		console.log( 'Injecting custom stylesheets' );
		var sheet = '<link href="https://iredesigned.com/stuff/northshore/style.css?v=' + Math.floor( Math.random() * 10000 ) + '" type="text/css" rel="stylesheet">';
		$( 'iframe#Nav' ).contents().find( 'body' ).append( sheet );
		$( 'iframe#Main' ).contents().find( 'body' ).append( sheet );
		$( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( 'body' ).append( sheet );
		$( 'body' ).append( sheet );
	} else {
		console.log( 'Not injecting stylesheets' );
	}
}

function syncEvents( workDates, existingWorkEvents ) {
	// console.log( 'Comparing existing events with schedule table' );
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
	function dateDiffInDays( a, b ) {
		const _MS_PER_DAY = 1000 * 60 * 60 * 24;
		const utc1 = Date.UTC( a.getFullYear(), a.getMonth(), a.getDate() );
		const utc2 = Date.UTC( b.getFullYear(), b.getMonth(), b.getDate() );
		return Math.floor( (utc2 - utc1) / _MS_PER_DAY );
	}

	function areConsecutive( date1, date2 ) {
		let a = new Date( date1.year, date1.month - 1, date1.day );
		let b = new Date( date2.year, date2.month - 1, date2.day );
		if ( dateDiffInDays( a, b ) == 1 ) {
			// console.log( $.format.date( a, 'yyyy-MM-dd' ) + ' and ' + $.format.date( b, 'yyyy-MM-dd' ) + ' are consecutive' );
			return true;
		} else {
			// console.log( $.format.date( a, 'yyyy-MM-dd' ) + ' and ' + $.format.date( b, 'yyyy-MM-dd' ) + ' are NOT consecutive' );
			return false;
		}
	}

	console.log( 'Traversing ' + workDates.length + ' workdays' );
	var i = 0;
	var numberOfConsecutiveSets = 0;
	while ( i < workDates.length ) {
		console.log( '\nProcessing workday ' + i );
		let date = workDates[i];
		let startTime = new Date( date.year, date.month - 1, date.day );
		startTime.setHours( 7 );
		startTime.setMinutes( 0 );
		let endTime;
		// Check for consecutive days and merge calendar entries
		var indexFirstInSet = i,
			indexLastInSet = indexFirstInSet + 1,
			consecutiveSet = false,
			setLength = 0,
			checkingForConsecutiveDates = true;
		while ( checkingForConsecutiveDates ) {
			let logDate = new Date( workDates[i].year, workDates[i].month - 1, workDates[i].day );
			// console.log( 'Checking if workday ' + i + ' (' + $.format.date( logDate, 'yyyy-MM-dd' ) + ') has any consecutives' );
			if ( workDates[indexLastInSet]
				&& areConsecutive( workDates[i], workDates[indexLastInSet] )
				&& workDates[indexFirstInSet].note === workDates[indexLastInSet].note ) {
				console.log( '... and have matching descriptions' );
				consecutiveSet = true;
				setLength++;
				i++;
				indexLastInSet++;
				checkingForConsecutiveDates = true;
			} else {
				// console.log( 'Workday ' + indexLastInSet + ' does NOT have consecutives' );
				checkingForConsecutiveDates = false;
				i++;

			}
		}
		// while ( checkingForConsecutiveDates ) {
		// 	console.log( 'Checking if workDays[' + i + '] has any consecutives' );
		// 	checkingForConsecutiveDates = false;
		// 	if ( workDates[indexLastInSet]
		// 		&& areConsecutive( workDates[indexFirstInSet], workDates[indexLastInSet] )
		// 		&& workDates[indexFirstInSet].note === workDates[indexLastInSet].note ) {
		// 		console.log( 'Found consecutive set' );
		// 		consecutiveSet = true;
		// 		setLength++;
		// 		i++;
		// 		checkingForConsecutiveDates = true;
		// 	}
		// }

		if ( consecutiveSet ) {
			numberOfConsecutiveSets++;
			endTime = new Date( workDates[indexLastInSet - 1].year, workDates[indexLastInSet - 1].month - 1, workDates[indexLastInSet - 1].day + 1 );
			console.log( 'Found ' + setLength + ' consecutive days' );
			// With multi-day all-day events, GCal needs an extra day for some reason
		} else {
			endTime = new Date( date.year, date.month - 1, date.day );
		}
		endTime.setHours( 19 );
		endTime.setMinutes( 30 );

		i++;

		let colorId;
		// 0 = Calendar color (green)
		// 1 = Lavender
		// 2 = Sage
		// 3 = Grape
		// 4 = Flamingo
		// 5 = Banana
		// 6 = Tangerine
		// 7 = Peacock
		// 8 = Graphite
		// 9 = Blueberry
		// 10 = Basil
		// 11 = Tomato
		// 12 or higher = invalid color and the event will not be created
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
	console.log( 'Traversed ' + i + ' workdays' );
	console.log( numberOfConsecutiveSets + ' consecutive sets found. ' + eventsToAdd.length + ' events will be created' );
	// console.log(eventsToAdd);
	workDates.forEach( function( date, index, dates ) {
	} );

	if ( eventsToAdd.length ) {
		sendBatchToCalendar( eventsToAdd );
	} else {
		console.log( 'No updates needed, calendar is in sync' );
		status( "Calendar synced, no changes" );
	}

	$resyncButton.show();
	// TODO True syncing; i.e. remove events that are in GCal but not in NorthShore. Quite rare; not very important. Also relatively complex due to the possibility of user changing periods and past events in particular.
}

function sendBatchToCalendar( events ) {
	console.log( 'Sending ' + events.length + ' events to calendar' );
	console.log( events );
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
		console.log( events.length + ' events sent' );
		status( events.length + " events synced", title );
	} );
}

function sendSingleEventToCalendar( event ) {
	console.log( event );
	var request = gapi.client.calendar.events.insert( {
		'calendarId': 'primary',
		'resource': event
	} );
	request.execute( function( event ) {
	} );
}

function getCurrentRange() {
	var currentPeriodText = $( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( '#ctl00_formContentPlaceHolder_dateRangeLabel' ).text();
	var currentPeriodTextDates = currentPeriodText.replace( '', '' );
	var shortenedCurrentPeriodText = currentPeriodTextDates.replace( /\/20/g, '/' );
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
	console.log( 'Initializing API client' );
	gapi.client.init( {
		apiKey: API_KEY,
		clientId: CLIENT_ID,
		discoveryDocs: DISCOVERY_DOCS,
		scope: SCOPES
	} ).then( function() {
		console.log( 'API client initialized' );
		// Listen for sign-in state changes.
		gapi.auth2.getAuthInstance().isSignedIn.listen( updateSigninStatus );
		// Handle the initial sign-in state.
		updateSigninStatus( gapi.auth2.getAuthInstance().isSignedIn.get() );
	} );
}

// Called when the signed in status changes, to update the UI appropriately. After a sign-in, the API is called.
function updateSigninStatus( isSignedIn ) {
	console.log( 'Checking authorization status' );
	if ( isSignedIn ) {
		console.log( 'Client is authorized' )
		$authorizeButton.hide();
		$signoutButton.show();
		runWorkdays();
	} else {
		console.log( 'Authorization button enabled, waiting for user to log in' );
		$authorizeButton.show();
		$signoutButton.hide();
		$resyncButton.hide();
	}
}

function handleAuthClick( event ) {
	gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick( event ) {
	gapi.auth2.getAuthInstance().signOut();
}

function status( message, title ) {
	var $text = $( '<div class="bounceIn">'+message + '</div>' );
	$statusContent.html( $text );
	if ( title !== undefined ) $statusContent.find( 'div:last-child' ).attr( 'title', title );
}

function deleteEvent( event ) {
	gapi.client.load( 'calendar', 'v3', function() {
		var request = gapi.client.calendar.events.delete( {
			'calendarId': 'primary',
			'eventId': event.id
		} );
		request.execute( function( response ) {
			if ( response.error || response == false ) {
				console.log( 'Error' );
			}
			else {
				console.log( 'Successfully deleted ' + event.start.date + ' (including any immediately following days)' );
			}
		} );
	} );
}

function runWorkdays( event ) {
	console.log( 'Retrieving existing calendar entries' );
	var existingWorkdays = [];
	var currentRange = getCurrentRange();
	var currentRangeStart = currentRange['start'];
	var currentRangeEnd = currentRange['end'];
	console.log( currentRangeStart );
	console.log( currentRangeEnd );
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
		console.log( 'Existing calendar entries retrieved' );
		var events = response.result.items;
		if ( events.length > 0 ) {
			for ( i = 0; i < events.length; i++ ) {
				var event = events[i];
				if ( event.description === "Save lives in the ICU" ) {
					var eventDate = new Date( event.start.date );
					if ( (eventDate >= currentRangeStart) && (eventDate <= currentRangeEnd) ) deleteEvent( event );
					existingWorkdays.push( event );
				}
			}
		}
		syncEvents( parseScheduleTable(), existingWorkdays );
	} );
}

function handleClientLoad() {
	console.log( 'Loading Google Calendar API' );
	gapi.load( 'client:auth2', initClient );
}

function createSidebarControls() {
	console.log( 'Creating sidebar controls' );
	$controls = $( '#api_controls' );
	if ( $controls.length == 0 ) {
		var $navbar = $( 'iframe#Nav' );
		$navbar.css( 'width', 'calc(100% - 425px)' );
		$controls = $( '<div id="api_controls"></div>' );
		$navbar.after( $controls );

		$authorizeButton = $( '<button class="material-button-raised" id="authorize_button" style="display: none;">Authorize Google Calendar</button>' );
		$statusContent = $( '<pre id="status_content" style="font-family: sans-serif; font-size: 14px; color: #eee; font-weight: normal; font-size: 13px; line-height: 1.5;">GCal Connector v0.2</pre>' );
		$resyncButton = $( '<button class="material-button-raised" id="resync_button" style="display: none;">Resync current date range</button>' );
		$signoutButton = $( '<button class="material-button-raised" id="signout_button" style="display: none;">Deauthorize</button>' );
		$controls.append( $authorizeButton, $statusContent, /*$resyncButton,*/ $signoutButton );

		$authorizeButton.on( 'click', handleAuthClick );
		$signoutButton.on( 'click', handleSignoutClick );
		$resyncButton.on( 'click', runWorkdays );
		$( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( '#ctl00_formContentPlaceHolder_nextAlphaImage, #ctl00_formContentPlaceHolder_prevAlphaImage' ).remove();
		$( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( '#ctl00_formContentPlaceHolder_dateRangeLabel' )
			.after( '<div style="margin-top: 8px">Please reload the page to change the current range. Run the connector again if you need to sync the new workdays.</div>' );
	} else {
		console.log( 'Not creating controls, they already exist' )
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
	// var navInterval = setInterval( function() {
	// 	if ( $( 'iframe#Nav' ).length && $( 'iframe#Nav' ).contents().find( '#ctl00_formContentPlaceHolder_employeeAI' ) ) {
	// 		console.log( 'Navigation loaded' );
	// 		clearInterval( navInterval );
	// 		setTimeout( function() {
	// 			$( 'iframe#Nav' ).contents().find( '#ctl00_formContentPlaceHolder_employeeAI' ).click();
	// 		}, 750 );
	// 	}
	// }, 250 );
	console.log( 'Connector running' );
	var interval = setInterval( function() {
		console.log( 'Waiting for schedule page and all frames to load...' );
		if ( $( 'iframe#Main, #west_side_div' ).length > 1 ) {
			$scheduleTable = $( 'iframe#Main' ).contents().find( 'table#ctl00_formContentPlaceHolder_myScheduleTable' );
			var $sidebarWidgets = $( '#west_side_div' ).find( '.rcard' );
			if ( ($scheduleTable.length > 0) && ($sidebarWidgets.length > 5) ) {
				clearInterval( interval );
				console.log( 'Schedule table loaded' );
				$( 'iframe#Main' ).contents().find( '#ctl00_formContentPlaceHolder_employeeScheduleHeaderSeparatorDiv' ).closest( 'tr' ).remove();
				injectStyles();
				createSidebarControls();
				handleClientLoad();
				$( 'div[id="Employee Sections"], div#Bookmarks, div[id="Report Favorites"]' ).appendTo( '#west_side_div' );
				$( '#ctl00_formContentPlaceHolder_employeeScheduleHeaderSeparatorDiv' ).remove();
				$( 'table#ctl00_formContentPlaceHolder_employeeScheduleOuterTable > tbody > tr:first-child ' ).remove();
			}
		}
	}, 250 );
}

console.log( 'Google Calendar NorthShore API Connector v0.12' );
var apiConnectorLoaded = true,
	allScriptsLoaded = false,
	gapiLoaded = false,
	jqueryLoaded = false;
if ( !gapiLoaded ) getScript( 'https://apis.google.com/js/api.js', function() {
	console.log( 'Google API loaded' );
	if ( !jqueryLoaded ) getScript( 'https://code.jquery.com/jquery-3.3.1.min.js', function() {
		console.log( 'jQuery loaded' );
		jQuery( window ).keydown( function( e ) {
			if ( e.keyCode === 123 ) debugger;
		} );
		if ( !allScriptsLoaded ) getScript( 'https://iredesigned.com/stuff/northshore/jquery-dateformat.min.js', function() {
			allScriptsLoaded = true;
			runConnector();
		} );
	} );
} );