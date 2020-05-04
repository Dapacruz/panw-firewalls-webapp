// TODO: Look into grouping HA pairs
// TODO: Fix Chrome issue with modal ctrl+a
// TODO: Add get Panorama configuration feature

var table;
var tableData = [];
var tableInitialized = false;
var apiKey;
var loginTimeout;
var env = (function () {
	var json = null;
	$.ajax({
		async: false,
		global: false,
		url: 'static/js/env.json',
		dataType: 'json',
		success: function (data) {
			json = data;
		}
	});
	return json;
})();

$(document).ready(function () {
	// $.ajaxSetup({
	// 	timout: 0
	// });

	getFirewalls();

	$('#login').click(() => {
		login();
	});

	$('#username, #password').on('keyup', function (event) {
		if (event.keyCode == 13) {
			event.preventDefault();
			$('#login').click();
		}
	});

	// When the user clicks on <span> (x), close the modal
	$('span.close').click(() => {
		$('body').toggleClass('noscroll');
		$('#results-overlay').attr('style', 'display: none;');
		$('#results').removeAttr('style');
		$('#results-filter input').val('');
	});

	// When the user clicks anywhere outside of the modal, close it
	$(window).click((event) => {
		if (event.target == $('#results-overlay')[0]) {
			$('body').toggleClass('noscroll');
			$('#results-overlay').scrollTop(0).attr('style', 'display: none;');
			$('#results-filter input').val('');
			$('#results-filter input').attr('placeholder', 'Filter');
			$('#results').removeAttr('style');
			$('#results').removeAttr('data-text-type');
		}
	});

	// Limit ctrl/cmd+a selection to results overlay
	$('.modal-content').keydown(function (e) {
		if ((e.ctrlKey || e.metaKey) && e.keyCode == 65) {
			e.preventDefault();
			selectText('results');
		}
	});

	// Limit ctrl/cmd+a selection to results overlay when mouse is hovering over modal
	$(document).keydown(function (e) {
		if ($('.modal-content:hover').length != 0) {
			if ((e.ctrlKey || e.metaKey) && e.keyCode == 65) {
				e.preventDefault();
				selectText('results');
			}
		}
	});

	$('#results-filter input').on('keyup change', function () {
		// Pause for a few more characters
		setTimeout(() => {
			// Retrieve the input field text
			var filter = $(this).val();

			if ($('#results').attr('data-text-type') == 'xml') {
				// Remove tag start and end characters
				filter = filter.replace(/(<|>|\/)/g, '');
				var startTag = new RegExp(`<${filter}[^/]*?>`, 'i');
				var endTag;
				var showTagChildren = false;

				$('#results-body div').contents().each(function () {
					if (filter == '') {
						$(this).parent().show();
					} else if ($(this).text().search(endTag) < 0 && showTagChildren) {
						// No closing tag match and showTagChildren is true
						$(this).parent().show();
					} else if ($(this).text().search(endTag) > 0 && showTagChildren) {
						// Closing tag matches and showTagChildren is true
						showTagChildren = false;
						$(this).parent().show();
					} else if (
						$(this).text().search(startTag) > 0 &&
						$(this)
							.text()
							.search(
								new RegExp(`${$(this).parent().text().match(/<[^ >]+/i)[0].replace(/</i, '</')}>`)
							) < 0
					) {
						// Filter matches and closing tag not on the same line
						showTagChildren = true;
						endTag = `${$(this).parent().text().match(/<[^ >]+/i)[0].replace(/</i, '</')}>`;
						$(this).parent().show();
					} else if ($(this).text().search(startTag) > 0) {
						$(this).parent().show();
					} else {
						$(this).parent().hide();
					}
				});
			} else {
				var re = new RegExp(filter, 'i');
				$('#results-body div').contents().each(function () {
					// If the list item does not contain the text hide it
					if ($(this).text().search(re) < 0) {
						$(this).parent().hide();
					} else {
						// Show the list item if the phrase matches
						$(this).parent().show();
					}
				});
			}
		}, 500);
	});

	$('#results-filter button').on('click clear', function () {
		$('#results-filter input').val('');
		$('#results-body div').contents().each(function () {
			$(this).parent().show();
		});
		$('tbody tr.dtrg-start>td:Contains("No group")').remove();
	});
});

function selectText(containerid) {
	// Limit ctrl/cmd+a selection to results overlay
	if (document.selection) {
		var range = document.body.createTextRange();
		range.moveToElementText(document.getElementById(containerid));
		range.select();
	} else if (window.getSelection) {
		var range = document.createRange();
		range.selectNode(document.getElementById(containerid));
		window.getSelection().addRange(range);
	}
}

