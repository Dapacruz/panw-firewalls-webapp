$('.modal-config-local-admins__close').on('click', function () {
    $('.modal-config-local-admins__bg').attr('style', 'display: none;');
    $('.modal-config-local-admins__input').val('');
});

$('#modal-config-local-admins-button').on('click', function () {
    let password = $('.modal-config-local-admins__input').val();

    $('.modal-config-local-admins__bg').attr('style', 'display: none;');
    $('.modal-config-local-admins__input').val('');

    configureLocalAdmins(env.ansible_templates.configure_local_admins, password);
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

    getDeviceState(env.ansible_templates.get_device_state, saveConfig);
});

function configureLocalAdmins(jobID, password) {
    let extra_vars = {
        password: password
    };
    executeAnsiblePlaybook(jobID, extra_vars);
}

async function getDeviceState(jobID, saveConfig) {

    if (!aapToken) {
        await login();
    } else {
        resetInactivityTimeout();
    }

    let extra_vars = {
        save_config_snapshot: saveConfig,
        smtp_to: `${username.slice(2)}@${env.domain}`
    };
    executeAnsiblePlaybook(jobID, extra_vars);
}

async function executeAnsiblePlaybook(jobID, extra_vars = {}) {
    var checkbox = $('.toggler');
    checkbox.prop('checked', false);

    var hostnames = [];
    table.rows({ selected: true }).data().each((row) => {
        var hostname = $.parseHTML(row.hostname)[0].innerText.toLowerCase();
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
    // TODO: Need to fix var limit of 1024 chars
    // extra_vars['hosts_limit'] = 'all';
    extra_vars['hosts_limit'] = hostnames.join(',');
    var data = {
        // limit: hostnames.join(','),
        extra_vars: extra_vars
    };
    $.ajax({
        url: `https://${env.ansible_tower}/api/v2/job_templates/${jobID}/launch/`,
        crossDomain: true,
        type: 'POST',
        headers: {
            "Authorization": "Basic " + aapToken
        },
        data: JSON.stringify(data),
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
            window.alert(`Something went seriously wrong`);
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
