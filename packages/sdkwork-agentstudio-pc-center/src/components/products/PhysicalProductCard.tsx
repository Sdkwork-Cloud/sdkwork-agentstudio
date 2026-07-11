import React from 'react';
import { Package, MapPin } from 'lucide-react';
import { PhysicalProduct } from '../../types';
import { ProductCardWrapper } from './ProductCardWrapper';
import { useTranslation } from 'react-i18next';

export const PhysicalProductCard = ({ product, onRequest }: { product: PhysicalProduct, onRequest: (name: string) => void }) => {
  const { t } = useTranslation();
  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> {t('products.labels.stock')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.stock}</span></div>
      <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {t('products.labels.shipping')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.shippingCost}</span></div>
    </ProductCardWrapper>
  );
};
