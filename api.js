// Defaults
const
	APPNAME = 'NorthShore API Google Calendar Connector',
	LOCATION = '777 Park Avenue West, Highland Park, IL',
	TIMEZONE = 'America/Chicago',
	FORMAT = 'yyyy-MM-dd',
	DAYSHIFT = { start: 7, end: 7 + 12 },
	WORK = 'WORK',
	PENDING = 'Pending',
	COWORKERS = 'Coworkers',
	BLANK = 'BLANK',
	DELAY = 250;

// Client ID and API key from the Developer Console
const CLIENT_ID = '709980319583-sd4omri8vnouh0jti1u6fh4tudl28hmv.apps.googleusercontent.com';
const API_KEY = 'AIzaSyA8GmS2x8a1HZ6Dp0YWHPU0tgaTQaKYONs';

// Array of API discovery doc URLs for APIs used by the quickstart
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
const SCOPES = "https://www.googleapis.com/auth/calendar";

// Enable verbose logging for debug purposes
var STYLES_ON = false;

// jQuery globals
var $controls,
	$currentUser,
	$authorizeButton,
	$signoutButton,
	$clearButton,
	$runButton,

	$statusContent,

	$scheduleTable,
	$employeeOuterTable,
	$employeeTable,
	$employeeHoursTable;

// Other globals
var coworkersCalendarId, primaryCalendarId;

