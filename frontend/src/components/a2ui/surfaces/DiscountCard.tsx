"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type DiscountType = "sale" | "coupon" | "bulk";

export interface DiscountCardProps {
  discount_type?: DiscountType;
  product_id?: string;
  product_name?: string;
  name?: string;
  // Sale
  sale_price?: number;
  sale_percent?: number;
  // Coupon
  coupon_code?: string;
  coupon_discount_percent?: number;
  coupon_discount_cents?: number;
  max_uses?: number;
  // Bulk
  bulk_min_quantity?: number;
  bulk_discount_percent?: number;
}

const fieldClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

function generateCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function TypePicker({ onSelect }: { onSelect: (t: DiscountType) => void }) {
  const types: { type: DiscountType; icon: string; label: string; desc: string }[] = [
    { type: "sale", icon: "🏷️", label: "Sale Price", desc: "Reduce the product price for a limited time" },
    { type: "coupon", icon: "🎟️", label: "Coupon Code", desc: "Share a code for customers to apply at checkout" },
    { type: "bulk", icon: "📦", label: "Bulk Discount", desc: "Automatically discount when buying in quantity" },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-3">Choose a discount type:</p>
      {types.map((t) => (
        <button
          key={t.type}
          type="button"
          onClick={() => onSelect(t.type)}
          className="w-full flex items-start gap-3 text-left border border-gray-200 rounded-xl px-4 py-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          <span className="text-xl mt-0.5">{t.icon}</span>
          <div>
            <p className="text-sm font-semibold text-gray-800">{t.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function SaleForm({
  props,
  name,
  setName,
  saleMode,
  setSaleMode,
  saleValue,
  setSaleValue,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: {
  props: DiscountCardProps;
  name: string;
  setName: (v: string) => void;
  saleMode: "percent" | "fixed";
  setSaleMode: (v: "percent" | "fixed") => void;
  saleValue: string;
  setSaleValue: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
}) {
  void props;
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Discount name</label>
        <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Sale" />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">Discount amount</label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setSaleMode("percent")}
            className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
              saleMode === "percent" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            % off
          </button>
          <button
            type="button"
            onClick={() => setSaleMode("fixed")}
            className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
              saleMode === "fixed" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Fixed price
          </button>
        </div>
        <input
          className={fieldClass}
          type="number"
          min="0"
          step={saleMode === "percent" ? "1" : "0.01"}
          value={saleValue}
          onChange={(e) => setSaleValue(e.target.value)}
          placeholder={saleMode === "percent" ? "e.g. 20 (%)" : "e.g. 9.99 ($)"}
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">Start date (optional)</label>
          <input className={fieldClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">End date (optional)</label>
          <input className={fieldClass} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function CouponForm({
  name,
  setName,
  code,
  setCode,
  couponMode,
  setCouponMode,
  couponValue,
  setCouponValue,
  maxUses,
  setMaxUses,
}: {
  name: string;
  setName: (v: string) => void;
  code: string;
  setCode: (v: string) => void;
  couponMode: "percent" | "fixed";
  setCouponMode: (v: "percent" | "fixed") => void;
  couponValue: string;
  setCouponValue: (v: string) => void;
  maxUses: string;
  setMaxUses: (v: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Coupon name</label>
        <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome10" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500">Coupon code</label>
          <button
            type="button"
            onClick={() => setCode(generateCode())}
            className="text-xs text-blue-500 hover:text-blue-700 font-medium"
          >
            auto-generate
          </button>
        </div>
        <input
          className={fieldClass}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. SAVE20"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">Discount amount</label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setCouponMode("percent")}
            className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
              couponMode === "percent" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            % off
          </button>
          <button
            type="button"
            onClick={() => setCouponMode("fixed")}
            className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
              couponMode === "fixed" ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            $ off
          </button>
        </div>
        <input
          className={fieldClass}
          type="number"
          min="0"
          step={couponMode === "percent" ? "1" : "0.01"}
          value={couponValue}
          onChange={(e) => setCouponValue(e.target.value)}
          placeholder={couponMode === "percent" ? "e.g. 10 (%)" : "e.g. 5.00 ($)"}
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Max uses (optional)</label>
        <input
          className={fieldClass}
          type="number"
          min="0"
          step="1"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          placeholder="Unlimited"
        />
      </div>
    </div>
  );
}

function BulkForm({
  name,
  setName,
  minQty,
  setMinQty,
  discountPercent,
  setDiscountPercent,
}: {
  name: string;
  setName: (v: string) => void;
  minQty: string;
  setMinQty: (v: string) => void;
  discountPercent: string;
  setDiscountPercent: (v: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Discount name</label>
        <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Buy 10+ Save 15%" />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">Minimum quantity</label>
        <input
          className={fieldClass}
          type="number"
          min="1"
          step="1"
          value={minQty}
          onChange={(e) => setMinQty(e.target.value)}
          placeholder="e.g. 10"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 mb-1 block">% off per unit</label>
        <input
          className={fieldClass}
          type="number"
          min="0"
          max="100"
          step="1"
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
          placeholder="e.g. 15"
        />
      </div>
    </div>
  );
}

export function DiscountCard(props: DiscountCardProps) {
  const { token } = useAuth();
  const [type, setType] = useState<DiscountType | null>(props.discount_type ?? null);

  // Shared
  const [name, setName] = useState(props.name ?? "");

  // Sale
  const [saleMode, setSaleMode] = useState<"percent" | "fixed">(
    props.sale_price !== undefined ? "fixed" : "percent"
  );
  const [saleValue, setSaleValue] = useState(
    props.sale_percent !== undefined
      ? String(props.sale_percent)
      : props.sale_price !== undefined
      ? String(props.sale_price)
      : ""
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Coupon
  const [code, setCode] = useState(props.coupon_code ?? "");
  const [couponMode, setCouponMode] = useState<"percent" | "fixed">(
    props.coupon_discount_cents !== undefined ? "fixed" : "percent"
  );
  const [couponValue, setCouponValue] = useState(
    props.coupon_discount_percent !== undefined
      ? String(props.coupon_discount_percent)
      : props.coupon_discount_cents !== undefined
      ? String(props.coupon_discount_cents / 100)
      : ""
  );
  const [maxUses, setMaxUses] = useState(
    props.max_uses !== undefined ? String(props.max_uses) : ""
  );

  // Bulk
  const [minQty, setMinQty] = useState(
    props.bulk_min_quantity !== undefined ? String(props.bulk_min_quantity) : ""
  );
  const [bulkPercent, setBulkPercent] = useState(
    props.bulk_discount_percent !== undefined ? String(props.bulk_discount_percent) : ""
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!token || !type) return;
    setSaving(true);
    setError(null);

    try {
      let body: Record<string, unknown> = {
        type,
        name: name || "Discount",
        ...(props.product_id ? { product_id: props.product_id } : {}),
      };

      if (type === "sale") {
        if (!saleValue) { setError("Enter a discount amount."); setSaving(false); return; }
        body = {
          ...body,
          ...(saleMode === "percent"
            ? { sale_percent: parseFloat(saleValue) }
            : { sale_price: parseFloat(saleValue) }),
          ...(startDate ? { start_date: startDate } : {}),
          ...(endDate ? { end_date: endDate } : {}),
        };
      } else if (type === "coupon") {
        if (!code) { setError("Enter a coupon code."); setSaving(false); return; }
        if (!couponValue) { setError("Enter a discount amount."); setSaving(false); return; }
        body = {
          ...body,
          coupon_code: code,
          ...(couponMode === "percent"
            ? { coupon_discount_percent: parseFloat(couponValue) }
            : { coupon_discount_cents: Math.round(parseFloat(couponValue) * 100) }),
          ...(maxUses ? { max_uses: parseInt(maxUses, 10) } : {}),
        };
      } else if (type === "bulk") {
        if (!minQty) { setError("Enter a minimum quantity."); setSaving(false); return; }
        if (!bulkPercent) { setError("Enter a discount %."); setSaving(false); return; }
        body = {
          ...body,
          bulk_min_quantity: parseInt(minQty, 10),
          bulk_discount_percent: parseFloat(bulkPercent),
        };
      }

      await apiFetch("/api/v1/discounts", token, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm w-full max-w-sm">
        <p className="text-green-700 font-semibold">✓ Discount created!</p>
        <p className="text-xs text-gray-500 mt-1">{name || "Your discount"} is now active.</p>
      </div>
    );
  }

  const typeLabels: Record<DiscountType, string> = {
    sale: "Sale Price",
    coupon: "Coupon Code",
    bulk: "Bulk Discount",
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm w-full max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-blue-700 font-semibold">
          {type ? typeLabels[type] : "Create Discount"}
        </p>
        {type && !props.discount_type && (
          <button
            type="button"
            onClick={() => setType(null)}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600"
          >
            ← Change type
          </button>
        )}
      </div>

      {props.product_name && (
        <p className="text-xs text-gray-500 mb-3">
          For: <span className="font-medium text-gray-700">{props.product_name}</span>
        </p>
      )}

      {!type && <TypePicker onSelect={setType} />}

      {type === "sale" && (
        <SaleForm
          props={props}
          name={name}
          setName={setName}
          saleMode={saleMode}
          setSaleMode={setSaleMode}
          saleValue={saleValue}
          setSaleValue={setSaleValue}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />
      )}

      {type === "coupon" && (
        <CouponForm
          name={name}
          setName={setName}
          code={code}
          setCode={setCode}
          couponMode={couponMode}
          setCouponMode={setCouponMode}
          couponValue={couponValue}
          setCouponValue={setCouponValue}
          maxUses={maxUses}
          setMaxUses={setMaxUses}
        />
      )}

      {type === "bulk" && (
        <BulkForm
          name={name}
          setName={setName}
          minQty={minQty}
          setMinQty={setMinQty}
          discountPercent={bulkPercent}
          setDiscountPercent={setBulkPercent}
        />
      )}

      {type && (
        <>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : "Create Discount"}
          </button>
        </>
      )}
    </div>
  );
}
