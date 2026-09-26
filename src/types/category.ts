export type CategoryImage = {
  publicId: string;
  url: string;
  alt?: string;
};

export type CategoryResponse = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: CategoryImage | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateCategoryInput = {
  name: string;
  slug?: string;
  description?: string;
  image?: CategoryImage;
  isActive?: boolean;
  sortOrder?: number;
};

export type UpdateCategoryInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  image?: CategoryImage | null;
  isActive?: boolean;
  sortOrder?: number;
};