function injectStylesIntoIframes() {
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

function createEventObject( title, details, startTime, endTime, colorId, isBusy ) {
	return {
		'summary': title,
		// 'location': LOCATION,
		'description': details,
		'start': {
			'date': $.format.date( startTime, FORMAT ),
			'timeZone': TIMEZONE
		},
		'end': {
			'date': $.format.date( endTime, FORMAT ),
			'timeZone': TIMEZONE
		},
		'reminders': {
			'useDefault': false,
			'overrides': []
		},
		'colorId': colorId,
		'transparency': isBusy === 'busy' ? 'opaque' : 'transparent'
	};
}

function syncEvents( range, events, calendarId, calendarName, isProcessFullTable ) {

	var myWorkdays = [], coworkerDays = [];
	// Build date-only array
	console.log( 'Traversing ' + events.length + ' workdays in calendar "' + calendarName + '"' );
	var i = 0;
	while ( i < events.length ) {
		// console.log( '\nProcessing workday ' + i );
		let date = events[i];
		let startTime = new Date( date.year, date.month - 1, date.day );
		startTime.setHours( 7 );
		startTime.setMinutes( 0 );
		let endTime = new Date( date.year, date.month - 1, date.day + 1 );
		endTime.setHours( 19 );
		endTime.setMinutes( 30 );
		i++;

		let colorId = 0;
		if ( date.note === WORK ) {
			colorId = 7; // Blue
		} else if ( date.note === PENDING ) {
			colorId = 2 // Green
		} else { // Holiday, vacation etc.
			colorId = 8; // Gray
		}

		// Generate coworker table
		let table = '<table rules="all" width="100%" frame="border" align="left" cellspacing="0" cellpadding="7">';
		table += '<thead bgcolor="#eaeaea" align="left"><tr><th>Day Nurses</th><th>PCTs</th></tr></thead>';
		table += '<tbody>';
		let totalWorkers = 0, nurses = [], PCTs = [], cc = [], uc = [];
		date.coworkers.forEach( function( el ) {
			if ( el.isDaytimeWorker ) {
				if ( el.title === "RN" ) nurses.push( el.name );
				if ( el.title === "RESOURCE" ) nurses.push( el.name + " (R)" );
				if ( el.title === "PCT" ) PCTs.push( el.name );
				if ( el.title === "CC" ) cc.push( el.name );
				if ( el.title === "UC" ) uc.push( el.name );
				totalWorkers++;
			}
		} );
		for ( let i = 0; i < Math.max( nurses.length, PCTs.length ); i++ ) {
			if ( nurses[i] || PCTs[i] ) {
				let rn = "&nbsp;", pct = "&nbsp;";
				if ( nurses[i] ) rn = nurses[i];
				if ( PCTs[i] ) pct = PCTs[i];
				table += '<tr><td>' + rn + '</td><td>' + pct + '</td></tr>';
			}
		}
		table += '<tr><td>&nbsp;</td><td>&nbsp;</td></tr>'; // blank row
		table += '</table>';
		table += '<table width="100%" frame="border" align="left" cellspacing="0" cellpadding="7">';

		table += '</tbody>';
		// Generate clinical coordinator and unit concierge table
		table += '<thead bgcolor="#eaeaea" align="left"><tr><th>Coordinator</th><th>Secretary</th></tr></thead>';
		table += '<tbody>';
		for ( let i = 0; i < Math.max( cc.length, uc.length ); i++ ) {
			let col1 = "&nbsp;",
				col2 = "&nbsp;";
			if ( cc[i] ) col1 = cc[i];
			if ( uc[i] ) col2 = uc[i];
			table += '<tr><td>' + col1 + '</td><td>' + col2 + '</td></tr>';
		}

		let updated = new Date();
		table += '<tr><td colspan="2"><hr><small><i>Updated: ' + updated.toDateString() + ' at ' + updated.toLocaleTimeString() + '<br><small>' + APPNAME + '</small></i></small></td></tr>';
		table += '</tbody></table>';

		coworkerDays.push( createEventObject( 'Coworkers', table, startTime, endTime, 0, 'available' ) );
		if ( date.note !== BLANK ) myWorkdays.push( createEventObject( date.note, table, startTime, endTime, colorId, 'busy' ) );

	}
	console.log( 'Traversed ' + i + ' workdays' );
	// console.log( myWorkdays.length + ' events will be created' );
	// console.log( coworkerDays.length + ' total events, including off-days will be created in the "Coworkers" calendar' );
	// console.log(myWorkdays);
	events.forEach( function( date, index, dates ) {
	} );
	var theBatch;
	if ( isProcessFullTable )
		theBatch = coworkerDays;
	else
		theBatch = myWorkdays;
	console.log( theBatch );
	if ( theBatch.length ) {
		sendBatchToCalendar( theBatch, calendarId, calendarName );
	} else {
		console.log( 'No updates needed, calendar is in sync' );
		status( "Calendar synced, no changes" );
	}

	$clearButton.show();
	// TODO True syncing; i.e. remove events that are in GCal but not in NorthShore. Quite rare; not very important. Also relatively complex due to the possibility of user changing periods and past events in particular.

}

function sendBatchToCalendar( events, calendarId, calendarName ) {
	console.log( 'Sending ' + events.length + ' events to calendar "' + calendarName + '"' );
	var batch = gapi.client.newBatch();
	var title = '';
	status( "Syncinc " + events.length + " events...", title );
	events.forEach( function( event ) {
		title += event.start.date + ', ';
		batch.add( gapi.client.calendar.events.insert( {
			'calendarId': calendarId,
			'resource': event
		} ) );
	} );
	batch.then( function() {
		console.log( events.length + ' events sent to calendar "' + calendarName + '": ' + title );
		status( events.length + ' events synced to calendar "' + calendarName + '"' );
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
	if ( !currentPeriodText ) return false;
	var currentPeriodTextDates = currentPeriodText.replace( '', '' );
	var rangeStartText = currentPeriodTextDates.substr( 7, 10 );
	var rangeEndText = currentPeriodTextDates.substr( 20, 10 );
	var result = [];
	result['start'] = new Date( rangeStartText );
	result['end'] = new Date( rangeEndText );
	result['end'].setHours( 23, 59, 59, 999 );
	return result;
}

function getCoworkers( columnIndex ) {

	function cleanName( name ) {
		if ( name ) {
			let first = '', last = '', names = [], theCleanName = name;
			names = name.split( ',' );
			if ( names.length ) {
				first = names[1].substr( 1 );
				last = names[0];
				theCleanName = first + '&nbsp;' + last;
			}
			return theCleanName.replace( / /g, '&nbsp;' );
		} else return false;
	}

	function parseHours( str ) {
		var hours = {};
		if ( str.includes( '-' ) ) {
			hours.start = parseInt( str.split( '-' )[0].substr( 0, 2 ) );
			hours.end = hours.start + parseInt( str.split( '-' )[1] );
			return hours;
		} else return false;
	};

	function isDaytimeWorker( hours ) {
		// check if hours overlap with daytime schedule
		let isDaytime = false;
		let isOverlapOrTouch = hours.start <= DAYSHIFT.end && DAYSHIFT.start <= hours.end;
		if ( isOverlapOrTouch ) {
			let latestStart = Math.max( hours.start, DAYSHIFT.start );
			let latestEnd = Math.min( hours.end, DAYSHIFT.end );
			let overlapAmount = latestEnd - latestStart;
			if ( (overlapAmount) > 0 ) isDaytime = true;
		}
		return isDaytime;
	}

	var $rows = $employeeHoursTable.find( '>tbody>tr' );
	var coworkers = [];
	$rows.each( function( rowIndex ) {
		let cellContents = $( this ).find( '>td' ).eq( columnIndex ).find( '.cellContents' ).text();
		if ( cellContents ) {
			let cellNumbersCount = cellContents.replace( /[^0-9]/g, '' ).length;
			if ( cellNumbersCount >= 4 && cellContents.includes( '-' ) ) { // Check if this isn't some holiday or vacation and is a well-formed time schedule
				cellContents = cellContents.replace( /[^\d.-]/g, '' );
				let employee = {};
				employee.name = cleanName( $employeeTable.find( '>tbody>tr' ).eq( rowIndex ).find( '>td' ).eq( 0 ).attr( 'title' ) );
				if ( employee.name ) {
					employee.isDaytimeWorker = isDaytimeWorker( parseHours( cellContents ) );
					employee.title = $employeeTable.find( '>tbody>tr' ).eq( rowIndex ).find( '>td' ).eq( 1 ).find( '.cellContents' ).text();
					if ( employee.title.substring( 0, 2 ) === "RN" && employee.title.length > 2 ) employee.title = "RESOURCE";
					if ( cellContents.includes( "¤" ) ) employee.name = "¤&nbsp;" + employee.name; // Check if pending schedule and add character
					coworkers.push( employee );
				}
			}
		}
	} );
	return (coworkers);
}

function parseScheduleTable() {
	var $dates = $( $scheduleTable.find( 'tbody > tr' ).eq( 1 ).find( '.cellContents' ) );
	var $hours = $( $scheduleTable.find( 'tbody > tr' ).eq( 2 ).find( '.cellContents' ) );
	var $hoursAux = $( $scheduleTable.find( 'tbody > tr' ).eq( 3 ).find( '.cellContents' ) );
	var workdays = [];
	var lastMonthInSet = 1;
	var year = getCurrentRange()['start'].getFullYear();

	function isWorkday( column ) {

	}

	$dates.each( function( index, e ) {
		let dateText = $( e ).text(); // Format is MM/DD
		let tableDate = {};
		tableDate.day = parseInt( dateText.substr( 3, 2 ) );
		tableDate.month = parseInt( dateText.substr( 0, 2 ) );
		// Check for transition at end of the year
		if ( tableDate.month < lastMonthInSet ) {
			year = year + 1;
		}
		lastMonthInSet = tableDate.month;
		tableDate.year = year;

		// Check if working that day
		let cellContents = $hoursAux.eq( index ).text();
		let cellNumbersCount = 0;
		if ( cellContents ) cellNumbersCount = cellContents.replace( /[^0-9]/g, '' ).length;
		if ( !cellContents || cellNumbersCount < 4 || cellNumbersCount > 10 ) cellContents = $hours.eq( index ).text();
		if ( cellContents ) {
			cellNumbersCount = cellContents.replace( /[^0-9]/g, '' ).length;
			if ( cellNumbersCount >= 4 ) { // Check if this isn't some holiday or vacation or whatever
				// var tableDateDate = new Date( tableDate.year, tableDate.month - 1, tableDate.day );
				tableDate.note = WORK;
			} else {
				tableDate.note = cellContents;
			}
			if ( cellContents.substr( 0, 1 ) === "¤" ) tableDate.note = PENDING;
		} else {
			tableDate.note = BLANK;

		}
		tableDate.coworkers = getCoworkers( index );
		workdays.push( tableDate );

	} );
	return workdays;
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
		updateSigninStatus();
	} );
}

// Called when the signed in status changes, to update the UI appropriately. After a sign-in, the API is called.
function updateSigninStatus( GoogleAuth ) {
	console.log( 'Checking authorization status' );
	var isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
	if ( isSignedIn ) {
		let fullName = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getName();
		console.log( 'Client is authorized' );
		toastr.clear();
		status( 'Connected to calendar <strong>' + fullName + '</strong><br>Use the buttons in the top right to perform operations' );
		$currentUser.text( 'Calendar: ' + fullName );
		$authorizeButton.hide();
		$signoutButton.show();
		$clearButton.show();
		$runButton.show();
	} else {
		console.log( 'Authorization button enabled, waiting for user to log in' );
		toastr.warning( 'Please click the Authorize button and log in to your Google account.', 'You are not logged in', { timeOut: 0 } );
		$currentUser.text( 'Not logged in, click Authorize' );
		$authorizeButton.show();
		$signoutButton.hide();
		$clearButton.hide();
		$runButton.hide();
	}
}

function handleAuthClick( event ) {
	gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick( event ) {
	gapi.auth2.getAuthInstance().signOut();
}

function status( message, title ) {
	if ( title !== undefined ) toastr.success( title, message );
	else toastr.success( message );
	// var $text = $( '<div class="bounceIn">'+message + '</div>' );
	// $statusContent.html( $statusContent.html() + '\n' + $text );
	// if ( title !== undefined ) $statusContent.find( 'div:last-child' ).attr( 'title', title );
}

function deleteEvents( events, calendarId, calendarName, callback ) {

	if ( events.length ) {
		status( 'Clearing calendar "' + calendarName + '" of previously-created workdays' );
		console.log( 'Clearing calendar "' + calendarName + '" of ' + events.length + ' out of ' + events.length + ' events...' );
		deletionLoop( events.length );
	} else {
		console.log( 'Calendar "' + calendarName + '" only contains ' + events.length + ' events and they\'re all non-deletable.' );
		callback();
		return;
	}

	// Throttle requests
	function deletionLoop( i ) {
		if ( i <= 0 ) return;
		setTimeout( function() {
			i--;
			deleteSingleEvent( events[i], events.length, calendarId, calendarName, callback );
			deletionLoop( i );
		}, DELAY );
	}

	var deletedEventCounter = 0,
		deletedEventErrors = 0;

	function deleteSingleEvent( event, totalEvents, calendarId, calendarName, callback ) {
		var request = gapi.client.calendar.events.delete( {
			'calendarId': calendarId,
			'eventId': event.id
		} );
		var progress = 0;
		request.execute( function( response ) {
			if ( response.error || response === false ) {
				console.error( 'Error deleting event' );
				deletedEventErrors++;
			} else {
				deletedEventCounter++;
			}
			progress = deletedEventCounter + deletedEventErrors;
			if ( progress === totalEvents ) {
				console.log( 'Calendar cleared: ' + deletedEventCounter + ' events deleted. ' + deletedEventErrors + ' errors.' );
				status( '"' + calendarName + '" calendar cleared', deletedEventCounter + ' events deleted. ' + deletedEventErrors + ' errors.' );
				callback();
			}
		} );
	}
}

function clearCalendar( range, calendarId, calendarName, callback ) {
	gapi.client.calendar.events.list( {
		'q': APPNAME,
		'calendarId': calendarId,
		'timeMin': range['start'].toISOString(),
		'timeMax': range['end'].toISOString(),
		'showDeleted': false,
		'singleEvents': true,
		'orderBy': 'startTime'
	} ).then( function( response ) {
		console.log( 'Retrieved events from calendar "' + calendarName + '"' );
		var events = response.result.items;
		deleteEvents( events, calendarId, calendarName, callback );
	} );
}

function clearThenSyncCalendar( calendarId, calendarName, scheduleTable, clearOnly, isProcessFullTable ) {
	// Retrieve existing events and delete them
	var range = getCurrentRange();
	if ( !range ) {
		toastr.error( 'Please load the schedule table first' );
		return;
	}
	console.log( 'Retrieving existing entries from calendar "' + calendarName + '" so we can clear them. Date range: ' + $.format.date( range['start'], FORMAT ) + ' through ' + $.format.date( range['end'], FORMAT ) );
	clearCalendar( range, calendarId, calendarName, function() {
		if ( !clearOnly ) syncEvents( range, scheduleTable, calendarId, calendarName, isProcessFullTable );
	} );
}

function getCalendars( isClearOnly ) {
	// We need to retrieve all calendars to obtain the calendarID of the "Coworkers" calendar
	gapi.client.calendar.calendarList.list().execute( function( response ) {
		var calendars = response.items;
		// Check if a "Coworkers" calendar already exists and create one if not
		var coworkersCalendarExists = false,
			primaryCalendarExists = false,
			coworkersSummary = '',
			primarySummary = '';
		let scheduleTable = parseScheduleTable();
		calendars.forEach( function( el ) {
			if ( el.summary === COWORKERS ) {
				coworkersCalendarId = el.id;
				coworkersSummary = el.summary;
				coworkersCalendarExists = true;
				console.log( 'Processing calendar "' + coworkersSummary + '"' );
			}
			if ( el.primary ) {
				primaryCalendarId = 'primary';
				primarySummary = el.summary;
				primaryCalendarExists = true;
				console.log( 'Processing calendar "' + primarySummary + '" (primary)' );
			}
		} );
		if ( primaryCalendarExists ) {
			console.log( 'Primary calendar found: ' + primarySummary );
			clearThenSyncCalendar( primaryCalendarId, primarySummary, scheduleTable, isClearOnly, false );
		} else {
			console.log( 'Primary calendar NOT found. Cannot continue.' );
		}
		if ( coworkersCalendarExists ) {
			console.log( 'Coworkers calendar exists. All events will be synced.' );
			clearThenSyncCalendar( coworkersCalendarId, coworkersSummary, scheduleTable, isClearOnly, true );
		} else {
			console.log( 'Coworkers calendar does NOT exist. Please create one named "' + COWORKERS + '", then reload the page and run the script again.' );
		}
	} );
}

function createControls() {
	console.log( 'Creating sidebar controls' );
	$controls = $( '#api_controls' );
	if ( $controls.length == 0 ) {
		var $navbar = $( 'iframe#Nav' );
		$navbar.css( 'width', 'calc(100% - 425px)' );
		$controls = $( '<div id="api_controls"></div>' );
		$navbar.after( $controls );

		$currentUser = $( '<span class="status_user" id="status_user"></span>' );
		$authorizeButton = $( '<button class="material-button-raised" id="authorize_button" style="display: none;">Authorize&nbsp;Google&nbsp;Calendar</button>' );
		// $statusContent = $( '<pre id="status_content" style="height: 50px; overflow-y: auto; font-family: sans-serif; font-size: 14px; color: #eee; font-weight: normal; font-size: 13px; line-height: 1.5;">GCal Connector v0.2</pre>' );
		$currentUser = $( '<pre id="status_content">GCal Connector v0.2</pre>' );
		$clearButton = $( '<button class="material-button-raised" id="clear_button" style="display: none;" title="Clear all events created by this app for the current time period">Clear</button>' );
		$runButton = $( '<button class="material-button-raised" id="run_button" style="display: none;" title="Clear and sync workdays for the current time period">Sync</button>' );
		$signoutButton = $( '<button class="material-button-raised" id="signout_button" style="display: none;" title="Sign out of your Google account">Deauthorize</button>' );
		$controls.append( $currentUser, $authorizeButton, /*$statusContent,*/ $runButton, $clearButton, $signoutButton );

		$authorizeButton.on( 'click', handleAuthClick );
		$signoutButton.on( 'click', handleSignoutClick );
		$clearButton.on( 'click', function() {
			getCalendars( true );
		} );
		$runButton.on( 'click', function() {
			getCalendars( false );
		} );
		$( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( '#ctl00_formContentPlaceHolder_nextAlphaImage, #ctl00_formContentPlaceHolder_prevAlphaImage' ).remove();
		$( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( '#ctl00_formContentPlaceHolder_dateRangeLabel' )
			.after( '<div style="margin-top: 8px">Please <a href="javascript:window.top.location.reload();">reload</a> the page to change the current range. Run the connector again if you need to sync the new workdays.</div>' );
	} else {
		console.log( 'Not creating controls, they already exist' )
	}
}

function getScript( source, callback ) {
	var script = document.createElement( 'script' );
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
	document.body.appendChild( script );
}

function runConnector() {
	connectorRunning = true;
	console.log( 'Connector running. Waiting for schedule page and all frames to load...' );
	var firstCheck = true;
	var interval = setInterval( function() {
		$scheduleTable = $( 'iframe#Main' ).contents().find( 'table#ctl00_formContentPlaceHolder_myScheduleTable' );
		$employeeOuterTable = $( 'iframe#Main' ).contents().find( 'table#ctl00_formContentPlaceHolder_employeeScheduleOuterTable' );
		$employeeTable = $employeeOuterTable.find( 'table#ctl00_formContentPlaceHolder_orgUnitScheduleHeaderTable' );
		$employeeHoursTable = $employeeOuterTable.find( 'table#ctl00_formContentPlaceHolder_orgUnitScheduleTable' );
		var $sidebarWidgets = $( '#west_side_div' ).find( '.rcard' );
		if ( $( 'iframe#Main, #west_side_div' ).length > 1
			&& $sidebarWidgets.length > 5
			&& $scheduleTable.length > 0 ) {
			clearInterval( interval );
			toastr.remove();
			toastr.success( 'Schedule table loaded' );
			createControls();
			injectStylesIntoIframes();
			$( 'iframe#Main' ).contents().find( '#ctl00_formContentPlaceHolder_employeeScheduleHeaderSeparatorDiv' ).closest( 'tr' ).remove();
			$( '#ctl00_formContentPlaceHolder_employeeScheduleHeaderSeparatorDiv' ).remove();
			$( 'table#ctl00_formContentPlaceHolder_employeeScheduleOuterTable > tbody > tr:first-child ' ).remove();
			console.log( 'Schedule table loaded' );
			$( 'div[id="Employee Sections"], div#Bookmarks, div[id="Report Favorites"]' ).appendTo( '#west_side_div' );
			getScript( 'https://apis.google.com/js/api.js', function() {
				console.log( 'Google API loaded' );
				gapi.load( 'client:auth2', initClient );
			} );
		} else if ( firstCheck ) {
			toastr.error( 'Please load the current schedule table first!<br>Employee > Open Current Schedule' );
			firstCheck = false;
		}
	}, DELAY );
}

console.log( 'Google Calendar NorthShore API Connector v0.13' );
var apiConnectorLoaded = true,
	allScriptsLoaded = false,
	connectorRunning = false;
getScript( 'https://ajax.googleapis.com/ajax/libs/jquery/3.3.1/jquery.min.js', function() {
	console.log( 'jQuery loaded' );
	$( 'body' ).append( '<link href="https://iredesigned.com/stuff/northshore/controls.css?v=' + Math.floor( Math.random() * 10000 ) + '" type="text/css" rel="stylesheet">' );
	$( 'body' ).addClass( 'ns-api' );
	getScript( 'https://iredesigned.com/stuff/northshore/toastr.min.js', function() {
		console.log( 'jQuery ToastR plugin loaded' );
		toastr.options = {
			"showMethod": 'slideDown',
			"hideMethod": 'slideUp',
			"positionClass": 'toast-bottom-right',
			"timeOut": 3333
		};
		getScript( 'https://iredesigned.com/stuff/northshore/jquery-dateformat.min.js', function() {
			console.log( 'Date format plugin loaded loaded' );
			allScriptsLoaded = true;
			runConnector();
		} );
	} );
} );
