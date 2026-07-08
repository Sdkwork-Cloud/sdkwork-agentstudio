import type { SdkworkAppClient, SdkworkAppConfig } from '@sdkwork/core-pc-react/app';
import type { AppSdkEnvelope } from './appSdkResult.ts';

export type { SdkworkAppClient, SdkworkAppConfig } from '@sdkwork/core-pc-react/app';

export interface PagePayload<T> {
  content?: T[];
  totalElements?: number | string;
  totalPages?: number | string;
  number?: number | string;
  size?: number | string;
  last?: boolean;
}

export interface SkillVO {
  id?: string | number;
  skillId?: string | number;
  skillKey?: string;
  name?: string;
  summary?: string;
  description?: string;
  descriptionMd?: string;
  categoryId?: string | number;
  categoryName?: string;
  authorName?: string;
  provider?: string;
  version?: string;
  installCount?: number | string;
  ratingAvg?: number | string;
  ratingCount?: number | string;
  repositoryUrl?: string;
  homepageUrl?: string;
  documentationUrl?: string;
  updatedAt?: string;
  latestPublishedAt?: string;
  icon?: string;
  tags?: string[];
}

export interface SkillPackageVO {
  packageId?: string | number;
  packageKey?: string;
  name?: string;
  summary?: string;
  description?: string;
  categoryId?: string | number;
  categoryName?: string;
  authorName?: string;
  installCount?: number | string;
  ratingAvg?: number | string;
  skills?: SkillVO[];
}

export interface SkillCategoryVO {
  id?: string | number;
  code?: string;
  name?: string;
  icon?: string;
}

export interface SkillReviewVO {
  reviewId?: string;
  userId?: string | number;
  userName?: string;
  rating?: number | string;
  comment?: string;
  createdAt?: string;
}

export type PageSkillVO = PagePayload<SkillVO>;

export interface OrderVO {
  orderId?: string;
  orderSn?: string;
  subject?: string;
  paidAmount?: number | string;
  totalAmount?: number | string;
  status?: string;
  statusName?: string;
  paymentProvider?: string;
  paymentMethod?: string;
  payTime?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVO {
  id?: string;
  title?: string;
  price?: number | string;
  sales?: number | string;
}

export type PageOrderVO = PagePayload<OrderVO>;
export type PageProductVO = PagePayload<ProductVO>;

export interface FeedbackVO {
  id?: string | number;
  type?: string;
  content?: string;
  status?: string;
  submitTime?: string;
  processTime?: string;
}

export interface FeedbackDetailVO extends FeedbackVO {
  contact?: string;
  attachmentUrl?: string;
  screenshotUrl?: string;
  followUps?: Array<{
    id?: string | number;
    feedbackId?: string | number;
    content?: string;
    attachmentUrl?: string;
    followUpTime?: string;
    follower?: string;
  }>;
}

export interface FaqCategoryVO {
  id?: string | number;
  name?: string;
  icon?: string;
  faqCount?: number | string;
}

export interface FaqVO {
  id?: string | number;
  question?: string;
  categoryId?: string | number;
  categoryName?: string;
  helpfulCount?: number | string;
  viewCount?: number | string;
}

export interface FaqDetailVO extends FaqVO {
  answer?: string;
}

export type PageFeedbackVO = PagePayload<FeedbackVO>;
export type PageFaqVO = PagePayload<FaqVO>;

export interface SupportInfoVO {
  hotline?: string;
  email?: string;
  workingHours?: string;
  wechatQrcode?: string;
  onlineSupportUrl?: string;
  faqUrl?: string;
  helpCenterUrl?: string;
}

export interface ClawStudioSkillClient {
  listCategories(): Promise<AppSdkEnvelope<SkillCategoryVO[]> | SkillCategoryVO[]>;
  list(params?: Record<string, unknown>): Promise<AppSdkEnvelope<PageSkillVO> | PageSkillVO>;
  detail(skillId: string | number): Promise<AppSdkEnvelope<SkillVO> | SkillVO>;
  listPackages(): Promise<AppSdkEnvelope<SkillPackageVO[]> | SkillPackageVO[]>;
  detailPackage(packageId: string | number): Promise<AppSdkEnvelope<SkillPackageVO> | SkillPackageVO>;
  listReviews(skillId: string | number): Promise<AppSdkEnvelope<SkillReviewVO[]> | SkillReviewVO[]>;
}

export interface ClawStudioOrderClient {
  listOrders(params?: Record<string, unknown>): Promise<AppSdkEnvelope<PageOrderVO> | PageOrderVO>;
}

export interface ClawStudioProductClient {
  getProducts(params?: Record<string, unknown>): Promise<AppSdkEnvelope<PageProductVO> | PageProductVO>;
}

export interface ClawStudioFeedbackClient {
  listFeedback(params?: Record<string, unknown>): Promise<AppSdkEnvelope<PageFeedbackVO> | PageFeedbackVO>;
  submit(body: Record<string, unknown>): Promise<AppSdkEnvelope<FeedbackVO> | FeedbackVO>;
  getFeedbackDetail(feedbackId: string | number): Promise<AppSdkEnvelope<FeedbackDetailVO> | FeedbackDetailVO>;
  followUp(
    feedbackId: string | number,
    body: Record<string, unknown>,
  ): Promise<AppSdkEnvelope<FeedbackDetailVO> | FeedbackDetailVO>;
  close(
    feedbackId: string | number,
    params?: Record<string, unknown>,
  ): Promise<AppSdkEnvelope<FeedbackDetailVO> | FeedbackDetailVO>;
  listFaqCategories(): Promise<AppSdkEnvelope<FaqCategoryVO[]> | FaqCategoryVO[]>;
  listFaqs(params?: Record<string, unknown>): Promise<AppSdkEnvelope<PageFaqVO> | PageFaqVO>;
  searchFaqs(params?: Record<string, unknown>): Promise<AppSdkEnvelope<FaqVO[]> | FaqVO[]>;
  getFaqDetail(faqId: string | number): Promise<AppSdkEnvelope<FaqDetailVO> | FaqDetailVO>;
  getSupportInfo(): Promise<AppSdkEnvelope<SupportInfoVO> | SupportInfoVO>;
}

export interface ClawStudioRemoteAppClient extends SdkworkAppClient {
  account?: unknown;
  category?: unknown;
  comment?: unknown;
  feedback?: ClawStudioFeedbackClient;
  feed?: unknown;
  order?: ClawStudioOrderClient;
  product?: ClawStudioProductClient;
  skill?: ClawStudioSkillClient;
  user?: unknown;
}
