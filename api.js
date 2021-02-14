// Defaults
var
	APPNAME = 'NorthShore API Google Calendar Connector',
	LOCATION = '777 Park Avenue West, Highland Park, IL',
	TIMEZONE = 'America/Chicago',
	FORMAT = 'yyyy-MM-dd',
	DAYSHIFT = { start: 7, end: 7 + 12 },
	WORK = 'WORK',
	PENDING = 'Pending',
	COWORKERS = 'Coworkers',
	BLANK = 'BLANK',
	DELAY = 250,

	// Client ID and API key from the Developer Console
	CLIENT_ID = '709980319583-sd4omri8vnouh0jti1u6fh4tudl28hmv.apps.googleusercontent.com',
	API_KEY = 'AIzaSyA8GmS2x8a1HZ6Dp0YWHPU0tgaTQaKYONs',

	// Array of API discovery doc URLs for APIs used by the quickstart
	DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],

	// Authorization scopes required by the API; multiple scopes can be
	// included, separated by spaces.
	SCOPES = "https://www.googleapis.com/auth/calendar",

	// Runtime parameters
	STYLES_ON = false, //verbose logging for debug purposes
	HEADLESS = false,

	// jQuery globals
	$controls,
	$currentUser,
	$authorizeButton,
	$signoutButton,
	$clearButton,
	$runButton,

	$statusContent,

	$scheduleTable,
	$employeeOuterTable,
	$employeeTable,
	$employeeHoursTable,

	// Other globals
	coworkersCalendarId,
	primaryCalendarId,

	// Status indicators
	isHeadless = Boolean( (new URLSearchParams( new URL( document.currentScript.src ).search )).get( 'headless' ) ),
	apiConnectorLoaded = true,
	allScriptsLoaded = false,
	connectorRunning = false;

