import React from 'react';
import { Store, Clock, Star } from 'lucide-react';
import { FoodProduct } from '../../types';
import { ProductCardWrapper } from './ProductCardWrapper';
import { useTranslation } from 'react-i18next';

interface Props {
  product: FoodProduct;
  onRequest: (name: string) => void;
}

export function FoodProductCard({ product, onRequest }: Props) {
  const { t } = useTranslation();

  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5 col-span-2">
        <Store className="w-3.5 h-3.5 text-zinc-400" />
        <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">{product.restaurant}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-zinc-400" />
        <span>{product.deliveryTime}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
        <span className="font-bold text-zinc-700 dark:text-zinc-300">{product.rating}</span>
      </div>
    </ProductCardWrapper>
  );
}
