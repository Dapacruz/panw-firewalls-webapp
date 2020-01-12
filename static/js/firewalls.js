// TODO: Implement get-panw-config
// TODO: Add a tags column

var table;
var tableData = [];
var tableInitialized = false;
var apiKey;
var env = (function() {
	var json = null;
	$.ajax({
		async: false,
		global: false,
		url: 'static/js/env.json',
		dataType: 'json',
		success: function(data) {
			json = data;
		}
	});
	return json;
})();

$(document).ready(function() {
	// Add column search
	$('#firewalls thead th').each(function() {
		var title = $(this).text();
		$(this).html(`<label>${title}</label><br><input class="searchInput" type="search" placeholder="" />`);
	});

	getFirewalls();

	$('#get-api-key').click(() => {
		getApiKey();
	});

	$('#username, #password').on('keyup', function(event) {
		if (event.keyCode == 13) {
			event.preventDefault();
			$('#get-api-key').click();
		}
	});

	// $('#clear-search').click(() => {
	// 	$('#clear-search').parent().removeAttr('style');
	// 	clearSearch();
	// });

	// $('#select-all-rows').click(() => {
	// 	table.rows().select();
	// 	$('#select-all-rows').parent().attr('style', 'display: none;');
	// 	$('#deselect-all-rows').parent().removeAttr('style');
	// });

	// $('#deselect-all-rows').click(() => {
	// 	table.rows().deselect();
	// 	$('#deselect-all-rows').parent().attr('style', 'display: none;');
	// 	$('#select-all-rows').parent().removeAttr('style');
	// });

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
			$('#results').removeAttr('style');
			$('#results-filter input').val('');
		}
	});

	// Limit ctrl/cmd+a selection to results overlay
	$('#results').keydown(function(e) {
		if ((e.ctrlKey || e.metaKey) && e.keyCode == 65) {
			e.preventDefault();
			selectText('results');
		}
	});

	// Limit ctrl/cmd+a selection to results overlay when mouse is hovering over modal
	$(document).keydown(function(e) {
		if ($('#results').is(':hover')) {
			if ((e.ctrlKey || e.metaKey) && e.keyCode == 65) {
				e.preventDefault();
				selectText('results');
			}
		}
	});

	$('#results-filter input').on('keyup change', function() {
		// Retrieve the input field text and reset the count to zero
		var filter = $(this).val(),
			count = 0;

		$('#results-body div').contents().each(function() {
			// If the list item does not contain the text hide it
			if ($(this).text().search(new RegExp(filter, 'i')) < 0) {
				$(this).parent().hide();
			} else {
				// Show the list item if the phrase matches and increase the count by 1
				$(this).parent().show();
				count++;
			}
		});
	});

	$('#results-filter button').on('click', function() {
		$('#results-filter input').val('');
		$('#results-filter input').change();
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

	$('#loading-message').attr('style', 'display: block;');

	$.ajax({
		url: '/get/interfaces',
		type: 'POST',
		data: `key=${apiKey}&firewalls=${hostnames.join(' ')}`,
		dataType: 'text',
		success: function(response) {
			// Wrap all lines and replace empty lines with a <br>
			var modifiedResponse = [];
			response.split('\n').forEach(function(val) {
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
			$('#results-overlay').attr('style', 'display: block;');
			$('body').toggleClass('noscroll');
			$('#loading-message').attr('style', 'display: none;');
		},
		error: function(xhr, status, error) {
			$(body).toggleClass('noscroll');
			$('#loading-message').attr('style', 'display: none;');
			window.alert('Something went seriously wrong');
		}
	});
}

function runCommand() {
	var username = $('#username').val();
	var password = $('#password').val();
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

	$('#loading-message').attr('style', 'display: block;');

	$.ajax({
		url: '/run/command',
		type: 'POST',
		data: `username=${username}&password=${password}&command=${command}&firewalls=${hostnames.join(' ')}`,
		dataType: 'text',
		success: function(response) {
			// Wrap all lines and replace empty lines with a <br>
			var modifiedResponse = [];
			response.split('\n').forEach(function(val) {
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

			$('body').toggleClass('noscroll');
			$('#results-overlay').attr('style', 'display: block;');
			$('#loading-message').attr('style', 'display: none;');
		},
		error: function(xhr, status, error) {
			$('#loading-message').attr('style', 'display: none;');
			window.alert(`Something went seriously wrong (${error}).`);
		}
	});
}

function clearSearch() {
	$('.searchInput').each(function() {
		this.value = '';
		this.dispatchEvent(new Event('clear'));
	});
}

function getApiKey() {
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
		success: function(response) {
			apiKey = $(response).find('key').text();
			if (apiKey) {
				$('#get-api-key').html('Logged In').attr('disabled', true);
				$('#auth-event').text('Authenticated!');
				setTimeout(() => {
					$('#auth-event').html('&nbsp');
				}, 5000);
			}
		},
		error: function(xhr, status, error) {
			console.log(error);
			$('#auth-event').html('Authentication failed!');
			setTimeout(() => {
				$('#auth-event').html('&nbsp');
			}, 5000);
		}
	});
}

function getFirewalls() {
	$.ajax({
		url: '/',
		type: 'POST',
		dataType: 'xml',
		success: function(response) {
			$('#events').html('&nbsp');

			const tableBody = $('#firewalls').find('tbody');
			tableData = [];

			$(response).find('devices').children('entry').each(function() {
				var hostname = $(this).children('hostname').text();
				var serial = $(this).children('serial').text();
				var ipAddress = $(this).children('ip-address').text();
				var model = $(this).children('model').text();
				// Convert to title case
				var connected = $(this).children('connected').text().replace(/(?:^|\s)\w/, (match) => {
					return match.toUpperCase();
				});
				var uptime = $(this).children('uptime').text();
				var swVersion = $(this).children('sw-version').text();

				var vSystems = [];
				$(this).children('vsys').children('entry').each(function() {
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
						vSystems: vSystems
					});
				}
			});

			if (!tableInitialized) {
				tableInitialized = true;

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
						{ data: 'vSystems' }
					],
					fixedHeader: true,
					buttons: true,
					order: [ [ 0, 'asc' ] ],
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
							action: function() {
								$('#clear-search').toggleClass('hide');
								clearSearch();
							}
						},
						{
							text: 'Deselect All',
							attr: {
								id: 'deselect-all-rows'
							},
							action: function() {
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
							action: function() {
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
								columns: [ 0, ':visible' ]
							}
						},
						{
							extend: 'colvis',
							text: 'Columns'
						}
					]
				});

				// Default button hidden
				$('#clear-search').toggleClass('hide');
				$('#deselect-all-rows').toggleClass('hide');

				// Apply the search
				table.columns().every(function() {
					var that = this;

					$('input', this.header()).click(function() {
						event.stopPropagation();
					});

					$('input', this.header()).on('keyup change clear', function() {
						if (this.value) {
							$('#clear-search').removeClass('hide');
						} else {
							$('#clear-search').addClass('hide');
						}

						if (that.search() !== this.value) {
							that.search(this.value, 'regex').draw();
						}
					});
				});

				table.on('deselect', function(e, dt, type, indexes) {
					if (table.rows({ selected: true }).count() == 0) {
						$('#deselect-all-rows').addClass('hide');
					}
				});

				table.on('select', function(e, dt, type, indexes) {
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
			$('.selected').each(function() {
				var id = `#${table.row(this).id()}`;
				selectedRows.push(id);
			});

			table.clear().rows.add(tableData).draw();

			// Restore rows selection
			table.rows(selectedRows).select();

			$('td>a').click(function() {
				event.stopPropagation();
			});
		},
		error: function(xhr, status, error) {
			$('#events').text('Connection to Panorama failed!');
		}
	});
}

// Refresh firewall table data every 30 seconds
setInterval(() => {
	getFirewalls();
}, 30000);
