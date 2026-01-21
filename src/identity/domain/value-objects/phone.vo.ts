/**
 * Phone value object.
 * Validates E.164 format (e.g., +5492944123456)
 */
export class Phone {
  private readonly value: string;

  constructor(phone: string) {
    if (!this.isValid(phone)) {
      throw new Error('Invalid phone format. Must be in E.164 format (e.g., +5492944123456)');
    }
    this.value = phone.trim();
  }

  private isValid(phone: string): boolean {
    // E.164 format: + followed by 1-15 digits
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone.trim());
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }
}

