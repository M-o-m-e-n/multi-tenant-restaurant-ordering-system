import type {
  MenuDto,
  MenuItemDto,
  MenuLang,
  ModifierGroupDto,
  TranslatedText,
  Translations,
} from '@ros/shared';

/**
 * Menu text in the guest's language (ADR-037): the translation when there is
 * one, otherwise the restaurant's own wording. The server's `name` is kept on
 * orders, so only what the guest reads changes.
 */
function text<T extends { name: string; translations: Translations }>(
  row: T,
  lang: MenuLang,
): TranslatedText | undefined {
  return row.translations[lang];
}

function localizeGroup(group: ModifierGroupDto, lang: MenuLang): ModifierGroupDto {
  return {
    ...group,
    name: text(group, lang)?.name ?? group.name,
    items: group.items.map((o) => ({ ...o, name: text(o, lang)?.name ?? o.name })),
  };
}

export function localizeItem(item: MenuItemDto, lang: MenuLang): MenuItemDto {
  const t = text(item, lang);
  return {
    ...item,
    name: t?.name ?? item.name,
    description: t?.description ?? item.description,
    ...(item.modifierGroups
      ? { modifierGroups: item.modifierGroups.map((g) => localizeGroup(g, lang)) }
      : {}),
  };
}

export function localizeMenu(menu: MenuDto, lang: MenuLang): MenuDto {
  return {
    categories: menu.categories.map((c) => {
      const t = text(c, lang);
      return {
        ...c,
        name: t?.name ?? c.name,
        description: t?.description ?? c.description,
        items: c.items.map((i) => localizeItem(i, lang)),
      };
    }),
  };
}
