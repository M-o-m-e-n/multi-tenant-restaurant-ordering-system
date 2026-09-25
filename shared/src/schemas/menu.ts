import { z } from 'zod';

import { cents, nonNegativeCents } from './common';

/** `HH:MM`, 24-hour, restaurant-local (MENU-06 schedule windows). */
export const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be a time in HH:MM form');

const name = (max: number) => z.string().trim().min(1).max(max);

export const createCategorySchema = z
  .object({
    name: name(80),
    description: z.string().trim().max(255).nullish(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial().strict();
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;

const itemShape = {
  categoryId: z.string().uuid(),
  name: name(120),
  description: z.string().trim().max(500).nullish(),
  price: nonNegativeCents.max(1_000_000),
  imageUrl: z.string().trim().url().max(500).nullish(),
  allergens: z.array(z.string().trim().min(1).max(30)).max(14).optional(),
  station: z.string().trim().min(1).max(40).nullish(),
  availableFrom: clockTime.nullish(),
  availableTo: clockTime.nullish(),
};

export const createItemSchema = z
  .object(itemShape)
  .strict()
  .refine((i) => ((i.availableFrom ?? null) === null) === ((i.availableTo ?? null) === null), {
    path: ['availableTo'],
    message: 'Set both ends of the schedule window, or neither.',
  });
export type CreateItemDto = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object(itemShape).partial().strict();
export type UpdateItemDto = z.infer<typeof updateItemSchema>;

/** PATCH /staff/menu/items/:id/availability — the 86 toggle (MENU-03, AC-7). */
export const availabilitySchema = z.object({ isAvailable: z.boolean() }).strict();
export type AvailabilityDto = z.infer<typeof availabilitySchema>;

export const modifierGroupSchema = z
  .object({
    name: name(80),
    minSelect: z.number().int().min(0).max(20),
    maxSelect: z.number().int().min(1).max(20),
  })
  .strict()
  .refine((g) => g.maxSelect >= g.minSelect, {
    path: ['maxSelect'],
    message: 'must be at least minSelect',
  });
export type ModifierGroupInput = z.infer<typeof modifierGroupSchema>;

export const updateModifierGroupSchema = z
  .object({
    name: name(80).optional(),
    minSelect: z.number().int().min(0).max(20).optional(),
    maxSelect: z.number().int().min(1).max(20).optional(),
  })
  .strict();
export type UpdateModifierGroupDto = z.infer<typeof updateModifierGroupSchema>;

export const modifierItemSchema = z
  .object({
    name: name(80),
    // Cents; may be negative ("no bun").
    priceDelta: cents.min(-100_000).max(100_000),
    isAvailable: z.boolean().optional(),
  })
  .strict();
export type ModifierItemInput = z.infer<typeof modifierItemSchema>;

export const updateModifierItemSchema = modifierItemSchema.partial().strict();

export const attachGroupSchema = z
  .object({
    modifierGroupId: z.string().uuid(),
    sortOrder: z.number().int().min(0).max(100).optional(),
  })
  .strict();
export type AttachGroupDto = z.infer<typeof attachGroupSchema>;

export const groupItemParamsSchema = z
  .object({ id: z.string().uuid(), itemId: z.string().uuid() })
  .strict();
export const itemGroupParamsSchema = z
  .object({ id: z.string().uuid(), groupId: z.string().uuid() })
  .strict();

// ---- Response shapes (API-CONTRACT §9) ----

export interface ModifierItemDto {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
}

export interface ModifierGroupDto {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  items: ModifierItemDto[];
}

export interface MenuItemDto {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  /** False means 86'd: shown as sold out, never omitted (MENU-05). */
  isAvailable: boolean;
  allergens: string[];
  station: string | null;
  availableFrom: string | null;
  availableTo: string | null;
  /** How many modifier groups the item offers; the groups come from the detail endpoint. */
  modifierGroupCount: number;
  modifierGroups?: ModifierGroupDto[];
}

export interface MenuCategoryDto {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  items: MenuItemDto[];
}

export interface MenuDto {
  categories: MenuCategoryDto[];
}

/** Admin view: includes inactive rows so they can be restored. */
export interface AdminMenuDto {
  categories: (MenuCategoryDto & {
    isActive: boolean;
    items: (MenuItemDto & { isActive: boolean })[];
  })[];
  modifierGroups: (ModifierGroupDto & { isActive: boolean })[];
}

/** One chosen modifier as snapshotted onto an order line (LLD §2.2 modifiersJson). */
export interface ModifierSnapshot {
  groupId: string;
  groupName: string;
  items: { id: string; name: string; priceDelta: number }[];
}