injectStylesIntoIframes = function() {
	console.log( 'Injecting custom stylesheets' );
	var sheet = '<link href="https://iredesigned.com/stuff/northshore/style.css?v=' + Math.floor( Math.random() * 10000 ) + '" type="text/css" rel="stylesheet">';
	$( 'iframe#Nav' ).contents().find( 'body' ).append( sheet );
	$( 'iframe#Main' ).contents().find( 'body' ).append( sheet );
	$( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( 'body' ).append( sheet );
	$( 'body' ).append( sheet );
}

createEventObject = function( title, details, startTime, endTime, colorId, isBusy ) {
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

syncEvents = function( range, scheduleTable, calendarId, calendarName, isCoworkers ) {

	var myWorkdays = [], coworkerDays = [];

	// Build calendar events array
	console.log( 'Traversing ' + scheduleTable.length + ' workdays in calendar [' + calendarName + ']' );
	var i = 0;
	while ( i < scheduleTable.length ) {
		// console.log( '\nProcessing workday ' + i );
		let date = scheduleTable[i];
		let startTime = new Date( date.year, date.month - 1, date.day );
		startTime.setHours( 7 );
		startTime.setMinutes( 0 );
		let endTime = new Date( date.year, date.month - 1, date.day + 1 );
		endTime.setHours( 19 );
		endTime.setMinutes( 30 );
		i++;

		let colorId = 0;
		if ( date.isWorkday === WORK ) {
			colorId = 7; // Blue
		} else if ( date.isWorkday === PENDING ) {
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

		if ( date.isWorkday !== BLANK ) myWorkdays.push( createEventObject( date.isWorkday, table, startTime, endTime, colorId, 'busy' ) );
		else coworkerDays.push( createEventObject( 'Coworkers', table, startTime, endTime, 0, 'available' ) );

	}
	console.log( 'Traversed ' + i + ' workdays' );

	if ( isHeadless ) {
		const schedule = [range, myWorkdays, coworkerDays]
		sendScheduleToServer( schedule );
	} else {
		var theBatch;
		if ( isCoworkers )
			theBatch = coworkerDays;
		else {
			theBatch = myWorkdays;
			// Build simple workday list for remote car starter
			if ( ['Felix Stanek', 'Diana Brahas'].includes( calendarName ) ) {
				var workdayList = [];
				myWorkdays.forEach( function( event ) {
					if ( event.summary === WORK ) workdayList.push( event.start.date )
				} );
				var workdayListJSON = JSON.stringify( workdayList );
				console.log( workdayListJSON );
				$.ajax( {
					type: 'POST',
					url: 'https://stuff.iredesigned.com/northshore/update-remote-start-calendar.php',
					data: workdayListJSON,
					success: function( response ) {
						notice( 'Server response: "' + response + '"', 'Workdays sent to Raspberry Pi for morning engine start' );
					},
					error: function( XMLHttpRequest, textStatus, errorThrown ) {
						console.log( 'Status: ' + textStatus + '\nError: ' + errorThrown );
						toastr.warning( 'Status: ' + textStatus + '\nError: ' + errorThrown, 'Error sending workdays to Raspberry Pi', { timeOut: 0 } );
					},
					always: function() {
						console.log( 'Data sent to calendar for remote start' );
					}
				} );
			}
		}
		console.log( theBatch );
		if ( theBatch.length ) {
			sendBatchToCalendar( theBatch, calendarId, calendarName );
		} else {
			console.log( 'No updates needed, calendar is in sync' );
			notice( "Calendar synced, no changes" );
			setTimeout( function() {
				enableControls();
			}, 3333 );
		}

		$clearButton.show();
		// TODO True syncing; i.e. remove events that are in GCal but not in NorthShore. Quite rare; not very important. Also relatively complex due to the possibility of user changing periods and past events in particular.
	}
}

sendScheduleToServer = function( schedule ) {
	const json = JSON.stringify( schedule );
	console.log( json );
}

sendBatchToCalendar = function( events, calendarId, calendarName ) {
	console.log( 'Sending ' + events.length + ' events to calendar [' + calendarName + ']' );
	var batch = gapi.client.newBatch();
	var listOfWorkdays = '';
	notice( "Syncing " + events.length + " events...", listOfWorkdays );
	events.forEach( function( event ) {
		listOfWorkdays += event.start.date + ', ';
		batch.add( gapi.client.calendar.events.insert( {
			'calendarId': calendarId,
			'resource': event
		} ) );
	} );
	batch.then( function() {
		console.log( events.length + ' events sent to calendar [' + calendarName + ']: ' + listOfWorkdays );
		notice( events.length + ' events synced to calendar [' + calendarName + ']' );
		enableControls();
	} );
}

sendSingleEventToCalendar = function( event ) {
	console.log( event );
	var request = gapi.client.calendar.events.insert( {
		'calendarId': 'primary',
		'resource': event
	} );
	request.execute( function( event ) {
	} );
}

getCurrentRange = function() {
	var currentPeriodText = $( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( '#formContentPlaceHolder_dateRangeLabel' ).text();
	if ( !currentPeriodText ) return false;
	var rangeStartText = currentPeriodText.split( ' - ' )[0];
	var rangeEndText = currentPeriodText.split( ' - ' )[1];
	var result = [];
	result['start'] = new Date( rangeStartText );
	result['end'] = new Date( rangeEndText );
	result['end'].setHours( 23, 59, 59, 999 );
	return result;
}

getCoworkers = function( columnIndex ) {

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

parseScheduleTable = function() {
	var $dates = $( $scheduleTable.find( 'tbody > tr' ).eq( 1 ).find( '.cellContents' ) );
	var $hours = $( $scheduleTable.find( 'tbody > tr' ).eq( 2 ).find( '.cellContents' ) );
	var $hoursAux = $( $scheduleTable.find( 'tbody > tr' ).eq( 3 ).find( '.cellContents' ) );
	var workdays = [];
	var lastMonthInSet = 1;
	var year = getCurrentRange()['start'].getFullYear();

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
				tableDate.isWorkday = WORK;
			} else {
				tableDate.isWorkday = cellContents;
			}
			if ( cellContents.substr( 0, 1 ) === "¤" ) tableDate.isWorkday = PENDING;
		} else {
			tableDate.isWorkday = BLANK;

		}
		tableDate.coworkers = getCoworkers( index );
		workdays.push( tableDate );

	} );
	return workdays;
}

// Initializes the API client library and sets up sign-in state listeners.
initClient = function( el ) {
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
updateSigninStatus = function( GoogleAuth ) {
	console.log( 'Checking authorization status' );
	enableControls();
	var isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
	if ( isSignedIn ) {
		let fullName = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getName();
		console.log( 'Client is authorized' );
		toastr.clear();
		notice( 'Use the buttons in the top right to sync your schedule', 'Connected to calendar <strong>' + fullName + '</strong>', 3000 );
		$currentUser.text( 'Calendar: ' + fullName );
		$authorizeButton.hide();
		$signoutButton.show();
		$clearButton.show();
		$runButton.show();
	} else {
		console.log( 'Authorization button enabled, waiting for user to log in' );
		toastr.warning( 'Please click the Authorize button and log in to your Google account.', 'You are not logged in', { timeOut: 3000 } );
		$currentUser.text( 'Not logged in, click Authorize' );
		$authorizeButton.show();
		enableControls();
		$signoutButton.hide();
		$clearButton.hide();
		$runButton.hide();
	}
}

handleAuthClick = function( event ) {
	disableControls();
	gapi.auth2.getAuthInstance().signIn();
}

handleSignoutClick = function( event ) {
	disableControls();
	gapi.auth2.getAuthInstance().signOut();
}

var notice = function( message, title, customTimeout ) {
	function strip_html( str ) {
		if ( (str === null) || (str === '') )
			return false;
		else
			str = str.toString();
		return str.replace( /<[^>]*>/g, '' );
	}

	var timeout;
	if ( customTimeout !== undefined ) timeout = customTimeout; else timeout = 13333;
	if ( title !== undefined && title ) {
		toastr.success( message, title, { timeOut: timeout } );
		let clean_title = strip_html( title ),
			clean_message = strip_html( message ),
			text_width = Math.max( clean_message.length, clean_title.length ),
			box_border = '─'.repeat( text_width );
		clean_title += ' '.repeat( text_width - clean_title.length );
		clean_message += ' '.repeat( text_width - clean_message.length );
		console.log( '┌─' + box_border + '─┐\n│ ' + clean_title + ' │\n│ ' + clean_message + ' │\n└─' + box_border + '─┘' )
	} else {
		toastr.success( message, '', { timeOut: timeout } );
		let clean_message = strip_html( message ),
			text_width = (clean_message.length),
			box_border = '─'.repeat( text_width );
		console.log( '┌─' + box_border + '─┐\n│ ' + clean_message + ' │\n└─' + box_border + '─┘' )
	}
	// var $text = $( '<div class="bounceIn">'+message + '</div>' );
	// $statusContent.html( $statusContent.html() + '\n' + $text );
	// if ( title !== undefined ) $statusContent.find( 'div:last-child' ).attr( 'title', title );
}

deleteEvents = function( events, calendarId, calendarName, callback ) {

	if ( events.length ) {
		notice( 'Clearing calendar [' + calendarName + '] of previously-created workdays' );
		console.log( 'Clearing calendar [' + calendarName + '] of ' + events.length + ' out of ' + events.length + ' events...' );
		deletionLoop( events.length );
	} else {
		console.log( 'Calendar [' + calendarName + '] only contains ' + events.length + ' events and they\'re all non-deletable.' );
		notice( 'Calendar [' + calendarName + '] contains no events generated by this app.' );
		enableControls();
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
				notice( '[' + calendarName + '] calendar cleared', deletedEventCounter + ' events deleted. ' + deletedEventErrors + ' errors.' );
				enableControls();
				callback();
			}
		} );
	}
}

