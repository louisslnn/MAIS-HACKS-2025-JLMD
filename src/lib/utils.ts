export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const result: string[] = [];

  inputs.forEach((input) => {
    if (!input) return;

    if (Array.isArray(input)) {
      const nested = cn(...input);
      if (nested) result.push(nested);
      return;
    }

    result.push(String(input));
  });

  return result.join(" ");
}
