/**
 * ProductGrid - Responsive grid layout for product cards
 */

'use client';

import { ProductCard } from './ProductCard';

interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  price?: number;
  stock_qty?: number;
  reorder_point?: number;
  tags?: string[];
  image_url?: string;
}

interface ProductGridProps {
  products: Product[];
  onUpdateProduct?: (id: string, field: string, value: any) => Promise<void>;
  emptyMessage?: string;
  className?: string;
}

export function ProductGrid({
  products,
  onUpdateProduct,
  emptyMessage = 'No products found',
  className = '',
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          {emptyMessage}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Upload an image or CSV to add products
        </p>
      </div>
    );
  }

  return (
    <div
      className={`
        grid grid-cols-1 gap-6
        sm:grid-cols-2
        lg:grid-cols-3
        xl:grid-cols-4
        ${className}
      `}
    >
      {products.map((product) => (
        <ProductCard
          key={product.id}
          id={product.id}
          name={product.name}
          description={product.description}
          sku={product.sku}
          price={product.price}
          stockQty={product.stock_qty}
          reorderPoint={product.reorder_point}
          tags={product.tags}
          imageUrl={product.image_url}
          onUpdate={onUpdateProduct}
        />
      ))}
    </div>
  );
}
