import React from 'react';
import { ArrowRight, CheckCircle2, Code, Server } from 'lucide-react';
import { SoftwareProduct } from '../../types';
import { ProductCardWrapper } from './ProductCardWrapper';
import { useTranslation } from 'react-i18next';

interface SoftwareProductCardProps {
  product: SoftwareProduct;
  onRequest: (name: string) => void;
}

export function SoftwareProductCard({ product, onRequest }: SoftwareProductCardProps) {
  const { t } = useTranslation();

  return (
    <ProductCardWrapper 
      product={product} 
      onRequest={onRequest}
      customContent={
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {product.supportedTypes.map((type, idx) => (
              <span key={idx} className="px-2 py-1 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 text-xs font-bold rounded-md flex items-center gap-1">
                <Code className="w-3 h-3" /> {type}
              </span>
            ))}
          </div>
          
          <div className="flex flex-wrap gap-2">
            {product.deploymentOptions.map((opt, idx) => (
              <span key={idx} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-bold rounded-md flex items-center gap-1">
                <Server className="w-3 h-3" /> {opt}
              </span>
            ))}
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <h4 className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {t('products.software.features')}
            </h4>
            <ul className="grid grid-cols-2 gap-2">
              {product.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
            <div className="rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-50/90 px-4 py-3 text-sm leading-6 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
              {t('products.software.deliveryNotice')}
            </div>
            <button
              type="button"
              onClick={() => onRequest(product.name)}
              className="w-full rounded-xl bg-zinc-950 py-2 text-sm font-bold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <ArrowRight className="w-4 h-4" /> {t('products.software.requestBuild')}
              </span>
            </button>
          </div>
        </div>
      }
    />
  );
}
