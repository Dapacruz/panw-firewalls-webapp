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

function updateUi() {
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

	$('#results-filter input').on('keyup change click', function () {
		// Pause for a few more characters
		setTimeout(() => {
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
		}, 1000);
	});

	$('#results-filter button').on('click clear', function () {
		$('#results-filter input').val('');
		$('#results-body div').contents().each(function () {
			$(this).parent().css('display', '');
		});
		$('tbody tr.dtrg-start>td:Contains("No group")').remove();
	});

	$('.modal-run-cmds__close').on('click', function () {
		$('.modal-run-cmds__bg').attr('style', 'display: none;');
		$('.modal-run-cmds__input').val('');
	});

	$('#modal-run-cmds-button').on('click', async function () {
		let input = $('.modal-run-cmds__input').val().split('\n');

		let commands = [];
		input.forEach(function (val) {
			cmd = val.trim();
			if (!cmd) {
				return;
			}
			commands.push(cmd);
		});

		$('.modal-run-cmds__bg').attr('style', 'display: none;');
		$('.modal-run-cmds__input').val('');

		runCommands(commands);
	});

	$('.modal-config-local-admins__close').on('click', function () {
		$('.modal-config-local-admins__bg').attr('style', 'display: none;');
		$('.modal-config-local-admins__input').val('');
	});

	$('#modal-config-local-admins-button').on('click', function () {
		let password = $('.modal-config-local-admins__input').val();

		$('.modal-config-local-admins__bg').attr('style', 'display: none;');
		$('.modal-config-local-admins__input').val('');

		configureLocalAdmins('43', password);
	});

	$('.modal-get-device-state-snapshot__close').on('click', function () {
		$('.modal-get-device-state-snapshot__bg').attr('style', 'display: none;');
		$('.modal-get-device-state-snapshot__input').val('');
	});

	$('#modal-get-device-state-snapshot-button').on('click', function () {
		let saveConfig = $('input[name="save_config"]:checked').val();

		$('.modal-get-device-state-snapshot__bg').attr('style', 'display: none;');
		$('#modal-get-device-state-snapshot__yes').prop('checked', false);
		$('#modal-get-device-state-snapshot__no').prop('checked', true);

		getDeviceState('47', saveConfig);
	});

	$('#username, #password').on('keyup', function (event) {
		if (event.keyCode == 13) {
			event.preventDefault();
			$('#login').click();
		}
	});

	$('.modal-credentials__close').on('click', function () {
		$('.modal-credentials__bg').attr('style', 'display: none;');
		$('#username').val('');
		$('#password').val('');
	});

	$('#modal-credentials-button').on('click', function () {
		login();
	});
}

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

function configureLocalAdmins(jobID, password) {
	let extra_vars = {
		password: password
	};
	executeAnsiblePlaybook(jobID, extra_vars);
}

function getDeviceState(jobID, saveConfig) {
	let extra_vars = {
		save_config_snapshot: saveConfig,
		smtp_to: `${username.slice(2)}@${env.domain}`
	};
	executeAnsiblePlaybook(jobID, extra_vars);
}

