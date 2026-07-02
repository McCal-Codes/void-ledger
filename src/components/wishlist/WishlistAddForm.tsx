"use client";

import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import { WishlistItem } from "@/types/baro";

const PRIORITIES: WishlistItem["priority"][] = [
  "Must Have",
  "High",
  "Medium",
  "Low",
  "Skip",
];

const CATEGORIES = ["Primed Mod", "Weapon", "Cosmetic", "Mod", "Decoration", "Other"];

interface WishlistAddFormProps {
  onAddItem: (item: WishlistItem) => void;
}

export function WishlistAddForm({ onAddItem }: WishlistAddFormProps) {
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("Primed Mod");
  const [priority, setPriority] = useState<WishlistItem["priority"]>("Medium");
  const [ducatCost, setDucatCost] = useState(0);
  const [creditCost, setCreditCost] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = itemName.trim();
    if (!trimmedName) return;

    onAddItem({
      id: `manual:${Date.now()}:${slugify(trimmedName)}`,
      wanted: true,
      owned: false,
      priority,
      itemName: trimmedName,
      category,
      ducatCost,
      creditCost,
      quantity,
      totalDucats: ducatCost * quantity,
      totalCredits: creditCost * quantity,
      source: "manual",
    });

    setItemName("");
    setCategory("Primed Mod");
    setPriority("Medium");
    setDucatCost(0);
    setCreditCost(0);
    setQuantity(1);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-zinc-900 border border-zinc-800 rounded-lg p-6"
      aria-label="Add wishlist item"
    >
      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="md:col-span-2">
          <label htmlFor="wishlistItemName" className="block text-sm text-zinc-400 mb-2">
            Item
          </label>
          <input
            id="wishlistItemName"
            value={itemName}
            onChange={(event) => setItemName(event.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
            placeholder="Primed Flow"
          />
        </div>
        <div>
          <label htmlFor="wishlistCategory" className="block text-sm text-zinc-400 mb-2">
            Category
          </label>
          <select
            id="wishlistCategory"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
          >
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wishlistPriority" className="block text-sm text-zinc-400 mb-2">
            Priority
          </label>
          <select
            id="wishlistPriority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as WishlistItem["priority"])}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wishlistDucats" className="block text-sm text-zinc-400 mb-2">
            Ducats
          </label>
          <input
            id="wishlistDucats"
            type="number"
            min="0"
            value={ducatCost}
            onChange={(event) => setDucatCost(Number(event.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
          />
        </div>
        <div>
          <label htmlFor="wishlistCredits" className="block text-sm text-zinc-400 mb-2">
            Credits
          </label>
          <input
            id="wishlistCredits"
            type="number"
            min="0"
            value={creditCost}
            onChange={(event) => setCreditCost(Number(event.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
          />
        </div>
        <div>
          <label htmlFor="wishlistQuantity" className="block text-sm text-zinc-400 mb-2">
            Qty
          </label>
          <input
            id="wishlistQuantity"
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
          />
        </div>
        <div className="md:col-span-6">
          <button
            type="submit"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add Item
          </button>
        </div>
      </div>
    </form>
  );
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
