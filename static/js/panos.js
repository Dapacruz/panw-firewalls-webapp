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

    runCommands(commands);
});

async function getInterfaces() {
    var checkbox = $('.toggler');
    checkbox.prop('checked', !checkbox.prop('checked'));

    var hostnames = [];
    table.rows({ selected: true }).data().each((row) => {
        var hostname = $.parseHTML(row.hostname)[0].innerText.toLowerCase();
        // Skip externally managed firewalls
        if (env.externallyManagedFirewalls.includes(hostname)) {
            return;
        }
        hostnames.push(`${hostname}.${env.domain}`);
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
        var hostname = $.parseHTML(row.hostname)[0].innerText.toLowerCase();
        // Skip externally managed firewalls
        if (env.externallyManagedFirewalls.includes(hostname)) {
            return;
        }
        hostnames.push(`${hostname}.${env.domain}`);
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
        var hostname = $.parseHTML(row.hostname)[0].innerText.toLowerCase();
        // Skip externally managed firewalls
        if (env.externallyManagedFirewalls.includes(hostname)) {
            return;
        }
        hostnames.push(`${hostname}.${env.domain}`);
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