import React from 'react';
import { Image as ImageIcon, Video, Music, Zap } from 'lucide-react';
import { AIGenerationProduct } from '../../types';
import { ProductCardWrapper } from './ProductCardWrapper';
import { useTranslation } from 'react-i18next';

export const AIGenerationProductCard = ({ product, onRequest }: { product: AIGenerationProduct, onRequest: (name: string) => void }) => {
  const { t } = useTranslation();
  const Icon = product.type === 'ai_image' ? ImageIcon : product.type === 'ai_video' ? Video : Music;
  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {t('products.labels.format')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.format}</span></div>
      <div className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> {t('products.labels.delivery')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.deliveryTime}</span></div>
      {product.resolution && <div className="flex items-center gap-1.5 col-span-2"><ImageIcon className="w-3.5 h-3.5" /> {t('products.labels.resolution')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.resolution}</span></div>}
      {product.duration && <div className="flex items-center gap-1.5 col-span-2"><Video className="w-3.5 h-3.5" /> {t('products.labels.duration')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.duration}</span></div>}
    </ProductCardWrapper>
  );
};