function getInterfaces() {
	var checkbox = $('.toggler');
	checkbox.prop('checked', !checkbox.prop('checked'));

	if (!apiKey) {
		window.alert('You need to log in to execute this action');
		return;
	}

	var hostnames = [];
	table.rows({ selected: true }).data().each((row) => {
		var hostname = $.parseHTML(row.hostname)[0].innerText;
		hostnames.push(hostname);
	});

	if (hostnames.length == 0) {
		window.alert('Please select the rows this action should be applied to');
		return;
	}

	$('#loading-progressbar').attr('style', 'display: block;');

	$.ajax({
		url: '/get/interfaces',
		type: 'POST',
		data: `key=${apiKey}&firewalls=${hostnames.join(' ')}`,
		dataType: 'text',
		success: function (response) {
			$('#results-filter input').attr('placeholder', 'Filter');

			// Wrap all lines and replace empty lines with a <br>
			var modifiedResponse = [];
			response.split('\n').forEach(function (val) {
				if (val == '') {
					modifiedResponse.push(`<br>`);
				} else {
					modifiedResponse.push(`<div>${val}</div>`);
				}
			});

			// Wrap header
			modifiedResponse[0] = `<div id="results-header">${modifiedResponse[0]}`;
			modifiedResponse[1] = `${modifiedResponse[1]}</div>`;
			modifiedResponse[2] = `<div id="results-body">${modifiedResponse[2]}`;
			modifiedResponse[-1] = `${modifiedResponse[-1]}</div>`;

			$('#results').html(modifiedResponse.join(''));

			$('#results div').attr('style', 'font-family: "Roboto Mono", monospace;');
			$('#results-filter input').val('');
			$('#results-overlay').attr('style', 'display: block;');
			$('#results-overlay .modal-content').scrollTop(0);
			$('#loading-progressbar').attr('style', 'display: none;');
			$('body').toggleClass('noscroll');
		},
		error: function (xhr, status, error) {
			$('#loading-progressbar').attr('style', 'display: none;');
			window.alert('Something went seriously wrong');
		}
	});
}

function runCommand() {
	var username = $('#username').val();
	// Encode to handle symbols that break AJAX requests
	var password = encodeURIComponent($('#password').val());
	var checkbox = $('.toggler');
	checkbox.prop('checked', !checkbox.prop('checked'));

	if (!apiKey) {
		window.alert('You need to log in to execute this action');
		return;
	}

	var hostnames = [];
	table.rows({ selected: true }).data().each((row) => {
		var hostname = $.parseHTML(row.hostname)[0].innerText;
		hostnames.push(hostname);
	});

	if (hostnames.length == 0) {
		window.alert('Please select the rows this action should be applied to');
		return;
	}

	var command = prompt('Command to run', 'show system info');
	if (!command) {
		return;
	}

	$('#loading-progressbar').attr('style', 'display: block;');

	$.ajax({
		url: '/run/command',
		type: 'POST',
		data: `username=${username}&password=${password}&command=${command}&firewalls=${hostnames.join(' ')}`,
		dataType: 'text',
		success: function (response) {
			$('#results-filter input').attr('placeholder', 'Filter');

			// Wrap all lines and replace empty lines with a <br>
			var modifiedResponse = [];
			response.split('\n').forEach(function (val) {
				if (val == '') {
					modifiedResponse.push(`<br>`);
				} else if (val.indexOf('=') == 0) {
					modifiedResponse.push(`${val}<br>`);
				} else {
					modifiedResponse.push(`<div>${val}</div>`);
				}
			});

			// Wrap response
			modifiedResponse[0] = `<div id="results-body">${modifiedResponse[0]}`;
			modifiedResponse[-1] = `${modifiedResponse[-1]}</div>`;

			$('#results').html(modifiedResponse.join(''));

			$('#results div').attr('style', 'font-family: "Roboto Mono", monospace;');
			$('#results-filter input').val('');
			$('#results-overlay').attr('style', 'display: block;');
			$('#results-overlay .modal-content').scrollTop(0);
			$('#loading-progressbar').attr('style', 'display: none;');
			$('body').toggleClass('noscroll');
		},
		error: function (xhr, status, error) {
			$('#loading-progressbar').attr('style', 'display: none;');
			window.alert(`Something went seriously wrong (${error}).`);
		}
	});
}

