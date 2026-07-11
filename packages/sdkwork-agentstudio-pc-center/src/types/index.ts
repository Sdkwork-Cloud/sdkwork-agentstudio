import { LucideIcon } from 'lucide-react';

export interface ClawRegistryCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  desc: string;
}

export type ClawRegistryKind = 'agent' | 'service';
export type ClawRegistryConnectionAuthMode = 'token' | 'none' | 'external';

export interface ClawRegistryConnectionProfile {
  gatewayUrl?: string | null;
  websocketUrl?: string | null;
  authMode: ClawRegistryConnectionAuthMode;
  token?: string | null;
  tokenPlaceholder?: string | null;
  defaultSession?: string | null;
  commandHint?: string | null;
}

export interface ClawRegistryEntry {
  id: string;
  slug: string;
  name: string;
  kind: ClawRegistryKind;
  category: string;
  summary: string;
  description: string;
  tags: string[];
  capabilities: string[];
  searchTerms: string[];
  verified: boolean;
  featured: boolean;
  matchCount: number;
  activeAgents: number;
  region: string;
  latency: string;
  updatedAt: string;
  serviceModes: string[];
  bestFor: string[];
  integrations: string[];
  connection: ClawRegistryConnectionProfile;
}

export interface ClawRegistryDetail extends ClawRegistryEntry {
  owner: string;
  overview: string;
  trustHighlights: string[];
  matchingNotes: string[];
  onboarding: string[];
  docsUrl?: string;
  consoleUrl?: string | null;
  relatedIds: string[];
}

export interface ClawRegistryQuickConnectAction {
  kind: 'chat' | 'instance' | 'install';
  to: string;
  instanceId: string | null;
}

export interface ClawRegistryQuickConnectState {
  action: ClawRegistryQuickConnectAction;
  availableInstanceCount: number;
  gatewayReadyInstanceCount: number;
  recommendedInstanceId: string | null;
}

export type ClawCategory = ClawRegistryCategory;
export type ClawInstance = ClawRegistryEntry;
export type ClawDetailData = ClawRegistryDetail;

export type ProductType =
  | 'physical'
  | 'auction'
  | 'recharge'
  | 'content'
  | 'ai_image'
  | 'ai_video'
  | 'ai_music'
  | 'service'
  | 'coupon'
  | 'food'
  | 'software';

export interface BaseProduct {
  id: string;
  type: ProductType;
  name: string;
  description: string;
  price: string;
  coverImage?: string;
}

export interface PhysicalProduct extends BaseProduct {
  type: 'physical';
  stock: number;
  shippingCost: string;
}

export interface AuctionProduct extends BaseProduct {
  type: 'auction';
  currentBid: string;
  endTime: string;
  bidCount: number;
}

export interface RechargeProduct extends BaseProduct {
  type: 'recharge';
  provider: string;
  denominations: string[];
}

export interface ContentProduct extends BaseProduct {
  type: 'content';
  author: string;
  chapters: number;
  latestUpdate: string;
  category: string;
}

export interface AIGenerationProduct extends BaseProduct {
  type: 'ai_image' | 'ai_video' | 'ai_music';
  resolution?: string;
  duration?: string;
  format: string;
  deliveryTime: string;
}

export interface ServiceProduct extends BaseProduct {
  type: 'service';
  category: string;
}

export interface CouponProduct extends BaseProduct {
  type: 'coupon';
  discount: string;
  validUntil: string;
  merchant: string;
}

export interface FoodProduct extends BaseProduct {
  type: 'food';
  restaurant: string;
  deliveryTime: string;
  rating: number;
}

export interface SoftwareProduct extends BaseProduct {
  type: 'software';
  supportedTypes: string[];
  deploymentOptions: string[];
  features: string[];
}

export type ClawProduct =
  | PhysicalProduct
  | AuctionProduct
  | RechargeProduct
  | ContentProduct
  | AIGenerationProduct
  | ServiceProduct
  | CouponProduct
  | FoodProduct
  | SoftwareProduct;

export interface Review {
  id: string;
  user: string;
  avatar: string;
  rating: number;
  date: string;
  content: string;
}
