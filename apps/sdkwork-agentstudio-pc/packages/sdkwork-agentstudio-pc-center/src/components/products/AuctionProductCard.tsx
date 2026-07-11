import React from 'react';
import { Gavel, Calendar, MessageCircle } from 'lucide-react';
import { AuctionProduct } from '../../types';
import { ProductCardWrapper } from './ProductCardWrapper';
import { useTranslation } from 'react-i18next';

export const AuctionProductCard = ({ product, onRequest }: { product: AuctionProduct, onRequest: (name: string) => void }) => {
  const { t, i18n } = useTranslation();
  const formatEndDate = (value: string) => new Intl.DateTimeFormat(i18n.language).format(new Date(value));
  return (
    <ProductCardWrapper product={product} onRequest={onRequest}>
      <div className="flex items-center gap-1.5"><Gavel className="w-3.5 h-3.5" /> {t('products.labels.currentBid')}: <span className="font-bold text-rose-600 dark:text-rose-400">{product.currentBid}</span></div>
      <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {t('products.labels.ends')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{formatEndDate(product.endTime)}</span></div>
      <div className="flex items-center gap-1.5 col-span-2"><MessageCircle className="w-3.5 h-3.5" /> {t('products.labels.bids')}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{product.bidCount}</span></div>
    </ProductCardWrapper>
  );
};