function getConfig(format) {
	var username = $('#username').val();
	// Encode to handle symbols that break AJAX requests
	var password = encodeURIComponent($('#password').val());
	var checkbox = $('.toggler');
	checkbox.prop('checked', !checkbox.prop('checked'));

	if (!apiKey) {
		window.alert('You need to log in to execute this action');
		return;
	}

	var hostnames = [];
	table.rows({ selected: true }).data().each((row) => {
		var hostname = $.parseHTML(row.hostname)[0].innerText;
		hostnames.push(hostname);
	});

	if (hostnames.length == 0) {
		window.alert('Please select the rows this action should be applied to');
		return;
	}

	$('#loading-progressbar').attr('style', 'display: block;');

	$.ajax({
		url: '/get/config',
		type: 'POST',
		data: `format=${format}&username=${username}&password=${password}&key=${apiKey}&firewalls=${hostnames.join(
			' '
		)}`,
		dataType: 'text',
		success: function (response) {
			if (format == 'xml') {
				// Change input placeholder to 'Tag Filter'
				$('#results-filter input').attr('placeholder', 'Tag Filter');
				$('#results').attr('data-text-type', 'xml');
			} else {
				$('#results-filter input').attr('placeholder', 'Filter');
			}

			// Wrap all lines and replace empty lines with a <br>
			var modifiedResponse = [];
			response.split('\n').forEach(function (val) {
				if (val == '') {
					modifiedResponse.push(`<br>`);
				} else if (val.indexOf('=') == 0) {
					modifiedResponse.push(`${val}<br>`);
				} else {
					if (format == 'xml') {
						val = val.replace(/&/g, '&amp;');
						val = val.replace(/b'</, '&lt;');
						val = val.replace(/>'/, '&gt;');
						val = val.replace(/>/g, '&gt;');
						val = val.replace(/</g, '&lt;');
					}
					modifiedResponse.push(`<div>${String(val)}</div>`);
				}
			});

			// Wrap response
			modifiedResponse[0] = `<div id="results-body">${modifiedResponse[0]}`;
			modifiedResponse[-1] = `${modifiedResponse[-1]}</div>`;

			$('#results').html(modifiedResponse.join(''));

			$('#results div').attr('style', 'font-family: "Roboto Mono", monospace;');
			$('#results-filter input').val('');
			$('#results-overlay').attr('style', 'display: block;');
			$('#results-overlay .modal-content').scrollTop(0);
			$('#loading-progressbar').attr('style', 'display: none;');
			$('body').toggleClass('noscroll');
		},
		error: function (xhr, status, error) {
			$('#loading-progressbar').attr('style', 'display: none;');
			window.alert('Something went seriously wrong');
		}
	});
}

function clearSearch() {
	$('.searchInput').each(function () {
		this.value = '';
		this.dispatchEvent(new Event('clear'));
	});
	$('tbody tr.dtrg-start>td:Contains("No group")').remove();
}

function login() {
	var username = $('#username').val();
	// Encode to handle symbols that break AJAX requests
	var password = encodeURIComponent($('#password').val());

	$('#auth-event').text('Authenticating ...');
	$.ajax({
		url: `https://${env.panorama}/api/?`,
		type: 'POST',
		crossDomain: true,
		data: `type=keygen&user=${username}&password=${password}`,
		dataType: 'xml',
		success: function (response) {
			apiKey = $(response).find('key').text();
			if (apiKey) {
				$('#login').html('Logout').unbind('click').click(() => {
					logout();
				});
				$('#username').hide();
				$('#password').hide();
				$('#auth-event').text('Authenticated!');
				setTimeout(() => {
					$('#auth-event').html('&nbsp');
				}, 5000);
			}

			// Logout at midnight due to password changes
			loginTimeout = setTimeout(function () {
				logout();
			}, getMSToMidnight());
		},
		error: function (xhr, status, error) {
			console.log(error);
			$('#auth-event').html('Authentication failed!');
			setTimeout(() => {
				$('#auth-event').html('&nbsp');
			}, 5000);
		}
	});
}

function logout() {
	if (apiKey) {
		apiKey = null;
		clearTimeout(loginTimeout);
		$('#password').val('');
		$('#login').html('Login').unbind('click').click(() => {
			login();
		});
		$('#username').show();
		$('#password').show();
		$('#auth-event').text(`Logged out at ${new Date().toLocaleTimeString()}`);
	}
}

function getMSToMidnight() {
	now = new Date();
	msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 24, 0, 0, 0) - now;
	if (msToMidnight < 0) {
		msToMidnight += 86400000;
	}
	return msToMidnight;
}

function getFirewalls() {
	// Get Panorama device tags
	$.ajax({
		url: '/get/tags',
		type: 'POST',
		dataType: 'xml',
		success: function (response) {
			var firewallTags = {};

			$(response).find('devices').children('entry').each(function () {
				var tags = new Set();
				var serial = $(this).attr('name');
				$(this).find('tags').find('member').each(function () {
					var tag = $(this).text();
					tags.add(tag ? tag : '');
				});

				if (serial in firewallTags) {
					originalTags = firewallTags[serial];
					firewallTags[serial] = new Set([...originalTags, ...tags]);
				} else {
					firewallTags[serial] = tags;
				}
			});

			// Get Panorama managed firewalls
			$.ajax({
				url: '/',
				type: 'POST',
				dataType: 'xml',
				success: function (response) {
					$('#events').html('&nbsp');

					const tableBody = $('#firewalls').find('tbody');

					// Find all active HA peers for row grouping
					var haPairs = new Proxy(
						{},
						{
							get: function (object, property) {
								return object.hasOwnProperty(property) ? object[property] : '';
							}
						}
					);
					$(response).find('devices').children('entry').each(function () {
						if ($(this).find('state').text() == 'active') {
							serial = $(this).children('serial').text();
							hostname = $(this).children('hostname').text();
							haPairs[serial] = `${hostname} (Active) | `;
						}
					});

					// Find all passive HA peers for row grouping
					$(response).find('devices').children('entry').each(function () {
						serial = $(this).children('serial').text();
						hostname = $(this).children('hostname').text();

						if ($(this).find('state').text() == 'passive') {
							peerSerial = $(this).children('ha').find('serial').text();
							haPairs[peerSerial] += `${hostname} (Passive)`;
							haPairs[serial] = haPairs[peerSerial];
						} else if ($(this).children('ha').length == 0) {
							haPairs[serial] = hostname;
						}
					});

					tableData = [];
					$(response).find('devices').children('entry').each(function () {
						var hostname = $(this).children('hostname').text();
						var ipAddress = $(this).children('ip-address').text();
						var model = $(this).children('model').text();
						var serial = $(this).children('serial').text();
						var haPair = haPairs[serial];
						// Convert to title case
						var connected = $(this).children('connected').text().replace(/(?:^|\s)\w/, (match) => {
							return match.toUpperCase();
						});
						var uptime = $(this).children('uptime').text();
						var swVersion = $(this).children('sw-version').text();
						var tags = Array.from(firewallTags[serial]).sort().join(', <br>');
						var haState = $(this).children('ha').children('state').text();
						haState = `${haState.charAt(0).toUpperCase()}${haState.slice(1)}`;

						var vSystems = [];
						$(this).children('vsys').children('entry').each(function () {
							var name = $(this).children('display-name').text().toLowerCase();
							if (name) {
								vSystems.push(name);
							}
						});
						vSystems = vSystems.sort().join(', <br>');

						if (hostname) {
							hostname = `${hostname.toLowerCase()}.${env.domain}`;

							tableData.push({
								hostname: `<a target="_blank" href="https://${hostname}">${hostname}</a>`,
								ipAddress: ipAddress,
								serialNumber: serial,
								modelNumber: model,
								connected: connected,
								uptime: uptime,
								swVersion: swVersion,
								haState: haState,
								tags: tags,
								vSystems: vSystems,
								haPair: haPair
							});
						}
					});

					if (!tableInitialized) {
						tableInitialized = true;

						// Add column search
						$('#firewalls thead th').each(function () {
							var title = $(this).text();
							$(this).html(
								`<label>${title}</label><br><input class="searchInput" type="search" placeholder="" />`
							);
						});

						// Delay showing the thead prematurely
						$('#firewalls thead').show();

						table = $('#firewalls').DataTable({
							data: tableData,
							autoWidth: false,
							columns: [
								{ data: 'hostname' },
								{ data: 'ipAddress' },
								{ data: 'serialNumber' },
								{ data: 'modelNumber' },
								{ data: 'connected' },
								{ data: 'uptime' },
								{ data: 'swVersion' },
								{ data: 'haState' },
								{ data: 'tags' },
								{ data: 'vSystems' },
								{ data: 'haPair' }
							],
							columnDefs: [{ targets: [2, 6, 7, 10], visible: false }],
							rowGroup: false,
							// rowGroup: {
							// 	dataSrc: 'haPair',
							// 	// emptyDataGroup: '',
							// 	// className: 'table-group',
							// 	endClassName: 'end-table-group',
							// 	startRender: function(rows, group) {
							// 		if (group.match(/Active/g)) {
							// 			return group;
							// 		} else {
							// 			return '';
							// 		}
							// 	},
							// 	endRender: function(rows, group) {
							// 		if (group.match(/Active/g)) {
							// 			return ' ';
							// 		}
							// 	}
							// },
							// orderFixed: [ 10, 'asc' ],
							fixedHeader: true,
							buttons: true,
							order: [[0, 'asc']],
							paging: false,
							searching: true,
							rowId: 'serialNumber',
							select: true,
							dom:
								'<"fg-toolbar ui-toolbar ui-widget-header ui-helper-clearfix ui-corner-tl ui-corner-tr"<"toolbar">Blr>' +
								't' +
								'<"fg-toolbar ui-toolbar ui-widget-header ui-helper-clearfix ui-corner-bl ui-corner-br"ip>',
							createdRow: (row, data, dataIndex, cells) => {
								if (data['connected'] == `No`) {
									$(cells[4]).addClass('notConnected');
								}
							},
							buttons: [
								{
									text: 'Clear Search',
									attr: {
										id: 'clear-search'
									},
									action: function () {
										$('#clear-search').toggleClass('hide');
										clearSearch();
									}
								},
								{
									text: 'Deselect All',
									attr: {
										id: 'deselect-all-rows'
									},
									action: function () {
										table.rows().deselect();
										$('#deselect-all-rows').addClass('hide');
										$('#select-all-rows').removeClass('hide');
									}
								},
								{
									text: 'Select All',
									attr: {
										id: 'select-all-rows'
									},
									action: function () {
										table.rows().select();
										$('#select-all-rows').addClass('hide');
										$('#deselect-all-rows').removeClass('hide');
									}
								},
								{
									extend: 'pdfHtml5',
									exportOptions: {
										columns: ':visible'
									}
								},
								{
									extend: 'excelHtml5',
									exportOptions: {
										columns: ':visible'
									}
								},
								{
									extend: 'copyHtml5',
									exportOptions: {
										columns: [0, ':visible']
									}
								},
								{
									extend: 'colvis',
									text: 'Columns'
								}
							],
							drawCallback: function (settings) {
								// TODO: Add class to style empty headers
								// This is not working
								// clearSearch()
								$('tbody tr.dtrg-start>td:Contains("No group")').remove();
							}
						});

						// Default button hidden
						$('#clear-search').toggleClass('hide');
						$('#deselect-all-rows').toggleClass('hide');

						// Apply the search
						table.columns().every(function () {
							var that = this;

							$('input', this.header()).click(function () {
								event.stopPropagation();
							});

							$('input', this.header()).on('keyup change clear', function () {
								// Pause for a few more characters
								setTimeout(() => {
									if (this.value) {
										$('#clear-search').removeClass('hide');
									} else {
										$('#clear-search').addClass('hide');
									}

									if (that.search() !== this.value) {
										that.search(this.value, 'regex').draw();
									}
									$('tbody tr.dtrg-start>td:Contains("No group")').remove();
								}, 500);
							});
						});

						table.on('deselect', function (e, dt, type, indexes) {
							if (table.rows({ selected: true }).count() == 0) {
								$('#deselect-all-rows').addClass('hide');
							}
						});

						table.on('select', function (e, dt, type, indexes) {
							$('#deselect-all-rows').removeClass('hide');
						});

						$('div.toolbar').html(`
							<div class="menu-wrap">
								<input type="checkbox" class="toggler">
								<div class="hamburger"><div></div></div>
								<div class="menu">
								<div>
									<div>
									<ul>
									<li><a onclick="getInterfaces()">Get Interfaces</a></li>
									<li><a onclick="runCommand()">Run Command</a></li>
									<li><a onclick="getConfig('xml')">Get Configuration (XML)</a></li>
									<li><a onclick="getConfig('set')">Get Configuration (Set)</a></li>
									</ul>
									</div>
								</div>
								</div>
							</div>
							<div class="toolbar-title"><a href="https://${env.panorama}/" target="_blank">Panorama</a> Managed Firewalls</div>
						`);
					}

					// Save current rows selection
					var selectedRows = [];
					$('.selected').each(function () {
						var id = `#${table.row(this).id()}`;
						selectedRows.push(id);
					});

					table.clear().rows.add(tableData).draw();

					// TODO: Add class to style empty headers
					// Ties with drawCallback option
					// clearSearch()
					// table.columns().every(function() {
					// try calling table.draw()
					$('tbody tr.dtrg-start>td:Contains("No group")').remove();

					// Restore rows selection
					table.rows(selectedRows).select();

					$('td>a').click(function () {
						event.stopPropagation();
					});
				},
				error: function (xhr, status, error) {
					$('#events').text('Connection to Panorama failed!');
				}
			});
		},
		error: function (xhr, status, error) {
			$('#events').text('Connection to Panorama failed!');
		}
	});
}

// Refresh firewall table data every 30 seconds
setInterval(getFirewalls, 30000);
