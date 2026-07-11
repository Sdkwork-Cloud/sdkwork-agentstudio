import React from 'react';
import { ChevronRight } from 'lucide-react';
import { ClawProduct } from '../../types';
import { useTranslation } from 'react-i18next';

interface Props {
  children?: React.ReactNode;
  customContent?: React.ReactNode;
  product: ClawProduct;
  onRequest: (name: string) => void;
}

export const ProductCardWrapper = ({ children, customContent, product, onRequest }: Props) => {
  const { t } = useTranslation();

  const getButtonText = (type: string) => {
    switch (type) {
      case 'physical': return t('products.buttons.buyNow');
      case 'auction': return t('products.buttons.placeBid');
      case 'recharge': return t('products.buttons.topUp');
      case 'content': return t('products.buttons.readSubscribe');
      case 'ai_image':
      case 'ai_video':
      case 'ai_music': return t('products.buttons.generateNow');
      case 'service': return t('products.buttons.inquire');
      case 'coupon': return t('products.buttons.claim');
      case 'food': return t('products.buttons.orderFood');
      case 'software': return t('products.buttons.generateSoftware');
      default: return t('products.buttons.viewDetails');
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'physical': return 'bg-blue-500/90';
      case 'auction': return 'bg-rose-500/90';
      case 'recharge': return 'bg-emerald-500/90';
      case 'content': return 'bg-purple-500/90';
      case 'ai_image':
      case 'ai_video':
      case 'ai_music': return 'bg-indigo-500/90';
      case 'service': return 'bg-zinc-800/90';
      case 'coupon': return 'bg-amber-500/90';
      case 'food': return 'bg-orange-500/90';
      case 'software': return 'bg-cyan-500/90';
      default: return 'bg-black/60';
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col sm:flex-row">
      {product.coverImage && (
        <div className="sm:w-48 h-48 sm:h-auto shrink-0 relative overflow-hidden">
          <img src={product.coverImage} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
          <div className={`absolute top-3 left-3 px-2.5 py-1 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider rounded-md shadow-sm ${getBadgeColor(product.type)}`}>
            {t(`products.labels.${product.type}`)}
          </div>
        </div>
      )}
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{product.name}</h3>
          <div className="text-lg font-black text-primary-600 dark:text-primary-400 whitespace-nowrap">{product.price}</div>
        </div>
        <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-4 flex-1 line-clamp-2">{product.description}</p>
        
        {children && (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-3 mb-4 text-xs text-zinc-600 dark:text-zinc-400 grid grid-cols-2 gap-y-2 gap-x-4">
            {children}
          </div>
        )}

        {customContent && (
          <div className="mb-4">
            {customContent}
          </div>
        )}

        <div className="flex justify-end mt-auto">
          <button 
            onClick={() => onRequest(product.name)}
            className="bg-primary-50 hover:bg-primary-100 text-primary-700 dark:bg-primary-500/10 dark:hover:bg-primary-500/20 dark:text-primary-400 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5"
          >
            {getButtonText(product.type)} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
