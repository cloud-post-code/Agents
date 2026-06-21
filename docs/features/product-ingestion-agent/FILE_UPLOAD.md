# File Upload System for Agent Chat

## Overview

The file upload system allows users to upload images and CSV files through the chat interface for product catalog ingestion.

## API Endpoints

### 1. Image Upload

**Endpoint**: `POST /api/v1/agent/upload/image`

**Authentication**: Required (JWT token)

**Content-Type**: `multipart/form-data`

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Image file (JPEG, PNG, WebP) |
| `session_id` | string | No | Agent session ID to log to |
| `price` | float | No* | Product price |
| `quantity` | int | No* | Stock quantity |
| `unique_id` | string | No* | Unique product identifier |
| `sku` | string | No | SKU code (optional) |

*If `price`, `quantity`, and `unique_id` are provided, the product is ingested immediately. Otherwise, the image is returned as base64 for agent processing.

#### Response (With Metadata - Immediate Ingestion)

```json
{
  "status": "success",
  "message": "Successfully imported 1 product(s)",
  "products": [
    {
      "id": "uuid",
      "name": "Handmade Lavender Soap",
      "description": "Natural artisan soap...",
      "tags": ["handmade", "soap", "lavender"],
      "price": 12.50,
      "stock_qty": 25
    }
  ]
}
```

#### Response (Without Metadata - Returns for Agent)

```json
{
  "status": "uploaded",
  "file_id": "uuid",
  "filename": "product.jpg",
  "size": 12345,
  "content_type": "image/jpeg",
  "image_base64": "base64-encoded-image-data",
  "message": "Image uploaded. Provide price, quantity, and unique_id to ingest."
}
```

### 2. CSV Upload

**Endpoint**: `POST /api/v1/agent/upload/csv`

**Authentication**: Required (JWT token)

**Content-Type**: `multipart/form-data`

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | CSV file |
| `session_id` | string | No | Agent session ID to log to |
| `auto_ingest` | boolean | No (default: true) | Auto-process CSV or preview only |

#### Response (Auto-Ingest)

```json
{
  "status": "success",
  "message": "Imported 48 products. 2 errors.",
  "imported": 48,
  "errors": [
    {"row": 5, "errors": ["duplicate unique_id: PROD-005"]},
    {"row": 23, "errors": ["name is required"]}
  ],
  "products": [
    {
      "id": "uuid",
      "name": "Product 1",
      "price": 10.00,
      "stock_qty": 5
    }
    // ... more products
  ]
}
```

#### Response (Preview Only)

```json
{
  "status": "uploaded",
  "filename": "products.csv",
  "size": 5432,
  "csv_base64": "base64-encoded-csv-data",
  "message": "CSV uploaded. Set auto_ingest=true to process."
}
```

## Constraints

### File Size Limits
- **Images**: 10 MB maximum
- **CSV**: 50 MB maximum

### Allowed File Types
- **Images**: JPEG, PNG, WebP
- **CSV**: text/csv, application/csv

### CSV Format

Expected columns (flexible naming):
- `name` / `product_name` / `title` → Product name
- `price` / `selling_price` / `retail_price` → Price
- `quantity` / `stock` / `stock_qty` / `qty` → Stock quantity
- `description` / `desc` / `details` → Description
- `unique_id` / `id` / `product_id` → Unique identifier
- `sku` / `sku_code` → SKU (optional)
- `cost` / `cost_price` → Cost (optional)

Example CSV:
```csv
name,price,quantity,description,unique_id,sku
"Handmade Soap",12.00,25,"Lavender scented",SOAP-001,SKU-SOAP-001
"Artisan Candle",18.50,15,"Vanilla scented",CANDLE-001,SKU-CANDLE-001
```

## Frontend Implementation

### Example: Image Upload with Immediate Ingestion

```typescript
async function uploadProductImage(
  file: File,
  price: number,
  quantity: number,
  uniqueId: string,
  sku?: string
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('price', price.toString());
  formData.append('quantity', quantity.toString());
  formData.append('unique_id', uniqueId);
  if (sku) formData.append('sku', sku);

  const response = await fetch('/api/v1/agent/upload/image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  return await response.json();
}
```

### Example: Image Upload for Agent Processing

