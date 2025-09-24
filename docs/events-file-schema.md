# file.created / file.updated / file.deleted event schema

These events are emitted by `data-service` when objects are created, updated or deleted in the canonical metadata store (D1).

All events MUST include the following top-level fields:

- id: string - a globally unique message identifier (UUID v4 recommended)
- type: string - one of `file.created`, `file.updated`, `file.deleted`
- timestamp: string - ISO 8601 UTC timestamp when the event was produced
- producer: string - service name producing the event (e.g. `data-service`)
- payload: object - the event-specific payload

Event payload fields (required for file.created and file.updated):

- fileId: string - unique identifier for the file (matches canonical metadata id)
- userId: string - owner of the file
- filename: string
- mimeType: string
- size: number - bytes
- r2Url: string - R2 URL or signed URL for the actual file content (optional if not available)
- uploadedAt: string - ISO 8601 timestamp of original upload
- metadata: object - free-form metadata, may include tags, source, etc.

For file.deleted payload, include:

- fileId: string
- userId: string
- reason?: string - optional reason for deletion

Delivery guarantees and idempotency:
- Messages should be idempotent; receivers should use `id` (message id) to deduplicate processing.
- `file.created` and `file.updated` should include the full current metadata snapshot for the file.

Examples:

```json
{
  "id": "3f2a5d3a-8fbe-4c7e-9aef-1b2c3d4e5f6a",
  "type": "file.created",
  "timestamp": "2025-08-23T12:34:56Z",
  "producer": "data-service",
  "payload": {
    "fileId": "file_12345",
    "userId": "user_6789",
    "filename": "report.pdf",
    "mimeType": "application/pdf",
    "size": 234234,
    "r2Url": "https://...",
    "uploadedAt": "2025-08-23T12:30:00Z",
    "metadata": { "source": "web-upload" }
  }
}
```
