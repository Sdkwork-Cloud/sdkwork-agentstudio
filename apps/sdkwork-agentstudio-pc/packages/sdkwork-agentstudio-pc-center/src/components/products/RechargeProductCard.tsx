import React from 'react';
import { Zap } from 'lucide-react';
import { RechargeProduct } from '../../types';
import { ProductCardWrapper } from './ProductCardWrapper';
import { useTranslation } from 'react-i18next';

export const RechargeProductCard = ({ product, onRequest }: { product: RechargeProduct, onRequest: (name: string) => void }) => {
  const { t } = useTranslation();
  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5 col-span-2"><Zap className="w-3.5 h-3.5" /> {t('products.labels.provider')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.provider}</span></div>
      <div className="col-span-2 flex flex-wrap gap-1 mt-1">
        {product.denominations.map(d => (
          <span key={d} className="px-2 py-0.5 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded text-[10px] font-bold">{d}</span>
        ))}
      </div>
    </ProductCardWrapper>
  );
};
