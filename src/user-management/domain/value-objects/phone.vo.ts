export class Phone {
  private readonly value: string;

  constructor(phone: string) {
    if (!this.isValid(phone)) {
      throw new Error('Invalid phone format');
    }
    this.value = phone.trim();
  }

  private isValid(phone: string): boolean {
    // Basic validation - adjust based on your needs
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }
}

