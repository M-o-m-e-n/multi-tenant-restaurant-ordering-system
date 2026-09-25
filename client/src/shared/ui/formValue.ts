/** A text field from a submitted form; file inputs and missing fields read as ''. */
export function formValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
