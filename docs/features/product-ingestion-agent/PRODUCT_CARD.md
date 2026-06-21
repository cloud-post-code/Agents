# ProductCard Component - Interactive Product Management

## Overview

A beautiful, interactive product card component with **inline editing** for SKU, quantity, and stock. Perfect for product catalog displays and agent-generated UI surfaces.

## Features

✅ **Inline Editing**
- Click-to-edit SKU
- Click-to-edit stock quantity
- Real-time validation
- Keyboard shortcuts (Enter to save, Escape to cancel)
- Optimistic UI updates

✅ **Visual Feedback**
- Low stock warnings
- Color-coded stock badges
- Smooth animations
- Hover effects
- Loading states

✅ **Rich Display**
- Product image support
- AI-generated tags
- Price display
- Description (with line clamping)
- Reorder point indicator

✅ **Responsive Design**
- Works on mobile, tablet, desktop
- Grid layout support
- Touch-friendly edit controls

## Components

### 1. ProductCard

Individual product card with inline editing.

**Import:**
```typescript
import { ProductCard } from '@/components/a2ui/containers/ProductCard';
```

**Props:**
```typescript
interface ProductCardProps {
  id: string;                 // Product ID
  name: string;              // Product name
  description?: string;      // Optional description
  sku?: string;             // SKU code (editable)
  price?: number;           // Price in dollars
  stockQty?: number;        // Current stock (editable)
  reorderPoint?: number;    // Low stock threshold
  tags?: string[];          // AI-generated tags
  imageUrl?: string;        // Product image URL
  onUpdate?: (id: string, field: string, value: any) => Promise<void>;
  className?: string;       // Custom CSS classes
}
```

**Example:**
```tsx
<ProductCard
  id="prod-123"
  name="Handmade Lavender Soap"
  description="Natural artisan soap with lavender essential oils"
  sku="SOAP-LAV-001"
  price={12.50}
  stockQty={25}
  reorderPoint={5}
  tags={['handmade', 'soap', 'lavender', 'natural']}
  imageUrl="/products/soap.jpg"
  onUpdate={handleProductUpdate}
/>
```

### 2. ProductGrid

Responsive grid layout for displaying multiple products.

**Import:**
```typescript
import { ProductGrid } from '@/components/a2ui/containers/ProductGrid';
```

**Props:**
```typescript
interface ProductGridProps {
  products: Product[];      // Array of products
  onUpdateProduct?: (id: string, field: string, value: any) => Promise<void>;
  emptyMessage?: string;   // Custom empty state message
  className?: string;      // Custom CSS classes
}
```

**Example:**
```tsx
<ProductGrid
  products={products}
  onUpdateProduct={handleUpdate}
  emptyMessage="No products in catalog"
/>
```

## Inline Editing

### How It Works

**Click to Edit:**
1. Click on SKU or Stock field
2. Field transforms into an editable input
3. Make your changes
4. Press Enter or click away to save
5. Press Escape to cancel

**Keyboard Shortcuts:**
- `Enter` - Save changes
- `Escape` - Cancel and revert
- `Tab` - Move to next field (standard behavior)

**Visual States:**
- **View Mode**: Hover effect, click to edit
- **Edit Mode**: Blue border, focused input
- **Saving**: "Saving..." indicator, disabled input
- **Error**: Reverts to previous value

### Validation

**SKU:**
- Any string value allowed
- Empty SKU shows placeholder "Click to add SKU..."

**Stock Quantity:**
- Must be a number
- Minimum: 0
- No maximum (unlimited)
- Invalid input reverts to previous value

## API Integration

### Update Handler

