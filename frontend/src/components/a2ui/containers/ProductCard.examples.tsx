/**
 * Example usage of ProductCard and ProductGrid
 */

import { ProductCard } from '@/components/a2ui/containers/ProductCard';
import { ProductGrid } from '@/components/a2ui/containers/ProductGrid';

// Example: Single Product Card
export function SingleProductExample() {
  const handleUpdate = async (id: string, field: string, value: any) => {
    // Call your API to update the product
    const response = await fetch(`/api/v1/products/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ [field]: value }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update product');
    }
  };

  return (
    <ProductCard
      id="prod-123"
      name="Handmade Lavender Soap"
      description="Natural artisan soap handcrafted with pure lavender essential oils, shea butter, and organic ingredients. Perfect for sensitive skin."
      sku="SOAP-LAV-001"
      price={12.50}
      stockQty={25}
      reorderPoint={5}
      tags={['handmade', 'soap', 'lavender', 'natural', 'skincare']}
      imageUrl="/products/soap-lavender.jpg"
      onUpdate={handleUpdate}
    />
  );
}

// Example: Product Grid
export function ProductCatalogPage() {
  const [products, setProducts] = useState([
    {
      id: '1',
      name: 'Handmade Lavender Soap',
      description: 'Natural artisan soap with lavender essential oils',
      sku: 'SOAP-LAV-001',
      price: 12.50,
      stock_qty: 25,
      reorder_point: 5,
      tags: ['handmade', 'soap', 'lavender'],
    },
    {
      id: '2',
      name: 'Artisan Candle - Vanilla',
      description: 'Hand-poured vanilla scented candle',
      sku: 'CANDLE-VAN-001',
      price: 18.50,
      stock_qty: 3, // Low stock!
      reorder_point: 5,
      tags: ['handmade', 'candle', 'vanilla'],
    },
    // ... more products
  ]);

  const handleUpdateProduct = async (id: string, field: string, value: any) => {
    // Optimistic update
    setProducts(prev =>
      prev.map(p => p.id === id ? { ...p, [field]: value } : p)
    );

    try {
      await fetch(`/api/v1/products/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ [field]: value }),
      });
    } catch (error) {
      // Revert on error
      // Fetch fresh data or revert optimistic update
      console.error('Failed to update:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Product Catalog
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Click on SKU or Stock to edit inline
        </p>
      </div>

      <ProductGrid
        products={products}
        onUpdateProduct={handleUpdateProduct}
      />
    </div>
  );
}

// Example: Agent Chat Integration
export function AgentChatWithProducts() {
  const [uploadedProducts, setUploadedProducts] = useState([]);

  const handleFileUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('auto_ingest', 'true');

    const response = await fetch('/api/v1/agent/upload/csv', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();
    
    // Display uploaded products in cards
    setUploadedProducts(data.products);
  };

  return (
    <div>
      {/* Agent Chat Interface */}
      <AgentChat />

      {/* Show uploaded products */}
      {uploadedProducts.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">
            Recently Imported Products
          </h3>
          <ProductGrid products={uploadedProducts} />
        </div>
      )}
    </div>
  );
}
