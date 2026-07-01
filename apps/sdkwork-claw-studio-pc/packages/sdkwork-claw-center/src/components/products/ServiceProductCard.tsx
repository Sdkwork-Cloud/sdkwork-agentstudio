import React from 'react';
import { Building2 } from 'lucide-react';
import { ServiceProduct } from '../../types';
import { ProductCardWrapper } from './ProductCardWrapper';
import { useTranslation } from 'react-i18next';

export const ServiceProductCard = ({ product, onRequest }: { product: ServiceProduct, onRequest: (name: string) => void }) => {
  const { t } = useTranslation();
  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5 col-span-2"><Building2 className="w-3.5 h-3.5" /> {t('products.labels.category')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.category}</span></div>
    </ProductCardWrapper>
  );
};
