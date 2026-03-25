# panw-firewalls-webapp

A Go web application for managing and inspecting Palo Alto Networks (PAN-OS) firewalls through a browser-based dashboard. It interfaces with Panorama to list connected firewalls, retrieve interface details and configurations, run operational commands, execute Ansible Automation Platform (AAP) playbooks, and manage API keys — all from a searchable, sortable DataTables UI with dark mode support.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Ansible Automation Platform Integration](#ansible-automation-platform-integration)
- [Python Scripts](#python-scripts)
- [Running Tests](#running-tests)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Features

- View all Panorama-connected firewalls with hostname, management IP, serial number, model, uptime, and software version
- Retrieve per-firewall interface details (status, IP, zone, MAC, virtual router, etc.)
- Export firewall configuration in XML or `set` format
- Run operational commands across multiple firewalls simultaneously
- Execute Ansible Automation Platform playbooks against selected firewalls (configure local admins, get device state snapshot, upgrade dynamic content)
- Fetch and manage Panorama API keys
- Dark mode / light mode toggle
- Export table data to CSV, Excel, or PDF via DataTables Buttons

## Prerequisites

- **Go** 1.21 or later
- **Python** 3.6 or later
- **Python packages:**
  - `lxml` — required for interface queries
  - `netmiko` — required for `set`-format configuration retrieval
- Access to a **Palo Alto Networks Panorama** instance
- A valid **Panorama API key** (can be generated from the app itself)
- **Ansible Automation Platform (AAP) / Ansible Tower** instance _(optional — required only for Ansible playbook features)_

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/davidcruz72/panw-firewalls-webapp.git
   cd panw-firewalls-webapp
   ```

2. **Install Go dependencies:**

   ```bash
   go mod download
   ```

3. **Install Python dependencies:**

   ```bash
   pip3 install lxml netmiko
   ```

4. **Ensure the `panos-cli` binary is executable:**

   ```bash
   chmod +x static/go/panos-cli
   ```

5. **Ensure Python scripts are executable:**

   ```bash
   chmod +x static/py/*.py
   ```

6. **Build and run the application:**

   ```bash
   go run firewalls.go
   ```

   Or build a binary first:

   ```bash
   go build -o firewalls firewalls.go
   ./firewalls
   ```

The application will be available at `http://127.0.0.1:8081`.

## Configuration

### Application Configuration

The Beego web server is configured via `conf/app.conf`:

```ini
appname = firewalls
httpaddr = 127.0.0.1   # Bind address (change to 0.0.0.0 to listen on all interfaces)
httpport = 8081        # Port number
runmode = dev          # Run mode: dev or prod
```

### PANW Settings File

Python scripts store connection settings in `~/.panw-settings.json`. This file is created automatically on first run of any script. The file is created with `600` permissions (owner read/write only).

Example `~/.panw-settings.json`:

```json
{
  "default_firewall": "fw01.example.com",
  "default_panorama": "panorama.example.com",
  "default_user": "admin",
  "key": "your-panorama-api-key"
}
```

To update saved settings interactively, run any Python script with the `-U` flag:

```bash
python3 static/py/get-panw-firewalls.py -U
```

### Frontend Environment File

The web UI reads `static/js/env.json` at startup. This file is not committed to the repository and must be created manually. It configures Panorama connectivity, the AAP instance, and Ansible job template IDs.

Example `static/js/env.json`:

```json
{
  "panorama": "panorama.example.com",
  "domain": "example.com",
  "ansible_tower": "aap.example.com",
  "ansible_templates": {
    "configure_local_admins": 42,
    "get_device_state": 43,
    "upgrade_dynamic_content": 44
  },
  "externallyManagedFirewalls": ["fw-external-01", "fw-external-02"]
}
```

| Key | Description |
|---|---|
| `panorama` | Hostname of the Panorama management server |
| `domain` | Domain suffix appended to firewall hostnames for links and email |
| `ansible_tower` | Hostname of the Ansible Automation Platform / Ansible Tower instance |
| `ansible_templates.configure_local_admins` | AAP job template ID for the Configure Local Admins playbook |
| `ansible_templates.get_device_state` | AAP job template ID for the Get Device State Snapshot playbook |
| `ansible_templates.upgrade_dynamic_content` | AAP job template ID for the Upgrade Dynamic Content playbook |
| `externallyManagedFirewalls` | List of firewall hostnames to skip when executing Ansible playbooks |

## Usage

1. Open your browser and navigate to `http://127.0.0.1:8081`.
2. The dashboard loads and fetches the list of firewalls from your configured Panorama instance.
3. Use the table controls to search, sort, and filter firewalls.
4. Select one or more firewalls to access the hamburger menu, which is split into two sections:
   - **PAN-OS API:** Get Configuration (Set or XML), Get Interfaces, Run Commands
   - **Ansible Playbooks:** Configure Local Admins, Get Device State Snapshot, Upgrade Dynamic Content
5. Actions that require authentication will prompt for credentials on first use. The session expires after 15 minutes of inactivity.
6. Use the **Get API Key** panel to generate a Panorama API key from your credentials.
7. Toggle dark/light mode using the sun/moon switch in the header.

## API Endpoints

All endpoints accept `POST` requests with form-encoded parameters.

| Endpoint | Method | Parameters | Description |
|---|---|---|---|
| `/` | `GET` | — | Serves the main dashboard UI |
| `/` | `POST` | — | Returns raw XML list of connected firewalls from Panorama |
| `/get/interfaces` | `POST` | `key`, `firewalls` | Returns interface details for the specified firewalls |
| `/get/config` | `POST` | `format` (`xml`\|`set`), `key`, `username`, `password`, `firewalls` | Returns firewall configuration in XML or set format |
| `/run/command` | `POST` | `username`, `password`, `commands`, `firewalls` | Runs an operational command on the specified firewalls |
| `/get/tags` | `POST` | — | Returns Panorama tags from saved settings |
| `/get/apikey` | `POST` | `panorama`, `username`, `password` | Generates and returns a Panorama API key |

**Notes:**
- `firewalls` is a comma-separated list of firewall hostnames or IPs for `/run/command`, and a space-separated string for other endpoints.
- The `/get/config` endpoint uses `key` for XML format and `username`/`password` for set format (via SSH through Netmiko).
- TLS certificate verification is disabled for all Panorama/firewall API calls.

## Ansible Automation Platform Integration

The dashboard integrates directly with Ansible Automation Platform (AAP) / Ansible Tower via its REST API (`/api/v2/`). Selecting one or more firewalls and choosing an action from the **Ansible Playbooks** menu will:

1. Prompt for credentials if not already authenticated (shared with the PAN-OS API login).
2. Launch the corresponding AAP job template, passing the selected firewall hostnames as `hosts_limit` in `extra_vars`.
3. Poll the job status every 5 seconds until the job completes.
4. Display the full colorized job output in a results overlay panel.

Firewalls listed in `externallyManagedFirewalls` in `env.json` are silently skipped when building the host limit.

### Available Playbooks

| Menu Item | Description | Extra Variables Passed |
|---|---|---|
| **Configure Local Admins** | Applies local admin account configuration to selected firewalls | `password`, `hosts_limit` |
| **Get Device State Snapshot** | Captures a device state snapshot; optionally saves config first; emails results | `save_config_snapshot`, `smtp_to`, `hosts_limit` |
| **Upgrade Dynamic Content** | Triggers a dynamic content (App-ID / Threat) upgrade on selected firewalls | `hosts_limit` |

### Job Output Colorization

The results overlay color-codes Ansible output for quick triage:

| Color | Meaning |
|---|---|
| Green | `ok` — task succeeded with no changes |
| Yellow/amber | `changed` — task succeeded and made changes |
| Blue/gray | `skipped` / `rescued` / `ignored` |
| Red | `fatal` / `unreachable` / `failed` |

### Authentication

The same username and password entered at login are used for both the PAN-OS API (keygen) and AAP (HTTP Basic auth via Base64). Credentials are held in memory and cleared automatically after 15 minutes of inactivity.

## Python Scripts

The scripts in `static/py/` can also be used standalone from the command line.

### `get-panw-firewalls.py`

Lists all firewalls connected to Panorama.

```bash
python3 static/py/get-panw-firewalls.py [panorama] [-k KEY] [-s STATE] [-t] [-r] [-U]
```

| Flag | Description |
|---|---|
| `panorama` | Panorama host (uses saved default if omitted) |
| `-k`, `--key` | API key (uses saved key if omitted) |
| `-s`, `--state` | Filter by connection state: `connected`, `disconnected`, `all` (default: `all`) |
| `-t`, `--terse` | Output firewall hostnames only |
| `-r`, `--raw-output` | Output raw pretty-printed XML |
| `-U`, `--update` | Update saved settings interactively |

### `get-panw-interfaces.py`

Lists interface details for one or more firewalls. Requires `lxml`.

```bash
python3 static/py/get-panw-interfaces.py "fw1 fw2" [-k KEY] [--if-status up|down] [-t] [-r]
```

### `get-panw-config.py`

Retrieves firewall configuration in XML or set format. Set format requires `netmiko` and SSH access.

```bash
# XML format (uses API key)
python3 static/py/get-panw-config.py "fw1 fw2" -f xml -k KEY

# Set format (uses SSH credentials)
python3 static/py/get-panw-config.py "fw1 fw2" -f set -u admin -p password
```

### `get-panw-tags.py`

Retrieves management configuration tags from Panorama.

```bash
python3 static/py/get-panw-tags.py [panorama] [-k KEY] [-U]
```

### `panos-cli` (Go Binary)

A compiled Go binary at `static/go/panos-cli` used by the `/run/command` endpoint to execute operational commands on firewalls. It is invoked with a 60-second timeout.

## Running Tests

```bash
go test ./tests/...
```

The test suite uses [GoConvey](https://github.com/smartystreets/goconvey) and verifies that the main route returns HTTP 200 with a non-empty body.

## Troubleshooting

**Dashboard is blank / firewalls don't load**

`static/js/env.json` is missing or malformed. Create it using the example in the [Configuration](#configuration) section. The UI loads this file synchronously at startup; any JSON parse error will silently prevent the page from functioning.

**Ansible playbook actions do nothing / "Something went seriously wrong" alert**

- Verify `ansible_tower` in `env.json` is reachable from the browser (CORS must be enabled on the AAP instance for cross-origin requests).
- Confirm the job template IDs in `env.json` match the actual template IDs in AAP.
- Check that the logged-in user has permission to launch those job templates in AAP.

**App won't start / port already in use**

Change `httpport` in `conf/app.conf` to an available port.

**"Unable to connect to host" errors from Python scripts**

- Verify the Panorama hostname/IP is reachable from the server running the app.
- Check that your API key is valid and has not expired.
- TLS certificate errors are suppressed by default; verify network connectivity instead.

**`lxml` import error**

Install the package: `pip3 install lxml`

**`netmiko` import error (set config format)**

Install the package: `pip3 install netmiko`

**`panos-cli` permission denied**

Make the binary executable: `chmod +x static/go/panos-cli`

**Python scripts not found**

The app expects to be run from the project root directory so that relative paths like `static/py/get-panw-firewalls.py` resolve correctly. Always start the server from the repository root.

**Settings not saved / prompts on every run**

Ensure `~/.panw-settings.json` exists and is readable. The file is created automatically on first run. Run any script once interactively to initialize it, or create it manually using the example in the [Configuration](#configuration) section.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

Copyright (c) 2020 David Cruz
