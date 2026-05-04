# API Endpoint - Network Path Handler

## Overview

Simple backend API for testing network path connections and detecting files.

**Architecture:**
```
Frontend (UI) → HTTP POST → Backend → SMB → Network Share
```

## Endpoint

### POST /test-connection

Test connection to a network path and detect a file matching a pattern.

## Request

**URL:** `POST http://localhost:3000/test-connection`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "path": "\\\\server\\share\\folder",
  "username": "username",
  "password": "password",
  "domain": "DOMAIN",
  "pattern": "*.csv"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `path` | string | Yes | UNC path (\\\\server\\share\\folder) |
| `username` | string | Yes | Username for authentication |
| `password` | string | Yes | Password for authentication |
| `domain` | string | No | Domain (e.g., COMPANY) |
| `pattern` | string | Yes | File pattern (e.g., data_*.csv) |

## Response

**Success (file found):**
```json
{
  "status": "READY",
  "file": "data_2024.csv",
  "logs": [
    "Resolving path...",
    "Connecting to network share...",
    "Authentication successful",
    "Folder accessible",
    "Files found: 5",
    "Matching files: 1",
    "File selected: data_2024.csv"
  ]
}
```

**Failed (no file found):**
```json
{
  "status": "FAILED",
  "file": null,
  "logs": [
    "Resolving path...",
    "Connecting to network share...",
    "Authentication successful",
    "Folder accessible",
    "Files found: 3",
    "Matching files: 0",
    "Error: File not found"
  ]
}
```

**Failed (multiple files):**
```json
{
  "status": "FAILED",
  "file": null,
  "logs": [
    "Resolving path...",
    "Connecting to network share...",
    "Authentication successful",
    "Folder accessible",
    "Files found: 5",
    "Matching files: 3",
    "Error: Multiple files found: data_2024.csv, data_2025.csv, data_backup.csv"
  ]
}
```

**Failed (connection error):**
```json
{
  "status": "FAILED",
  "file": null,
  "logs": [
    "Resolving path...",
    "Connecting to network share...",
    "Error: Connection failed: Server not reachable"
  ]
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | "READY" if success, "FAILED" if error |
| `file` | string \| null | Selected filename if success, null otherwise |
| `logs` | string[] | Array of log messages (step-by-step execution) |

## Patterns

### Wildcard (*)
```
data_*.csv       → data_2024.csv, data_2025.csv
*_report.csv     → jan_report.csv, feb_report.csv
*.csv            → any .csv file
```

### Exact Match
```
data.csv         → only data.csv
report_2024.csv  → only report_2024.csv
```

## Error Cases

| Error | Cause | Solution |
|-------|-------|----------|
| Cannot resolve path | Invalid UNC format | Use \\\\server\\share format |
| Connection failed | Server not reachable | Check server address and network |
| Authentication failed | Invalid credentials | Verify username and password |
| Access denied | Insufficient permissions | Use account with folder access |
| Folder not found | Path doesn't exist | Check folder path |
| File not found | No files match pattern | Check pattern or folder contents |
| Multiple files found | Multiple matches | Use more specific pattern |

## Examples

### JavaScript (Fetch)

```javascript
const client = new NetworkPathClient();

const result = await client.testConnection({
  path: '\\\\192.168.1.100\\shared\\data',
  username: 'john',
  password: 'secret123',
  domain: 'COMPANY',
  pattern: 'export_*.csv'
});

if (result.status === 'READY') {
  console.log('File found:', result.file);
} else {
  console.log('Error:', result.logs);
}
```

### cURL

```bash
curl -X POST http://localhost:3000/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "path": "\\\\server\\share\\data",
    "username": "user",
    "password": "pass",
    "pattern": "*.csv"
  }'
```

### Python

```python
import requests

response = requests.post('http://localhost:3000/test-connection', json={
    'path': '\\\\server\\share\\data',
    'username': 'user',
    'password': 'pass',
    'pattern': '*.csv'
})

result = response.json()
print(result['status'])
print(result['file'])
for log in result['logs']:
    print(log)
```

## Logging

Logs show step-by-step execution:

1. **Resolving path** - Parse UNC path
2. **Connecting to network share** - Establish SMB connection
3. **Authentication successful** - Credentials validated
4. **Folder accessible** - Can access the folder
5. **Files found: N** - Total files in folder
6. **Matching files: M** - Files matching pattern
7. **File selected: filename** - Selected file (if success)

On error, logs stop at the failure point.

## Security Notes

- Passwords are NOT logged
- Use HTTPS in production
- Credentials should be encrypted in transit
- Validate all inputs on backend

## Implementation

**Backend:** `backend/network-path-handler.js`
**Server:** `server.js`
**Client:** `src/js/network-path-client.js`

## Running

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`
