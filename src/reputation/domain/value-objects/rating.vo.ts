export class Rating {
  private readonly value: number;

  constructor(rating: number) {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
    if (!Number.isInteger(rating)) {
      throw new Error('Rating must be an integer');
    }
    this.value = rating;
  }

  getValue(): number {
    return this.value;
  }

  equals(other: Rating): boolean {
    return this.value === other.value;
  }

  isExcellent(): boolean {
    return this.value === 5;
  }

  isGood(): boolean {
    return this.value >= 4;
  }

  isAverage(): boolean {
    return this.value === 3;
  }

  isPoor(): boolean {
    return this.value <= 2;
  }
}