```typescript
const handleProductUpdate = async (
  id: string,
  field: string,
  value: any
) => {
  // Optimistic update (update UI immediately)
  setProducts(prev =>
    prev.map(p => p.id === id ? { ...p, [field]: value } : p)
  );

  try {
    // Call backend API
    const response = await fetch(`/api/v1/products/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ [field]: value }),
    });

    if (!response.ok) {
      throw new Error('Update failed');
    }

    // Success - no action needed (optimistic update already done)
  } catch (error) {
    // Revert on error
    console.error('Failed to update product:', error);
    
    // Re-fetch or revert optimistic update
    // fetchProducts();
  }
};
```

## Usage Examples

### Example 1: Agent Chat with Products

Display products after CSV upload:

```tsx
function AgentProductView({ sessionId }) {
  const [products, setProducts] = useState([]);

  const handleCSVUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('auto_ingest', 'true');
    formData.append('session_id', sessionId);

    const response = await fetch('/api/v1/agent/upload/csv', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    const data = await response.json();
    setProducts(data.products);
  };

  return (
    <div>
      <FileUpload onUpload={handleCSVUpload} />
      
      {products.length > 0 && (
        <>
          <h3>Imported Products ({products.length})</h3>
          <ProductGrid products={products} onUpdateProduct={updateProduct} />
        </>
      )}
    </div>
  );
}
```

### Example 2: Product Catalog Page

Full catalog with search and filters:

```tsx
function ProductCatalogPage() {
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg"
        />
      </div>

      <ProductGrid
        products={filteredProducts}
        onUpdateProduct={handleUpdate}
        emptyMessage="No products match your search"
      />
    </div>
  );
}
```

### Example 3: Low Stock Alert View

Show only low stock products:

```tsx
function LowStockView({ products }) {
  const lowStockProducts = products.filter(
    p => p.stock_qty <= (p.reorder_point || 5)
  );

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">
        Low Stock Alert ({lowStockProducts.length})
      </h2>
      
      <ProductGrid
        products={lowStockProducts}
        onUpdateProduct={updateProduct}
        emptyMessage="All products are well-stocked! 🎉"
      />
    </div>
  );
}
```

## Styling & Customization

### Custom Colors

Override colors with Tailwind classes:

```tsx
<ProductCard
  {...props}
  className="border-purple-200 bg-purple-50"
/>
```

### Grid Layouts

Customize grid columns:

```tsx
<ProductGrid
  products={products}
  className="grid-cols-2 lg:grid-cols-5 gap-4"
/>
```

### Dark Mode Support

Add dark mode classes:

```tsx
<ProductCard
  {...props}
  className="dark:bg-gray-800 dark:border-gray-700"
/>
```

## Accessibility

✅ **Keyboard Navigation**
- Tab to navigate between cards
- Enter/Escape for edit mode
- Full keyboard accessibility

✅ **Screen Readers**
- Semantic HTML
- Proper labels
- ARIA attributes where needed

✅ **Touch Support**
- Large touch targets
- Tap to edit
- Mobile-optimized inputs

## Performance

**Optimizations:**
- Optimistic UI updates (instant feedback)
- Minimal re-renders
- Efficient event handlers
- Image lazy loading support

**Best Practices:**
```tsx
// ✅ Good: Memoize update handler
const handleUpdate = useCallback(async (id, field, value) => {
  // ...
}, []);

// ✅ Good: Batch state updates
setProducts(prev => prev.map(/* ... */));

// ❌ Bad: Create new handler on every render
<ProductCard onUpdate={async (id, field, value) => { /* ... */ }} />
```

## Integration with Agent Tools

The ProductCard automatically works with products created by the ingestion agent:

```typescript
// Product structure from ingestion agent
{
  "id": "uuid",
  "name": "Handmade Lavender Soap",      // From AI vision
  "description": "Natural artisan...",    // AI-enriched
  "tags": ["handmade", "soap"],          // AI-generated
  "sku": "SOAP-001",                     // User-provided
  "price": 12.50,                        // User-provided
  "stock_qty": 25,                       // User-provided
  "reorder_point": 5
}
```

## Testing

### Component Tests

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import { ProductCard } from './ProductCard';

test('edits SKU inline', async () => {
  const onUpdate = jest.fn();
  const { getByText, getByDisplayValue } = render(
    <ProductCard
      id="1"
      name="Test Product"
      sku="OLD-SKU"
      onUpdate={onUpdate}
    />
  );

  // Click to edit
  fireEvent.click(getByText('OLD-SKU'));
  
  // Change value
  const input = getByDisplayValue('OLD-SKU');
  fireEvent.change(input, { target: { value: 'NEW-SKU' } });
  fireEvent.blur(input);

  // Verify API call
  await waitFor(() => {
    expect(onUpdate).toHaveBeenCalledWith('1', 'sku', 'NEW-SKU');
  });
});
```

## Troubleshooting

### Updates not saving?

Check that `onUpdate` handler is properly bound and async:

```tsx
const handleUpdate = async (id, field, value) => {
  await fetch(/* ... */);  // Must be async
};
```

### Card not responsive?

Ensure parent container allows flex/grid:

```tsx
<div className="container mx-auto">  {/* Good */}
  <ProductGrid products={products} />
</div>
```

### Low stock badge not showing?

Verify `reorderPoint` is set and `stockQty` is valid:

```tsx
<ProductCard
  stockQty={3}
  reorderPoint={5}  // Badge shows if stockQty <= reorderPoint
/>
```

## Summary

The ProductCard component provides:
- ✅ Beautiful, interactive UI
- ✅ Inline editing (SKU, stock)
- ✅ Low stock alerts
- ✅ AI-generated tags display
- ✅ Responsive grid layouts
- ✅ Full keyboard support
- ✅ Optimistic updates
- ✅ Production-ready

Perfect for product catalogs, agent UIs, and inventory management! 🚀