clearCalendar = function( range, calendarId, calendarName, callback ) {
	gapi.client.calendar.events.list( {
		'q': APPNAME,
		'calendarId': calendarId,
		'timeMin': range['start'].toISOString(),
		'timeMax': range['end'].toISOString(),
		'showDeleted': false,
		'singleEvents': true,
		'orderBy': 'startTime'
	} ).then( function( response ) {
		console.log( 'Retrieved events from calendar [' + calendarName + ']' );
		var events = response.result.items;
		deleteEvents( events, calendarId, calendarName, callback );
	} );
}

clearThenSyncCalendar = function( calendarId, calendarName, scheduleTable, clearOnly, isCoworkers ) {
	// Retrieve existing events and delete them
	var range = getCurrentRange();
	if ( !range ) {
		toastr.error( 'Please load the schedule table first' );
		return;
	}
	console.log( 'Retrieving existing entries from calendar [' + calendarName + '] so we can clear them. Date range: ' + $.format.date( range['start'], FORMAT ) + ' through ' + $.format.date( range['end'], FORMAT ) );
	clearCalendar( range, calendarId, calendarName, function() {
		if ( !clearOnly ) syncEvents( range, scheduleTable, calendarId, calendarName, isCoworkers );
	} );
}

runConnectorHeadless = function() {
	// Retrieve existing events and delete them
	var range = getCurrentRange();
	console.log( range );
	$scheduleTable = $( 'iframe#Main' ).contents().find( 'table#formContentPlaceHolder_myScheduleTable' );
	$employeeOuterTable = $( 'iframe#Main' ).contents().find( 'table#formContentPlaceHolder_employeeScheduleOuterTable' );
	$employeeTable = $employeeOuterTable.find( 'table#formContentPlaceHolder_orgUnitScheduleHeaderTable' );
	$employeeHoursTable = $employeeOuterTable.find( 'table#formContentPlaceHolder_orgUnitScheduleTable' );

	let scheduleTable = parseScheduleTable();
	console.log( scheduleTable )
	// clearCalendar( range, calendarId, calendarName, function() {
	// 	if ( !clearOnly ) syncEvents( range, scheduleTable, calendarId, calendarName, isCoworkers );
	// } );
}