```typescript
async function uploadImageForAgent(file: File, sessionId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('session_id', sessionId);

  const response = await fetch('/api/v1/agent/upload/image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  const data = await response.json();
  
  // Now agent can process the image_base64
  return data.image_base64;
}
```

### Example: CSV Bulk Upload

```typescript
async function uploadProductsCSV(file: File, sessionId?: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('auto_ingest', 'true');
  if (sessionId) formData.append('session_id', sessionId);

  const response = await fetch('/api/v1/agent/upload/csv', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  return await response.json();
}
```

## Integration with Agent Chat

### Workflow 1: User Uploads Image, Agent Asks for Details

```
1. User: [uploads image via file picker]
   → POST /api/v1/agent/upload/image (no metadata)
   → Returns: {status: "uploaded", image_base64: "..."}

2. Agent receives system message:
   "[Image uploaded: product.jpg, size: 12345 bytes]"

3. Agent analyzes image_base64 and responds:
   "I can see this is a handmade lavender soap. To add it to your catalog, 
    I need:
    • Price (how much do you sell it for?)
    • Quantity in stock
    • A unique ID for your records"

4. User: "Price is $12, I have 25 in stock, ID is SOAP-001"

5. Agent calls ingest_product_from_image tool:
   → Creates product in database
   → Returns success
```

### Workflow 2: User Uploads Image with Form

```
1. Frontend shows form:
   [Image Upload] [___________]
   Price:        [$__________]
   Quantity:     [__________]
   Unique ID:    [__________]
   SKU (opt):    [__________]
   [Upload & Create Product]

2. On submit:
   → POST /api/v1/agent/upload/image (with all metadata)
   → Product created immediately
   → Chat updated: "Product created: Handmade Lavender Soap ✓"
```

### Workflow 3: CSV Bulk Upload

```
1. User: [uploads products.csv with 50 items]
   → POST /api/v1/agent/upload/csv (auto_ingest=true)

2. Agent receives system message:
   "[CSV uploaded and processed: 48 products imported, 2 errors]"

3. Agent responds:
   "I've imported 48 products from your CSV! ✓
    
    ⚠ 2 products had errors:
    • Row 5: Duplicate unique_id (PROD-005)
    • Row 23: Missing product name
    
    Would you like me to show you the full product list or help fix the errors?"
```

## Error Handling

### Common Errors

**400 Bad Request**
```json
{"detail": "Invalid file type. Allowed: image/jpeg, image/png, image/webp"}
```

**413 Request Entity Too Large**
```json
{"detail": "Image too large. Maximum size: 10MB"}
```

**400 Bad Request (Validation)**
```json
{"detail": "Failed to ingest product: name is required"}
```

### Frontend Error Handling

```typescript
try {
  const result = await uploadProductImage(file, price, qty, id);
  
  if (result.status === 'success') {
    showSuccess(`Created ${result.products.length} product(s)`);
  }
} catch (error) {
  if (error.status === 413) {
    showError('File too large. Maximum 10MB for images.');
  } else if (error.status === 400) {
    showError(error.detail || 'Invalid file or data');
  } else {
    showError('Upload failed. Please try again.');
  }
}
```

## Session Logging

When `session_id` is provided, system messages are logged to the agent session:

```
[Image uploaded: product.jpg, size: 12345 bytes]
[CSV uploaded and processed: 48 products imported, 2 errors]
```

This allows the agent to reference uploaded files in conversation context.

## Security

- ✅ JWT authentication required
- ✅ Tenant isolation (products scoped to user's tenant)
- ✅ File size limits enforced
- ✅ File type validation
- ✅ Duplicate detection (unique_id, SKU)
- ✅ SQL injection prevention (parameterized queries)

## Testing

See `/backend/tests/test_upload.py` for endpoint tests.

```bash
# Run upload tests
pytest backend/tests/test_upload.py -v
```

## Next Steps

### Frontend Tasks
1. Add file upload button to chat interface
2. Create image upload form (with price/quantity fields)
3. Create CSV upload interface
4. Handle upload progress indicators
5. Display success/error messages
6. Show uploaded product details

### Backend Enhancements
1. Store uploaded files temporarily
2. Add file cleanup job (delete old uploads)
3. Add image resizing/optimization
4. Add CSV preview before ingestion
5. Add webhook for upload completion