async function executeAnsiblePlaybook(jobID, extraVars = {}) {
	var checkbox = $('.toggler');
	checkbox.prop('checked', false);

	var hostnames = [];
	table.rows({ selected: true }).data().each((row) => {
		var hostname = $.parseHTML(row.hostname)[0].innerText.replace(`.${env.domain}`, "");
		// Skip externally managed firewalls
		if (env.externallyManagedFirewalls.includes(hostname)) {
			return;
		}
		hostnames.push(hostname);
	});

	if (hostnames.length == 0) {
		window.alert('Please select the firewalls this action should be applied to');
		return;
	}

	if (!aapToken) {
		await login();
	} else {
		resetInactivityTimeout();
	}

	$('#loading-progressbar').attr('style', 'display: block;');

	extraVars = {
		limit: hostnames.join(','),
		extra_vars: extraVars
	};
	$.ajax({
		url: `https://${env.ansible_tower}/api/v2/job_templates/${jobID}/launch/`,
		crossDomain: true,
		type: 'POST',
		headers: {
			"Authorization": "Basic " + aapToken
		},
		data: JSON.stringify(extraVars),
		contentType: 'application/json',
		dataType: 'json',
		success: async (response) => {
			var jobId = response.id;
			var jobStatus;
			var jobReport;

			do {
				await sleep(5000);
				jobStatus = getAnsibleJobStatus(jobId);
			} while (['pending', 'running'].includes(jobStatus));

			jobReport = fetchAnsibleJobReport(jobId);

			console.log(jobReport);

			$('#results-filter input').attr('placeholder', 'Filter');

			// Wrap all lines and replace empty lines with a <br>
			var modifiedResponse = [];
			jobReport.split('\n').forEach((val) => {
				if (val == '') {
					modifiedResponse.push(`<br>`);
				} else {
					// Colorize play recap hostname
					if (/(unreachable|failed)=[1-9]\d*/.test(val)) {
						val = val.replace(/^(.[^\s]+)(.+)/, '<span class="ansible-fatal">$1</span>$2');
					} else if (/changed=[1-9]\d*/.test(val)) {
						val = val.replace(/^(.[^\s]+)(.+)/, '<span class="ansible-changed">$1</span>$2');
					} else if (/ok=[1-9]\d*/.test(val)) {
						val = val.replace(/^(.[^\s]+)(.+)/, '<span class="ansible-ok">$1</span>$2');
					} else if (/(skipped|rescued|ignored)=[1-9]\d*/.test(val)) {
						val = val.replace(/^(.[^\s]+)(.+)/, '<span class="ansible-skipped">$1</span>$2');
					}

					// Colorize play recap change results
					if (/ok=[1-9]\d*/.test(val)) {
						val = val.replace(/^(.+)(ok=[1-9]\d*)(.*)/, '$1<span class="ansible-ok">$2</span>$3');
					}
					if (/changed=[1-9]\d*/.test(val)) {
						val = val.replace(/^(.+)(changed=[1-9]\d*)(.*)/, '$1<span class="ansible-changed">$2</span>$3');
					}
					if (/(skipped|rescued|ignored)=[1-9]\d*/.test(val)) {
						val = val.replace(/^(.+)((?:skipped|rescued|ignored)=[1-9]\d*)(.*)/, '$1<span class="ansible-skipped">$2</span>$3');
					}
					if (/(unreachable|failed)=[1-9]\d*/.test(val)) {
						val = val.replace(/^(.+)((?:unreachable|failed)=[1-9]\d*)(.*)/, '$1<span class="ansible-fatal">$2</span>$3');
					}

					// Colorize task results
					if (/^ok:/.test(val)) {
						modifiedResponse.push(`<div class="ansible-ok">${val}</div>`);
					} else if (/^changed:/.test(val)) {
						modifiedResponse.push(`<div class="ansible-changed">${val}</div>`);
					} else if (/^(skipping|rescuing|ingoring):/.test(val)) {
						modifiedResponse.push(`<div class="ansible-skipped">${val}</div>`);
					} else if (/^fatal:/.test(val)) {
						modifiedResponse.push(`<div class="ansible-fatal">${val}</div>`);
					} else {
						modifiedResponse.push(`<div>${val}</div>`);
					}
				}
			});

			// Wrap header
			modifiedResponse[0] = `<div id="results-header">${modifiedResponse[0]}</div>`;
			modifiedResponse[1] = `<div id="results-body">${modifiedResponse[1]}`;
			modifiedResponse[-1] = `${modifiedResponse[-1]}</div>`;

			$('#results').html(modifiedResponse.join(''));
			$('#results div').attr('style', 'font-family: "Roboto Mono", monospace;');
			$('#results-filter input').val('');
			$('#results-overlay').attr('style', 'display: block;');
			$('#results').scrollTop(0);
			$('body').toggleClass('noscroll');

			$('#loading-progressbar').attr('style', 'display: none;');
		},
		error: (xhr, status, error) => {
			$('#loading-progressbar').attr('style', 'display: none;');
			window.alert('Something went seriously wrong');
		}
	});
}

function getAnsibleJobStatus(jobId) {
	var jobStatus;

	resetInactivityTimeout();

	$.ajax({
		url: `https://${env.ansible_tower}/api/v2/jobs/${jobId}/activity_stream/`,
		type: 'GET',
		headers: {
			"Authorization": "Basic " + aapToken
		},
		dataType: 'json',
		async: false,
		success: function (response) {
			jobStatus = response.results[0].summary_fields.job[0].status;
		},
		error: function (xhr, status, error) { }
	});

	return jobStatus;
}

function fetchAnsibleJobReport(jobId) {
	var jobReport;

	resetInactivityTimeout();

	$.ajax({
		url: `https://${env.ansible_tower}/api/v2/jobs/${jobId}/stdout/?format=txt_download`,
		type: 'GET',
		headers: {
			"Authorization": "Basic " + aapToken
		},
		dataType: 'text',
		async: false,
		success: function (response) {
			jobReport = response;
		},
		error: function (xhr, status, error) { }
	});

	return jobReport;
}

function sleep(n) {
	return new Promise(done => {
		setTimeout(() => {
			done();
		}, n);
	});
}