getCalendars = function( isClearOnly ) {
	disableControls();
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

log = function() {
	var context = "My Descriptive Logger Prefix:";
	return Function.prototype.bind.call( console.log, console, context );
}();

disableControls = function() {
	$controls.find( 'button' ).addClass( 'hidden' ).attr( 'disabled', '' );
	$controls.find( '.current-operation' ).addClass( 'hidden' );
}

enableControls = function() {
	$controls.find( 'button' ).removeClass( 'hidden' ).removeAttr( 'disabled' );
	$controls.find( '.current-operation' ).removeClass( 'hidden' );
}

createControls = function() {
	console.log( 'Creating sidebar controls' );
	$controls = $( '#api_controls' );
	if ( !$controls.length ) {
		var $navbar = $( 'iframe#NavigationSpa' ).contents().find( '#navBar .ui-menubar-custom' )
		$navbar.css( { 'color': 'white', 'height': 40, 'display': 'flex', 'justify-content': 'center', 'align-items': 'center' } )
		$controls = $( '<div id="api_controls"></div>' );
		$navbar.append( $controls );

		$currentUser = $( '<span class="status_user" id="status_user"></span>' );
		$authorizeButton = $( '<button class="material-button-raised" id="authorize_button" style="display: none;">Authorize&nbsp;Google&nbsp;Calendar</button>' );
		// $statusContent = $( '<pre id="status_content" style="height: 50px; overflow-y: auto; font-family: sans-serif; font-size: 14px; color: #eee; font-weight: normal; font-size: 13px; line-height: 1.5;">GCal Connector v0.2</pre>' );
		$currentUser = $( '<span id="status_content">GCal Connector v0.2</span>' );
		$clearButton = $( '<button class="material-button-raised" id="clear_button" style="display: none;" title="Clear all events created by this app for the current time period">Clear</button>' );
		$runButton = $( '<button disabled class="material-button-raised" id="run_button" style="display: none;" title="Clear and sync workdays for the current time period">Sync</button>' );
		$signoutButton = $( '<button class="material-button-raised" id="signout_button" style="display: none;" title="Sign out of your Google account">Deauthorize</button>' );
		$currentOperation = $( '<pre class="current-operation">GCal Connector v0.2</pre>' );
		$controls.append( $currentUser, $authorizeButton, /*$statusContent,*/ $runButton, $clearButton, $signoutButton );

		$authorizeButton.on( 'click', handleAuthClick );
		$signoutButton.on( 'click', handleSignoutClick );
		$clearButton.on( 'click', function() {
			getCalendars( true );
			1
		} );
		$runButton.on( 'click', function() {
			getCalendars( false );
		} );
		$( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( '#formContentPlaceHolder_nextAlphaImage, #formContentPlaceHolder_prevAlphaImage' ).remove();
		$( 'iframe#EmployeeSelfScheduleSet_iframe' ).contents().find( '#formContentPlaceHolder_dateRangeLabel' )
			.after( '<div style="margin-top: 8px">Please <a href="javascript:window.top.location.reload();">reload</a> the page to change the current range. Run the connector again if you need to sync the new workdays.</div>' );
	} else {
		console.log( 'Not creating controls, they already exist' )
	}
}

getScript = function( source, callback ) {
	const id = source.split( '/' ).pop().replace( /\.[^/.]+$/, "" )
	const alreadyLoaded = !!document.getElementById( id )
	if ( alreadyLoaded ) {
		if ( callback ) callback()
	} else {
		var script = document.createElement( 'script' );
		script.async = 1;
		script.id = id;
		script.src = source;
		script.onload = script.onreadystatechange = function( _, isAbort ) {
			console.log( 'Onload:', id )
			if ( isAbort || !script.readyState || /loaded|complete/.test( script.readyState ) ) {
				script.onload = script.onreadystatechange = null;
				script = undefined;

				if ( !isAbort ) {
					if ( callback ) callback();
				}
			}
		};
		document.body.appendChild( script );
	}
}

runConnector = function() {
	connectorRunning = true;
	console.log( 'Connector running. Waiting for schedule page and all frames to load...' );
	var firstCheck = true;
	var interval = setInterval( function() {
		$scheduleTable = $( 'iframe#Main' ).contents().find( 'table#formContentPlaceHolder_myScheduleTable' );
		$employeeOuterTable = $( 'iframe#Main' ).contents().find( 'table#formContentPlaceHolder_employeeScheduleOuterTable' );
		$employeeTable = $employeeOuterTable.find( 'table#formContentPlaceHolder_orgUnitScheduleHeaderTable' );
		$employeeHoursTable = $employeeOuterTable.find( 'table#formContentPlaceHolder_orgUnitScheduleTable' );
		var $sidebarWidgets = $( '#west_side_div' ).find( '.rcard' );
		if ( $( 'iframe#Main, #west_side_div' ).length > 1
			&& $sidebarWidgets.length > 5
			&& $scheduleTable.length > 0 ) {
			clearInterval( interval );
			toastr.remove();
			toastr.success( 'Schedule table loaded' );
			createControls();
			if ( STYLES_ON ) injectStylesIntoIframes();
			// $( 'iframe#Main' ).contents().find( '#formContentPlaceHolder_employeeScheduleHeaderSeparatorDiv' ).closest( 'tr' ).remove();
			// $( '#formContentPlaceHolder_employeeScheduleHeaderSeparatorDiv' ).remove();
			// $( 'table#formContentPlaceHolder_employeeScheduleOuterTable > tbody > tr:first-child ' ).remove();
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

console.log( 'Google Calendar NorthShore API Connector v0.21' );
console.log( 'Source:', document.currentScript.src );

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
			"timeOut": 13333
		};
		getScript( 'https://iredesigned.com/stuff/northshore/jquery-dateformat.min.js', function() {
			console.log( 'Date format plugin loaded loaded' );
			allScriptsLoaded = true;
			if ( isHeadless ) runConnectorHeadless();
			else runConnector();
		} );
	} );
} );
