import React from 'react';
import { Tag, Calendar, Store } from 'lucide-react';
import { CouponProduct } from '../../types';
import { ProductCardWrapper } from './ProductCardWrapper';
import { useTranslation } from 'react-i18next';

interface Props {
  product: CouponProduct;
  onRequest: (name: string) => void;
}

export function CouponProductCard({ product, onRequest }: Props) {
  const { t } = useTranslation();

  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5">
        <Store className="w-3.5 h-3.5 text-zinc-400" />
        <span className="font-medium text-zinc-700 dark:text-zinc-300">{product.merchant}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Tag className="w-3.5 h-3.5 text-amber-500" />
        <span className="font-bold text-amber-600 dark:text-amber-500">{product.discount}</span>
      </div>
      <div className="flex items-center gap-1.5 col-span-2">
        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
        <span>{t('products.validUntil')}: {product.validUntil}</span>
      </div>
    </ProductCardWrapper>
  );
}
