// TODO: Look into grouping HA pairs
// TODO: Fix Chrome issue with modal ctrl+a
// TODO: Add get Panorama configuration feature

var table;
var tableData = [];
var tableInitialized = false;
var username;
var password;
var panosToken;
var aapToken;
var authTimeout;
var tableSearchTimeoutId;
var resultsSearchTimeoutId;
const inactivityTimeout = 15 * 60 * 1000;	// 15 minutes
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

updateUi();

getFirewalls();

// Refresh firewall table data every 30 seconds
setInterval(getFirewalls, 30000);

// Disable backspace browser navigation
$(function () {
	var regex = /input|select|textarea/i;
	$(document).bind('keydown keypress', function (event) {
		if (event.which == 8) { // 8 == backspace
			if (!regex.test(event.target.tagName) || $(event.target).is(':checkbox') || $(event.target).is(':radio') || $(event.target).is(':submit') || event.target.disabled || event.target.readOnly) {
				event.preventDefault();
			}
		}
	});
});

// Limit ctrl/cmd+a selection to results overlay
function selectText(containerid) {
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

function sleep(n) {
	return new Promise(done => {
		setTimeout(() => {
			done();
		}, n);
	});
}

function clearSearch() {
	$('.searchInput').each(function () {
		this.value = '';
		$(`#${this.id}`).change();
	});
}

function getCredentials() {
	$('.modal-credentials__bg').attr('style', 'display: flex;');
	if (username) {
		$('#username').val(username);
		$('#password').focus();
	} else {
		$('#username').focus();
	}

	// Wait for user input
	return new Promise(resolve => {
		function handleClick() {
			document.getElementById('login').removeEventListener('click', handleClick);
			document.removeEventListener('keypress', handleEnter);
			$('.modal-credentials__bg').attr('style', 'display: none;');
			username = $('#username').val();
			password = encodeURIComponent($('#password').val());
			resolve();
			$('#password').val('');
		}
		function handleEnter(event) {
			if (event.key === 'Enter') {
				event.preventDefault();
				document.getElementById('login').click();
			}
		}
		document.addEventListener('keypress', handleEnter);
		document.getElementById('login').addEventListener('click', handleClick);
	});
}

async function login() {
	await getCredentials();

	// Get PAN-OS API key
	await $.ajax({
		url: `/get/apikey`,
		type: 'POST',
		crossDomain: true,
		data: `type=keygen&username=${username}&password=${password}&panorama=${env.panorama}`,
		dataType: 'xml',
		success: function (response) {
			panosToken = $(response).find('key').text();
		},
		error: function (xhr, status, error) {
			console.log(error);
			$('#auth-event').html('Authentication failed!');
			setTimeout(() => {
				$('#auth-event').html('&nbsp');
			}, 5000);
		}
	});

	aapToken = btoa(`${username}:${decodeURIComponent(password)}`);

	// Remove credentials after 15 minutes
	authTimeout = setTimeout(() => {
		panosToken = null;
		aapToken = null;
	}, inactivityTimeout);

	password = null;
}

function resetInactivityTimeout() {
	if (authTimeout) {
		clearTimeout(authTimeout);
		authTimeout = setTimeout(() => {
			panosToken = null;
			password = null;
		}, inactivityTimeout);
	}
}

function updateUi() {
	// Update search results when clicking input clear (x)
	document.getElementById('results-filter-input').addEventListener('search', () => {
		$('#results-filter-input').change();
	});

	// When the user clicks on <span> (x), close the modal
	$('span.close').click(function () {
		$('body').toggleClass('noscroll');
		$('#results-overlay').attr('style', 'display: none;');
		$('#results').removeAttr('style');
		$('#results-filter input').val('');
	});

	// When the user clicks anywhere outside of the modal, close it
	$(window).click(function (event) {
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
	$('.modal-content').keydown(function (event) {
		if ((event.ctrlKey || event.metaKey) && event.keyCode == 65) {
			event.preventDefault();
			selectText('results');
		}
	});

	// Limit ctrl/cmd+a selection to results overlay when mouse is hovering over modal
	$(document).keydown(function (event) {
		if ($('.modal-content:hover').length != 0) {
			if ((event.ctrlKey || event.metaKey) && event.keyCode == 65) {
				event.preventDefault();
				selectText('results');
			}
		}
	});

	$('#results-filter input').on('keyup change', function (event) {
		// Clear the timeout for keyup events
		if (event.type === 'keyup') {
			clearTimeout(tableSearchTimeoutId);
		}
		// Pause for a few more characters
		resultsSearchTimeoutId = setTimeout(() => {
			// Retrieve the input field text
			var filter = $(this).val();

			if ($('#results').attr('data-text-type') == 'xml') {
				// Remove tag start and end characters
				filter = filter.replace(/(<|>|\/)/g, '');
				var startTag = new RegExp(`(<${filter}[^/]*?>)`, 'i');
				var endTag;
				var showTagChildren = false;

				$('#results-body div').contents().each(function () {
					if (filter == '') {
						$(this).parent().css('display', '');
					} else if ($(this).text().search(endTag) < 0 && showTagChildren) {
						// No closing tag match and showTagChildren is true
						$(this).parent().css('display', '');
					} else if ($(this).text().search(endTag) > 0 && showTagChildren) {
						// Closing tag matches and showTagChildren is true
						showTagChildren = false;
						$(this).parent().css('display', '');
					} else if ($(this).text().search(startTag) > 0 &&
						$(this)
							.text()
							.search(
								new RegExp(`(${$(this).parent().text().match(/<[^ >]+/i)[0].replace(/</i, '</')}>)`)
							) < 0) {
						// Filter matches and closing tag not on the same line
						showTagChildren = true;
						endTag = `${$(this).parent().text().match(/<[^ >]+/i)[0].replace(/</i, '</')}>`;
						$(this).parent().css('display', '');
					} else if ($(this).text().search(startTag) > 0) {
						$(this).parent().css('display', '');
					} else {
						$(this).parent().css('display', 'none');
					}
				});
			} else {
				var re = new RegExp(`(${filter})`, 'i');
				$('#results-body div').contents().each(function () {
					// If the list item does not contain the text hide it
					if ($(this).text().startsWith('*** ') || $(this).text().startsWith('#')) {
						// Always display run command headers
						$(this).parent().css('display', '');
					} else if ($(this).text().search(re) < 0) {
						$(this).parent().css('display', 'none');
					} else {
						// Show the list item if the phrase matches
						$(this).parent().css('display', '');
					}
				});
			}
		}, 750);
	});

	$('#results-filter button').on('click clear', function () {
		$('#results-filter input').val('');
		$('#results-body div').contents().each(function () {
			$(this).parent().css('display', '');
		});
		$('tbody tr.dtrg-start>td:Contains("No group")').remove();
	});

	$('#username, #password').on('keyup', function (event) {
		if (event.keyCode == 13) {
			event.preventDefault();
			$('#login').click();
		}
	});

	$('.modal-credentials__close').on('click', function () {
		$('.modal-credentials__bg').attr('style', 'display: none;');
		$('#password').val('');
	});

	$('#modal-credentials-button').on('click', function () {
		login();
	});
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

						// Skip firewalls that have not been fully staged
						if (tags.length === 0 || tags.includes('Staging')) {
							return;
						}

						var haState = $(this).children('ha').children('state').text() || 'standalone';
						if (haState === 'active') {
							ha_led = 'static/img/green_led.png';
						} else if (haState === 'passive') {
							ha_led = 'static/img/yellow_led.png';
						} else if (haState !== 'standalone') {
							ha_led = 'static/img/red_led.png';
						} else {
							ha_led = 'static/img/gray_led.png';
						}

						haState = `<img src="${ha_led}" alt="${haState}" style="padding-right: .2em; vertical-align: middle;"><span style="vertical-align: middle;">${haState.charAt(0).toUpperCase()}${haState.slice(1)}</span>`;

						var vSystems = [];
						$(this).children('vsys').children('entry').each(function () {
							var name = $(this).children('display-name').text().toLowerCase();
							if (name) {
								vSystems.push(name);
							}
						});
						vSystems = vSystems.sort().join(', <br>');

						if (hostname) {
							hostname = `<a target="_blank" href="https://${hostname}.${env.domain}">${hostname.toUpperCase()}</a>`;
							tableData.push({
								hostname: hostname,
								haState: haState,
								ipAddress: ipAddress,
								connected: connected,
								serialNumber: serial,
								modelNumber: model,
								uptime: uptime,
								swVersion: swVersion,
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
							var id = title.replace(' ', '-').toLowerCase();
							$(this).html(
								`<label>${title}</label><br><input id="${id}" class="searchInput" type="search" placeholder="search"/>`
							);

							// Update search results when clicking input clear (x)
							document.getElementById(id).addEventListener('search', () => {
								$(`#${id}`).change();
							});
						});

						// Delay showing the thead prematurely
						$('#firewalls thead').show();

						table = $('#firewalls').DataTable({
							data: tableData,
							autoWidth: false,
							columns: [
								{ data: 'hostname' },
								{ data: 'haState' },
								{ data: 'ipAddress' },
								{ data: 'connected' },
								{ data: 'serialNumber' },
								{ data: 'modelNumber' },
								{ data: 'uptime' },
								{ data: 'swVersion' },
								{ data: 'tags' },
								{ data: 'vSystems' },
								{ data: 'haPair' }
							],
							columnDefs: [{ targets: [4, 6, 10], visible: false }],
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
								if (data['connected'] === 'No') {
									$(cells).addClass('notConnected');
									$(cells[3]).css('font-weight', '600').css('color', 'red');
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
										table.rows({ page: 'current' }).select();
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

						// Apply the column search
						table.columns().every(function () {
							var that = this;

							$('input', this.header()).click(function (event) {
								event.stopPropagation();
							});

							$('input', this.header()).on('keydown', function (event) {
								if (event.keyCode == 13) {
								    event.preventDefault();
								}
							});
							$('input', this.header()).on('keyup change', function (event) {
								// Clear the timeout for keyup events
								if (event.type === 'keyup') {
									clearTimeout(tableSearchTimeoutId);
								}
								// Pause for a few more characters
								tableSearchTimeoutId = setTimeout(() => {
									if (this.value) {
										$('#clear-search').removeClass('hide');
									} else {
										$('#clear-search').addClass('hide');
										$('.searchInput').each(function () {
											if (this.value !== '') {
												$('#clear-search').removeClass('hide');
											}
										});
									}

									if (this.value.startsWith('!')) {
										value = `^(((?!${this.value.replace('!', '')}).)*)$`;
										if (that.search() !== value) {
											that.search(value, 'regex').draw();
										}
									} else {
										if (that.search() !== this.value) {
											that.search(`(${this.value})`, 'regex').draw();
										}
									}
									$('tbody tr.dtrg-start>td:Contains("No group")').remove();
								}, 750);
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

						// Create hamburger menu
						$('div.toolbar').html(`
							<div class="menu-wrap">
								<input type="checkbox" class="toggler">
								<div class="hamburger"><div></div></div>
								<div class="menu">
								<div>
									<div>
									<ul>
									<li><h3 style="color:#fa582d;">PAN-OS API</h3></li>
									<li><a onclick="getConfig('set')">Get Configuration (Set)</a></li>
									<li><a onclick="getConfig('xml')">Get Configuration (XML)</a></li>
									<li><a onclick="getInterfaces()">Get Interfaces</a></li>
									<li><a id="menu-run-cmds">Run Commands</a></li>
									</ul>
									<br>
									<ul>
									<li><h3 style="color:#fa582d;">Ansible Playbooks</h3></li>
									<li><a id="menu-config-local-admins">Configure Local Admins</a></li>
									<li><a id="menu-get-device-state-snapshot">Get Device State Snapshot</a></li>
									<li><a onclick="executeAnsiblePlaybook('132')">Upgrade Dynamic Content</a></li>
									</ul>
									</div>
								</div>
								</div>
							</div>
							<div class="toolbar-title"><a href="https://${env.panorama}/" target="_blank">Panorama</a> Managed Firewalls</div>
						`);

						$('#menu-run-cmds').on('click', function () {
							var checkbox = $('.toggler');
							checkbox.prop('checked', !checkbox.prop('checked'));

							var hostnames = [];
							table.rows({ selected: true }).data().each((row) => {
								var hostname = $.parseHTML(row.hostname)[0].innerText;
								hostnames.push(hostname);
							});

							if (hostnames.length == 0) {
								window.alert('Please select the firewalls this action should be applied to');
								return;
							}

							$('.modal-run-cmds__bg').attr('style', 'display: flex;');
							$('.modal-run-cmds__input').focus();
						});

						$('#menu-config-local-admins').on('click', function () {
							var checkbox = $('.toggler');
							checkbox.prop('checked', !checkbox.prop('checked'));

							var hostnames = [];
							table.rows({ selected: true }).data().each((row) => {
								var hostname = $.parseHTML(row.hostname)[0].innerText;
								hostnames.push(hostname);
							});

							if (hostnames.length == 0) {
								window.alert('Please select the firewalls this action should be applied to');
								return;
							}

							$('.modal-config-local-admins__bg').attr('style', 'display: flex;');
							$('.modal-config-local-admins__input').focus();
						});

						$('#menu-get-device-state-snapshot').on('click', function () {
							var checkbox = $('.toggler');
							checkbox.prop('checked', !checkbox.prop('checked'));

							var hostnames = [];
							table.rows({ selected: true }).data().each((row) => {
								var hostname = $.parseHTML(row.hostname)[0].innerText;
								hostnames.push(hostname);
							});

							if (hostnames.length == 0) {
								window.alert('Please select the firewalls this action should be applied to');
								return;
							}

							$('.modal-get-device-state-snapshot__bg').attr('style', 'display: flex;');
							$('.modal-get-device-state-snapshot__input').focus();
						});
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

					$('a').click(function (event) {
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
};
