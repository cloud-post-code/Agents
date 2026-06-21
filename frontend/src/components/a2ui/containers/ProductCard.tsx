/**
 * ProductCard - Interactive product card with inline editing
 * 
 * Features:
 * - Editable quantity and stock
 * - SKU display and editing
 * - Price display
 * - AI-generated tags
 * - Low stock alerts
 * - Smooth animations
 * - Click to edit with validation
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { PriceTag } from '../atoms/PriceTag';
import { StockBadge } from '../atoms/StockBadge';

interface ProductCardProps {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  price?: number;
  stockQty?: number;
  reorderPoint?: number;
  tags?: string[];
  imageUrl?: string;
  onUpdate?: (id: string, field: string, value: any) => Promise<void>;
  className?: string;
}

export function ProductCard({
  id,
  name,
  description,
  sku,
  price,
  stockQty = 0,
  reorderPoint = 5,
  tags = [],
  imageUrl,
  onUpdate,
  className = '',
}: ProductCardProps) {
  const [isEditingSKU, setIsEditingSKU] = useState(false);
  const [isEditingStock, setIsEditingStock] = useState(false);
  const [skuValue, setSkuValue] = useState(sku || '');
  const [stockValue, setstockValue] = useState(stockQty.toString());
  const [isSaving, setIsSaving] = useState(false);
  
  const skuInputRef = useRef<HTMLInputElement>(null);
  const stockInputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingSKU && skuInputRef.current) {
      skuInputRef.current.focus();
      skuInputRef.current.select();
    }
  }, [isEditingSKU]);

  useEffect(() => {
    if (isEditingStock && stockInputRef.current) {
      stockInputRef.current.focus();
      stockInputRef.current.select();
    }
  }, [isEditingStock]);

  const handleSKUSubmit = async () => {
    if (skuValue !== sku && onUpdate) {
      setIsSaving(true);
      try {
        await onUpdate(id, 'sku', skuValue);
      } catch (error) {
        setSkuValue(sku || ''); // Revert on error
      }
      setIsSaving(false);
    }
    setIsEditingSKU(false);
  };

  const handleStockSubmit = async () => {
    const newStock = parseInt(stockValue, 10);
    if (!isNaN(newStock) && newStock !== stockQty && onUpdate) {
      setIsSaving(true);
      try {
        await onUpdate(id, 'stock_qty', newStock);
      } catch (error) {
        setStockValue(stockQty.toString()); // Revert on error
      }
      setIsSaving(false);
    }
    setIsEditingStock(false);
  };

  const handleSKUKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSKUSubmit();
    } else if (e.key === 'Escape') {
      setSkuValue(sku || '');
      setIsEditingSKU(false);
    }
  };

  const handleStockKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleStockSubmit();
    } else if (e.key === 'Escape') {
      setStockValue(stockQty.toString());
      setIsEditingStock(false);
    }
  };

  const isLowStock = stockQty <= reorderPoint;

  return (
    <div
      className={`
        bg-white rounded-lg border border-gray-200 shadow-sm
        hover:shadow-md transition-shadow duration-200
        overflow-hidden
        ${className}
      `}
    >
      {/* Product Image */}
      {imageUrl && (
        <div className="w-full h-48 bg-gray-100 overflow-hidden">
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Product Content */}
      <div className="p-4">
        {/* Header with name and price */}
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 flex-1">
            {name}
          </h3>
          {price !== undefined && (
            <div className="ml-3 flex-shrink-0">
              <PriceTag amount={price} size="lg" />
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {description}
          </p>
        )}

        {/* SKU - Editable */}
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            SKU
          </label>
          {isEditingSKU ? (
            <input
              ref={skuInputRef}
              type="text"
              value={skuValue}
              onChange={(e) => setSkuValue(e.target.value)}
              onBlur={handleSKUSubmit}
              onKeyDown={handleSKUKeyDown}
              disabled={isSaving}
              className="
                mt-1 block w-full px-3 py-2 text-sm
                border border-blue-300 rounded-md
                focus:outline-none focus:ring-2 focus:ring-blue-500
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              placeholder="Enter SKU..."
            />
          ) : (
            <button
              onClick={() => setIsEditingSKU(true)}
              className="
                mt-1 block w-full px-3 py-2 text-sm text-left
                border border-transparent rounded-md
                hover:border-gray-300 hover:bg-gray-50
                transition-colors duration-150
                text-gray-700 font-mono
              "
            >
              {skuValue || (
                <span className="text-gray-400 italic">Click to add SKU...</span>
              )}
            </button>
          )}
        </div>

        {/* Stock Quantity - Editable with badge */}
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Stock Quantity
          </label>
          {isEditingStock ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                ref={stockInputRef}
                type="number"
                min="0"
                value={stockValue}
                onChange={(e) => setStockValue(e.target.value)}
                onBlur={handleStockSubmit}
                onKeyDown={handleStockKeyDown}
                disabled={isSaving}
                className="
                  block w-24 px-3 py-2 text-sm
                  border border-blue-300 rounded-md
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              />
              <span className="text-xs text-gray-500">
                units
              </span>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingStock(true)}
              className="
                mt-1 flex items-center gap-2 px-3 py-2
                border border-transparent rounded-md
                hover:border-gray-300 hover:bg-gray-50
                transition-colors duration-150
                w-full
              "
            >
              <StockBadge quantity={stockQty} lowThreshold={reorderPoint} />
              <span className="text-sm text-gray-700 font-medium">
                {stockQty} units
              </span>
              {isLowStock && (
                <span className="ml-auto text-xs text-orange-600 font-medium">
                  Low Stock!
                </span>
              )}
            </button>
          )}
        </div>

        {/* Reorder Point */}
        <div className="text-xs text-gray-500 mb-3">
          Reorder at: <span className="font-medium">{reorderPoint} units</span>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
            {tags.map((tag, idx) => (
              <span
                key={idx}
                className="
                  inline-flex items-center px-2.5 py-0.5
                  rounded-full text-xs font-medium
                  bg-blue-50 text-blue-700
                  border border-blue-200
                "
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={() => setIsEditingSKU(true)}
            className="
              flex-1 px-3 py-1.5 text-sm font-medium
              text-gray-700 bg-white border border-gray-300
              rounded-md hover:bg-gray-50
              transition-colors duration-150
            "
          >
            Edit SKU
          </button>
          <button
            onClick={() => setIsEditingStock(true)}
            className="
              flex-1 px-3 py-1.5 text-sm font-medium
              text-white bg-blue-600 border border-blue-600
              rounded-md hover:bg-blue-700
              transition-colors duration-150
            "
          >
            Update Stock
          </button>
        </div>

        {/* Saving indicator */}
        {isSaving && (
          <div className="mt-2 text-xs text-center text-gray-500 animate-pulse">
            Saving...
          </div>
        )}
      </div>
    </div>
  );
}
