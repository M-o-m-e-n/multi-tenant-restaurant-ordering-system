import type { Messages } from '../../i18n';

/** Which dictionary line explains a problem with each checkout field. */
const FIELD: Readonly<Record<string, keyof Messages['checkout']['field']>> = {
  'customer.name': 'name',
  'customer.phone': 'phone',
  'delivery.address': 'address',
  'delivery.note': 'addressNote',
};

/**
 * A checkout validation issue as a sentence in the reader's language. The
 * shared Zod schema is the rule (the server runs the same one); only the
 * words are chosen here, by the field the issue points at (M14-S4).
 * @returns null when the field has no specific message
 */
export function fieldMessage(
  t: Messages,
  path: readonly (string | number)[] | undefined,
): string | null {
  const key = path ? FIELD[path.join('.')] : undefined;
  return key ? t.checkout.field[key] : null;
}