async function getInterfaces() {
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

	if (!panosToken) {
		await login();
	} else {
		resetInactivityTimeout();
	}

	$('#loading-progressbar').attr('style', 'display: block;');

	$.ajax({
		url: '/get/interfaces',
		type: 'POST',
		data: `key=${panosToken}&firewalls=${hostnames.join(' ')}`,
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
			// $('#results').attr('style', 'padding: 1em 2em 0 5em;');
			$('#results-filter input').val('');
			$('#results-overlay').attr('style', 'display: block;');
			$('#results').scrollTop(0);
			$('#loading-progressbar').attr('style', 'display: none;');
			$('body').toggleClass('noscroll');
		},
		error: function (xhr, status, error) {
			$('#loading-progressbar').attr('style', 'display: none;');
			window.alert('Something went seriously wrong');
		}
	});
}

async function runCommands(commands) {
	var hostnames = [];
	table.rows({ selected: true }).data().each((row) => {
		var hostname = $.parseHTML(row.hostname)[0].innerText;
		hostnames.push(hostname);
	});

	if (!commands) {
		return;
	}

	if (!password) {
		await getCredentials();
	}

	$('#loading-progressbar').attr('style', 'display: block;');

	$.ajax({
		url: '/run/command',
		type: 'POST',
		data: `username=${username}&password=${password}&commands=${commands.join(',')}&firewalls=${hostnames.join(',')}`,
		dataType: 'text',
		success: function (response) {
			$('#results-filter input').attr('placeholder', 'Filter');

			// Wrap all lines and replace empty lines with a <br>
			var modifiedResponse = [];
			response.split('\n').forEach(function (val) {
				if (val == '') {
					modifiedResponse.push(`<br>`);
				} else if (val.includes(env.domain)) {
					modifiedResponse.push(`<div class='modal-run-cmds__hostname'>${val}</div>`);
				} else if (val.startsWith('*** ')) {
					modifiedResponse.push(`<div class='modal-run-cmds__command'>${val}</div>`);
				} else if (val.startsWith('#')) {
					modifiedResponse.push(`<div class='modal-run-cmds__separator'>${val}</div>`);
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
			$('#results').scrollTop(0);
			$('#loading-progressbar').attr('style', 'display: none;');
			$('body').toggleClass('noscroll');
		},
		error: function (xhr, status, error) {
			$('#loading-progressbar').attr('style', 'display: none;');
			window.alert(`Something went seriously wrong (${error}).`);
		}
	});

	password = null;
}

async function getConfig(format) {
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

	if (format === 'set' && !password) {
		await getCredentials();
	} else if (!panosToken) {
		await login();
	} else if (panosToken) {
		resetInactivityTimeout();
	}

	$('#loading-progressbar').attr('style', 'display: block;');

	$.ajax({
		url: '/get/config',
		type: 'POST',
		data: `format=${format}&username=${username}&password=${password}&key=${panosToken}&firewalls=${hostnames.join(
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
			$('#results').scrollTop(0);
			$('#loading-progressbar').attr('style', 'display: none;');
			$('body').toggleClass('noscroll');
		},
		error: function (xhr, status, error) {
			$('#loading-progressbar').attr('style', 'display: none;');
			window.alert('Something went seriously wrong');
		}
	});

	password = null;
}

function clearSearch() {
	$('.searchInput').each(function () {
		this.value = '';
		this.dispatchEvent(new Event('clear'));
	});
	$('tbody tr.dtrg-start>td:Contains("No group")').remove();
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
			$('#username').val('');
			password = encodeURIComponent($('#password').val());
			$('#password').val('');
			resolve();
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
		// Pointing to a version 9.1 firewall, as there are CORS issues with 10.x
		url: `https://${env.firewall}/api/?`,
		type: 'POST',
		crossDomain: true,
		data: `type=keygen&user=${username}&password=${password}`,
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
							ha_led = "static/img/green_led.png";
						} else if (haState === 'passive') {
							ha_led = "static/img/yellow_led.png";
						} else if (haState !== 'standalone') {
							ha_led = "static/img/red_led.png";
						} else {
							ha_led = "static/img/gray_led.png";
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
							hostname = `${hostname.toLowerCase()}.${env.domain}`;
							hostname = `<a target="_blank" href="https://${hostname}">${hostname}</a>`;

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

							$('input', this.header()).on('keyup change clear click', function () {
								// Pause for a few more characters
								setTimeout(() => {
									if (this.value) {
										$('#clear-search').removeClass('hide');
									} else {
										$('#clear-search').addClass('hide');
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
								}, 1000);
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
									<li><a onclick="executeAnsiblePlaybook('39')">Upgrade Dynamic Content</a></li>
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
}

// Refresh firewall table data every 30 seconds
setInterval(getFirewalls, 30000);
