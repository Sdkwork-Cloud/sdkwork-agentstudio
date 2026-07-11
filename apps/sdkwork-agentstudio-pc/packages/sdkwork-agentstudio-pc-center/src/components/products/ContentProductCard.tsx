import React from 'react';
import { BookOpen, Star, Calendar } from 'lucide-react';
import { ContentProduct } from '../../types';
import { ProductCardWrapper } from './ProductCardWrapper';
import { useTranslation } from 'react-i18next';

export const ContentProductCard = ({ product, onRequest }: { product: ContentProduct, onRequest: (name: string) => void }) => {
  const { t } = useTranslation();
  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> {t('products.labels.category')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.category}</span></div>
      <div className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> {t('products.labels.chapters')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.chapters}</span></div>
      <div className="flex items-center gap-1.5 col-span-2"><Calendar className="w-3.5 h-3.5" /> {t('products.labels.updated')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.latestUpdate}</span></div>
    </ProductCardWrapper>
  );
};
